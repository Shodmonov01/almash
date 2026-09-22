import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { parseJsonArray } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const user = await prisma.user.findFirst({
      where: { OR: [{ id }, { username: id }] },
      select: {
        id: true,
        name: true,
        username: true,
        avatarUrl: true,
        city: true,
        district: true,
        bio: true,
        trustLevel: true,
        rating: true,
        ratingCount: true,
        completedTrades: true,
        cancelledTrades: true,
        disputesCount: true,
        disputesWon: true,
        disputesLost: true,
        createdAt: true,
        status: true,
      },
    });
    if (!user || user.status === "BLOCKED") return jsonError("Не найден", 404);

    const [items, reviews] = await Promise.all([
      prisma.item.findMany({
        where: { ownerId: user.id, status: { in: ["ACTIVE", "IN_TRADE"] } },
        include: { media: { orderBy: { sortOrder: "asc" }, take: 1 } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.review.findMany({
        where: { targetId: user.id },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
          trade: { select: { publicId: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    return jsonOk({
      user,
      items,
      reviews: reviews.map((r) => ({
        ...r,
        tags: parseJsonArray(r.tags),
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
