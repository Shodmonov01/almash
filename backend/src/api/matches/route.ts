import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { scorePair } from "@/lib/services/matching";

/** Direct match + simple 3-cycle chain suggestions. */
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
          select: {
            id: true,
            name: true,
            city: true,
            rating: true,
            trustLevel: true,
          },
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
      for (const theirs of others) {
        const { score, reasons } = scorePair(mine, theirs);
        if (score >= 80 && reasons.some((r) => r.includes("взаимный"))) {
          matches.push({
            type: "DIRECT",
            score,
            theirItem: theirs,
            myItem: mine,
            reason: "🎉 Найден взаимный обмен",
          });
        } else if (score >= 40) {
          matches.push({
            type: "DIRECT",
            score,
            theirItem: theirs,
            myItem: mine,
            reason: reasons[0] || "Подходит под ваши интересы",
          });
        }
      }
    }

    // Simple chain A→B→C→A
    const byOwner = new Map<string, typeof others>();
    for (const it of others) {
      const list = byOwner.get(it.ownerId) || [];
      list.push(it);
      byOwner.set(it.ownerId, list);
    }

    for (const mine of myItems) {
      for (const [ownerB, itemsB] of byOwner) {
        for (const b of itemsB) {
          const ab = scorePair(mine, b);
          if (ab.score < 30) continue;
          for (const [ownerC, itemsC] of byOwner) {
            if (ownerC === ownerB) continue;
            for (const c of itemsC) {
              const bc = scorePair(b, c);
              const ca = scorePair(c, mine);
              if (bc.score >= 30 && ca.score >= 30) {
                matches.push({
                  type: "CHAIN",
                  score: Math.round((ab.score + bc.score + ca.score) / 3),
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
