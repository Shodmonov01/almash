"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { api, type User } from "@/lib/client";
import { ToyMascot } from "@/components/ToyMascot";

const TILE = ["bg-mist", "bg-lilac", "bg-sand", "bg-coral text-white"];

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
    <div className="mx-auto max-w-md animate-rise">
      <div className="overflow-hidden rounded-[2rem] bg-white shadow-[0_20px_50px_rgba(23,21,31,0.12)]">
        <div className="relative bg-forest px-6 pb-20 pt-10 text-center text-white">
          <p className="font-display text-5xl leading-none">SwapToy</p>
          <p className="mt-2 text-sm font-semibold text-white/85">
            меняйся игрушками — весело и без денег
          </p>
          <div className="absolute -bottom-12 left-1/2 w-36 -translate-x-1/2">
            <ToyMascot mood="wave" />
          </div>
        </div>

        <div className="space-y-3 px-4 pb-5 pt-16 sm:px-5">
          {error && (
            <p className="rounded-2xl bg-coral/10 px-4 py-3 text-sm font-semibold text-coral">
              {error}
            </p>
          )}
          {users.map((u, i) => (
            <button
              key={u.id}
              type="button"
              disabled={busy}
              onClick={() => onPick(u.username!)}
              className={`flex min-h-[4.5rem] w-full items-center gap-3 rounded-[1.4rem] p-3 text-left shadow-[0_6px_0_rgba(23,21,31,0.08)] transition active:translate-y-0.5 active:shadow-none disabled:opacity-60 ${TILE[i % TILE.length]}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={u.avatarUrl || ""}
                alt=""
                className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-white/70"
              />
              <div className="min-w-0">
                <p className="font-display text-lg leading-tight">
                  {u.name}{" "}
                  {u.role === "ADMIN" && (
                    <span className="text-xs font-bold opacity-80">admin</span>
                  )}
                </p>
                <p className="truncate text-sm font-semibold opacity-70">
                  @{u.username} · {u.city}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
