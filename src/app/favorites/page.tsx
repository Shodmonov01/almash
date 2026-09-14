"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/client";
import { ItemCard, type ItemCardData } from "@/components/ItemCard";

export default function FavoritesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<ItemCardData[]>([]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    api<{ favorites: { item: ItemCardData }[] }>("/api/favorites").then((d) =>
      setItems(d.favorites.map((f) => f.item)),
    );
  }, [user]);

  if (!user) return null;

  return (
    <div className="space-y-6 animate-rise">
      <h1 className="font-display text-3xl text-forest">Избранное</h1>
      {items.length === 0 ? (
        <p className="text-ink/50">
          Пусто. <Link href="/" className="text-coral underline">Найти обмен</Link>
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
