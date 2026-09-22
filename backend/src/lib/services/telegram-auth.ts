import { createHash, createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { writeAudit } from "@/lib/utils";

export type TelegramProfile = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

function safeEqualHex(a: string, b: string) {
  try {
    const left = Buffer.from(a, "hex");
    const right = Buffer.from(b, "hex");
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function authDateFresh(authDate: number) {
  if (!authDate) return false;
  return Date.now() / 1000 - authDate <= 86400;
}

export function telegramPublicConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  const rawId = token.includes(":") ? Number(token.split(":")[0]) : NaN;
  const botId = Number.isFinite(rawId) ? rawId : null;
  const botUsername =
    process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "").trim() || null;
  return {
    enabled: Boolean(token) || process.env.NODE_ENV !== "production",
    botId,
    botUsername,
    demoHint: process.env.NODE_ENV !== "production",
  };
}

/**
 * Telegram Mini App initData validation (HMAC-SHA256, key = HMAC("WebAppData", botToken)).
 * Without BOT_TOKEN in non-production, accepts signed demo payloads.
 */
export function validateTelegramInitData(
  initData: string,
  botToken?: string,
): { ok: boolean; user?: TelegramProfile; error?: string } {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, error: "hash missing" };

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, error: "telegram bot is not configured" };
    }
    const demo = createHmac("sha256", "demo").update(dataCheckString).digest("hex");
    if (hash !== demo) return { ok: false, error: "invalid demo signature" };
  } else {
    const secret = createHmac("sha256", "WebAppData").update(token).digest();
    const calculated = createHmac("sha256", secret).update(dataCheckString).digest("hex");
    if (!safeEqualHex(hash, calculated)) {
      return { ok: false, error: "invalid telegram signature" };
    }
  }

  const authDate = Number(params.get("auth_date") || 0);
  if (!authDateFresh(authDate)) {
    return { ok: false, error: "auth_date expired" };
  }

  const userRaw = params.get("user");
  if (!userRaw) return { ok: false, error: "user missing" };
  try {
    const user = JSON.parse(userRaw) as TelegramProfile;
    if (!user?.id) return { ok: false, error: "user missing" };
    return { ok: true, user };
  } catch {
    return { ok: false, error: "bad user json" };
  }
}

/**
 * Telegram Login Widget validation (HMAC-SHA256, key = SHA256(botToken)).
 * Used on the ordinary website, not inside Mini App.
 */
export function validateTelegramLoginWidget(
  payload: Record<string, unknown>,
  botToken?: string,
): { ok: boolean; user?: TelegramProfile; error?: string } {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: "telegram bot is not configured" };

  const hash = String(payload.hash || "");
  if (!hash) return { ok: false, error: "hash missing" };

  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (key === "hash" || value == null) continue;
    data[key] = String(value);
  }

  const dataCheckString = Object.keys(data)
    .sort()
    .map((key) => `${key}=${data[key]}`)
    .join("\n");

  const secret = createHash("sha256").update(token).digest();
  const calculated = createHmac("sha256", secret)
    .update(dataCheckString)
    .digest("hex");
  if (!safeEqualHex(hash, calculated)) {
    return { ok: false, error: "invalid telegram signature" };
  }

  const authDate = Number(data.auth_date || 0);
  if (!authDateFresh(authDate)) {
    return { ok: false, error: "auth_date expired" };
  }

  const id = Number(data.id);
  if (!id) return { ok: false, error: "user missing" };

  return {
    ok: true,
    user: {
      id,
      first_name: data.first_name,
      last_name: data.last_name,
      username: data.username,
      photo_url: data.photo_url,
    },
  };
}

function displayName(user: TelegramProfile, fallback: string) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return name || fallback;
}

export async function loginWithTelegram(params: {
  initData?: string;
  widget?: Record<string, unknown>;
  city?: string;
  deviceFingerprint?: string;
  ip?: string;
  linkToUserId?: string | null;
}) {
  let identity: TelegramProfile | undefined;
  if (params.initData) {
    const result = validateTelegramInitData(params.initData);
    if (!result.ok || !result.user) {
      throw Object.assign(new Error(result.error || "auth failed"), { status: 401 });
    }
    identity = result.user;
  } else if (params.widget) {
    const result = validateTelegramLoginWidget(params.widget);
    if (!result.ok || !result.user) {
      throw Object.assign(new Error(result.error || "auth failed"), { status: 401 });
    }
    identity = result.user;
  } else {
    throw Object.assign(new Error("Нет данных Telegram"), { status: 400 });
  }

  const tgId = String(identity.id);
  let user = await prisma.user.findUnique({ where: { telegramId: tgId } });

  if (params.deviceFingerprint) {
    const siblings = await prisma.user.count({
      where: {
        deviceFingerprint: params.deviceFingerprint,
        NOT: { telegramId: tgId },
      },
    });
    if (siblings >= 2 && (user || params.linkToUserId)) {
      const targetId = user?.id || params.linkToUserId;
      if (targetId) {
        await prisma.riskEvent.create({
          data: {
            userId: targetId,
            type: "SHARED_DEVICE",
            score: 20,
            detail: `device=${params.deviceFingerprint} siblings=${siblings}`,
          },
        });
        await prisma.user.update({
          where: { id: targetId },
          data: { riskScoreCached: { increment: 10 } },
        });
      }
    }
  }

  if (params.linkToUserId) {
    const account = await prisma.user.findUnique({
      where: { id: params.linkToUserId },
    });
    if (!account) {
      throw Object.assign(new Error("Требуется авторизация"), { status: 401 });
    }
    if (account.status === "BLOCKED") {
      throw Object.assign(new Error("Аккаунт заблокирован"), { status: 403 });
    }
    if (account.telegramId && account.telegramId !== tgId) {
      throw Object.assign(
        new Error("К этому аккаунту уже привязан другой Telegram"),
        { status: 409 },
      );
    }
    if (user && user.id !== account.id) {
      throw Object.assign(
        new Error("Этот Telegram уже привязан к другому аккаунту"),
        { status: 409 },
      );
    }
    user = await prisma.user.update({
      where: { id: account.id },
      data: {
        telegramId: tgId,
        avatarUrl: identity.photo_url || account.avatarUrl,
        deviceFingerprint: params.deviceFingerprint || account.deviceFingerprint,
        lastIp: params.ip || account.lastIp,
        telegramAuthDate: new Date(),
      },
    });
  } else if (!user) {
    const preferred =
      identity.username?.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24) ||
      `tg_${tgId}`;
    const taken = await prisma.user.findUnique({
      where: { username: preferred },
    });
    user = await prisma.user.create({
      data: {
        telegramId: tgId,
        name: displayName(identity, `User ${tgId}`),
        username: taken ? `tg_${tgId}` : preferred,
        avatarUrl: identity.photo_url,
        city: params.city || "Ташкент",
        deviceFingerprint: params.deviceFingerprint,
        lastIp: params.ip,
        telegramAuthDate: new Date(),
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        avatarUrl: identity.photo_url || user.avatarUrl,
        deviceFingerprint: params.deviceFingerprint || user.deviceFingerprint,
        lastIp: params.ip || user.lastIp,
        telegramAuthDate: new Date(),
      },
    });
  }

  if (user.status === "BLOCKED") {
    throw Object.assign(new Error("Аккаунт заблокирован"), { status: 403 });
  }

  const token = await createSession(user.id);
  await writeAudit({
    userId: user.id,
    action: params.linkToUserId ? "TELEGRAM_LINK" : "TELEGRAM_LOGIN",
  });
  return { user, token };
}

/** Build demo initData for local testing without a real bot. */
export function buildDemoInitData(user: {
  id: number;
  first_name: string;
  username: string;
}) {
  const params = new URLSearchParams();
  params.set("auth_date", String(Math.floor(Date.now() / 1000)));
  params.set("user", JSON.stringify(user));
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const hash = createHmac("sha256", "demo").update(dataCheckString).digest("hex");
  params.set("hash", hash);
  return params.toString();
}
