import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ToyMascot } from "@/components/ToyMascot";
import { useNavigate } from "react-router-dom";
import {
  getTelegramInitData,
  isTelegramMiniApp,
  requestTelegramWidgetAuth,
} from "@/lib/telegram";

const DEMO_ACCOUNTS = ["aliya", "bobur", "dilnoza", "admin"] as const;

export default function LoginPage() {
  const { user, login, register, loginTelegram, loading, telegram } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("Ташкент");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inMiniApp = isTelegramMiniApp();
  const canTelegram = inMiniApp || Boolean(telegram.botId);

  useEffect(() => {
    if (!loading && user) navigate("/", { replace: true });
  }, [user, loading, navigate]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "register") {
        await register({ username, password, name, city });
      } else {
        await login(username, password);
      }
      navigate("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка входа");
    } finally {
      setBusy(false);
    }
  };

  const onTelegram = async () => {
    setBusy(true);
    setError("");
    try {
      const initData = getTelegramInitData();
      if (initData) {
        await loginTelegram({ initData });
      } else if (telegram.botId) {
        const widget = await requestTelegramWidgetAuth(telegram.botId);
        await loginTelegram({ telegramWidget: widget });
      } else {
        throw new Error(
          "Telegram-вход ещё не настроен. Нужен токен бота от BotFather.",
        );
      }
      navigate("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка входа через Telegram");
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = (loginName: string) => {
    setMode("login");
    setUsername(loginName);
    setPassword("demo1234");
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

        <div className="space-y-4 px-4 pb-5 pt-16 sm:px-5">
          {error && (
            <p className="rounded-2xl bg-coral/10 px-4 py-3 text-sm font-semibold text-coral">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 rounded-full bg-cream p-1 text-sm font-extrabold">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`rounded-full py-2 ${
                mode === "login" ? "bg-white text-ink shadow-sm" : "text-ink/50"
              }`}
            >
              Вход
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`rounded-full py-2 ${
                mode === "register" ? "bg-white text-ink shadow-sm" : "text-ink/50"
              }`}
            >
              Регистрация
            </button>
          </div>

          <form className="space-y-3" onSubmit={onSubmit}>
            {mode === "register" && (
              <>
                <label className="block">
                  <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-ink/50">
                    Имя
                  </span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
                    className="w-full rounded-2xl border border-ink/10 bg-cream px-4 py-3 font-semibold outline-none ring-forest/30 focus:ring-2"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-ink/50">
                    Город
                  </span>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                    className="w-full rounded-2xl border border-ink/10 bg-cream px-4 py-3 font-semibold outline-none ring-forest/30 focus:ring-2"
                  />
                </label>
              </>
            )}
            <label className="block">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-ink/50">
                Логин
              </span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="w-full rounded-2xl border border-ink/10 bg-cream px-4 py-3 font-semibold outline-none ring-forest/30 focus:ring-2"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-ink/50">
                Пароль
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === "register" ? 8 : 1}
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
                className="w-full rounded-2xl border border-ink/10 bg-cream px-4 py-3 font-semibold outline-none ring-forest/30 focus:ring-2"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="flex min-h-12 w-full items-center justify-center rounded-full bg-forest text-sm font-extrabold text-white shadow-[0_5px_0_#6f63d6] transition active:translate-y-0.5 active:shadow-none disabled:opacity-60"
            >
              {mode === "register" ? "Создать аккаунт" : "Войти"}
            </button>
          </form>

          {telegram.demoHint && (
            <div className="rounded-2xl bg-cream px-3 py-3">
              <p className="mb-2 text-center text-[11px] font-extrabold uppercase tracking-wide text-ink/45">
                Демо-аккаунты · пароль demo1234
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {DEMO_ACCOUNTS.map((loginName) => (
                  <button
                    key={loginName}
                    type="button"
                    disabled={busy}
                    onClick={() => fillDemo(loginName)}
                    className="rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-ink shadow-sm"
                  >
                    @{loginName}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 text-xs font-extrabold uppercase tracking-wide text-ink/35">
            <span className="h-px flex-1 bg-ink/10" />
            или
            <span className="h-px flex-1 bg-ink/10" />
          </div>

          <button
            type="button"
            disabled={busy || !canTelegram}
            onClick={onTelegram}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#2AABEE] text-sm font-extrabold text-white shadow-[0_5px_0_#1e8fc7] transition active:translate-y-0.5 active:shadow-none disabled:opacity-50"
          >
            <TelegramMark />
            Войти через Telegram
          </button>
          {!canTelegram && (
            <p className="text-center text-xs font-semibold text-ink/45">
              Кнопка заработает после настройки бота в BotFather.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function TelegramMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M21.9 4.3c.3-.9-.5-1.6-1.3-1.3L2.6 9.2c-.9.3-.9 1.5.1 1.8l4.7 1.5 1.8 5.5c.3.8 1.3 1 1.9.4l2.7-2.7 4.7 3.5c.7.5 1.7.1 1.9-.7z"
      />
    </svg>
  );
}
