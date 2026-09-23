import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { prisma } from "@/lib/db";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
/** Un-watermarked originals; not served publicly. */
const ORIGINAL_DIR = path.join(process.cwd(), "uploads-original");

function uploadFilename(url: string): string | null {
  if (!url.startsWith("/uploads/")) return null;
  const name = path.basename(url);
  return /^[\w.-]+$/.test(name) ? name : null;
}

/** Keep the original upload so the listing can be re-watermarked with its real ID. */
export async function storeOriginal(url: string, buffer: Buffer) {
  const name = uploadFilename(url);
  if (!name) return;
  await mkdir(ORIGINAL_DIR, { recursive: true });
  await writeFile(path.join(ORIGINAL_DIR, name), buffer);
}

/** Original bytes for an uploaded photo (falls back to the public copy). */
export async function loadUploadedPhoto(url: string): Promise<Buffer | null> {
  const name = uploadFilename(url);
  if (!name) return null;
  for (const dir of [ORIGINAL_DIR, UPLOAD_DIR]) {
    try {
      return await readFile(path.join(dir, name));
    } catch {
      // try next location
    }
  }
  return null;
}

/** Average-hash style perceptual fingerprint for near-duplicate detection. */
export async function computePhash(buffer: Buffer): Promise<string> {
  const raw = await sharp(buffer)
      .greyscale()
      .resize(8, 8, { fit: "fill" })
      .raw()
      .toBuffer();

  const avg = raw.reduce((a, b) => a + b, 0) / raw.length;
  let bits = "";
  for (const v of raw) bits += v >= avg ? "1" : "0";
  // pack to hex
  let hex = "";
  for (let i = 0; i < 64; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    const x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    dist += [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4][x] ?? 4;
  }
  return dist;
}

export function contentHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 32);
}

export async function watermarkAndStore(params: {
  buffer: Buffer;
  itemId: string;
  sortOrder: number;
}): Promise<{
  url: string;
  hash: string;
  phash: string;
  width: number;
  height: number;
}> {
  await mkdir(UPLOAD_DIR, { recursive: true });

  const hash = contentHash(params.buffer);
  const phash = await computePhash(params.buffer);
  const meta = await sharp(params.buffer).metadata();

  const resizedBuffer = await sharp(params.buffer)
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .toBuffer();
  const resizedMeta = await sharp(resizedBuffer).metadata();

  const baseWidth = resizedMeta.width ?? 600;
  // Wide enough for the full listing ID, never wider than the photo itself
  const wmWidth = Math.min(baseWidth, 640, Math.max(280, Math.round(baseWidth * 0.5)));
  const wmHeight = Math.max(22, Math.round(wmWidth * 0.08));
  const label = `Retoy · ID ${params.itemId}`;
  // Fit the full listing ID into the badge (TZ §36: watermark + listing ID).
  const fontSize = Math.max(
    8,
    Math.round(Math.min(wmHeight * 0.45, (wmWidth - 24) / (label.length * 0.55))),
  );

  const labeled = await sharp(resizedBuffer)
      .composite([
        {
          input: Buffer.from(
              `<svg width="${wmWidth}" height="${wmHeight}">
            <rect width="${wmWidth}" height="${wmHeight}" fill="rgba(15,61,49,0.45)"/>
            <text x="12" y="${Math.round(wmHeight * 0.65)}" font-size="${fontSize}" font-family="Arial" fill="rgba(255,255,255,0.9)">
              ${label}
            </text>
          </svg>`,
          ),
          gravity: "southeast",
        },
      ])
      .jpeg({ quality: 85 })
      .toBuffer();

  const filename = `${params.itemId}-${params.sortOrder}-${hash}.jpg`;
  const abs = path.join(UPLOAD_DIR, filename);
  await writeFile(abs, labeled);

  return {
    url: `/uploads/${filename}`,
    hash,
    phash,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
  };
}

/** Find near-duplicate photos across other owners. */
export async function findDuplicatePhotos(phash: string, ownerId: string) {
  const candidates = await prisma.itemMedia.findMany({
    where: {
      phash: { not: null },
      item: { ownerId: { not: ownerId } },
    },
    include: {
      item: { select: { id: true, ownerId: true, title: true, status: true } },
    },
    take: 500,
  });

  return candidates.filter(
      (c) => c.phash && hammingDistance(phash, c.phash) <= 8,
  );
}