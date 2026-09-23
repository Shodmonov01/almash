import { getAuthToken } from "./session";
import { apiUrl } from "./env";
import i18n from "@/lib/i18n";

export async function api<T = unknown>(
    path: string,
    init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  const isForm =
      typeof FormData !== "undefined" && init?.body instanceof FormData;
  if (!isForm && init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = getAuthToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(apiUrl(path), {
    ...init,
    credentials: "include",
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error || i18n.t("errors.request")) as Error & {
      status: number;
      data: unknown;
    };
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

export type User = {
  id: string;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  city: string;
  district?: string | null;
  role: string;
  trustLevel: string;
  rating?: number;
  ratingCount?: number;
  completedTrades?: number;
  status?: string;
  createdAt?: string;
  bio?: string | null;
  onboardingDone?: boolean;
  tgNotify?: boolean;
  riskScoreCached?: number;
  hasPassword?: boolean;
  telegramLinked?: boolean;
};