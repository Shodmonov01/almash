import { useEffect, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { FancySelect } from "@/components/FancySelect";
import { ItemCard, type ItemCardData } from "@/components/ItemCard";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/client";
import { CATEGORIES, CONDITIONS } from "@/lib/constants";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLabels } from "@/lib/labels";

type Feed = "new" | "nearby" | "for_me";

export default function BrowsePage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const labels = useLabels();
  const [items, setItems] = useState<ItemCardData[]>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [condition, setCondition] = useState("");
  const [brand, setBrand] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [age, setAge] = useState("");
  const [inSet, setInSet] = useState(false);
  const [feed, setFeed] = useState<Feed>("new");
  const [loading, setLoading] = useState(true);

  const subcats = category ? CATEGORIES[category] || [] : [];

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (subcategory) params.set("subcategory", subcategory);
    if (condition) params.set("condition", condition);
    if (brand) params.set("brand", brand);
    if (city.trim()) params.set("city", city.trim());
    if (district.trim()) params.set("district", district.trim());
    if (age) params.set("age", age);
    if (inSet) params.set("inSet", "1");
    params.set("feed", feed);
    if (user?.city) params.set("meCity", user.city);
    if (user?.id) params.set("meId", user.id);
    setLoading(true);
    api<{ items: (ItemCardData & { matchScore?: number; matchReasons?: string[] })[] }>(
        `/api/items?${params}`,
    )
        .then((d) => setItems(d.items))
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
  }, [q, category, subcategory, condition, brand, city, district, age, inSet, feed, user?.city, user?.id]);

  return (
      <div className="space-y-5 sm:space-y-8">
        <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between animate-rise">
          <div>
            <h1 className="font-display text-4xl text-ink">{t("browse.title")}</h1>
            <p className="text-sm font-semibold text-ink/55">
              {t("browse.subtitle")}{" "}
              <Link to="/" className="font-extrabold text-forest underline-offset-2 hover:underline">
                {t("browse.swipeLink")}
              </Link>
              .
            </p>
          </div>
          <Link
              to="/"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-sand px-5 text-sm font-extrabold text-ink shadow-[0_5px_0_#b8d63a]"
          >
            <Sparkles size={16} /> {t("browse.toSwipes")}
          </Link>
        </section>

        <section
            className="relative z-20 space-y-3 animate-rise sm:space-y-4"
            style={{ animationDelay: "80ms" }}
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" size={18} />
              <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t("browse.search")}
                  className="w-full rounded-2xl border border-forest/15 bg-white/80 py-3 pl-10 pr-4 outline-none ring-forest/30 focus:ring-2 sm:text-sm"
              />
            </div>

            <FancySelect
                value={category}
                onChange={(v) => {
                  setCategory(v);
                  setSubcategory("");
                }}
                placeholder={t("browse.allCategories")}
                options={[
                  { value: "", label: t("browse.allCategories") },
                  ...Object.keys(CATEGORIES).map((c) => ({ value: c, label: labels.category(c) })),
                ]}
            />

            {subcats.length > 0 && (
                <FancySelect
                    value={subcategory}
                    onChange={setSubcategory}
                    placeholder={t("browse.allSubcategories")}
                    options={[
                      { value: "", label: t("browse.allSubcategories") },
                      ...subcats.map((sc) => ({ value: sc, label: labels.subcategory(sc) })),
                    ]}
                />
            )}

            <FancySelect
                value={condition}
                onChange={setCondition}
                placeholder={t("browse.anyCondition")}
                options={[
                  { value: "", label: t("browse.anyCondition") },
                  ...CONDITIONS.map((c) => ({ value: c, label: labels.condition(c) })),
                ]}
            />

            <input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder={t("browse.brand")}
                className="min-h-11 w-full rounded-2xl border border-forest/15 bg-white/80 px-4 py-3 outline-none ring-forest/30 focus:ring-2 sm:text-sm"
            />

            <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={t("browse.city")}
                className="min-h-11 w-full rounded-2xl border border-forest/15 bg-white/80 px-4 py-3 outline-none ring-forest/30 focus:ring-2 sm:text-sm"
            />

            <input
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder={t("browse.district")}
                className="min-h-11 w-full rounded-2xl border border-forest/15 bg-white/80 px-4 py-3 outline-none ring-forest/30 focus:ring-2 sm:text-sm"
            />

            <FancySelect
                value={age}
                onChange={setAge}
                placeholder={t("browse.anyAge")}
                options={[
                  { value: "", label: t("browse.anyAge") },
                  ...Array.from({ length: 15 }, (_, i) => ({
                    value: String(i),
                    label: i === 0 ? t("browse.under1") : t("browse.age", { count: i }),
                  })),
                ]}
            />

            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl border border-forest/15 bg-white/80 px-4 py-3 text-sm text-ink/80">
              <input
                  type="checkbox"
                  checked={inSet}
                  onChange={(e) => setInSet(e.target.checked)}
                  className="h-4 w-4 accent-forest"
              />
              {t("browse.inSet")}
            </label>
          </div>

          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
            {(
                [
                  ["new", t("browse.feedNew")],
                  ["nearby", t("browse.feedNearby")],
                  ["for_me", t("browse.feedForMe")],
                ] as const
            ).map(([id, label]) => (
                <button
                    key={id}
                    type="button"
                    onClick={() => setFeed(id)}
                    className={
                      feed === id
                          ? "shrink-0 rounded-full bg-forest px-4 py-2 text-sm text-cream"
                          : "shrink-0 rounded-full bg-white/70 px-4 py-2 text-sm text-ink/70 ring-1 ring-forest/10"
                    }
                >
                  {label}
                </button>
            ))}
          </div>
        </section>

        {loading ? (
            <p className="text-ink/50">{t("pages.loading")}</p>
        ) : items.length === 0 ? (
            <p className="rounded-2xl bg-white/60 p-6 text-center text-sm text-ink/60 sm:p-8">
              {t("browse.empty")}
            </p>
        ) : (
            <div className="relative z-0 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
              {items.map((item) => (
                  <ItemCard key={item.id} item={item} />
              ))}
            </div>
        )}
      </div>
  );
}