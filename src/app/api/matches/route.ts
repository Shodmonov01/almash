import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { parseJsonArray } from "@/lib/utils";

/** Direct match + simple 3-cycle chain suggestions (Phase 2 lite). */
export async function GET() {
  try {
    const me = await requireUser();

    const myItems = await prisma.item.findMany({
      where: { ownerId: me.id, status: "ACTIVE" },
    });

    const others = await prisma.item.findMany({
      where: { status: "ACTIVE", NOT: { ownerId: me.id } },
      include: {
        media: { take: 1, orderBy: { sortOrder: "asc" } },
        owner: {
          select: { id: true, name: true, city: true, rating: true, trustLevel: true },
        },
      },
      take: 200,
    });

    type Match = {
      type: "DIRECT" | "CHAIN";
      score: number;
      theirItem: (typeof others)[number];
      myItem?: (typeof myItems)[number];
      reason: string;
      chain?: { viaUserId: string; viaItemTitle: string }[];
    };

    const matches: Match[] = [];

    for (const mine of myItems) {
      const myWantCats = parseJsonArray(mine.wantCategories);
      const myWantBrands = parseJsonArray(mine.wantBrands);

      for (const theirs of others) {
        const theirWantCats = parseJsonArray(theirs.wantCategories);
        const theirWantBrands = parseJsonArray(theirs.wantBrands);

        const iWantTheirs =
          mine.wantType === "ANY" ||
          myWantCats.includes(theirs.subcategory || "") ||
          myWantCats.includes(theirs.category) ||
          (theirs.brand && myWantBrands.includes(theirs.brand)) ||
          (mine.wantText || "").toLowerCase().includes((theirs.brand || "").toLowerCase());

        const theyWantMine =
          theirs.wantType === "ANY" ||
          theirWantCats.includes(mine.subcategory || "") ||
          theirWantCats.includes(mine.category) ||
          (mine.brand && theirWantBrands.includes(mine.brand));

        if (iWantTheirs && theyWantMine) {
          matches.push({
            type: "DIRECT",
            score: 100,
            theirItem: theirs,
            myItem: mine,
            reason: "🎉 Найден взаимный обмен",
          });
        } else if (iWantTheirs) {
          matches.push({
            type: "DIRECT",
            score: 60,
            theirItem: theirs,
            myItem: mine,
            reason: "Подходит под ваши «хочу получить»",
          });
        }
      }
    }

    // Simple chain A→B→C→A detection (limited)
    const byOwner = new Map<string, typeof others>();
    for (const it of others) {
      const list = byOwner.get(it.ownerId) || [];
      list.push(it);
      byOwner.set(it.ownerId, list);
    }

    for (const mine of myItems) {
      const myWant = parseJsonArray(mine.wantCategories);
      for (const [ownerB, itemsB] of byOwner) {
        for (const b of itemsB) {
          const bMatchesMineWant =
            myWant.includes(b.subcategory || "") ||
            myWant.includes(b.category) ||
            mine.wantType === "ANY";
          if (!bMatchesMineWant) continue;

          const bWant = parseJsonArray(b.wantCategories);
          for (const [ownerC, itemsC] of byOwner) {
            if (ownerC === ownerB) continue;
            for (const c of itemsC) {
              const cMatchesBWant =
                bWant.includes(c.subcategory || "") ||
                bWant.includes(c.category) ||
                b.wantType === "ANY";
              if (!cMatchesBWant) continue;
              const cWant = parseJsonArray(c.wantCategories);
              const aMatchesCWant =
                cWant.includes(mine.subcategory || "") ||
                cWant.includes(mine.category) ||
                c.wantType === "ANY";
              if (aMatchesCWant) {
                matches.push({
                  type: "CHAIN",
                  score: 80,
                  theirItem: b,
                  myItem: mine,
                  reason: "Возможная цепочка A → B → C → A",
                  chain: [
                    { viaUserId: ownerB, viaItemTitle: b.title },
                    { viaUserId: ownerC, viaItemTitle: c.title },
                  ],
                });
              }
            }
          }
        }
      }
    }

    matches.sort((a, b) => b.score - a.score);
    const unique = [];
    const seen = new Set<string>();
    for (const m of matches) {
      const key = `${m.type}-${m.theirItem.id}-${m.myItem?.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(m);
      if (unique.length >= 30) break;
    }

    return jsonOk({ matches: unique });
  } catch (e) {
    return handleApiError(e);
  }
}
