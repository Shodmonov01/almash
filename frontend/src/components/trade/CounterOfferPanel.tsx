import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { mediaUrl } from "@/lib/env";

type MiniItem = {
  id: string;
  title: string;
  status?: string;
  media: { url: string }[];
  ownerId?: string;
};

type Props = {
  tradeId: string;
  initiatorId: string;
  recipientId: string;
  currentOfferedIds: string[];
  currentTargetIds: string[];
  onDone: () => void;
};

export function CounterOfferPanel({
  tradeId,
  initiatorId,
  recipientId,
  currentOfferedIds,
  currentTargetIds,
  onDone,
}: Props) {
  const [sideA, setSideA] = useState<MiniItem[]>([]);
  const [sideB, setSideB] = useState<MiniItem[]>([]);
  const [offered, setOffered] = useState<string[]>(currentOfferedIds);
  const [targets, setTargets] = useState<string[]>(currentTargetIds);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      api<{ items: MiniItem[] }>(`/api/items?ownerId=${initiatorId}`),
      api<{ items: MiniItem[] }>(`/api/items?ownerId=${recipientId}`),
    ]).then(([a, b]) => {
      setSideA(
        a.items.filter(
          (i) => i.status === "ACTIVE" || currentOfferedIds.includes(i.id),
        ),
      );
      setSideB(
        b.items.filter(
          (i) => i.status === "ACTIVE" || currentTargetIds.includes(i.id),
        ),
      );
    });
  }, [initiatorId, recipientId, currentOfferedIds, currentTargetIds]);

  function toggle(list: string[], id: string, set: (v: string[]) => void) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function submit() {
    if (!offered.length || !targets.length) {
      setError("Выберите хотя бы по одному предмету с каждой стороны");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/api/trades/${tradeId}/actions`, {
        method: "POST",
        body: JSON.stringify({
          action: "counter",
          offeredItemIds: offered,
          targetItemIds: targets,
          note: note || undefined,
        }),
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-3xl border border-forest/15 bg-white p-5">
      <h3 className="font-display text-xl text-forest">Изменить состав обмена</h3>
      <p className="text-sm text-ink/60">
        Изменения создают новую версию сделки. Условия нужно подтвердить заново.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <Picker
          title="Сторона A отдаёт"
          items={sideA}
          selected={offered}
          onToggle={(id) => toggle(offered, id, setOffered)}
        />
        <Picker
          title="Сторона B отдаёт"
          items={sideB}
          selected={targets}
          onToggle={(id) => toggle(targets, id, setTargets)}
        />
      </div>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Комментарий к изменению"
        className="w-full rounded-xl border border-forest/15 px-3 py-2 text-sm"
      />
      {error && <p className="text-sm text-coral">{error}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={submit}
        className="rounded-xl bg-forest px-4 py-2 text-sm font-medium text-cream disabled:opacity-60"
      >
        {busy ? "Сохранение…" : "Отправить новую версию"}
      </button>
    </div>
  );
}

function Picker({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string;
  items: MiniItem[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{title}</p>
      <div className="max-h-56 space-y-2 overflow-y-auto">
        {items.map((it) => {
          const on = selected.includes(it.id);
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => onToggle(it.id)}
              className={
                on
                  ? "flex w-full items-center gap-2 rounded-xl bg-forest p-2 text-left text-sm text-cream"
                  : "flex w-full items-center gap-2 rounded-xl bg-mist/50 p-2 text-left text-sm"
              }
            >
              <img
                src={mediaUrl(it.media[0]?.url) || "https://placehold.co/40"}
                alt=""
                className="h-10 w-10 rounded-lg object-cover"
              />
              {it.title}
            </button>
          );
        })}
        {items.length === 0 && (
          <p className="text-xs text-ink/45">Нет доступных предметов</p>
        )}
      </div>
    </div>
  );
}
