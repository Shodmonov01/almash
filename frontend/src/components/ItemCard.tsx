import { TRUST_LEVELS } from "@/lib/constants";
import { Link } from "react-router-dom";

export type ItemCardData = {
  id: string;
  title: string;
  condition: string;
  category: string;
  city: string;
  district?: string | null;
  wantText?: string | null;
  media: { url: string }[];
  matchScore?: number;
  matchReasons?: string[];
  owner: {
    id: string;
    name: string;
    rating: number;
    completedTrades: number;
    trustLevel: string;
  };
};

export function ItemCard({ item }: { item: ItemCardData }) {
  const trust =
    TRUST_LEVELS[item.owner.trustLevel as keyof typeof TRUST_LEVELS]?.label ||
    item.owner.trustLevel;

  return (
    <Link
      to={`/items/${item.id}`}
      className="group block overflow-hidden rounded-[1.4rem] bg-white shadow-[0_10px_0_rgba(23,21,31,0.06)] transition active:translate-y-0.5 active:shadow-none hover:-translate-y-0.5"
    >
      <div className="relative aspect-square overflow-hidden bg-lilac">
        <img
          src={item.media[0]?.url || "https://placehold.co/600x600"}
          alt={item.title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      </div>
      <div className="space-y-2 p-2.5 sm:space-y-2 sm:p-3">
        <p className="text-sm font-extrabold leading-snug text-ink line-clamp-2 sm:text-base">
          {item.title}
        </p>
        {typeof item.matchScore === "number" && (
          <p className="text-[10px] leading-tight text-coral sm:text-[11px]">
            Match {item.matchScore}
            {item.matchReasons?.length
              ? ` · ${item.matchReasons.slice(0, 2).join(", ")}`
              : ""}
          </p>
        )}
        <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 text-[11px] text-ink/60 sm:gap-2 sm:text-xs">
          <span className="line-clamp-1">{item.condition}</span>
          <span className="hidden sm:inline">·</span>
          <span className="line-clamp-1">
            {item.city}
            {item.district ? `, ${item.district}` : ""}
          </span>
        </div>
        {item.wantText && (
          <p className="hidden text-xs text-forest/80 line-clamp-2 sm:block">
            <span className="font-medium">Хочу:</span> {item.wantText}
          </p>
        )}
        <div className="flex items-center justify-between gap-1 border-t border-forest/5 pt-2 text-[11px] sm:gap-2 sm:text-xs">
          <span className="truncate text-ink/70">{item.owner.name}</span>
          <span className="shrink-0 text-ink/50">
            ★ {item.owner.rating.toFixed(1)}
            <span className="hidden sm:inline"> · {trust}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
