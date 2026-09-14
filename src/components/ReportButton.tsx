"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { REPORT_REASONS } from "@/lib/constants";

type Props = {
  targetUserId?: string;
  itemId?: string;
  tradeId?: string;
};

export function ReportButton({ targetUserId, itemId, tradeId }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [description, setDescription] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    try {
      await api("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          reason,
          description,
          targetUserId,
          itemId,
          tradeId,
        }),
      });
      setDone(true);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }

  if (done) {
    return (
      <p className="text-xs text-forest">Жалоба отправлена. Спасибо.</p>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-coral underline"
      >
        Пожаловаться
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 space-y-2 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-forest/10">
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as typeof reason)}
            className="w-full rounded-lg border border-forest/15 px-2 py-1.5 text-xs"
          >
            {REPORT_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Кратко опишите ситуацию"
            className="w-full rounded-lg border border-forest/15 p-2 text-xs"
            rows={3}
          />
          {error && <p className="text-xs text-coral">{error}</p>}
          <button
            type="button"
            onClick={submit}
            className="w-full rounded-lg bg-coral py-1.5 text-xs text-white"
          >
            Отправить жалобу
          </button>
        </div>
      )}
    </div>
  );
}
