"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";

type Version = {
  version: number;
  note?: string | null;
  createdAt: string;
  items: {
    side: string;
    title: string;
    snapshot: {
      title?: string;
      condition?: string;
      description?: string;
      media?: { url: string }[];
      frozenAt?: string;
    } | null;
  }[];
};

export function SnapshotTimeline({ tradeId }: { tradeId: string }) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    api<{ versions: Version[] }>(`/api/trades/${tradeId}/versions`)
      .then((d) => setVersions(d.versions))
      .catch((e) => setError(e.message));
  }, [open, tradeId]);

  return (
    <section className="rounded-3xl bg-white/70 p-5 ring-1 ring-forest/10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-forest">Доказательства / версии</h2>
          <p className="text-sm text-ink/55">
            Снимки состава и состояния предметов на момент каждой версии сделки.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-xl bg-mist px-3 py-2 text-sm"
        >
          {open ? "Скрыть" : "Показать"}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-4">
          {error && <p className="text-sm text-coral">{error}</p>}
          {versions.map((v) => (
            <div
              key={v.version}
              className="rounded-2xl border border-forest/10 bg-cream/50 p-4"
            >
              <p className="text-sm font-medium">
                Версия {v.version}
                {v.note ? ` · ${v.note}` : ""} ·{" "}
                <span className="text-ink/50">
                  {new Date(v.createdAt).toLocaleString("ru-RU")}
                </span>
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {v.items.map((it, idx) => (
                  <div key={idx} className="rounded-xl bg-white p-3 text-sm">
                    <p className="font-medium">
                      {it.side}: {it.snapshot?.title || it.title}
                    </p>
                    {it.snapshot?.condition && (
                      <p className="text-ink/60">{it.snapshot.condition}</p>
                    )}
                    {it.snapshot?.media?.[0]?.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.snapshot.media[0].url}
                        alt=""
                        className="mt-2 h-24 w-full rounded-lg object-cover"
                      />
                    )}
                    {it.snapshot?.frozenAt && (
                      <p className="mt-1 text-[10px] text-ink/40">
                        freeze {new Date(it.snapshot.frozenAt).toLocaleString("ru-RU")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {versions.length === 0 && !error && (
            <p className="text-sm text-ink/50">Загрузка…</p>
          )}
        </div>
      )}
    </section>
  );
}
