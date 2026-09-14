"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/client";
import { CATEGORIES, CONDITIONS } from "@/lib/constants";

export default function NewItemPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState("Игрушки");
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const subcats = useMemo(() => CATEGORIES[category] || [], [category]);

  if (!loading && !user) {
    router.replace("/login");
  }

  async function onUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const fd = new FormData();
        fd.append("file", files[i]);
        fd.append("itemId", "draft");
        fd.append("sortOrder", String(uploaded.length + i));
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Ошибка загрузки");
        urls.push(data.url);
        if (data.duplicateWarning) {
          setError(
            "Похожие фото уже есть у других пользователей — объявление может уйти на модерацию.",
          );
        }
      }
      setUploaded((u) => [...u, ...urls]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const photosRaw = String(fd.get("photos") || "");
    const photosFromText = photosRaw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const photos = [...uploaded, ...photosFromText];

    const wantCategories = String(fd.get("wantCategories") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const data = await api<{ item: { id: string } }>("/api/items", {
        method: "POST",
        body: JSON.stringify({
          title: fd.get("title"),
          description: fd.get("description"),
          category,
          subcategory: fd.get("subcategory") || undefined,
          brand: fd.get("brand") || undefined,
          model: fd.get("model") || undefined,
          condition: fd.get("condition"),
          completeness: fd.get("completeness") || undefined,
          hasDamage: fd.get("hasDamage") === "on",
          damageNotes: fd.get("damageNotes") || undefined,
          missingParts: fd.get("missingParts") || undefined,
          isOriginal: fd.get("isOriginal") !== "off",
          city: fd.get("city") || user.city,
          district: fd.get("district") || undefined,
          wantType: fd.get("wantType") || "ANY",
          wantText: fd.get("wantText") || undefined,
          wantCategories,
          defectsConfirmed: true,
          photos:
            photos.length >= 2
              ? photos
              : [
                  `https://placehold.co/600x600/1a5f4a/fff?text=${encodeURIComponent(String(fd.get("title")))}+1`,
                  `https://placehold.co/600x600/e85d4c/fff?text=${encodeURIComponent(String(fd.get("title")))}+2`,
                ],
        }),
      });
      router.push(`/items/${data.item.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-rise">
      <div>
        <h1 className="font-display text-3xl text-forest">Добавить предмет</h1>
        <p className="mt-1 text-ink/60">
          Укажите все существенные дефекты. Деньги, цены и доплаты запрещены.
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-coral/10 px-4 py-3 text-sm text-coral">{error}</p>
      )}

      <form onSubmit={onSubmit} className="space-y-4 rounded-3xl bg-white/75 p-6 ring-1 ring-forest/10">
        <Field label="Название" name="title" required />
        <label className="block space-y-1 text-sm">
          <span>Описание</span>
          <textarea
            name="description"
            required
            minLength={10}
            rows={4}
            className="w-full rounded-xl border border-forest/15 bg-white px-3 py-2"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span>Категория</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-forest/15 bg-white px-3 py-2"
            >
              {Object.keys(CATEGORIES).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span>Подкатегория</span>
            <select
              name="subcategory"
              className="w-full rounded-xl border border-forest/15 bg-white px-3 py-2"
            >
              {subcats.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Бренд" name="brand" />
          <Field label="Модель" name="model" />
        </div>

        <label className="block space-y-1 text-sm">
          <span>Состояние</span>
          <select
            name="condition"
            required
            className="w-full rounded-xl border border-forest/15 bg-white px-3 py-2"
          >
            {CONDITIONS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>

        <Field label="Комплектация" name="completeness" />

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="hasDamage" />
          Есть повреждения
        </label>
        <Field label="Описание повреждений" name="damageNotes" />
        <Field label="Отсутствующие элементы" name="missingParts" />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Город" name="city" defaultValue={user?.city} required />
          <Field label="Район" name="district" />
        </div>

        <label className="block space-y-1 text-sm">
          <span>Тип «хочу получить»</span>
          <select
            name="wantType"
            className="w-full rounded-xl border border-forest/15 bg-white px-3 py-2"
          >
            <option value="ANY">Рассмотрю любые</option>
            <option value="CATEGORY">Категории</option>
            <option value="BRAND">Бренд</option>
            <option value="SPECIFIC">Конкретная игрушка</option>
          </select>
        </label>
        <Field
          label="Хочу получить (текст)"
          name="wantText"
          placeholder="LEGO City / машинки / конструкторы"
        />
        <Field
          label="Категории желаемого (через запятую)"
          name="wantCategories"
          placeholder="Конструкторы, Машинки"
        />

        <label className="block space-y-2 text-sm">
          <span>Фото (загрузка с watermark платформы)</span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => onUpload(e.target.files)}
            className="block w-full text-sm"
          />
          {uploading && <p className="text-xs text-ink/50">Загрузка…</p>}
          {uploaded.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {uploaded.map((u) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={u}
                  src={u}
                  alt=""
                  className="h-16 w-16 rounded-lg object-cover ring-1 ring-forest/10"
                />
              ))}
            </div>
          )}
          <span className="text-xs text-ink/45">
            Или вставьте URL (по одному в строке). Минимум 2 фото — иначе демо-плейсхолдеры.
          </span>
          <textarea
            name="photos"
            rows={2}
            className="w-full rounded-xl border border-forest/15 bg-white px-3 py-2 font-mono text-xs"
            placeholder="https://..."
          />
        </label>

        <label className="flex items-start gap-2 rounded-xl bg-mist/50 p-3 text-sm">
          <input type="checkbox" name="defectsConfirmed" required className="mt-1" />
          <span>
            Я указал все известные мне существенные дефекты и несоответствия
            предмета описанию.
          </span>
        </label>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-coral py-3 font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Публикация…" : "Опубликовать"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  required,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span>{label}</span>
      <input
        name={name}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full rounded-xl border border-forest/15 bg-white px-3 py-2"
      />
    </label>
  );
}
