import type { AppRequest } from "@/lib/http";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser, requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { computeRiskScore, MONEY_REASONS, scanContent } from "@/lib/antifraud";
import {
  findDuplicatePhotos,
  loadUploadedPhoto,
  watermarkAndStore,
} from "@/lib/services/media";
import { parseJsonArray, writeAudit } from "@/lib/utils";
import { CONDITIONS } from "@/lib/constants";
import { rankFeedForUser } from "@/lib/services/matching";
import {
  assertCanTransact,
  assertRateLimit,
  RateLimitError,
} from "@/lib/services/rate-limit";
import {
  findDuplicateDescriptions,
  findForbiddenCategory,
  refreshUserRisk,
} from "@/lib/services/risk";

export async function GET(req: AppRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";
    const category = searchParams.get("category") || "";
    const subcategory = searchParams.get("subcategory") || "";
    const brand = searchParams.get("brand") || "";
    const condition = searchParams.get("condition") || "";
    const city = searchParams.get("city") || "";
    const ownerId = searchParams.get("ownerId") || "";
    const feed = searchParams.get("feed") || "new";
    const meCity = searchParams.get("meCity") || "";
    const meId = searchParams.get("meId") || "";
    const district = searchParams.get("district") || "";
    const ageParam = searchParams.get("age");
    const age = ageParam ? Number(ageParam) : NaN;
    const inSet = searchParams.get("inSet") === "1";
    const limit = Math.min(Number(searchParams.get("limit") || 24), 50);

    const where: Record<string, unknown> = {
      status: { in: ["ACTIVE", "IN_TRADE"] },
    };

    if (ownerId) {
      where.ownerId = ownerId;
      delete (where as { status?: unknown }).status;
      where.status = { notIn: ["BLOCKED"] };
    }
    if (category) where.category = category;
    if (subcategory) where.subcategory = subcategory;
    if (brand) where.brand = { contains: brand };
    if (condition) where.condition = condition;
    if (city) where.city = city;
    if (district) where.district = district;
    if (feed === "nearby" && meCity) where.city = meCity;
    if (inSet) where.setItems = { some: {} };

    const and: Record<string, unknown>[] = [];
    if (Number.isFinite(age)) {
      // Item's age range must include the requested age (open-ended ranges allowed)
      and.push({ OR: [{ ageFrom: null }, { ageFrom: { lte: age } }] });
      and.push({ OR: [{ ageTo: null }, { ageTo: { gte: age } }] });
    }
    if (q) {
      and.push({
        OR: [
          { title: { contains: q } },
          { description: { contains: q } },
          { brand: { contains: q } },
          { model: { contains: q } },
          { subcategory: { contains: q } },
          { tags: { contains: q } },
        ],
      });
    }
    if (and.length) where.AND = and;

    let items = await prisma.item.findMany({
      where,
      include: {
        media: { orderBy: { sortOrder: "asc" } },
        owner: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            rating: true,
            completedTrades: true,
            trustLevel: true,
            city: true,
            district: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: feed === "for_me" ? 80 : limit * 2,
    });

    if (feed === "for_me") {
      const session = meId || (await getSessionUser())?.id;
      if (session) {
        const myItems = await prisma.item.findMany({
          where: { ownerId: session, status: { in: ["ACTIVE", "IN_TRADE"] } },
        });
        const ranked = rankFeedForUser(
          myItems,
          items.filter((i) => i.ownerId !== session),
        );
        const sliced = ranked.slice(0, limit);
        return jsonOk({
          items: sliced.map((it) => ({
            ...it,
            wantCategories: parseJsonArray(it.wantCategories),
            wantBrands: parseJsonArray(it.wantBrands),
            tags: parseJsonArray(it.tags),
            matchScore: it.matchScore,
            matchReasons: it.matchReasons,
          })),
        });
      }
    }

    items = items.slice(0, limit);

    return jsonOk({
      items: items.map((it) => ({
        ...it,
        wantCategories: parseJsonArray(it.wantCategories),
        wantBrands: parseJsonArray(it.wantBrands),
        tags: parseJsonArray(it.tags),
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

const createSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(4000),
  category: z.string().min(1),
  subcategory: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  ageFrom: z.number().int().min(0).max(18).optional(),
  ageTo: z.number().int().min(0).max(18).optional(),
  condition: z.enum(CONDITIONS as unknown as [string, ...string[]]),
  completeness: z.string().optional(),
  hasDamage: z.boolean().optional(),
  damageNotes: z.string().optional(),
  missingParts: z.string().optional(),
  isOriginal: z.boolean().optional(),
  size: z.string().optional(),
  color: z.string().optional(),
  city: z.string().min(1),
  district: z.string().optional(),
  radiusKm: z.number().int().min(1).max(100).optional(),
  wantType: z.enum(["SPECIFIC", "CATEGORY", "BRAND", "ANY"]).optional(),
  wantText: z.string().optional(),
  wantCategories: z.array(z.string()).optional(),
  wantBrands: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  defectsConfirmed: z.literal(true),
  serialNumber: z.string().optional(),
  photos: z.array(z.string()).min(2).max(10),
  videoUrl: z
    .string()
    .regex(/^\/uploads\/video-[\w.-]+$/, "Загрузите видео через форму")
    .optional(),
});

export async function POST(req: AppRequest) {
  try {
    const user = await requireUser();
    await assertRateLimit(user.id, "create_item");
    const { user: dbUser, risk } = await assertCanTransact(user.id, "item");

    const body = createSchema.parse(await req.json());
    const text = [
      body.title,
      body.description,
      body.wantText,
      body.completeness,
      body.damageNotes,
      body.missingParts,
      ...(body.tags ?? []),
    ]
      .filter(Boolean)
      .join("\n");
    const flag = scanContent(text);
    if (flag.blocked && flag.reasons.some((r) => MONEY_REASONS.has(r))) {
      await prisma.riskEvent.create({
        data: {
          userId: user.id,
          type: "MONEY_IN_LISTING",
          score: 40,
          detail: flag.reasons.join(", "),
        },
      });
      await prisma.moderationQueue.create({
        data: {
          type: "MONEY_LISTING",
          userId: user.id,
          detail: flag.reasons.join(", "),
          score: 40,
        },
      });
      return jsonError(flag.message, 400, { reasons: flag.reasons });
    }

    const forbiddenHit = await findForbiddenCategory(
      [text, body.category, body.subcategory, body.brand, body.model].join("\n"),
    );
    if (forbiddenHit) {
      return jsonError(`Категория запрещена: ${forbiddenHit}`, 400);
    }

    const photoBuffers: Buffer[] = [];
    for (const url of body.photos) {
      const buf = await loadUploadedPhoto(url);
      if (!buf) {
        return jsonError("Фото не найдено — загрузите его заново", 400);
      }
      photoBuffers.push(buf);
    }

    const item = await prisma.item.create({
      data: {
        ownerId: user.id,
        title: body.title,
        description: body.description,
        category: body.category,
        subcategory: body.subcategory,
        brand: body.brand,
        model: body.model,
        ageFrom: body.ageFrom,
        ageTo: body.ageTo,
        condition: body.condition,
        completeness: body.completeness,
        hasDamage: body.hasDamage ?? false,
        damageNotes: body.damageNotes,
        missingParts: body.missingParts,
        isOriginal: body.isOriginal ?? true,
        size: body.size,
        color: body.color,
        city: body.city,
        district: body.district,
        radiusKm: body.radiusKm ?? 10,
        wantType: body.wantType ?? "ANY",
        wantText: body.wantText ?? "Рассмотрю любые предложения",
        wantCategories: JSON.stringify(body.wantCategories ?? []),
        wantBrands: JSON.stringify(body.wantBrands ?? []),
        tags: JSON.stringify(body.tags ?? []),
        defectsConfirmed: true,
        serialNumber: body.serialNumber,
        // Suspicious text or a high-risk account → manual moderation (TZ §33, §35)
        status: flag.blocked || risk.highRisk ? "PENDING_MODERATION" : "ACTIVE",
        media: {
          create: [
            ...(body.videoUrl
              ? [
                  {
                    type: "VIDEO",
                    url: body.videoUrl,
                    hash: `video-${Date.now()}`,
                    sortOrder: 99,
                  },
                ]
              : []),
          ],
        },
      },
      include: { media: true },
    });

    // Re-watermark with the real listing ID and keep content/perceptual hashes
    // so duplicate-photo detection (TZ §36–37) has something to compare against.
    let duplicateCount = 0;
    for (const [i, buffer] of photoBuffers.entries()) {
      const stored = await watermarkAndStore({
        buffer,
        itemId: item.id,
        sortOrder: i,
      });
      await prisma.itemMedia.create({
        data: {
          itemId: item.id,
          type: "PHOTO",
          url: stored.url,
          hash: stored.hash,
          phash: stored.phash,
          sortOrder: i,
        },
      });
      const dupes = await findDuplicatePhotos(stored.phash, user.id);
      if (dupes.length) {
        duplicateCount += dupes.length;
        await prisma.moderationQueue.create({
          data: {
            type: "DUPLICATE_PHOTO",
            userId: user.id,
            itemId: item.id,
            mediaHash: stored.phash,
            detail: JSON.stringify(
              dupes.slice(0, 5).map((d) => ({
                itemId: d.item.id,
                ownerId: d.item.ownerId,
                title: d.item.title,
              })),
            ),
            score: computeRiskScore({
              isNewAccount: dbUser.completedTrades === 0,
              duplicatePhotos: true,
            }),
          },
        });
      }
    }
    if (duplicateCount) {
      await prisma.riskEvent.create({
        data: {
          userId: user.id,
          type: "DUPLICATE_PHOTO",
          score: 35,
          detail: `item=${item.id} matches=${duplicateCount}`,
        },
      });
    }

    // TZ §33: identical descriptions on other accounts
    const sameText = await findDuplicateDescriptions({
      description: body.description,
      ownerId: user.id,
      excludeItemId: item.id,
    });
    if (sameText.length) {
      await prisma.riskEvent.create({
        data: {
          userId: user.id,
          type: "DUPLICATE_DESCRIPTION",
          score: 30,
          detail: `item=${item.id} matches=${sameText.length}`,
        },
      });
      await prisma.moderationQueue.create({
        data: {
          type: "DUPLICATE_DESCRIPTION",
          userId: user.id,
          itemId: item.id,
          score: 30,
          detail: JSON.stringify(
            sameText.slice(0, 5).map((d) => ({
              itemId: d.id,
              ownerId: d.ownerId,
              title: d.title,
            })),
          ),
        },
      });
    }
    if (duplicateCount || sameText.length) await refreshUserRisk(user.id);

    await writeAudit({
      userId: user.id,
      action: "ITEM_CREATED",
      meta: { itemId: item.id, status: item.status },
    });

    return jsonOk({ item }, { status: 201 });
  } catch (e) {
    if (e instanceof RateLimitError) return jsonError(e.message, 429);
    const err = e as Error & { status?: number };
    if (err.status) return jsonError(err.message, err.status);
    return handleApiError(e);
  }
}
