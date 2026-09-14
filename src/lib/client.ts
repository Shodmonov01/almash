export async function api<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Ошибка запроса") as Error & {
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
  riskScoreCached?: number;
};
