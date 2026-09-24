import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/client";
import { mediaUrl } from "@/lib/env";
import { ItemCard, type ItemCardData } from "@/components/ItemCard";
import { useTranslation } from "react-i18next";
import { LanguageList } from "@/components/LanguageSwitcher";
import { PasswordInput } from "@/components/PasswordInput";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  Camera,
  ChevronRight,
  Heart,
  Languages,
  Loader2,
  LogOut,
  Shield,
  ShieldCheck,
  Star,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  ensureTelegramWriteAccess,
  getTelegramInitData,
  isTelegramMiniApp,
  requestTelegramWidgetAuth,
} from "@/lib/telegram";

function SettingsGroup({
  title,
  icon: Icon,
  children,
}: {
  title?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section>
      {title && (
        <h2 className="mb-1.5 flex items-center gap-1.5 px-4 text-xs font-bold uppercase tracking-wide text-ink/45">
          {Icon && <Icon size={14} />}
          {title}
        </h2>
      )}
      <div className="divide-y divide-ink/[0.06] overflow-hidden rounded-2xl bg-white shadow-sm">
        {children}
      </div>
    </section>
  );
}

function SettingsRow({
  icon: Icon,
  iconBg,
  label,
  to,
  onClick,
  danger,
}: {
  icon: LucideIcon;
  iconBg: string;
  label: string;
  to?: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  const content = (
    <>
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-white ${iconBg}`}>
        <Icon size={18} strokeWidth={2.2} />
      </span>
      <span className={`flex-1 text-[15px] font-semibold ${danger ? "text-coral" : "text-ink"}`}>
        {label}
      </span>
      {!danger && <ChevronRight size={18} className="shrink-0 text-ink/25" />}
    </>
  );
  const className =
    "flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 text-left transition active:bg-ink/[0.04]";

  return to ? (
    <Link to={to} className={className}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

export default function ProfilePage() {
  const { user, loading, logout, refresh, loginTelegram, telegram } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [items, setItems] = useState<(ItemCardData & { status?: string })[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [listingErr, setListingErr] = useState("");
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
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarErr, setAvatarErr] = useState("");

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
        {/* Telegram-style header: centred avatar, name, handle, quick stats */}
        <section className="flex flex-col items-center px-2 pt-2 text-center">
          <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarBusy}
              aria-label={t("profile.avatar.change")}
              title={t("profile.avatar.change")}
              className="group relative rounded-full transition active:scale-95"
          >
            <img
                src={mediaUrl(user.avatarUrl) || "https://placehold.co/96x96"}
                alt=""
                className="h-24 w-24 rounded-full object-cover shadow-[0_8px_24px_rgba(23,21,31,0.12)] ring-4 ring-white"
            />
            {avatarBusy && (
                <span className="absolute inset-0 grid place-items-center rounded-full bg-ink/45">
                  <Loader2 size={28} className="animate-spin text-white" />
                </span>
            )}
            <span className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full bg-forest text-white shadow-md ring-[3px] ring-cream">
              <Camera size={16} strokeWidth={2.4} />
            </span>
          </button>
          <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                setAvatarBusy(true);
                setAvatarErr("");
                try {
                  const form = new FormData();
                  form.append("file", file);
                  await api("/api/me/avatar", { method: "POST", body: form });
                  await refresh();
                } catch (err) {
                  setAvatarErr(err instanceof Error ? err.message : t("common.error"));
                } finally {
                  setAvatarBusy(false);
                }
              }}
          />
          {avatarErr && <p className="mt-2 text-sm font-semibold text-coral">{avatarErr}</p>}
          <h1 className="mt-3 max-w-full break-words font-display text-2xl text-ink sm:text-3xl">
            {user.name}
          </h1>
          <p className="mt-0.5 max-w-full truncate text-sm font-semibold text-ink/50">
            @{user.username}
            {user.city ? ` · ${user.city}` : ""}
          </p>

          <div className="mt-4 grid w-full max-w-md grid-cols-3 divide-x divide-ink/[0.06] overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="flex flex-col items-center gap-0.5 px-2 py-3">
              <span className="flex items-center gap-1 text-base font-extrabold text-ink">
                <Star size={15} className="fill-amber-400 text-amber-400" />
                {(user.rating ?? 0).toFixed(1)}
              </span>
              <span className="text-[11px] font-semibold text-ink/45">{t("profile.stats.rating")}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 px-2 py-3">
              <span className="text-base font-extrabold text-ink">{user.completedTrades ?? 0}</span>
              <span className="text-[11px] font-semibold text-ink/45">{t("profile.stats.trades")}</span>
            </div>
            <div className="flex min-w-0 flex-col items-center gap-0.5 px-2 py-3">
              <span className="flex max-w-full items-center gap-1 text-base font-extrabold text-ink">
                <ShieldCheck size={15} className="shrink-0 text-forest" />
                <span className="truncate">{trust}</span>
              </span>
              <span className="text-[11px] font-semibold text-ink/45">{t("profile.stats.trust")}</span>
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-md space-y-5">
          <SettingsGroup>
            <SettingsRow to="/favorites" icon={Heart} iconBg="bg-coral" label={t("profile.favorites")} />
            <SettingsRow to="/notifications" icon={Bell} iconBg="bg-amber-400" label={t("profile.alerts")} />
          </SettingsGroup>

          {/* The admin link lives only in the desktop header, so phones reach it from here. */}
          {user.role === "ADMIN" && (
              <SettingsGroup>
                <SettingsRow to="/admin" icon={Shield} iconBg="bg-ink" label={t("nav.admin")} />
              </SettingsGroup>
          )}

          {/* Interface language: ru (default) / uz */}
          <SettingsGroup title={t("lang.label")} icon={Languages}>
            <LanguageList />
          </SettingsGroup>

          <SettingsGroup>
            <SettingsRow
                icon={LogOut}
                iconBg="bg-coral"
                label={t("profile.logout")}
                danger
                onClick={async () => {
                  await logout();
                  navigate("/login");
                }}
            />
          </SettingsGroup>
        </div>

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
                <PasswordInput
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder={t("profile.security.current")}
                    autoComplete="current-password"
                    className="rounded-2xl border border-ink/10 bg-cream px-4 py-3 font-semibold"
                />
            )}
            <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t(user.hasPassword ? "profile.security.new" : "profile.security.set")}
                minLength={8}
                required
                autoComplete="new-password"
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
          {listingErr && (
              <p className="rounded-xl bg-coral/10 px-4 py-3 text-sm font-semibold text-coral">{listingErr}</p>
          )}
          {items.length === 0 ? (
              <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm font-semibold text-ink/50 shadow-sm">
                {t("profile.listings.empty")}
              </p>
          ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
                {items.map((item) => {
                  const inTrade = item.status === "IN_TRADE";
                  const deleting = deletingId === item.id;
                  return (
                      <div key={item.id} className={`relative transition ${deleting ? "opacity-50" : ""}`}>
                        <ItemCard item={item} />
                        <button
                            type="button"
                            disabled={deleting}
                            aria-label={t("profile.listings.delete")}
                            title={inTrade ? t("profile.listings.inTrade") : t("profile.listings.delete")}
                            onClick={async () => {
                              setListingErr("");
                              if (inTrade) {
                                setListingErr(t("profile.listings.inTrade"));
                                return;
                              }
                              if (!confirm(t("profile.listings.confirmDelete", { title: item.title }))) return;
                              setDeletingId(item.id);
                              try {
                                await api(`/api/items/${item.id}`, { method: "DELETE" });
                                setItems((prev) => prev.filter((i) => i.id !== item.id));
                                loadSets();
                              } catch (e) {
                                setListingErr(e instanceof Error ? e.message : t("common.error"));
                              } finally {
                                setDeletingId(null);
                              }
                            }}
                            className={`absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full shadow-md backdrop-blur-sm transition active:scale-90 ${
                              inTrade ? "bg-white/70 text-ink/30" : "bg-white/90 text-coral hover:bg-coral hover:text-white"
                            }`}
                        >
                          {deleting ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={17} />}
                        </button>
                      </div>
                  );
                })}
              </div>
          )}
        </section>
      </div>
  );
}
