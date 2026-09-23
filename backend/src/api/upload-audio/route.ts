import type { AppRequest } from "@/lib/http";
import { mkdir, writeFile } from "fs/promises";
import { createHash } from "crypto";
import path from "path";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { assertRateLimit, RateLimitError } from "@/lib/services/rate-limit";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

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
        if (!file.type.startsWith("audio/")) {
            return jsonError("Только аудио", 400);
        }

        await mkdir(UPLOAD_DIR, { recursive: true });
        const buffer = Buffer.from(await file.arrayBuffer());
        const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 16);
        const ext = file.type.includes("ogg")
            ? "ogg"
            : file.type.includes("mp4")
                ? "m4a"
                : "webm";
        const filename = `voice-${Date.now()}-${hash}.${ext}`;
        await writeFile(path.join(UPLOAD_DIR, filename), buffer);

        return jsonOk({ url: `/uploads/${filename}` });
    } catch (e) {
        if (e instanceof RateLimitError) return jsonError(e.message, 429);
        return handleApiError(e);
    }
}