import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, destroySession, getSessionUser, requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { writeAudit } from "@/lib/utils";

const loginSchema = z.object({
  username: z.string().min(1),
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
    const user = await prisma.user.findUnique({ where: { username: body.username } });
    if (!user) return jsonError("Пользователь не найден", 404);
    if (user.status === "BLOCKED") return jsonError("Аккаунт заблокирован", 403);

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
      },
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
