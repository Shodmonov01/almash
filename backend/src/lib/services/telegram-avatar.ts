import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { prisma } from "@/lib/db";

const AVATAR_DIR = path.join(process.cwd(), "uploads", "avatars");
/** Filename prefix of photos the user uploaded themselves (see /api/me/avatar). */
export const CUSTOM_AVATAR_PREFIX = "u_";
const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 5 * 1024 * 1024;

function apiBase() {
  return (process.env.TELEGRAM_API_BASE || "https://api.telegram.org").replace(/\/$/, "");
}

async function fetchWithTimeout(url: string) {
  return fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

async function download(url: string): Promise<Buffer | null> {
  const res = await fetchWithTimeout(url);
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.length > 0 && buf.length <= MAX_BYTES ? buf : null;
}

/**
 * Current profile photo through the Bot API. The file URL contains the bot
 * token, so the image is always downloaded server-side and never exposed.
 */
async function photoViaBot(telegramId: string): Promise<Buffer | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  const photosRes = await fetchWithTimeout(
    `${apiBase()}/bot${token}/getUserProfilePhotos?user_id=${encodeURIComponent(telegramId)}&limit=1`,
  );
  const photos = (await photosRes.json().catch(() => null)) as {
    ok?: boolean;
    result?: { photos?: { file_id: string; width: number }[][] };
  } | null;
  const sizes = photos?.ok ? photos.result?.photos?.[0] : undefined;
  if (!sizes?.length) return null;
  // pick the smallest size that is still >= 320px, else the largest one
  const sorted = [...sizes].sort((a, b) => a.width - b.width);
  const size = sorted.find((s) => s.width >= 320) ?? sorted[sorted.length - 1];

  const fileRes = await fetchWithTimeout(
    `${apiBase()}/bot${token}/getFile?file_id=${encodeURIComponent(size.file_id)}`,
  );
  const file = (await fileRes.json().catch(() => null)) as {
    ok?: boolean;
    result?: { file_path?: string };
  } | null;
  const filePath = file?.ok ? file.result?.file_path : undefined;
  if (!filePath) return null;
  return download(`${apiBase()}/file/bot${token}/${filePath}`);
}

/**
 * Put the user's Telegram profile photo as their avatar (stored locally).
 * Never throws: a missing/hidden photo simply leaves the avatar as is.
 */
export async function syncTelegramAvatar(params: {
  userId: string;
  telegramId: string;
  photoUrl?: string;
}) {
  try {
    // A photo the user picked in the profile wins over the Telegram one.
    const current = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { avatarUrl: true },
    });
    if (current?.avatarUrl?.startsWith(`/uploads/avatars/${CUSTOM_AVATAR_PREFIX}`)) return;

    let image = await photoViaBot(params.telegramId).catch(() => null);
    if (!image && params.photoUrl?.startsWith("https://")) {
      image = await download(params.photoUrl).catch(() => null);
    }
    if (!image) return;

    const jpeg = await sharp(image)
      .rotate()
      .resize(256, 256, { fit: "cover" })
      .jpeg({ quality: 85 })
      .toBuffer();
    await mkdir(AVATAR_DIR, { recursive: true });
    const filename = `tg_${params.userId}.jpg`;
    await writeFile(path.join(AVATAR_DIR, filename), jpeg);
    await prisma.user.update({
      where: { id: params.userId },
      // version query busts browser caches when the photo changes
      data: { avatarUrl: `/uploads/avatars/${filename}?v=${Date.now()}` },
    });
  } catch (e) {
    console.warn("telegram avatar sync failed:", e instanceof Error ? e.message : e);
  }
}
