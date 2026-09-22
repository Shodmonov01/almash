import type { AppRequest } from "@/lib/http";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, toClientUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { writeAudit } from "@/lib/utils";
import { hashPassword } from "@/lib/password";
import { assertRateLimit } from "@/lib/services/rate-limit";

const schema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Минимум 3 символа")
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/, "Только латиница, цифры и _"),
  password: z.string().min(8, "Минимум 8 символов").max(72),
  name: z.string().trim().min(1).max(80),
  city: z.string().trim().min(1).max(80).optional().default("Ташкент"),
  deviceFingerprint: z.string().optional(),
});

export async function POST(req: AppRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "anon";
    await assertRateLimit(ip, "register");

    const body = schema.parse(await req.json());
    const exists = await prisma.user.findUnique({
      where: { username: body.username },
    });
    if (exists) return jsonError("Такой логин уже занят", 409);

    const user = await prisma.user.create({
      data: {
        username: body.username,
        passwordHash: await hashPassword(body.password),
        name: body.name,
        city: body.city,
        deviceFingerprint: body.deviceFingerprint,
        lastIp: ip === "anon" ? undefined : ip,
      },
    });

    const token = await createSession(user.id);
    await writeAudit({ userId: user.id, action: "USER_REGISTER" });
    return jsonOk({ user: toClientUser(user), token }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
