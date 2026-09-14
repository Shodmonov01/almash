"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { api, type User } from "@/lib/client";

export default function LoginPage() {
  const { user, login, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ users: User[] }>("/api/demo-users").then((d) => setUsers(d.users));
  }, []);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [user, loading, router]);

  const onPick = async (username: string) => {
    setBusy(true);
    setError("");
    try {
      await login(username);
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка входа");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4 animate-rise sm:space-y-6">
      <div className="rounded-2xl bg-forest p-5 text-cream sm:rounded-3xl sm:p-8">
        <h1 className="font-display text-2xl sm:text-3xl">Вход в SwapToy</h1>
        <p className="mt-2 text-sm text-cream/80 sm:text-base">
          MVP-авторизация имитирует Telegram Mini App: выберите демо-профиль.
          Пароли не используются.
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-coral/10 px-4 py-3 text-sm text-coral">{error}</p>
      )}

      <div className="space-y-2 sm:space-y-3">
        {users.map((u) => (
          <button
            key={u.id}
            type="button"
            disabled={busy}
            onClick={() => onPick(u.username!)}
            className="flex min-h-[4.5rem] w-full items-center gap-3 rounded-2xl bg-white/80 p-3 text-left ring-1 ring-forest/10 transition active:scale-[0.99] hover:ring-forest/30 disabled:opacity-60 sm:gap-4 sm:p-4"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={u.avatarUrl || ""}
              alt=""
              className="h-12 w-12 shrink-0 rounded-full object-cover"
            />
            <div className="min-w-0">
              <p className="font-medium">
                {u.name}{" "}
                {u.role === "ADMIN" && (
                  <span className="text-xs text-coral">admin</span>
                )}
              </p>
              <p className="truncate text-sm text-ink/55">
                @{u.username} · {u.city} · {u.trustLevel}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
