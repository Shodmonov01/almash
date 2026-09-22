import { prisma } from "@/lib/db";

const WINDOWS: Record<string, { limit: number; windowMs: number }> = {
  create_item: { limit: 10, windowMs: 60 * 60 * 1000 },
  create_offer: { limit: 20, windowMs: 60 * 60 * 1000 },
  send_message: { limit: 60, windowMs: 10 * 60 * 1000 },
  report: { limit: 15, windowMs: 60 * 60 * 1000 },
  upload: { limit: 40, windowMs: 60 * 60 * 1000 },
  login: { limit: 30, windowMs: 15 * 60 * 1000 },
  register: { limit: 10, windowMs: 60 * 60 * 1000 },
};

export async function assertRateLimit(
  userId: string,
  action: keyof typeof WINDOWS,
): Promise<void> {
  const cfg = WINDOWS[action];
  const key = `${action}:${userId}`;
  const now = Date.now();

  const bucket = await prisma.rateLimitBucket.findUnique({ where: { key } });
  if (!bucket) {
    await prisma.rateLimitBucket.create({
      data: { key, count: 1, windowStart: new Date(now) },
    });
    return;
  }

  const elapsed = now - bucket.windowStart.getTime();
  if (elapsed > cfg.windowMs) {
    await prisma.rateLimitBucket.update({
      where: { key },
      data: { count: 1, windowStart: new Date(now) },
    });
    return;
  }

  if (bucket.count >= cfg.limit) {
    throw new RateLimitError(
      `Слишком много действий (${action}). Подождите и попробуйте снова.`,
    );
  }

  await prisma.rateLimitBucket.update({
    where: { key },
    data: { count: { increment: 1 } },
  });
}

export class RateLimitError extends Error {
  status = 429;
  constructor(message: string) {
    super(message);
  }
}

/** Block high-risk / limited users from creating offers & listings. */
export async function assertCanTransact(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  if (user.status === "BLOCKED") {
    const err = new Error("Аккаунт заблокирован") as Error & { status: number };
    err.status = 403;
    throw err;
  }
  if (user.status === "LIMITED" || user.riskScoreCached >= 70) {
    const err = new Error(
      "Аккаунт ограничен из‑за риска. Обратитесь в поддержку.",
    ) as Error & { status: number };
    err.status = 403;
    throw err;
  }
  return user;
}
