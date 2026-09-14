import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./db";

const COOKIE = process.env.SESSION_COOKIE || "toyswap_session";
const secret = () =>
  new TextEncoder().encode(
    process.env.JWT_SECRET || "toy-swap-dev-secret-change-in-production",
  );

export type SessionUser = {
  id: string;
  name: string;
  role: string;
  city: string;
  trustLevel: string;
  avatarUrl: string | null;
};

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    const id = payload.sub;
    if (!id) return null;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.status === "BLOCKED") return null;

    return {
      id: user.id,
      name: user.name,
      role: user.role,
      city: user.city,
      trustLevel: user.trustLevel,
      avatarUrl: user.avatarUrl,
    };
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new AuthError("Требуется авторизация");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new AuthError("Недостаточно прав", 403);
  return user;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}
