import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { prisma } from "@/lib/db";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

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

  const labeled = await sharp(params.buffer)
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .composite([
      {
        input: Buffer.from(
          `<svg width="600" height="60">
            <rect width="600" height="60" fill="rgba(15,61,49,0.45)"/>
            <text x="16" y="38" font-size="22" font-family="Arial" fill="rgba(255,255,255,0.9)">
              SwapToy · ${params.itemId.slice(0, 8)}
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
