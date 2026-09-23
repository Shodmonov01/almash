import { useEffect, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { api } from "@/lib/client";
import { FancySelect } from "@/components/FancySelect";
import { REPORT_REASONS } from "@/lib/constants";
import { useTranslation } from "react-i18next";
import { useLabels } from "@/lib/labels";

type Props = {
  targetUserId?: string;
  itemId?: string;
  tradeId?: string;
};

/** The button may sit inside a <Link> (item page owner card): keep clicks here. */
const swallow = (e: MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

export function ReportButton({ targetUserId, itemId, tradeId }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [description, setDescription] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { t } = useTranslation();
  const labels = useLabels();

  // While open: lock the page behind the sheet, close on Escape
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function submit() {
    setError("");
    setBusy(true);
    try {
      await api("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          reason,
          description,
          targetUserId,
          itemId,
          tradeId,
        }),
      });
      setDone(true);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <p className="text-xs text-forest">{t("report.sent")}</p>;
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          swallow(e);
          setOpen(true);
        }}
        className="inline-flex min-h-9 items-center text-xs text-coral underline"
      >
        {t("report.button")}
      </button>

      {open &&
        // Portal: a transformed ancestor would misplace a fixed overlay, and an
        // absolutely positioned panel slid off-screen next to a left-aligned button.
        createPortal(
          <div
            className="fixed inset-0 z-[55] flex items-end justify-center bg-ink/60 backdrop-blur-sm sm:items-center sm:p-4"
            onClick={(e) => {
              swallow(e);
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={t("report.button")}
              className="flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-2xl sm:max-h-[90dvh] sm:max-w-md sm:rounded-3xl"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-coral/15 px-5 py-4">
                <h3 className="font-display text-lg text-coral">{t("report.button")}</h3>
                <button
                  type="button"
                  aria-label={t("report.cancel")}
                  onClick={() => setOpen(false)}
                  className="grid h-10 w-10 place-items-center rounded-full text-ink/60 transition hover:bg-ink/5 active:scale-95"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3 overflow-y-auto overscroll-contain p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                <FancySelect
                  value={reason}
                  onChange={(v) => setReason(v as typeof reason)}
                  options={REPORT_REASONS.map((r) => ({ value: r, label: labels.reportReason(r) }))}
                  triggerClassName="border-forest/15 bg-white hover:border-forest/30 focus:ring-forest/30"
                />
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("report.placeholder")}
                  className="w-full rounded-2xl border border-forest/15 p-3 text-sm outline-none focus:ring-2 focus:ring-coral/20"
                  rows={4}
                />
                {error && <p className="text-sm text-coral">{error}</p>}
                <button
                  type="button"
                  disabled={busy}
                  onClick={submit}
                  className="min-h-12 w-full rounded-2xl bg-coral py-3 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
                >
                  {t("report.submit")}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="min-h-11 w-full rounded-2xl bg-mist/60 py-2.5 text-sm font-semibold text-ink/70"
                >
                  {t("report.cancel")}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
