import type { AppRequest } from "@/lib/http";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { writeAudit } from "@/lib/utils";

const schema = z.object({
  onboardingDone: z.boolean().optional(),
  tgNotify: z.boolean().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  bio: z.string().max(500).optional(),
  name: z.string().trim().min(1).max(80).optional(),
  password: z.string().min(8).max(72).optional(),
  currentPassword: z.string().min(1).optional(),
});

export async function PATCH(req: AppRequest) {
  try {
    const session = await requireUser();
    const body = schema.parse(await req.json());
    const existing = await prisma.user.findUnique({
      where: { id: session.id },
    });
    if (!existing) return jsonError("Пользователь не найден", 404);

    if (body.password) {
      if (existing.passwordHash) {
        if (!body.currentPassword) {
          return jsonError("Укажите текущий пароль", 400);
        }
        const ok = await verifyPassword(
          body.currentPassword,
          existing.passwordHash,
        );
        if (!ok) return jsonError("Неверный текущий пароль", 400);
      }
    }

    const { password, currentPassword: _current, ...profile } = body;
    const user = await prisma.user.update({
      where: { id: session.id },
      data: {
        ...profile,
        ...(password ? { passwordHash: await hashPassword(password) } : {}),
      },
      select: {
        id: true,
        name: true,
        onboardingDone: true,
        tgNotify: true,
        city: true,
        district: true,
        bio: true,
      },
    });
    if (password) {
      await writeAudit({ userId: session.id, action: "PASSWORD_SET" });
    }
    return jsonOk({
      user: {
        ...user,
        hasPassword: Boolean(existing.passwordHash || password),
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
