import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
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

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

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
      {createPortal(<ToastStack toasts={toasts} onDismiss={dismiss} />, document.body)}
      {dialog && createPortal(<ConfirmSheet {...dialog} onClose={close} />, document.body)}
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackApi {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used inside <FeedbackProvider>");
  return ctx;
}

function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  const { t: tr } = useTranslation();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-3 z-[80] flex w-[min(22rem,calc(100vw-1.5rem))] flex-col items-end gap-2 sm:right-5"
      // top-right, just under the sticky header (and Telegram's fullscreen controls)
      style={{ top: "calc(var(--app-inset-top) + 4.25rem)" }}
    >
      {toasts.map((t) => {
        const error = t.kind === "error";
        return (
          <div
            key={t.id}
            role={error ? "alert" : "status"}
            className="pointer-events-auto relative flex w-full animate-toast items-center gap-3 overflow-hidden rounded-2xl bg-white py-3 pl-3 pr-2 shadow-[0_14px_36px_rgba(23,21,31,0.18)] ring-1 ring-ink/[0.06]"
          >
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                error ? "bg-coral/15 text-coral" : "bg-forest/15 text-forest"
              }`}
            >
              {error ? <AlertCircle size={19} strokeWidth={2.4} /> : <CheckCircle2 size={19} strokeWidth={2.4} />}
            </span>
            <span className="min-w-0 flex-1 text-sm font-bold leading-snug text-ink">{t.text}</span>
            <button
              type="button"
              aria-label={tr("common.close")}
              onClick={() => onDismiss(t.id)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink/35 transition hover:bg-ink/5 hover:text-ink/70"
            >
              <X size={16} />
            </button>
            {/* time left until it disappears */}
            <span
              className={`absolute bottom-0 left-0 h-[3px] w-full origin-left animate-toast-timer ${
                error ? "bg-coral" : "bg-forest"
              }`}
              style={{ animationDuration: `${TOAST_MS}ms` }}
            />
          </div>
        );
      })}
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
