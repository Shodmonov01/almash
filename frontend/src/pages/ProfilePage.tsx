import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/client";
import { mediaUrl } from "@/lib/env";
import { ItemCard, type ItemCardData } from "@/components/ItemCard";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Link, useNavigate } from "react-router-dom";
import {
  ensureTelegramWriteAccess,
  getTelegramInitData,
  isTelegramMiniApp,
  requestTelegramWidgetAuth,
} from "@/lib/telegram";

export default function ProfilePage() {
  const { user, loading, logout, refresh, loginTelegram, telegram } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [items, setItems] = useState<ItemCardData[]>([]);
  const [sets, setSets] = useState<
      {
        id: string;
        title: string;
        description?: string | null;
        items: { item: ItemCardData }[];
      }[]
  >([]);
  const [isCreatingSet, setIsCreatingSet] = useState(false);
  const [newSetTitle, setNewSetTitle] = useState("");
  const [newSetDesc, setNewSetDesc] = useState("");
  const [selectedSetItemIds, setSelectedSetItemIds] = useState<string[]>([]);
  const [itemSetBusy, setItemSetBusy] = useState(false);
  const [itemSetError, setItemSetError] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [securityMsg, setSecurityMsg] = useState("");
  const [securityErr, setSecurityErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [user, loading, navigate]);

  const loadSets = () => {
    if (!user) return;
    api<{ sets: typeof sets }>("/api/sets").then((d) => setSets(d.sets || []));
  };

  useEffect(() => {
    if (!user) return;
    api<{ items: ItemCardData[] }>(`/api/items?ownerId=${user.id}`).then((d) =>
        setItems(d.items),
    );
    loadSets();
  }, [user]);

  if (!user) return null;

  const trust = t(`trust.${user.trustLevel}`, { defaultValue: user.trustLevel });

  return (
      <div className="space-y-6 animate-rise sm:space-y-8">
        <section className="flex flex-col gap-4 rounded-2xl bg-forest p-4 text-cream sm:flex-row sm:flex-wrap sm:items-center sm:rounded-3xl sm:p-6">
          <img
              src={mediaUrl(user.avatarUrl) || ""}
              alt=""
              className="h-16 w-16 rounded-full object-cover ring-4 ring-cream/20 sm:h-20 sm:w-20"
          />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl sm:text-3xl">{user.name}</h1>
            <p className="text-sm text-cream/70">
              @{user.username} · {user.city} · {trust}
            </p>
            <p className="mt-1 text-sm text-cream/60">
              ★ {(user.rating ?? 0).toFixed(1)} ·{" "}
              {t("profile.trades", { count: user.completedTrades ?? 0 })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
                to="/favorites"
                className="inline-flex min-h-10 items-center rounded-xl bg-cream/15 px-4 py-2 text-sm"
            >
              {t("profile.favorites")}
            </Link>
            <Link
                to="/notifications"
                className="inline-flex min-h-10 items-center rounded-xl bg-cream/15 px-4 py-2 text-sm"
            >
              {t("profile.alerts")}
            </Link>
            <button
                type="button"
                onClick={async () => {
                  await logout();
                  navigate("/login");
                }}
                className="inline-flex min-h-10 items-center rounded-xl bg-cream/15 px-4 py-2 text-sm"
            >
              {t("profile.logout")}
            </button>
          </div>

          {/* Interface language: ru (default) / uz */}
          <div className="flex w-full flex-wrap items-center justify-between gap-3 border-t border-cream/15 pt-3">
            <span className="text-sm font-semibold text-cream/75">{t("lang.label")}</span>
            <LanguageSwitcher tone="dark" />
          </div>
        </section>

        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <h2 className="font-display text-2xl text-forest">{t("profile.security.title")}</h2>
          <p className="text-sm font-semibold text-ink/60">
            {t("profile.security.status", {
              telegram: t(user.telegramLinked ? "profile.security.tgLinked" : "profile.security.tgNotLinked"),
              password: t(user.hasPassword ? "profile.security.pwSet" : "profile.security.pwNotSet"),
            })}
          </p>

          {/* TZ §50: Telegram notifications on/off */}
          <div className="flex items-start justify-between gap-3 rounded-2xl bg-cream/60 p-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink">{t("profile.tg.title")}</p>
              <p className="text-xs text-ink/55">
                {user.telegramLinked
                  ? t("profile.tg.hint", { bot: telegram.botUsername ? `@${telegram.botUsername}` : "" })
                  : t("profile.tg.notLinked")}
              </p>
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={user.telegramLinked && user.tgNotify !== false}
                aria-label={t("profile.tg.title")}
                disabled={!user.telegramLinked || busy}
                onClick={async () => {
                  const next = !(user.tgNotify !== false);
                  setBusy(true);
                  setSecurityErr("");
                  try {
                    if (next) await ensureTelegramWriteAccess();
                    await api("/api/me", {
                      method: "PATCH",
                      body: JSON.stringify({ tgNotify: next }),
                    });
                    await refresh();
                  } catch (e) {
                    setSecurityErr(e instanceof Error ? e.message : t("common.error"));
                  } finally {
                    setBusy(false);
                  }
                }}
                className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-40 ${
                  user.telegramLinked && user.tgNotify !== false ? "bg-forest" : "bg-ink/20"
                }`}
            >
              <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                    user.telegramLinked && user.tgNotify !== false ? "left-[1.375rem]" : "left-0.5"
                  }`}
              />
            </button>
          </div>
          {securityErr && (
              <p className="text-sm font-semibold text-coral">{securityErr}</p>
          )}
          {securityMsg && (
              <p className="text-sm font-semibold text-forest">{securityMsg}</p>
          )}
          <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={async (event) => {
                event.preventDefault();
                setBusy(true);
                setSecurityErr("");
                setSecurityMsg("");
                try {
                  await api("/api/me", {
                    method: "PATCH",
                    body: JSON.stringify({
                      password,
                      ...(user.hasPassword ? { currentPassword } : {}),
                    }),
                  });
                  setPassword("");
                  setCurrentPassword("");
                  setSecurityMsg(t("profile.security.saved"));
                  await refresh();
                } catch (e) {
                  setSecurityErr(e instanceof Error ? e.message : t("common.error"));
                } finally {
                  setBusy(false);
                }
              }}
          >
            {user.hasPassword && (
                <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder={t("profile.security.current")}
                    className="rounded-2xl border border-ink/10 bg-cream px-4 py-3 font-semibold"
                />
            )}
            <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t(user.hasPassword ? "profile.security.new" : "profile.security.set")}
                minLength={8}
                required
                className="rounded-2xl border border-ink/10 bg-cream px-4 py-3 font-semibold"
            />
            <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-ink px-4 py-3 text-sm font-extrabold text-cream disabled:opacity-60 sm:col-span-2"
            >
              {t(user.hasPassword ? "profile.security.change" : "profile.security.save")}
            </button>
          </form>
          {!user.telegramLinked && (
              <button
                  type="button"
                  disabled={busy || (!isTelegramMiniApp() && !telegram.botId)}
                  onClick={async () => {
                    setBusy(true);
                    setSecurityErr("");
                    setSecurityMsg("");
                    try {
                      const initData = getTelegramInitData();
                      if (initData) {
                        await loginTelegram({ initData });
                      } else if (telegram.botId) {
                        const widget = await requestTelegramWidgetAuth(telegram.botId);
                        await loginTelegram({ telegramWidget: widget });
                      } else {
                        throw new Error(t("profile.security.botNotConfigured"));
                      }
                      setSecurityMsg(t("profile.security.tgLinkedOk"));
                      await refresh();
                    } catch (e) {
                      setSecurityErr(e instanceof Error ? e.message : t("common.error"));
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="w-full rounded-full bg-[#2AABEE] px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50"
              >
                {t("profile.security.linkTelegram")}
              </button>
          )}
        </section>

        {/* Мои наборы (ItemSets - TZ п. 8) */}
        <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <h2 className="font-display text-xl leading-tight text-forest sm:text-2xl">{t("profile.sets.title")}</h2>
              <p className="mt-1 text-xs leading-relaxed text-ink/60">
                {t("profile.sets.hint")}
              </p>
            </div>
            <button
                type="button"
                onClick={() => {
                  setIsCreatingSet((v) => !v);
                  setItemSetError("");
                }}
                className={`inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-full px-5 text-sm font-extrabold transition sm:w-auto ${
                  isCreatingSet
                    ? "bg-ink/5 text-ink/70 hover:bg-ink/10"
                    : "bg-forest text-cream shadow-[0_4px_0_#6f63d6] hover:brightness-105"
                }`}
            >
              {isCreatingSet ? t("profile.sets.cancel") : t("profile.sets.create")}
            </button>
          </div>

          {isCreatingSet && (
              <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (selectedSetItemIds.length === 0) {
                      setItemSetError(t("profile.sets.pickOne"));
                      return;
                    }
                    setItemSetBusy(true);
                    setItemSetError("");
                    try {
                      await api("/api/sets", {
                        method: "POST",
                        body: JSON.stringify({
                          title: newSetTitle,
                          description: newSetDesc || undefined,
                          itemIds: selectedSetItemIds,
                        }),
                      });
                      setNewSetTitle("");
                      setNewSetDesc("");
                      setSelectedSetItemIds([]);
                      setIsCreatingSet(false);
                      loadSets();
                    } catch (err) {
                      setItemSetError(
                          err instanceof Error ? err.message : t("profile.sets.createError"),
                      );
                    } finally {
                      setItemSetBusy(false);
                    }
                  }}
                  className="space-y-3 rounded-2xl bg-mist/40 p-3 sm:p-4"
              >
                <p className="text-sm font-bold text-ink">{t("profile.sets.newTitle")}</p>
                {itemSetError && (
                    <p className="text-xs font-semibold text-coral">{itemSetError}</p>
                )}
                <input
                    type="text"
                    required
                    placeholder={t("profile.sets.namePlaceholder")}
                    value={newSetTitle}
                    onChange={(e) => setNewSetTitle(e.target.value)}
                    className="min-h-11 w-full rounded-xl border border-forest/15 bg-white px-3 py-2 text-base outline-none focus:border-forest sm:text-sm"
                />
                <input
                    type="text"
                    placeholder={t("profile.sets.descPlaceholder")}
                    value={newSetDesc}
                    onChange={(e) => setNewSetDesc(e.target.value)}
                    className="min-h-11 w-full rounded-xl border border-forest/15 bg-white px-3 py-2 text-base outline-none focus:border-forest sm:text-sm"
                />
                <div>
                  <p className="mb-2 text-xs font-semibold text-ink/70">
                    {t("profile.sets.pickItems")}
                  </p>
                  {items.length === 0 ? (
                      <p className="text-xs text-ink/50">
                        {t("profile.sets.noItems")}
                      </p>
                  ) : (
                      <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto overscroll-contain pr-1 min-[380px]:grid-cols-2 sm:grid-cols-3">
                        {items.map((it) => {
                          const isSelected = selectedSetItemIds.includes(it.id);
                          return (
                              <button
                                  type="button"
                                  key={it.id}
                                  aria-pressed={isSelected}
                                  onClick={() =>
                                      setSelectedSetItemIds((prev) =>
                                          isSelected
                                              ? prev.filter((id) => id !== it.id)
                                              : [...prev, it.id],
                                      )
                                  }
                                  className={`flex min-h-14 w-full items-center gap-2 rounded-xl p-2 text-left text-xs transition ${
                                      isSelected
                                          ? "bg-forest/15 ring-2 ring-forest"
                                          : "bg-white hover:bg-forest/5"
                                  }`}
                              >
                                <img
                                    src={mediaUrl(it.media?.[0]?.url) || ""}
                                    alt=""
                                    className="h-10 w-10 shrink-0 rounded-lg object-cover"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-semibold">{it.title}</p>
                                  <p className="text-[10px] text-ink/60">{it.condition}</p>
                                </div>
                                <span
                                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                                        isSelected ? "bg-forest text-cream" : "ring-1 ring-ink/20"
                                    }`}
                                >
                                  {isSelected ? "✓" : ""}
                                </span>
                              </button>
                          );
                        })}
                      </div>
                  )}
                </div>
                <button
                    type="submit"
                    disabled={itemSetBusy || items.length === 0}
                    className="min-h-11 w-full rounded-full bg-forest py-2.5 text-sm font-extrabold text-cream disabled:opacity-50"
                >
                  {itemSetBusy ? t("profile.sets.saving") : t("profile.sets.save")}
                </button>
              </form>
          )}

          {sets.length === 0 ? (
              <p className="text-xs text-ink/50">
                {t("profile.sets.empty")}
              </p>
          ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {sets.map((s) => (
                    <div
                        key={s.id}
                        className="space-y-2 rounded-xl border border-forest/10 bg-white/80 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="break-words font-display text-base text-ink">{s.title}</h3>
                          {s.description && (
                              <p className="text-xs text-ink/60">{s.description}</p>
                          )}
                        </div>
                        <button
                            type="button"
                            onClick={async () => {
                              if (!confirm(t("profile.sets.confirmDelete", { title: s.title }))) return;
                              await api(`/api/sets?id=${s.id}`, { method: "DELETE" });
                              loadSets();
                            }}
                            className="-mr-1 -mt-1 inline-flex min-h-9 shrink-0 items-center rounded-full px-3 text-xs font-bold text-coral/80 hover:bg-coral/10 hover:text-coral"
                        >
                          {t("profile.sets.delete")}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {s.items.map(({ item }) => (
                            <div
                                key={item.id}
                                className="flex items-center gap-1.5 rounded-lg bg-mist/60 px-2 py-1 text-[11px]"
                            >
                              <img
                                  src={mediaUrl(item.media?.[0]?.url) || ""}
                                  alt=""
                                  className="h-5 w-5 rounded object-cover"
                              />
                              <span className="max-w-[9rem] truncate">{item.title}</span>
                            </div>
                        ))}
                      </div>
                    </div>
                ))}
              </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl text-forest">{t("profile.listings.title")}</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {items.map((item) => (
                <ItemCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      </div>
  );
}
