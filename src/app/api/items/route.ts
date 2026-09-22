import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser, requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { scanContent } from "@/lib/antifraud";
import { parseJsonArray, writeAudit } from "@/lib/utils";
import { CONDITIONS } from "@/lib/constants";
import { rankFeedForUser } from "@/lib/services/matching";
import {
  assertCanTransact,
  assertRateLimit,
  RateLimitError,
} from "@/lib/services/rate-limit";

export async function GET(req: NextRequest) {
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
    if (feed === "nearby" && meCity) where.city = meCity;

    if (q) {
      where.OR = [
        { title: { contains: q } },
        { description: { contains: q } },
        { brand: { contains: q } },
        { tags: { contains: q } },
      ];
    }

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
  ageFrom: z.number().int().optional(),
  ageTo: z.number().int().optional(),
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
  videoUrl: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    await assertRateLimit(user.id, "create_item");
    await assertCanTransact(user.id);

    const body = createSchema.parse(await req.json());
    const text = `${body.title}\n${body.description}\n${body.wantText || ""}`;
    const flag = scanContent(text);
    if (
      flag.blocked &&
      flag.reasons.some((r) =>
        [
          "оплата",
          "доплата",
          "сумма",
          "валюта",
          "карта",
          "перевод денег",
          "продажа",
        ].includes(r),
      )
    ) {
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

    const forbidden = await prisma.forbiddenCategory.findMany({
      where: { enabled: true },
    });
    const lower = text.toLowerCase();
    for (const f of forbidden) {
      if (lower.includes(f.name.toLowerCase())) {
        return jsonError(`Категория запрещена: ${f.name}`, 400);
      }
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
        status: flag.blocked ? "PENDING_MODERATION" : "ACTIVE",
        media: {
          create: [
            ...body.photos.map((url, i) => ({
              type: "PHOTO",
              url,
              hash: `upload-${Date.now()}-${i}`,
              sortOrder: i,
            })),
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
