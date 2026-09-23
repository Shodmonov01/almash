import { prisma } from "@/lib/db";

/*
 * TZ §50 — Telegram notifications.
 *
 * Every in-app Notification row doubles as an outbox entry: it is pushed to
 * the user's Telegram chat right after creation, and a background loop retries
 * transient failures (network, 429, 5xx) with backoff. Permanent problems
 * (user never started the bot, blocked it, no Telegram linked, turned off in
 * the profile) mark the row SKIPPED so it is never retried.
 */

const MAX_ATTEMPTS = 5;
/** Don't deliver stale news (e.g. after a long outage or a token added later). */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** Chat messages: at most one Telegram push per trade per user in this window. */
const MESSAGE_THROTTLE_MS = 2 * 60 * 1000;
const LEASE_MS = 2 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;

function botToken() {
  return process.env.TELEGRAM_BOT_TOKEN || "";
}
function apiBase() {
  return (process.env.TELEGRAM_API_BASE || "https://api.telegram.org").replace(/\/$/, "");
}
/** Public https URL of the Mini App (e.g. https://retoy.uz) — enables the "Open" button. */
function webAppUrl() {
  return (process.env.TELEGRAM_WEBAPP_URL || "").replace(/\/$/, "");
}

export function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Pure: Telegram sendMessage payload for a notification. */
export function buildTelegramMessage(
  n: { title: string; body: string; tradeId: string | null },
  chatId: string,
  baseUrl = webAppUrl(),
) {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text: `<b>${escapeHtml(n.title)}</b>\n${escapeHtml(n.body)}`,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  // web_app buttons open the Mini App right on the relevant screen
  if (baseUrl.startsWith("https://")) {
    const path = n.tradeId ? `/trades/${n.tradeId}` : "/notifications";
    payload.reply_markup = {
      inline_keyboard: [
        [{ text: n.tradeId ? "Открыть сделку" : "Открыть", web_app: { url: `${baseUrl}${path}` } }],
      ],
    };
  }
  return payload;
}

export type SendOutcome =
  | { kind: "sent" }
  | { kind: "permanent"; reason: string }
  | { kind: "retry"; reason: string; retryAfterMs?: number };

/** Pure: classify a Bot API response. */
export function classifyTelegramResponse(
  httpStatus: number,
  body: { ok?: boolean; error_code?: number; description?: string; parameters?: { retry_after?: number } } | null,
): SendOutcome {
  if (body?.ok) return { kind: "sent" };
  const code = body?.error_code ?? httpStatus;
  const reason = `${code}: ${body?.description ?? "unknown error"}`;
  if (code === 429) {
    return { kind: "retry", reason, retryAfterMs: (body?.parameters?.retry_after ?? 5) * 1000 };
  }
  if (code >= 500) return { kind: "retry", reason };
  // 400 chat not found, 403 bot blocked / can't initiate conversation, etc.
  return { kind: "permanent", reason };
}

function backoffMs(attempt: number) {
  return Math.min(30_000 * 2 ** (attempt - 1), 30 * 60 * 1000);
}

async function callSendMessage(payload: Record<string, unknown>): Promise<SendOutcome> {
  try {
    const res = await fetch(`${apiBase()}/bot${botToken()}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = (await res.json().catch(() => null)) as Parameters<typeof classifyTelegramResponse>[1];
    return classifyTelegramResponse(res.status, body);
  } catch (err) {
    return { kind: "retry", reason: `network: ${err instanceof Error ? err.message : String(err)}` };
  }
}

async function skip(id: string, reason: string) {
  await prisma.notification.update({
    where: { id },
    data: { tgStatus: "SKIPPED", tgError: reason, tgNextAt: null },
  });
}

/** Try to deliver one notification to Telegram. Never throws. */
export async function deliverTelegram(notificationId: string): Promise<void> {
  try {
    const now = new Date();
    // Claim the row (PENDING / FAILED due / SENDING with an expired lease) so
    // the immediate send and the retry loop never deliver it twice.
    const claimed = await prisma.notification.updateMany({
      where: {
        id: notificationId,
        OR: [
          { tgStatus: "PENDING" },
          { tgStatus: { in: ["FAILED", "SENDING"] }, OR: [{ tgNextAt: null }, { tgNextAt: { lte: now } }] },
        ],
      },
      data: { tgStatus: "SENDING", tgNextAt: new Date(now.getTime() + LEASE_MS) },
    });
    if (claimed.count === 0) return;

    const n = await prisma.notification.findUnique({
      where: { id: notificationId },
      include: { user: { select: { telegramId: true, tgNotify: true, status: true } } },
    });
    if (!n) return;

    if (!botToken()) return skip(n.id, "bot token not configured");
    if (now.getTime() - n.createdAt.getTime() > MAX_AGE_MS) return skip(n.id, "too old");
    if (!n.user.telegramId) return skip(n.id, "telegram not linked");
    if (!n.user.tgNotify) return skip(n.id, "disabled by user");
    if (n.user.status === "BLOCKED") return skip(n.id, "user blocked");

    if (n.type === "MESSAGE" && n.tradeId) {
      const recent = await prisma.notification.findFirst({
        where: {
          id: { not: n.id },
          userId: n.userId,
          tradeId: n.tradeId,
          type: "MESSAGE",
          tgStatus: "SENT",
          tgSentAt: { gte: new Date(now.getTime() - MESSAGE_THROTTLE_MS) },
        },
      });
      if (recent) return skip(n.id, "throttled (chat)");
    }

    const outcome = await callSendMessage(buildTelegramMessage(n, n.user.telegramId));
    const attempts = n.tgAttempts + 1;

    if (outcome.kind === "sent") {
      await prisma.notification.update({
        where: { id: n.id },
        data: { tgStatus: "SENT", tgSentAt: new Date(), tgAttempts: attempts, tgError: null, tgNextAt: null },
      });
    } else if (outcome.kind === "permanent" || attempts >= MAX_ATTEMPTS) {
      await prisma.notification.update({
        where: { id: n.id },
        data: { tgStatus: "SKIPPED", tgAttempts: attempts, tgError: outcome.reason, tgNextAt: null },
      });
    } else {
      await prisma.notification.update({
        where: { id: n.id },
        data: {
          tgStatus: "FAILED",
          tgAttempts: attempts,
          tgError: outcome.reason,
          tgNextAt: new Date(Date.now() + (outcome.retryAfterMs ?? backoffMs(attempts))),
        },
      });
    }
  } catch (err) {
    console.error("telegram delivery failed", notificationId, err);
  }
}

/** Background loop: deliver pending rows and retry failed ones that are due. */
export async function processTelegramOutbox(limit = 50): Promise<{ processed: number }> {
  const now = new Date();
  const due = await prisma.notification.findMany({
    where: {
      OR: [
        { tgStatus: "PENDING" },
        { tgStatus: { in: ["FAILED", "SENDING"] }, OR: [{ tgNextAt: null }, { tgNextAt: { lte: now } }] },
      ],
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  for (const { id } of due) {
    // sequential: stays well under Telegram's per-bot rate limits
    await deliverTelegram(id);
  }
  return { processed: due.length };
}
