import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useAnchoredPopover } from "./useAnchoredPopover";
import { useTranslation } from "react-i18next";
import { dateLocale } from "@/lib/labels";

/** Value format is the same as <input type="datetime-local">: YYYY-MM-DDTHH:mm */
const pad = (n: number) => String(n).padStart(2, "0");
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toValue = (d: Date) => `${toKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

function parseValue(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
}

/** "сентябрь 2026 г." → "Сентябрь 2026 г." (CSS capitalize would hit every word) */
const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const FIRST_SLOT = 8 * 60; // 08:00
const LAST_SLOT = 22 * 60; // 22:00
const STEP = 30;
const SLOTS = Array.from(
  { length: (LAST_SLOT - FIRST_SLOT) / STEP + 1 },
  (_, i) => FIRST_SLOT + i * STEP,
);

/** Earliest selectable moment: now + lead time. */
function earliest(leadMinutes: number) {
  return new Date(Date.now() + leadMinutes * 60 * 1000);
}

function slotDate(day: Date, minutes: number) {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60);
}

function firstFreeSlot(day: Date, min: Date): number | null {
  return SLOTS.find((m) => slotDate(day, m) >= min) ?? null;
}

/** Next free slot at least `leadMinutes` from now — a sensible default. */
export function defaultMeetingValue(leadMinutes = 60): string {
  const min = earliest(leadMinutes);
  const day = new Date(min.getFullYear(), min.getMonth(), min.getDate());
  for (let i = 0; i < 2; i++) {
    const slot = firstFreeSlot(day, min);
    if (slot != null) return toValue(slotDate(day, slot));
    day.setDate(day.getDate() + 1);
  }
  return toValue(slotDate(day, 10 * 60));
}

export function DateTimePicker({
  value,
  onChange,
  leadMinutes = 30,
  placeholder,
  triggerClassName = "border-forest/15 bg-white hover:border-forest/30 focus:ring-forest/30",
}: {
  value: string;
  onChange: (v: string) => void;
  /** Meetings can't start sooner than this. */
  leadMinutes?: number;
  placeholder?: string;
  triggerClassName?: string;
}) {
  const { open, setOpen, anchorRef, popoverRef, style } = useAnchoredPopover<
    HTMLDivElement,
    HTMLDivElement
  >({ maxHeight: 460, minWidth: 300, flipBelow: 360 });

  const { t } = useTranslation();
  const weekdays = t("picker.weekdays", { returnObjects: true }) as string[];
  const selected = parseValue(value);
  const selectedSlotRef = useRef<HTMLButtonElement>(null);
  const slotsRef = useRef<HTMLDivElement>(null);
  const [month, setMonth] = useState(() => {
    const base = selected ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const min = earliest(leadMinutes);
  const minDay = new Date(min.getFullYear(), min.getMonth(), min.getDate());
  const todayKey = toKey(new Date());
  const selectedDay = selected
    ? new Date(selected.getFullYear(), selected.getMonth(), selected.getDate())
    : null;
  const selectedMinutes = selected ? selected.getHours() * 60 + selected.getMinutes() : null;

  const canGoBack =
    month.getFullYear() > minDay.getFullYear() ||
    (month.getFullYear() === minDay.getFullYear() && month.getMonth() > minDay.getMonth());

  const lead = (month.getDay() + 6) % 7; // Monday-first grid
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];

  const dayDisabled = (d: Date) => d < minDay || firstFreeSlot(d, min) == null;

  function pickDay(d: Date) {
    // keep the chosen time if it is still possible on the new day
    const keep =
      selectedMinutes != null && slotDate(d, selectedMinutes) >= min ? selectedMinutes : null;
    const minutes = keep ?? firstFreeSlot(d, min);
    if (minutes != null) onChange(toValue(slotDate(d, minutes)));
  }

  function toggle() {
    if (!open) {
      const base = selected ?? min;
      setMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    }
    setOpen((v) => !v);
  }

  const label = selected
    ? capitalize(
        `${selected.toLocaleDateString(dateLocale(), { weekday: "short", day: "numeric", month: "long" })} · ${pad(selected.getHours())}:${pad(selected.getMinutes())}`,
      )
    : placeholder ?? t("picker.placeholder");

  // Bring the chosen time into view by scrolling only the slot list itself
  // (scrollIntoView could scroll the page and close the popover).
  useEffect(() => {
    const list = slotsRef.current;
    const btn = selectedSlotRef.current;
    if (!open || !list || !btn) return;
    const top = btn.offsetTop - list.offsetTop;
    if (top < list.scrollTop || top + btn.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = top - 4;
    }
  }, [open, value, style]);

  return (
    <div ref={anchorRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
        className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm outline-none transition focus:ring-2 ${triggerClassName}`}
      >
        <CalendarDays size={16} className="shrink-0 text-forest" aria-hidden />
        <span className={`truncate ${selected ? "text-ink" : "text-ink/45"}`}>{label}</span>
      </button>

      {open &&
        style &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={t("picker.dialog")}
            style={style}
            className="overflow-auto overscroll-contain rounded-2xl border border-forest/10 bg-white p-3 shadow-lg shadow-forest/10"
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                aria-label={t("picker.prevMonth")}
                disabled={!canGoBack}
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                className="grid h-8 w-8 place-items-center rounded-full text-ink/70 transition hover:bg-forest/10 disabled:opacity-25 disabled:hover:bg-transparent"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm font-bold text-ink">
                {capitalize(month.toLocaleDateString(dateLocale(), { month: "long", year: "numeric" }))}
              </span>
              <button
                type="button"
                aria-label={t("picker.nextMonth")}
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                className="grid h-8 w-8 place-items-center rounded-full text-ink/70 transition hover:bg-forest/10"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {weekdays.map((w) => (
                <span key={w} className="py-1 text-[11px] font-semibold text-ink/40">
                  {w}
                </span>
              ))}
              {cells.map((d, i) => {
                if (!d) return <span key={`blank-${i}`} />;
                const key = toKey(d);
                const disabled = dayDisabled(d);
                const isSelected = selectedDay != null && key === toKey(selectedDay);
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={disabled}
                    aria-pressed={isSelected}
                    aria-label={d.toLocaleDateString(dateLocale(), { day: "numeric", month: "long" })}
                    onClick={() => pickDay(d)}
                    className={`h-9 rounded-lg text-sm transition ${
                      isSelected
                        ? "bg-forest font-bold text-white"
                        : disabled
                          ? "cursor-default text-ink/30"
                          : key === todayKey
                            ? "font-bold text-forest ring-1 ring-forest/40 hover:bg-forest/10"
                            : "text-ink/80 hover:bg-forest/10"
                    }`}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 border-t border-forest/10 pt-3">
              <p className="mb-2 text-xs font-semibold text-ink/50">{t("picker.time")}</p>
              {selectedDay ? (
                <div
                  ref={slotsRef}
                  className="grid max-h-36 grid-cols-4 gap-1.5 overflow-y-auto overscroll-contain p-0.5"
                >
                  {SLOTS.filter((m) => slotDate(selectedDay, m) >= min).map((m) => {
                    const isSelected = m === selectedMinutes;
                    return (
                      <button
                        key={m}
                        ref={isSelected ? selectedSlotRef : undefined}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => {
                          onChange(toValue(slotDate(selectedDay, m)));
                          setOpen(false);
                        }}
                        className={`rounded-lg py-1.5 text-xs font-semibold tabular-nums transition ${
                          isSelected
                            ? "bg-forest text-white"
                            : "bg-forest/5 text-ink/80 hover:bg-forest/15"
                        }`}
                      >
                        {pad(Math.floor(m / 60))}:{pad(m % 60)}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-ink/40">{t("picker.pickDayFirst")}</p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
