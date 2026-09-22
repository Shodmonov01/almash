import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  createSession,
  destroySession,
  getSessionUser,
  requireUser,
} from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { writeAudit } from "@/lib/utils";
import { loginWithTelegram } from "@/lib/services/telegram-auth";
import { hashPassword, verifyPassword } from "@/lib/password";

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Минимум 3 символа")
  .max(20, "Максимум 20 символов")
  .regex(/^[a-zA-Z0-9_]+$/, "Только латиница, цифры и _")
  .transform((s) => s.toLowerCase());

const loginSchema = z.object({
  action: z.literal("login").optional(),
  username: usernameSchema,
  password: z.string().min(1, "Введите пароль"),
  deviceFingerprint: z.string().optional(),
});

const registerSchema = z.object({
  action: z.literal("register"),
  username: usernameSchema,
  password: z.string().min(8, "Пароль не короче 8 символов"),
  name: z.string().trim().min(2, "Укажите имя").max(40),
  city: z.string().trim().min(2, "Укажите город").max(40),
  deviceFingerprint: z.string().optional(),
});

const telegramSchema = z.object({
  initData: z.string().min(1),
  city: z.string().optional(),
  deviceFingerprint: z.string().optional(),
});

function publicUser(user: {
  id: string;
  name: string;
  username: string | null;
  role: string;
  city: string;
  trustLevel: string;
  avatarUrl: string | null;
  onboardingDone: boolean;
}) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    city: user.city,
    trustLevel: user.trustLevel,
    avatarUrl: user.avatarUrl,
    onboardingDone: user.onboardingDone,
  };
}

async function stampDevice(params: {
  userId: string;
  deviceFingerprint?: string;
  ip?: string;
}) {
  if (!params.deviceFingerprint) {
    if (params.ip) {
      await prisma.user.update({
        where: { id: params.userId },
        data: { lastIp: params.ip },
      });
    }
    return;
  }

  const siblings = await prisma.user.count({
    where: {
      deviceFingerprint: params.deviceFingerprint,
      NOT: { id: params.userId },
    },
  });
  await prisma.user.update({
    where: { id: params.userId },
    data: {
      deviceFingerprint: params.deviceFingerprint,
      lastIp: params.ip,
      ...(siblings >= 2 ? { riskScoreCached: { increment: 10 } } : {}),
    },
  });
  if (siblings >= 2) {
    await prisma.riskEvent.create({
      data: {
        userId: params.userId,
        type: "SHARED_DEVICE",
        score: 20,
        detail: `siblings=${siblings}`,
      },
    });
  }
}

export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) return jsonOk({ user: null });

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        name: true,
        username: true,
        avatarUrl: true,
        city: true,
        district: true,
        role: true,
        trustLevel: true,
        rating: true,
        ratingCount: true,
        completedTrades: true,
        cancelledTrades: true,
        disputesCount: true,
        status: true,
        createdAt: true,
        bio: true,
        onboardingDone: true,
        riskScoreCached: true,
      },
    });
    return jsonOk({ user });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      undefined;

    if (raw?.initData) {
      const body = telegramSchema.parse(raw);
      const user = await loginWithTelegram({
        initData: body.initData,
        city: body.city,
        deviceFingerprint: body.deviceFingerprint,
        ip,
      });
      return jsonOk({ user: publicUser(user) });
    }

    if (raw?.action === "register") {
      const body = registerSchema.parse(raw);
      const existing = await prisma.user.findUnique({
        where: { username: body.username },
      });
      if (existing) return jsonError("Такой логин уже занят", 409);

      const user = await prisma.user.create({
        data: {
          name: body.name,
          username: body.username,
          passwordHash: await hashPassword(body.password),
          city: body.city,
          deviceFingerprint: body.deviceFingerprint,
          lastIp: ip,
        },
      });
      await createSession(user.id);
      await writeAudit({ userId: user.id, action: "USER_REGISTER" });
      return jsonOk({ user: publicUser(user) }, { status: 201 });
    }

    const body = loginSchema.parse(raw);
    const user = await prisma.user.findUnique({
      where: { username: body.username },
    });
    if (!user?.passwordHash) {
      return jsonError("Неверный логин или пароль", 401);
    }
    if (user.status === "BLOCKED") return jsonError("Аккаунт заблокирован", 403);

    const ok = await verifyPassword(body.password, user.passwordHash);
    if (!ok) return jsonError("Неверный логин или пароль", 401);

    await stampDevice({
      userId: user.id,
      deviceFingerprint: body.deviceFingerprint,
      ip,
    });
    await createSession(user.id);
    await writeAudit({ userId: user.id, action: "USER_LOGIN" });
    return jsonOk({ user: publicUser(user) });
  } catch (e) {
    const err = e as Error & { status?: number };
    if (err.status) return jsonError(err.message, err.status);
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
