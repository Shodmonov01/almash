import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/client";
import { ItemCard, type ItemCardData } from "@/components/ItemCard";
import { Link, useNavigate } from "react-router-dom";

export default function FavoritesPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<ItemCardData[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [user, loading, navigate]);

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
          Пусто. <Link to="/" className="text-coral underline">Найти обмен</Link>
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
