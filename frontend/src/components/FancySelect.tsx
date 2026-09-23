import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { useAnchoredPopover } from "./useAnchoredPopover";

const DEFAULT_TRIGGER =
  "border-forest/15 bg-white/80 hover:border-forest/25 focus:ring-forest/30";

/**
 * Dropdown rendered in a portal: capped height, opens upwards when there is
 * no room below, follows its trigger on scroll and closes when it leaves the
 * screen. With `name` it also posts its value in a <form>.
 */
export function FancySelect({
                       value,
                       onChange,
                       options,
                       placeholder = "",
                       name,
                       triggerClassName = DEFAULT_TRIGGER,
                     }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  name?: string;
  triggerClassName?: string;
}) {
  const { open, setOpen, anchorRef, popoverRef, style } = useAnchoredPopover<
    HTMLDivElement,
    HTMLUListElement
  >();

  const selected = options.find((o) => o.value === value);

  return (
      <div ref={anchorRef} className="relative">
        {name && <input type="hidden" name={name} value={value} />}
        <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-left text-sm outline-none transition focus:ring-2 ${triggerClassName}`}
        >
        <span className={`truncate ${selected ? "text-ink" : "text-ink/45"}`}>
          {selected ? selected.label : placeholder}
        </span>
          <ChevronDown
              size={16}
              aria-hidden
              className={`shrink-0 text-ink/40 transition ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open &&
            style &&
            createPortal(
                <ul
                    ref={popoverRef}
                    role="listbox"
                    style={style}
                    className="overflow-auto overscroll-contain rounded-2xl border border-forest/10 bg-white py-1.5 shadow-lg shadow-forest/10"
                >
                  {options.map((o) => (
                      <li key={o.value}>
                        <button
                            type="button"
                            role="option"
                            aria-selected={value === o.value}
                            onClick={() => {
                              onChange(o.value);
                              setOpen(false);
                            }}
                            className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition ${
                                value === o.value
                                    ? "bg-forest/10 font-semibold text-forest"
                                    : "text-ink/80 hover:bg-forest/5"
                            }`}
                        >
                          {o.label}
                          {value === o.value && <Check size={14} strokeWidth={2.5} />}
                        </button>
                      </li>
                  ))}
                </ul>,
                document.body,
            )}
      </div>
  );
}
