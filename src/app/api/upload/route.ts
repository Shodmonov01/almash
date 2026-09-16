import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { assertRateLimit, RateLimitError } from "@/lib/services/rate-limit";
import {
  findDuplicatePhotos,
  watermarkAndStore,
} from "@/lib/services/media";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/utils";
import { computeRiskScore } from "@/lib/antifraud";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    await assertRateLimit(user.id, "upload");

    const form = await req.formData();
    const file = form.get("file");
    const itemId = String(form.get("itemId") || "draft");
    const sortOrder = Number(form.get("sortOrder") || 0);

    if (!(file instanceof File)) {
      return jsonError("file обязателен", 400);
    }
    if (file.size > 8 * 1024 * 1024) {
      return jsonError("Максимум 8 МБ", 400);
    }
    if (!file.type.startsWith("image/")) {
      return jsonError("Только изображения", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await watermarkAndStore({ buffer, itemId, sortOrder });

    // Duplicate detection across accounts
    const dupes = await findDuplicatePhotos(stored.phash, user.id);
    if (dupes.length > 0) {
      await prisma.moderationQueue.create({
        data: {
          type: "DUPLICATE_PHOTO",
          userId: user.id,
          itemId: itemId !== "draft" ? itemId : null,
          mediaHash: stored.phash,
          detail: JSON.stringify(
            dupes.slice(0, 5).map((d) => ({
              itemId: d.item.id,
              ownerId: d.item.ownerId,
              title: d.item.title,
            })),
          ),
          score: computeRiskScore({
            isNewAccount: true,
            duplicatePhotos: true,
          }),
        },
      });
      await prisma.riskEvent.create({
        data: {
          userId: user.id,
          type: "DUPLICATE_PHOTO",
          score: 35,
          detail: `phash=${stored.phash} matches=${dupes.length}`,
        },
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { riskScoreCached: { increment: 15 } },
      });
    }

    await writeAudit({
      userId: user.id,
      action: "MEDIA_UPLOADED",
      meta: { hash: stored.hash, phash: stored.phash, dupes: dupes.length },
    });

    return jsonOk({
      url: stored.url,
      hash: stored.hash,
      phash: stored.phash,
      watermarked: true,
      duplicateWarning: dupes.length > 0,
      duplicates: dupes.length,
    });
  } catch (e) {
    if (e instanceof RateLimitError) return jsonError(e.message, 429);
    return handleApiError(e);
  }
}
