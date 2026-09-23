import { prisma } from "@/lib/db";
import { computeRiskScore, MONEY_REASONS, type RiskSignals } from "@/lib/antifraud";

const DAY = 24 * 60 * 60 * 1000;

/** TZ §32: a decision needs several signals, never a single technical one. */
export const HIGH_RISK_SCORE = 70;
export const MIN_SIGNALS_FOR_RESTRICTION = 2;
/** TZ §42: 2–3 violations → limit the number of active offers. */
export const LIMITED_MAX_ACTIVE_OFFERS = 2;

export const SIGNAL_LABELS: Record<keyof RiskSignals, string> = {
  isNewAccount: "новый аккаунт",
  manyListings: "много объявлений за сутки",
  moneyTalk: "попытки обсуждать деньги",
  externalContact: "попытки увести общение с платформы",
  manyCancels: "частые отмены",
  manyDisputes: "частые/проигранные споры",
  duplicatePhotos: "повторяющиеся фотографии",
  duplicateDescriptions: "одинаковые описания",
  sharedDevice: "несколько аккаунтов с одного устройства",
  manyReports: "много жалоб",
  noShows: "неявки на встречи",
  burstActivity: "резкий всплеск активности",
};

const ACTIVE_TRADE_STATUSES = [
  "OFFER_SENT",
  "NEGOTIATION",
  "TERMS_AGREED",
  "MEETING_SCHEDULED",
  "HANDOFF_PENDING",
  "PARTY_A_CONFIRMED",
  "PARTY_B_CONFIRMED",
];

export type UserRisk = {
  score: number;
  signals: (keyof RiskSignals)[];
  highRisk: boolean;
};

/** TZ §33: collects every behavioural signal for a user from stored data. */
export async function collectUserSignals(userId: string): Promise<RiskSignals> {
  const now = Date.now();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return {};

  const [
    listings24h,
    listingsTotal,
    recentCancels,
    reportsAgainst,
    offers24h,
    chatEvents,
    listingMoney,
    dupPhotos,
    dupDescriptions,
    deviceSiblings,
  ] = await Promise.all([
    prisma.item.count({ where: { ownerId: userId, createdAt: { gte: new Date(now - DAY) } } }),
    prisma.item.count({ where: { ownerId: userId } }),
    prisma.trade.count({
      where: {
        cancelledById: userId,
        status: "CANCELLED",
        updatedAt: { gte: new Date(now - 7 * DAY) },
      },
    }),
    prisma.report.count({
      where: { targetUserId: userId, status: { not: "DISMISSED" } },
    }),
    prisma.trade.count({
      where: { initiatorId: userId, createdAt: { gte: new Date(now - DAY) } },
    }),
    prisma.riskEvent.findMany({
      where: { userId, type: "CHAT_VIOLATION" },
      select: { detail: true },
      take: 200,
    }),
    prisma.riskEvent.count({ where: { userId, type: "MONEY_IN_LISTING" } }),
    prisma.riskEvent.count({ where: { userId, type: "DUPLICATE_PHOTO" } }),
    prisma.riskEvent.count({ where: { userId, type: "DUPLICATE_DESCRIPTION" } }),
    user.deviceFingerprint
      ? prisma.user.count({
          where: { deviceFingerprint: user.deviceFingerprint, NOT: { id: userId } },
        })
      : Promise.resolve(0),
  ]);

  const chatReasons = chatEvents.flatMap((e) =>
    (e.detail || "").split(",").map((r) => r.trim()),
  );
  const moneyChat = chatReasons.some((r) => MONEY_REASONS.has(r));
  const contactChat = chatReasons.some((r) =>
    ["телефон", "telegram", "WhatsApp"].includes(r),
  );

  return {
    isNewAccount:
      user.completedTrades === 0 && now - user.createdAt.getTime() < 7 * DAY,
    manyListings: listings24h >= 10 || listingsTotal > 50,
    moneyTalk: moneyChat || listingMoney > 0,
    externalContact: contactChat,
    manyCancels: user.cancelledTrades > 5 || recentCancels >= 3,
    manyDisputes: user.disputesLost >= 2 || user.disputesCount > 3,
    duplicatePhotos: dupPhotos > 0,
    duplicateDescriptions: dupDescriptions > 0,
    sharedDevice: deviceSiblings >= 2,
    manyReports: reportsAgainst >= 3,
    noShows: user.noShowCount >= 2,
    burstActivity: offers24h >= 8,
  };
}

/** Recomputes the user's risk score from all signals and stores it. */
export async function refreshUserRisk(userId: string): Promise<UserRisk> {
  const signals = await collectUserSignals(userId);
  const score = computeRiskScore(signals);
  const active = (Object.keys(signals) as (keyof RiskSignals)[]).filter(
    (k) => signals[k],
  );
  let highRisk =
    score >= HIGH_RISK_SCORE && active.length >= MIN_SIGNALS_FOR_RESTRICTION;

  // A moderator cleared this account: only new risk events re-enable
  // automatic restrictions (TZ §33 — the final decision is manual).
  if (highRisk) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { riskClearedAt: true },
    });
    if (u?.riskClearedAt) {
      const newEvents = await prisma.riskEvent.count({
        where: { userId, createdAt: { gt: u.riskClearedAt } },
      });
      if (newEvents === 0) highRisk = false;
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { riskScoreCached: score },
  });

  // Manual moderation of high-risk accounts (TZ §33), once per open case
  if (highRisk) {
    const open = await prisma.moderationQueue.findFirst({
      where: { userId, type: "HIGH_RISK_USER", status: "OPEN" },
    });
    if (!open) {
      await prisma.moderationQueue.create({
        data: {
          type: "HIGH_RISK_USER",
          userId,
          score,
          detail: active.map((k) => SIGNAL_LABELS[k]).join(", "),
        },
      });
    }
  }

  return { score, signals: active, highRisk };
}

/** Number of offers the user started that are still in progress. */
export function countActiveOffers(userId: string) {
  return prisma.trade.count({
    where: { initiatorId: userId, status: { in: ACTIVE_TRADE_STATUSES } },
  });
}

// "Игрушечное оружие" is an allowed toy category (TZ §3), real weapons are not (§34)
const TOY_QUALIFIER = /(игрушечн\p{L}*|детск\p{L}*|toy|o['ʻʼ‘]?yinchoq)\s*$/iu;

export function matchesForbidden(text: string, name: string): boolean {
  const lower = text.toLowerCase();
  const needle = name.toLowerCase().trim();
  if (!needle) return false;
  let idx = lower.indexOf(needle);
  while (idx !== -1) {
    const before = lower.slice(0, idx);
    const wordStart = !/\p{L}$/u.test(before);
    if (wordStart && !TOY_QUALIFIER.test(before)) return true;
    idx = lower.indexOf(needle, idx + 1);
  }
  return false;
}

/** TZ §34: admin-configured forbidden categories / words. */
export async function findForbiddenCategory(text: string): Promise<string | null> {
  const forbidden = await prisma.forbiddenCategory.findMany({
    where: { enabled: true },
  });
  const hit = forbidden.find((f) => matchesForbidden(text, f.name));
  return hit ? hit.name : null;
}

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** TZ §33: the same description reused by other accounts. */
export async function findDuplicateDescriptions(params: {
  description: string;
  ownerId: string;
  excludeItemId?: string;
}) {
  const norm = normalizeText(params.description);
  if (norm.length < 30) return [];
  const candidates = await prisma.item.findMany({
    where: {
      ownerId: { not: params.ownerId },
      ...(params.excludeItemId ? { id: { not: params.excludeItemId } } : {}),
    },
    select: { id: true, ownerId: true, title: true, description: true },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });
  return candidates.filter((c) => normalizeText(c.description) === norm);
}
