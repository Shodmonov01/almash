"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Heart,
  Home,
  MessageCircle,
  PlusCircle,
  RefreshCw,
  Shield,
  User as UserIcon,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "./AuthProvider";

const desktopLinks = [
  { href: "/", label: "Найти", icon: Home },
  { href: "/items/new", label: "Добавить", icon: PlusCircle },
  { href: "/trades", label: "Обмены", icon: RefreshCw },
  { href: "/favorites", label: "Избранное", icon: Heart },
  { href: "/matches", label: "Match", icon: MessageCircle },
  { href: "/notifications", label: "Алерты", icon: Bell },
  { href: "/profile", label: "Профиль", icon: UserIcon },
];

/** Primary thumb-zone tabs for phones */
const mobileTabs = [
  { href: "/", label: "Найти", icon: Home },
  { href: "/trades", label: "Обмены", icon: RefreshCw },
  { href: "/items/new", label: "Добавить", icon: PlusCircle, emphasize: true },
  { href: "/matches", label: "Match", icon: MessageCircle },
  { href: "/profile", label: "Профиль", icon: UserIcon },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <div className="flex min-h-[100dvh] flex-col overflow-x-hidden">
      <header className="sticky top-0 z-40 border-b border-forest/10 bg-[rgba(247,250,248,0.92)] pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-3 sm:h-16 sm:px-4">
          <Link href="/" className="min-w-0 shrink-0">
            <span className="font-display text-xl tracking-tight text-forest sm:text-2xl">
              SwapToy
            </span>
          </Link>

          <nav className="hidden items-center gap-0.5 lg:flex">
            {desktopLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm transition",
                  isActive(pathname, href)
                    ? "bg-forest text-cream"
                    : "text-ink/70 hover:bg-forest/5 hover:text-forest",
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
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm transition",
                  pathname.startsWith("/admin")
                    ? "bg-coral text-white"
                    : "text-ink/70 hover:bg-coral/10",
                )}
              >
                <Shield size={16} />
                Админ
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/notifications"
              className={clsx(
                "inline-flex h-10 w-10 items-center justify-center rounded-full transition lg:hidden",
                isActive(pathname, "/notifications")
                  ? "bg-forest text-cream"
                  : "bg-forest/5 text-forest",
              )}
              aria-label="Уведомления"
            >
              <Bell size={18} />
            </Link>
            {user ? (
              <Link
                href="/profile"
                className="flex max-w-[40vw] items-center gap-2 rounded-full bg-forest/5 py-1 pl-1 pr-2.5 text-sm sm:pr-3"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={user.avatarUrl || "https://placehold.co/40x40"}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-full object-cover"
                />
                <span className="hidden truncate sm:inline">{user.name}</span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex h-10 items-center rounded-xl bg-coral px-3.5 text-sm font-medium text-white"
              >
                Войти
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-4 sm:py-6 md:pb-8">
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-forest/10 bg-[rgba(247,250,248,0.96)] pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        aria-label="Мобильная навигация"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 px-1 pt-1">
          {mobileTabs.map(({ href, label, icon: Icon, emphasize }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium",
                  active ? "text-forest" : "text-ink/45",
                )}
              >
                <span
                  className={clsx(
                    "flex items-center justify-center rounded-2xl transition",
                    emphasize
                      ? "h-11 w-11 -translate-y-1 bg-coral text-white shadow-lg shadow-coral/30"
                      : active
                        ? "h-9 w-9 bg-forest/10"
                        : "h-9 w-9",
                  )}
                >
                  <Icon size={emphasize ? 22 : 20} strokeWidth={active ? 2.4 : 2} />
                </span>
                <span className={clsx(emphasize && "text-coral")}>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
