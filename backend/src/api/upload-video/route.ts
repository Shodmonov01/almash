import type { AppRequest } from "@/lib/http";
import { mkdir, writeFile } from "fs/promises";
import { createHash } from "crypto";
import path from "path";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { writeAudit } from "@/lib/utils";
import { assertRateLimit, RateLimitError } from "@/lib/services/rate-limit";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

const EXT_BY_TYPE: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

/** Listing / chat / dispute-evidence video (TZ §4, §13, §21). */
export async function POST(req: AppRequest) {
  try {
    const user = await requireUser();
    await assertRateLimit(user.id, "upload");

    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return jsonError("file обязателен", 400);
    }
    if (file.size > MAX_VIDEO_BYTES) {
      return jsonError("Видео до 50 МБ", 400);
    }
    const ext = EXT_BY_TYPE[file.type];
    if (!ext) {
      return jsonError("Только видео MP4, WebM или MOV", 400);
    }

    await mkdir(UPLOAD_DIR, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 32);
    const filename = `video-${Date.now()}-${hash}.${ext}`;
    await writeFile(path.join(UPLOAD_DIR, filename), buffer);

    await writeAudit({
      userId: user.id,
      action: "VIDEO_UPLOADED",
      meta: { hash, size: file.size },
    });

    return jsonOk({ url: `/uploads/${filename}`, hash });
  } catch (e) {
    if (e instanceof RateLimitError) return jsonError(e.message, 429);
    return handleApiError(e);
  }
}
