"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/client";

const TIPS = [
  {
    title: "Только обмен вещами",
    body: "На SwapToy нет цен, доплат и оплаты. Сделка = ваши предметы ⇄ предметы другого человека.",
  },
  {
    title: "Фиксация условий",
    body: "Состав обмена подтверждается в интерфейсе. Чат сам по себе сделку не меняет.",
  },
  {
    title: "Встреча вместе",
    body: "Передавайте предметы одновременно в людном месте. Подтверждение — двумя кодами/QR.",
  },
];

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user, refresh } = useAuth();
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (user && user.onboardingDone === false) setShow(true);
    else setShow(false);
  }, [user]);

  if (!show || !user) return <>{children}</>;

  const tip = TIPS[step];

  async function finish() {
    await api("/api/me", {
      method: "PATCH",
      body: JSON.stringify({ onboardingDone: true }),
    });
    await refresh();
    setShow(false);
  }

  return (
    <>
      {children}
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-forest-deep/50 p-4 sm:items-center">
        <div className="w-full max-w-md animate-rise rounded-3xl bg-cream p-6 shadow-2xl">
          <p className="text-xs uppercase tracking-wide text-coral">
            Добро пожаловать · {step + 1}/{TIPS.length}
          </p>
          <h2 className="mt-2 font-display text-2xl text-forest">{tip.title}</h2>
          <p className="mt-2 text-sm text-ink/70">{tip.body}</p>
          <div className="mt-6 flex gap-2">
            {step < TIPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="flex-1 rounded-xl bg-coral py-3 text-sm font-semibold text-white"
              >
                Дальше
              </button>
            ) : (
              <button
                type="button"
                onClick={finish}
                className="flex-1 rounded-xl bg-coral py-3 text-sm font-semibold text-white"
              >
                Понятно, начать
              </button>
            )}
            <Link
              href="/items/new"
              onClick={finish}
              className="rounded-xl bg-forest/10 px-4 py-3 text-sm text-forest"
            >
              Добавить игрушку
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
