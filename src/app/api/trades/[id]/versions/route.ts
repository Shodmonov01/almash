import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { loadTradeOrThrow, assertPartyAccess, TradeError } from "@/lib/services/trades";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** Return frozen snapshots for each trade version (evidence timeline). */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const trade = await loadTradeOrThrow(id);
    assertPartyAccess(trade, user.id, user.role);

    const versions = await prisma.tradeVersion.findMany({
      where: { tradeId: trade.id },
      orderBy: { version: "asc" },
    });

    const items = await prisma.tradeItem.findMany({
      where: { tradeId: trade.id },
      include: {
        item: {
          select: { id: true, title: true, status: true },
        },
      },
      orderBy: [{ version: "asc" }, { side: "asc" }],
    });

    const byVersion = versions.map((v) => ({
      ...v,
      payload: JSON.parse(v.payloadJson),
      items: items
        .filter((i) => i.version === v.version)
        .map((i) => ({
          side: i.side,
          itemId: i.itemId,
          title: i.item.title,
          snapshot: i.itemSnapshot ? JSON.parse(i.itemSnapshot) : null,
        })),
    }));

    return jsonOk({
      publicId: trade.publicId,
      currentVersion: trade.currentVersion,
      termsLockedAt: trade.termsLockedAt,
      versions: byVersion,
    });
  } catch (e) {
    if (e instanceof TradeError) return jsonError(e.message, e.status);
    return handleApiError(e);
  }
}
