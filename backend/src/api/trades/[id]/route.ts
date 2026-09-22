import type { AppRequest } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: AppRequest, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    const trade = await prisma.trade.findFirst({
      where: {
        OR: [{ id }, { publicId: id }],
      },
      include: {
        parties: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatarUrl: true,
                trustLevel: true,
                rating: true,
                completedTrades: true,
                city: true,
                district: true,
              },
            },
          },
        },
        items: {
          include: {
            item: {
              include: {
                media: { orderBy: { sortOrder: "asc" } },
                owner: { select: { id: true, name: true } },
              },
            },
          },
        },
        versions: { orderBy: { version: "desc" } },
        disputes: { orderBy: { createdAt: "desc" } },
        reviews: true,
        auditLogs: { orderBy: { createdAt: "asc" }, take: 100 },
      },
    });

    if (!trade) return jsonError("Сделка не найдена", 404);

    const isParty =
      trade.initiatorId === user.id ||
      trade.recipientId === user.id ||
      user.role === "ADMIN";
    if (!isParty) return jsonError("Нет доступа", 403);

    const myParty = trade.parties.find((p) => p.userId === user.id);
    const items = trade.items.filter((i) => i.version === trade.currentVersion);

    // Hide opponent confirm codes; show own code after meeting scheduled
    const sanitized = {
      ...trade,
      items,
      confirmCodeA:
        myParty?.side === "A" || user.role === "ADMIN" ? trade.confirmCodeA : null,
      confirmCodeB:
        myParty?.side === "B" || user.role === "ADMIN" ? trade.confirmCodeB : null,
      qrToken:
        ["MEETING_SCHEDULED", "HANDOFF_PENDING", "PARTY_A_CONFIRMED", "PARTY_B_CONFIRMED"].includes(
          trade.status,
        ) || user.role === "ADMIN"
          ? trade.qrToken
          : null,
      mySide: myParty?.side ?? null,
    };

    return jsonOk({ trade: sanitized });
  } catch (e) {
    return handleApiError(e);
  }
}
