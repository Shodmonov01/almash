import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

type ToastKind = "success" | "error";
type Toast = { id: number; kind: ToastKind; text: string };

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  /** Red confirm button for destructive actions (default true). */
  danger?: boolean;
};

type FeedbackApi = {
  toast: { success: (text: string) => void; error: (text: string) => void };
  /** In-app replacement for window.confirm: one sheet, resolves true/false. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const FeedbackContext = createContext<FeedbackApi | null>(null);

const TOAST_MS = 2600;

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const nextId = useRef(1);

  const push = useCallback((kind: ToastKind, text: string) => {
    const id = nextId.current++;
    setToasts((list) => [...list.slice(-2), { id, kind, text }]);
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), TOAST_MS);
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        // A second call while one is open answers the first with "no" — never two sheets.
        setDialog((prev) => {
          prev?.resolve(false);
          return { ...options, resolve };
        });
      }),
    [],
  );

  const api = useRef<FeedbackApi>({
    toast: { success: (t) => push("success", t), error: (t) => push("error", t) },
    confirm,
  }).current;

  const close = (ok: boolean) => {
    dialog?.resolve(ok);
    setDialog(null);
  };

  return (
    <FeedbackContext.Provider value={api}>
      {children}
      {createPortal(<ToastStack toasts={toasts} />, document.body)}
      {dialog && createPortal(<ConfirmSheet {...dialog} onClose={close} />, document.body)}
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackApi {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used inside <FeedbackProvider>");
  return ctx;
}

function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[80] flex flex-col items-center gap-2 px-4"
      // just under the sticky header (and Telegram's fullscreen controls)
      style={{ top: "calc(var(--app-inset-top) + 4.25rem)" }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className={`pointer-events-auto flex max-w-sm animate-toast items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-bold shadow-[0_12px_32px_rgba(23,21,31,0.22)] ${
            t.kind === "error" ? "bg-coral text-white" : "bg-ink text-cream"
          }`}
        >
          {t.kind === "error" ? (
            <AlertCircle size={18} className="shrink-0" />
          ) : (
            <CheckCircle2 size={18} className="shrink-0 text-sand" />
          )}
          <span className="min-w-0">{t.text}</span>
        </div>
      ))}
    </div>
  );
}

function ConfirmSheet({
  title,
  message,
  confirmText,
  danger = true,
  onClose,
}: ConfirmOptions & { onClose: (ok: boolean) => void }) {
  const { t } = useTranslation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/50 pt-[var(--app-inset-top)] backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={() => onClose(false)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm animate-bouncein rounded-t-[1.75rem] bg-white px-5 pt-5 pb-[max(1.25rem,var(--app-inset-bottom))] shadow-2xl sm:rounded-[1.75rem] sm:pb-5"
      >
        <h2 id="confirm-title" className="text-center text-lg font-extrabold text-ink">
          {title}
        </h2>
        {message && <p className="mt-1.5 text-center text-sm text-ink/60">{message}</p>}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="min-h-12 rounded-2xl bg-ink/[0.06] text-sm font-bold text-ink transition active:scale-[0.97]"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => onClose(true)}
            className={`min-h-12 rounded-2xl text-sm font-extrabold text-white transition active:scale-[0.97] ${
              danger ? "bg-coral" : "bg-forest"
            }`}
          >
            {confirmText ?? t("common.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
