import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/client";
import { Link, useNavigate } from "react-router-dom";

type N = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  tradeId?: string | null;
  createdAt: string;
  type: string;
};

export default function NotificationsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<N[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [user, loading, navigate]);

  async function load() {
    const d = await api<{ notifications: N[] }>("/api/notifications");
    setItems(d.notifications);
  }

  useEffect(() => {
    if (user) load();
  }, [user]);

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-rise">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-forest">Уведомления</h1>
        <button
          type="button"
          className="text-sm text-coral"
          onClick={async () => {
            await api("/api/notifications", {
              method: "POST",
              body: JSON.stringify({}),
            });
            await load();
          }}
        >
          Отметить все прочитанными
        </button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl bg-white/60 p-8 text-center text-ink/60">
          Пока тихо. Когда придёт предложение или напоминание о встрече — оно
          появится здесь.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li
              key={n.id}
              className={
                n.read
                  ? "rounded-2xl bg-white/50 p-4 text-sm ring-1 ring-forest/5"
                  : "rounded-2xl bg-white p-4 text-sm ring-1 ring-forest/20"
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{n.title}</p>
                  <p className="text-ink/65">{n.body}</p>
                  <p className="mt-1 text-[10px] text-ink/40">
                    {new Date(n.createdAt).toLocaleString("ru-RU")} · {n.type}
                  </p>
                </div>
                {n.tradeId && (
                  <Link
                    to={`/trades/${n.tradeId}`}
                    className="shrink-0 text-xs text-forest underline"
                  >
                    Открыть
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
