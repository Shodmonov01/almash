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
import {
  buildDemoInitData,
  loginWithTelegram,
} from "@/lib/services/telegram-auth";

const loginSchema = z.object({
  username: z.string().min(1).optional(),
  initData: z.string().optional(),
  city: z.string().optional(),
  deviceFingerprint: z.string().optional(),
});

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
    const body = loginSchema.parse(await req.json());
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      undefined;

    // Telegram Mini App path
    if (body.initData) {
      const user = await loginWithTelegram({
        initData: body.initData,
        city: body.city,
        deviceFingerprint: body.deviceFingerprint,
        ip,
      });
      return jsonOk({
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
          city: user.city,
          trustLevel: user.trustLevel,
          avatarUrl: user.avatarUrl,
          onboardingDone: user.onboardingDone,
        },
      });
    }

    // Demo username login (also stamps device fingerprint)
    if (!body.username) return jsonError("username или initData обязательны", 400);

    const user = await prisma.user.findUnique({
      where: { username: body.username },
    });
    if (!user) return jsonError("Пользователь не найден", 404);
    if (user.status === "BLOCKED") return jsonError("Аккаунт заблокирован", 403);

    if (body.deviceFingerprint) {
      const siblings = await prisma.user.count({
        where: {
          deviceFingerprint: body.deviceFingerprint,
          NOT: { id: user.id },
        },
      });
      await prisma.user.update({
        where: { id: user.id },
        data: {
          deviceFingerprint: body.deviceFingerprint,
          lastIp: ip,
          ...(siblings >= 2
            ? { riskScoreCached: { increment: 10 } }
            : {}),
        },
      });
      if (siblings >= 2) {
        await prisma.riskEvent.create({
          data: {
            userId: user.id,
            type: "SHARED_DEVICE",
            score: 20,
            detail: `siblings=${siblings}`,
          },
        });
      }
    }

    await createSession(user.id);
    await writeAudit({ userId: user.id, action: "USER_LOGIN" });
    return jsonOk({
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        city: user.city,
        trustLevel: user.trustLevel,
        avatarUrl: user.avatarUrl,
        onboardingDone: user.onboardingDone,
      },
    });
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

/** Helper for QA: build signed demo initData for a telegram id. */
export async function PUT(req: NextRequest) {
  try {
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
