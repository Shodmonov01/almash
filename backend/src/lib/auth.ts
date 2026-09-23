import "@fastify/cookie";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./db";
import { httpStore } from "./context";

const COOKIE = process.env.SESSION_COOKIE || "toyswap_session";
const secret = () => {
  const value = process.env.JWT_SECRET;
  if (
    process.env.NODE_ENV === "production" &&
    (!value || value === "change-me" || value.length < 32)
  ) {
    throw new Error("JWT_SECRET must be set (32+ chars) in production");
  }
  return new TextEncoder().encode(
    value || "toy-swap-dev-secret-change-in-production",
  );
};

export type SessionUser = {
  id: string;
  name: string;
  role: string;
  city: string;
  trustLevel: string;
  avatarUrl: string | null;
};

export type ClientUser = {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  city: string;
  district: string | null;
  role: string;
  trustLevel: string;
  rating: number;
  ratingCount: number;
  completedTrades: number;
  cancelledTrades: number;
  disputesCount: number;
  status: string;
  createdAt: Date;
  bio: string | null;
  onboardingDone: boolean;
  tgNotify: boolean;
  riskScoreCached: number;
  hasPassword: boolean;
  telegramLinked: boolean;
};

function cookieOpts() {
  const store = httpStore();
  const proto = String(store?.req.headers["x-forwarded-proto"] || "");
  const secure =
    process.env.COOKIE_SECURE === "true" || proto === "https";
  return {
    httpOnly: true,
    path: "/",
    sameSite: (secure ? "none" : "lax") as "none" | "lax",
    secure,
    maxAge: 60 * 60 * 24 * 30,
  };
}

function readBearer(header?: string) {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token;
}

function cookieToken(store: ReturnType<typeof httpStore>) {
  const header = String(store?.req.headers.cookie || "");
  const fromHeader = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(COOKIE + "="))
    ?.slice(COOKIE.length + 1);
  return store?.req.cookies?.[COOKIE] || fromHeader || null;
}

async function userFromToken(token: string): Promise<SessionUser | null> {
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

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = httpStore();
  const bearer = readBearer(String(store?.req.headers.authorization || ""));
  if (bearer) {
    const fromBearer = await userFromToken(bearer);
    if (fromBearer) return fromBearer;
  }
  const fromCookie = cookieToken(store);
  if (!fromCookie) return null;
  return userFromToken(fromCookie);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());

  httpStore()?.reply.setCookie(COOKIE, token, cookieOpts());
  return token;
}

export async function destroySession() {
  httpStore()?.reply.clearCookie(COOKIE, cookieOpts());
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

export const clientUserSelect = {
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
  tgNotify: true,
  riskScoreCached: true,
  passwordHash: true,
  telegramId: true,
} as const;

export function toClientUser(user: {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  city: string;
  district: string | null;
  role: string;
  trustLevel: string;
  rating: number;
  ratingCount: number;
  completedTrades: number;
  cancelledTrades: number;
  disputesCount: number;
  status: string;
  createdAt: Date;
  bio: string | null;
  onboardingDone: boolean;
  tgNotify?: boolean;
  riskScoreCached: number;
  passwordHash?: string | null;
  telegramId?: string | null;
}): ClientUser {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    avatarUrl: user.avatarUrl,
    city: user.city,
    district: user.district,
    role: user.role,
    trustLevel: user.trustLevel,
    rating: user.rating,
    ratingCount: user.ratingCount,
    completedTrades: user.completedTrades,
    cancelledTrades: user.cancelledTrades,
    disputesCount: user.disputesCount,
    status: user.status,
    createdAt: user.createdAt,
    bio: user.bio,
    onboardingDone: user.onboardingDone,
    tgNotify: user.tgNotify ?? true,
    riskScoreCached: user.riskScoreCached,
    hasPassword: Boolean(user.passwordHash),
    telegramLinked: Boolean(user.telegramId),
  };
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}
