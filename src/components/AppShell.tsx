"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
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

const links = [
  { href: "/", label: "Найти", icon: Home },
  { href: "/items/new", label: "Добавить", icon: PlusCircle },
  { href: "/trades", label: "Обмены", icon: RefreshCw },
  { href: "/favorites", label: "Избранное", icon: Heart },
  { href: "/matches", label: "Match", icon: MessageCircle },
  { href: "/profile", label: "Профиль", icon: UserIcon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-forest/10 bg-[rgba(247,250,248,0.85)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="group flex items-baseline gap-2">
            <span className="font-display text-2xl tracking-tight text-forest">
              SwapToy
            </span>
            <span className="hidden text-xs text-ink/50 sm:inline">
              обмен без денег
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition",
                  pathname === href
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
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition",
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
          <div className="flex items-center gap-2">
            {user ? (
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-full bg-forest/5 py-1 pl-1 pr-3 text-sm"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={user.avatarUrl || "https://placehold.co/40x40"}
                  alt=""
                  className="h-8 w-8 rounded-full object-cover"
                />
                <span className="hidden sm:inline">{user.name}</span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="rounded-lg bg-coral px-3 py-2 text-sm font-medium text-white"
              >
                Войти
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>

      <nav className="sticky bottom-0 z-40 border-t border-forest/10 bg-[rgba(247,250,248,0.95)] backdrop-blur md:hidden">
        <div className="flex justify-around px-1 py-2">
          {links.slice(0, 5).map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex flex-col items-center gap-0.5 px-2 py-1 text-[10px]",
                pathname === href ? "text-forest" : "text-ink/50",
              )}
            >
              <Icon size={20} />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
