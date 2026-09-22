"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ToyMascot } from "@/components/ToyMascot";
import { CITIES } from "@/lib/constants";

const fieldClass =
  "w-full rounded-2xl border border-forest/15 bg-white px-4 py-3 font-semibold text-ink outline-none ring-forest/30 focus:ring-2";

export default function LoginPage() {
  const { user, login, register, loading } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [user, loading, router]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const username = String(fd.get("username") || "");
    const password = String(fd.get("password") || "");
    try {
      if (mode === "register") {
        const confirm = String(fd.get("confirm") || "");
        if (password !== confirm) {
          throw new Error("Пароли не совпадают");
        }
        await register({
          username,
          password,
          name: String(fd.get("name") || ""),
          city: String(fd.get("city") || ""),
        });
      } else {
        await login(username, password);
      }
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
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

        <form onSubmit={onSubmit} className="space-y-3 px-4 pb-5 pt-16 sm:px-5">
          {error && (
            <p className="rounded-2xl bg-coral/10 px-4 py-3 text-sm font-semibold text-coral">
              {error}
            </p>
          )}

          {mode === "register" && (
            <label className="block space-y-1 text-sm font-bold text-ink/70">
              Имя
              <input
                name="name"
                required
                minLength={2}
                maxLength={40}
                autoComplete="name"
                className={fieldClass}
                placeholder="Как к вам обращаться"
              />
            </label>
          )}

          <label className="block space-y-1 text-sm font-bold text-ink/70">
            Логин
            <input
              name="username"
              required
              minLength={3}
              maxLength={20}
              autoComplete="username"
              pattern="[A-Za-z0-9_]+"
              className={fieldClass}
              placeholder="username"
            />
          </label>

          {mode === "register" && (
            <label className="block space-y-1 text-sm font-bold text-ink/70">
              Город
              <select name="city" required defaultValue="Ташкент" className={fieldClass}>
                {CITIES.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block space-y-1 text-sm font-bold text-ink/70">
            Пароль
            <input
              name="password"
              type="password"
              required
              minLength={mode === "register" ? 8 : 1}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              className={fieldClass}
              placeholder={mode === "register" ? "не меньше 8 символов" : "••••••••"}
            />
          </label>

          {mode === "register" && (
            <label className="block space-y-1 text-sm font-bold text-ink/70">
              Повторите пароль
              <input
                name="confirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className={fieldClass}
                placeholder="ещё раз"
              />
            </label>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex min-h-12 w-full items-center justify-center rounded-full bg-forest text-base font-extrabold text-white shadow-[0_6px_0_#6f63d6] transition active:translate-y-0.5 active:shadow-none disabled:opacity-60"
          >
            {busy
              ? "Секунду…"
              : mode === "register"
                ? "Создать аккаунт"
                : "Войти"}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setError("");
              setMode((m) => (m === "login" ? "register" : "login"));
            }}
            className="w-full py-2 text-sm font-bold text-ink/55 hover:text-ink"
          >
            {mode === "login"
              ? "Нет аккаунта? Зарегистрироваться"
              : "Уже есть аккаунт? Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}
