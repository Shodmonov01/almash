import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/client";
import { mediaUrl } from "@/lib/env";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { dateLocale, useLabels } from "@/lib/labels";

type ChatRow = {
  id: string;
  publicId: string;
  status: string;
  updatedAt: string;
  parties: { side: string; user: { id: string; name: string; avatarUrl?: string | null } }[];
  _count: { messages: number };
  lastMessage: {
    body: string;
    createdAt: string;
    system: boolean;
    senderId: string;
    mediaUrl?: string | null;
  } | null;
};

/** TZ §13 / §43: every offer has its own chat — this is the list of them. */
export default function MessagesPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const labels = useLabels();
  const [chats, setChats] = useState<ChatRow[] | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    api<{ trades: ChatRow[] }>("/api/trades")
      .then((d) => {
        const rows = d.trades.filter((t) => t.lastMessage);
        rows.sort(
          (a, b) =>
            new Date(b.lastMessage!.createdAt).getTime() -
            new Date(a.lastMessage!.createdAt).getTime(),
        );
        setChats(rows);
      })
      .catch(() => setChats([]));
  }, [user]);

  if (!user) return null;

  return (
    <div className="space-y-6 animate-rise">
      <h1 className="font-display text-3xl text-forest">{t("pages.messages.title")}</h1>
      {chats === null ? (
        <p className="text-ink/50">{t("pages.loading")}</p>
      ) : chats.length === 0 ? (
        <p className="rounded-2xl bg-white/60 p-8 text-center text-ink/60">
          {t("pages.messages.empty")}
        </p>
      ) : (
        <div className="space-y-2">
          {chats.map((c) => {
            const other = c.parties.find((p) => p.user.id !== user.id)?.user;
            const last = c.lastMessage!;
            const preview = last.mediaUrl && !last.body.trim() ? t("pages.messages.attachment") : last.body;
            return (
              <Link
                key={c.id}
                to={`/trades/${c.id}`}
                className="flex items-center gap-3 rounded-2xl bg-white/80 p-3 ring-1 ring-forest/10 transition active:scale-[0.99] hover:ring-forest/30"
              >
                <img
                  src={mediaUrl(other?.avatarUrl) || "https://placehold.co/48x48"}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate font-bold text-ink">{other?.name || "—"}</p>
                    <span className="shrink-0 text-[11px] text-ink/45">
                      {new Date(last.createdAt).toLocaleString(dateLocale(), {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="truncate text-xs text-ink/50">
                    {c.publicId} · {labels.tradeStatus(c.status)}
                  </p>
                  <p className="truncate text-sm text-ink/70">
                    {last.system ? <span className="italic">{preview}</span> : preview}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
