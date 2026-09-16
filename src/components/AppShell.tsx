"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Heart,
  Home,
  Layers,
  Plus,
  RefreshCw,
  Shield,
  User as UserIcon,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "./AuthProvider";
import { api } from "@/lib/client";

const desktopLinks = [
  { href: "/", label: "Свайп", icon: Heart },
  { href: "/browse", label: "Каталог", icon: Layers },
  { href: "/items/new", label: "Добавить", icon: Plus },
  { href: "/trades", label: "Обмены", icon: RefreshCw },
  { href: "/matches", label: "Матчи", icon: Home },
  { href: "/profile", label: "Профиль", icon: UserIcon },
];

const mobileTabs = [
  { href: "/", label: "Свайп", icon: Heart },
  { href: "/trades", label: "Обмены", icon: RefreshCw },
  { href: "/items/new", label: "Добавить", icon: Plus, emphasize: true },
  { href: "/browse", label: "Каталог", icon: Layers },
  { href: "/profile", label: "Профиль", icon: UserIcon },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const swipeHome = pathname === "/";
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    api<{ unread: number }>("/api/notifications")
      .then((d) => setUnread(d.unread || 0))
      .catch(() => setUnread(0));
  }, [user, pathname]);

  return (
    <div className="flex min-h-[100dvh] flex-col overflow-x-hidden">
      <header className="sticky top-0 z-40 bg-cream/80 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-3 sm:h-16 sm:px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-2xl bg-forest text-sm font-black text-white shadow-[0_6px_0_#1B1828]">
              ⇄
            </span>
            <span className="font-display text-xl text-ink sm:text-2xl">
              SwapToy
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {desktopLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold transition",
                  isActive(pathname, href)
                    ? "bg-ink text-cream"
                    : "text-ink/60 hover:bg-white hover:text-ink",
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            ))}
            {user?.role === "ADMIN" && (
              <Link
                href="/admin"
                className={clsx(
                  "flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold transition",
                  pathname.startsWith("/admin")
                    ? "bg-coral text-white"
                    : "text-ink/60 hover:bg-coral/10",
                )}
              >
                <Shield size={16} />
                Админ
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {user && (
              <Link
                href="/notifications"
                className={clsx(
                  "relative inline-flex h-10 w-10 items-center justify-center rounded-full transition",
                  isActive(pathname, "/notifications")
                    ? "bg-ink text-cream"
                    : "bg-white text-ink shadow-sm",
                )}
                aria-label="Уведомления"
              >
                <Bell size={18} />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 text-[10px] font-black text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
            )}
            {user ? (
              <Link
                href="/profile"
                className="flex max-w-[40vw] items-center gap-2 rounded-full bg-white py-1 pl-1 pr-2.5 text-sm font-bold shadow-sm sm:pr-3"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={user.avatarUrl || "https://placehold.co/40x40"}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-sand"
                />
                <span className="hidden truncate sm:inline">{user.name}</span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex h-10 items-center rounded-full bg-ink px-4 text-sm font-bold text-cream"
              >
                Войти
              </Link>
            )}
          </div>
        </div>
      </header>

      <main
        className={clsx(
          "mx-auto w-full flex-1 px-3 pb-[calc(6.25rem+env(safe-area-inset-bottom))] pt-3 sm:px-4 sm:py-6 md:pb-8",
          swipeHome ? "max-w-lg" : "max-w-6xl",
        )}
      >
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
        aria-label="Мобильная навигация"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 rounded-[1.7rem] bg-ink p-1.5 text-cream shadow-[0_12px_40px_rgba(23,21,31,0.28)]">
          {mobileTabs.map(({ href, label, icon: Icon, emphasize }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[10px] font-bold",
                  active && !emphasize ? "text-sand" : "text-cream/45",
                )}
              >
                <span
                  className={clsx(
                    "flex items-center justify-center rounded-2xl transition",
                    emphasize
                      ? "h-11 w-11 -translate-y-0.5 bg-sand text-ink shadow-[0_4px_0_#b8d63a]"
                      : active
                        ? "h-9 w-9 bg-white/10"
                        : "h-9 w-9",
                  )}
                >
                  <Icon size={emphasize ? 22 : 20} strokeWidth={active ? 2.6 : 2} />
                </span>
                <span className={clsx(emphasize && "text-sand")}>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
