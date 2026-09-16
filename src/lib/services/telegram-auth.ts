import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { writeAudit } from "@/lib/utils";

/**
 * Telegram Mini App initData validation (HMAC-SHA256).
 * In demo mode without BOT_TOKEN, accepts signed demo payloads.
 */
export function validateTelegramInitData(
  initData: string,
  botToken?: string,
): { ok: boolean; user?: { id: number; first_name?: string; username?: string; photo_url?: string }; error?: string } {
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
    // Demo fallback: accept if hash === sha256 of data + "demo"
    const demo = createHmac("sha256", "demo").update(dataCheckString).digest("hex");
    if (hash !== demo) return { ok: false, error: "invalid demo signature" };
  } else {
    const secret = createHmac("sha256", "WebAppData").update(token).digest();
    const calculated = createHmac("sha256", secret).update(dataCheckString).digest("hex");
    try {
      const a = Buffer.from(hash, "hex");
      const b = Buffer.from(calculated, "hex");
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return { ok: false, error: "invalid telegram signature" };
      }
    } catch {
      return { ok: false, error: "invalid telegram signature" };
    }
  }

  const authDate = Number(params.get("auth_date") || 0);
  if (authDate && Date.now() / 1000 - authDate > 86400) {
    return { ok: false, error: "auth_date expired" };
  }

  const userRaw = params.get("user");
  if (!userRaw) return { ok: false, error: "user missing" };
  try {
    const user = JSON.parse(userRaw);
    return { ok: true, user };
  } catch {
    return { ok: false, error: "bad user json" };
  }
}

export async function loginWithTelegram(params: {
  initData: string;
  city?: string;
  deviceFingerprint?: string;
  ip?: string;
}) {
  const result = validateTelegramInitData(params.initData);
  if (!result.ok || !result.user) {
    throw Object.assign(new Error(result.error || "auth failed"), { status: 401 });
  }

  const tgId = String(result.user.id);
  let user = await prisma.user.findUnique({ where: { telegramId: tgId } });

  // Multi-account signal: same device already used by another telegram id
  if (params.deviceFingerprint) {
    const siblings = await prisma.user.count({
      where: {
        deviceFingerprint: params.deviceFingerprint,
        NOT: { telegramId: tgId },
      },
    });
    if (siblings >= 2 && user) {
      await prisma.riskEvent.create({
        data: {
          userId: user.id,
          type: "SHARED_DEVICE",
          score: 20,
          detail: `device=${params.deviceFingerprint} siblings=${siblings}`,
        },
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { riskScoreCached: { increment: 10 } },
      });
    }
  }

  if (!user) {
    user = await prisma.user.create({
      data: {
        telegramId: tgId,
        name: result.user.first_name || `User ${tgId}`,
        username: result.user.username || `tg_${tgId}`,
        avatarUrl: result.user.photo_url,
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
        name: result.user.first_name || user.name,
        avatarUrl: result.user.photo_url || user.avatarUrl,
        deviceFingerprint: params.deviceFingerprint || user.deviceFingerprint,
        lastIp: params.ip || user.lastIp,
        telegramAuthDate: new Date(),
      },
    });
  }

  if (user.status === "BLOCKED") {
    throw Object.assign(new Error("Аккаунт заблокирован"), { status: 403 });
  }

  await createSession(user.id);
  await writeAudit({ userId: user.id, action: "TELEGRAM_LOGIN" });
  return user;
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
