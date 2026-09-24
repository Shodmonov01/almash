import type { AppRequest } from "@/lib/http";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/db";
import { assertRateLimit, RateLimitError } from "@/lib/services/rate-limit";
import { CUSTOM_AVATAR_PREFIX } from "@/lib/services/telegram-avatar";
import { contentHash } from "@/lib/services/media";
import { writeAudit } from "@/lib/utils";

const AVATAR_DIR = path.join(process.cwd(), "uploads", "avatars");

/**
 * Profile photo picked by the user. Unlike listing photos it is not
 * watermarked or checked for duplicates — just square-cropped to 512px.
 */
export async function POST(req: AppRequest) {
  try {
    const user = await requireUser();
    await assertRateLimit(user.id, "upload");

    const form = await req.formData();
    const file = form.get("file");
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
    let jpeg: Buffer;
    try {
      jpeg = await sharp(buffer)
        .rotate()
        .resize(512, 512, { fit: "cover" })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch {
      return jsonError("Не удалось прочитать изображение", 400);
    }

    await mkdir(AVATAR_DIR, { recursive: true });
    const filename = `${CUSTOM_AVATAR_PREFIX}${user.id}-${contentHash(jpeg)}.jpg`;
    await writeFile(path.join(AVATAR_DIR, filename), jpeg);

    const avatarUrl = `/uploads/avatars/${filename}`;
    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl },
    });
    await writeAudit({ userId: user.id, action: "AVATAR_UPDATED" });

    return jsonOk({ avatarUrl });
  } catch (e) {
    if (e instanceof RateLimitError) return jsonError(e.message, 429);
    return handleApiError(e);
  }
}
