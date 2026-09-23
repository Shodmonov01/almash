import type { User } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  countActiveOffers,
  LIMITED_MAX_ACTIVE_OFFERS,
  refreshUserRisk,
  type UserRisk,
} from "@/lib/services/risk";

const WINDOWS: Record<string, { limit: number; windowMs: number }> = {
  create_item: { limit: 10, windowMs: 60 * 60 * 1000 },
  create_offer: { limit: 20, windowMs: 60 * 60 * 1000 },
  send_message: { limit: 60, windowMs: 10 * 60 * 1000 },
  report: { limit: 15, windowMs: 60 * 60 * 1000 },
  upload: { limit: 40, windowMs: 60 * 60 * 1000 },
  login: { limit: 30, windowMs: 15 * 60 * 1000 },
  register: { limit: 10, windowMs: 60 * 60 * 1000 },
  handoff_code: { limit: 10, windowMs: 60 * 60 * 1000 },
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

function forbidden(message: string) {
  const err = new Error(message) as Error & { status: number };
  err.status = 403;
  return err;
}

/**
 * Sanctions before creating an offer or a listing:
 * - BLOCKED → nothing allowed;
 * - high risk (score + several signals, TZ §32–33) → no new offers,
 *   new listings go to manual moderation (handled by the caller);
 * - LIMITED (TZ §42, 2–3 violations) → at most N active offers.
 */
export async function assertCanTransact(
  userId: string,
  action: "offer" | "item" = "offer",
): Promise<{ user: User; risk: UserRisk }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  if (user.status === "BLOCKED") throw forbidden("Аккаунт заблокирован");

  const risk = await refreshUserRisk(userId);

  if (action === "offer") {
    if (risk.highRisk) {
      throw forbidden(
        "Создание новых сделок временно ограничено: аккаунт на проверке у модератора.",
      );
    }
    if (user.status === "LIMITED") {
      const active = await countActiveOffers(userId);
      if (active >= LIMITED_MAX_ACTIVE_OFFERS) {
        throw forbidden(
          `Аккаунт ограничен: не более ${LIMITED_MAX_ACTIVE_OFFERS} активных предложений одновременно.`,
        );
      }
    }
  }
  return { user, risk };
}
