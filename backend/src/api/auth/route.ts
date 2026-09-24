import type { AppRequest } from "@/lib/http";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  clientUserSelect,
  createSession,
  destroySession,
  getSessionUser,
  requireUser,
  toClientUser,
} from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { writeAudit } from "@/lib/utils";
import { verifyPassword } from "@/lib/password";
import { assertRateLimit } from "@/lib/services/rate-limit";
import {
  buildDemoInitData,
  loginWithTelegram,
  telegramPublicConfig,
} from "@/lib/services/telegram-auth";

const telegramWidgetSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    username: z.string().optional(),
    photo_url: z.string().optional(),
    auth_date: z.union([z.number(), z.string()]),
    hash: z.string(),
  })
  .passthrough();

const loginSchema = z.object({
  username: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
  initData: z.string().optional(),
  telegramWidget: telegramWidgetSchema.optional(),
  city: z.string().optional(),
  deviceFingerprint: z.string().optional(),
});

function clientIp(req: AppRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    undefined
  );
}

export async function GET() {
  try {
    const telegram = telegramPublicConfig();
    const session = await getSessionUser();
    if (!session) return jsonOk({ user: null, telegram });

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: clientUserSelect,
    });
    return jsonOk({ user: user ? toClientUser(user) : null, telegram });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: AppRequest) {
  try {
    const body = loginSchema.parse(await req.json());
    const ip = clientIp(req);
    await assertRateLimit(ip || "anon", "login");

    if (body.initData || body.telegramWidget) {
      const session = await getSessionUser();
      const { user, token } = await loginWithTelegram({
        initData: body.initData,
        widget: body.telegramWidget,
        city: body.city,
        deviceFingerprint: body.deviceFingerprint,
        ip,
        linkToUserId: session?.id ?? null,
      });
      return jsonOk({
        user: toClientUser(user),
        token,
      });
    }

    if (!body.username || !body.password) {
      return jsonError("Укажите логин и пароль или войдите через Telegram", 400);
    }

    const user = await prisma.user.findUnique({
      where: { username: body.username.trim() },
    });
    if (!user) return jsonError("Неверный логин или пароль", 401);
    if (user.status === "BLOCKED") return jsonError("Аккаунт заблокирован", 403);
    if (!user.passwordHash) {
      return jsonError(
        "У этого аккаунта нет пароля. Войдите через Telegram или задайте пароль после входа.",
        400,
      );
    }
    const ok = await verifyPassword(body.password, user.passwordHash);
    if (!ok) return jsonError("Неверный логин или пароль", 401);

    // Several accounts on one device (e.g. a family phone) is not a risk signal.
    if (body.deviceFingerprint) {
      await prisma.user.update({
        where: { id: user.id },
        data: { deviceFingerprint: body.deviceFingerprint, lastIp: ip },
      });
    }

    const token = await createSession(user.id);
    await writeAudit({ userId: user.id, action: "USER_LOGIN" });
    return jsonOk({
      user: toClientUser(user),
      token,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    await destroySession();
    await writeAudit({ userId: user.id, action: "USER_LOGOUT" });
    return jsonOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

/** Helper for QA: build signed demo initData for a telegram id. */
export async function PUT(req: AppRequest) {
  try {
    if (process.env.NODE_ENV === "production") {
      return jsonError("Не найдено", 404);
    }
    const { telegramId, name, username } = await req.json();
    const initData = buildDemoInitData({
      id: Number(telegramId),
      first_name: name || "TG User",
      username: username || `tg_${telegramId}`,
    });
    return jsonOk({ initData });
  } catch (e) {
    return handleApiError(e);
  }
}
