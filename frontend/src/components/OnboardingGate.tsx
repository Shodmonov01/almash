import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/client";
import { ToyMascot } from "@/components/ToyMascot";
import { Link } from "react-router-dom";

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
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-3 sm:items-center sm:p-4">
        <div className="w-full max-w-md animate-bouncein rounded-t-[2rem] bg-cream p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[2rem] sm:p-6 sm:pb-6">
          <ToyMascot className="mx-auto w-24" mood={step === TIPS.length - 1 ? "yay" : "wave"} />
          <p className="text-center text-xs font-extrabold uppercase tracking-wide text-forest">
            Добро пожаловать · {step + 1}/{TIPS.length}
          </p>
          <h2 className="mt-2 text-center font-display text-2xl text-ink sm:text-3xl">{tip.title}</h2>
          <p className="mt-2 text-center text-sm font-semibold text-ink/70">{tip.body}</p>
          <div className="mt-5 flex flex-col gap-2 sm:mt-6 sm:flex-row">
            {step < TIPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="flex min-h-11 flex-1 items-center justify-center rounded-full bg-forest py-3 text-sm font-extrabold text-white shadow-[0_5px_0_#6f63d6]"
              >
                Дальше
              </button>
            ) : (
              <button
                type="button"
                onClick={finish}
                className="flex min-h-11 flex-1 items-center justify-center rounded-full bg-sand py-3 text-sm font-extrabold text-ink shadow-[0_5px_0_#b8d63a]"
              >
                Понятно, начать
              </button>
            )}
            <Link
              to="/items/new"
              onClick={finish}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-4 py-3 text-sm font-bold text-ink"
            >
              Добавить игрушку
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
