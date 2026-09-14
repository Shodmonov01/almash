"use client";

import Link from "next/link";
import { TRUST_LEVELS } from "@/lib/constants";

export type ItemCardData = {
  id: string;
  title: string;
  condition: string;
  category: string;
  city: string;
  district?: string | null;
  wantText?: string | null;
  media: { url: string }[];
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
      href={`/items/${item.id}`}
      className="group block overflow-hidden rounded-2xl bg-white/70 shadow-[0_8px_30px_rgba(26,95,74,0.08)] ring-1 ring-forest/5 transition hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(26,95,74,0.14)]"
    >
      <div className="relative aspect-square overflow-hidden bg-mist">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.media[0]?.url || "https://placehold.co/600x600"}
          alt={item.title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-forest/80 to-transparent p-3 pt-10">
          <p className="text-sm font-medium text-cream line-clamp-2">{item.title}</p>
        </div>
      </div>
      <div className="space-y-2 p-3">
        <div className="flex flex-wrap gap-2 text-xs text-ink/60">
          <span>{item.condition}</span>
          <span>·</span>
          <span>
            {item.city}
            {item.district ? `, ${item.district}` : ""}
          </span>
        </div>
        {item.wantText && (
          <p className="text-xs text-forest/80 line-clamp-2">
            <span className="font-medium">Хочу:</span> {item.wantText}
          </p>
        )}
        <div className="flex items-center justify-between gap-2 border-t border-forest/5 pt-2 text-xs">
          <span className="text-ink/70">{item.owner.name}</span>
          <span className="text-ink/50">
            ★ {item.owner.rating.toFixed(1)} · {trust}
          </span>
        </div>
      </div>
    </Link>
  );
}
