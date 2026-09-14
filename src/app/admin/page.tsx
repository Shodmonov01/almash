"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/client";

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!loading && (!user || user.role !== "ADMIN")) router.replace("/");
  }, [user, loading, router]);

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    api<Record<string, unknown>>(`/api/admin?tab=${tab}`).then(setData);
  }, [user, tab]);

  if (!user || user.role !== "ADMIN") return null;

  async function run(payload: Record<string, unknown>) {
    await api("/api/admin", { method: "POST", body: JSON.stringify(payload) });
    const d = await api<Record<string, unknown>>(`/api/admin?tab=${tab}`);
    setData(d);
  }

  return (
    <div className="space-y-6 animate-rise">
      <h1 className="font-display text-3xl text-forest">Админ-панель</h1>
      <div className="flex flex-wrap items-center gap-2">
        {["overview", "users", "items", "trades", "disputes", "reports", "moderation"].map(
          (t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={
                tab === t
                  ? "rounded-lg bg-coral px-3 py-1.5 text-sm text-white"
                  : "rounded-lg bg-white px-3 py-1.5 text-sm ring-1 ring-forest/10"
              }
            >
              {t}
            </button>
          ),
        )}
        <button
          type="button"
          className="rounded-lg bg-forest px-3 py-1.5 text-sm text-cream"
          onClick={() => run({ action: "run_jobs" })}
        >
          Run jobs
        </button>
      </div>

      {tab === "overview" && data.overview != null ? (
        <pre className="overflow-auto rounded-2xl bg-white/80 p-4 text-xs">
          {JSON.stringify(data.overview, null, 2)}
        </pre>
      ) : null}

      {tab === "users" && Array.isArray(data.users) && (
        <div className="space-y-2">
          {(data.users as { id: string; name: string; status: string; username: string }[]).map(
            (u) => (
              <div
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/80 p-3 text-sm"
              >
                <span>
                  {u.name} (@{u.username}) — {u.status}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-mist px-2 py-1"
                    onClick={() => run({ action: "warn_user", userId: u.id })}
                  >
                    Warn
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-coral/20 px-2 py-1 text-coral"
                    onClick={() =>
                      run({ action: "block_user", userId: u.id, reason: "admin" })
                    }
                  >
                    Block
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      )}

      {tab === "items" && Array.isArray(data.items) && (
        <div className="space-y-2">
          {(
            data.items as {
              id: string;
              title: string;
              status: string;
              owner: { name: string };
            }[]
          ).map((it) => (
            <div
              key={it.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/80 p-3 text-sm"
            >
              <span>
                {it.title} · {it.owner.name} · {it.status}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-mist px-2 py-1"
                  onClick={() =>
                    run({
                      action: "moderate_item",
                      itemId: it.id,
                      decision: "APPROVE",
                    })
                  }
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-coral/20 px-2 py-1 text-coral"
                  onClick={() =>
                    run({
                      action: "moderate_item",
                      itemId: it.id,
                      decision: "BLOCK",
                    })
                  }
                >
                  Block
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "disputes" && Array.isArray(data.disputes) && (
        <div className="space-y-2">
          {(
            data.disputes as {
              id: string;
              reason: string;
              status: string;
              trade: { publicId: string };
              openedBy: { name: string };
            }[]
          ).map((d) => (
            <div
              key={d.id}
              className="space-y-2 rounded-xl bg-white/80 p-3 text-sm"
            >
              <p>
                {d.trade.publicId}: {d.reason} ({d.status}) — {d.openedBy.name}
              </p>
              <div className="flex flex-wrap gap-2">
                {(["RESOLVED_A", "RESOLVED_B", "RETURNED", "CLOSED"] as const).map(
                  (r) => (
                    <button
                      key={r}
                      type="button"
                      className="rounded-lg bg-mist px-2 py-1 text-xs"
                      onClick={() =>
                        run({
                          action: "resolve_dispute",
                          disputeId: d.id,
                          resolution: r,
                          note: r,
                        })
                      }
                    >
                      {r}
                    </button>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {(tab === "trades" || tab === "reports") && (
        <pre className="overflow-auto rounded-2xl bg-white/80 p-4 text-xs">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}

      {tab === "moderation" && Array.isArray(data.queue) && (
        <div className="space-y-2">
          {(
            data.queue as {
              id: string;
              type: string;
              status: string;
              detail: string | null;
              score: number;
            }[]
          ).map((q) => (
            <div
              key={q.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/80 p-3 text-sm"
            >
              <span>
                [{q.type}] {q.status} · score {q.score}
                <br />
                <span className="text-xs text-ink/50">{q.detail}</span>
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-mist px-2 py-1 text-xs"
                  onClick={() =>
                    run({
                      action: "review_moderation",
                      queueId: q.id,
                      status: "REVIEWED",
                    })
                  }
                >
                  Reviewed
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-mist px-2 py-1 text-xs"
                  onClick={() =>
                    run({
                      action: "review_moderation",
                      queueId: q.id,
                      status: "DISMISSED",
                    })
                  }
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
