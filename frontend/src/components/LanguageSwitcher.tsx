import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { LANGUAGES, type Language } from "@/lib/i18n";


function FlagRU({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 9 6" className={className} aria-hidden>
      <rect width="9" height="2" fill="#FFFFFF" />
      <rect y="2" width="9" height="2" fill="#0039A6" />
      <rect y="4" width="9" height="2" fill="#D52B1E" />
    </svg>
  );
}

function FlagUZ({ className = "" }: { className?: string }) {
  const stars = [
    [9.2, 2.1], [10.8, 2.1], [12.4, 2.1],
    [7.6, 3.6], [9.2, 3.6], [10.8, 3.6], [12.4, 3.6],
    [9.2, 5.1], [10.8, 5.1], [12.4, 5.1],
  ];
  return (
    <svg viewBox="0 0 30 15" className={className} aria-hidden>
      <rect width="30" height="15" fill="#FFFFFF" />
      <rect width="30" height="5" fill="#0099B5" />
      <rect y="10" width="30" height="5" fill="#1EB53A" />
      <rect y="5" width="30" height="0.4" fill="#CE1126" />
      <rect y="9.6" width="30" height="0.4" fill="#CE1126" />
      {/* crescent */}
      <circle cx="4.2" cy="2.5" r="1.8" fill="#FFFFFF" />
      <circle cx="4.9" cy="2.5" r="1.55" fill="#0099B5" />
      {stars.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x - 1.6} cy={y - 0.7} r="0.42" fill="#FFFFFF" />
      ))}
    </svg>
  );
}

const FLAGS: Record<Language, (p: { className?: string }) => ReactElement> = {
  ru: FlagRU,
  uz: FlagUZ,
};

/**
 * Segmented language control: flag + language name.
 * `tone="dark"` for coloured backgrounds (profile header), "light" otherwise.
 */
export function LanguageSwitcher({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { t, i18n } = useTranslation();
  const current = (i18n.resolvedLanguage || i18n.language) as Language;

  return (
    <div
      role="radiogroup"
      aria-label={t("lang.label")}
      className={`inline-flex items-center gap-1 rounded-full p-1 ${
        tone === "dark" ? "bg-white/15 ring-1 ring-white/20" : "bg-forest/10"
      }`}
    >
      {LANGUAGES.map((code) => {
        const Flag = FLAGS[code];
        const active = current === code;
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={t(`lang.${code}`)}
            title={t(`lang.${code}`)}
            onClick={() => void i18n.changeLanguage(code)}
            className={`flex min-h-9 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold transition active:scale-95 ${
              active
                ? "bg-white text-ink shadow-sm"
                : tone === "dark"
                  ? "text-cream/80 hover:bg-white/10 hover:text-cream"
                  : "text-ink/60 hover:bg-white/60 hover:text-ink"
            }`}
          >
            <Flag className="h-4 w-6 shrink-0 overflow-hidden rounded-[3px] ring-1 ring-black/10" />
            <span>{t(`lang.${code}`)}</span>
          </button>
        );
      })}
    </div>
  );
}
