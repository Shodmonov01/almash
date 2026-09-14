import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { parseJsonArray, writeAudit } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const item = await prisma.item.findUnique({
      where: { id },
      include: {
        media: { orderBy: { sortOrder: "asc" } },
        owner: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
            rating: true,
            ratingCount: true,
            completedTrades: true,
            trustLevel: true,
            city: true,
            district: true,
            createdAt: true,
          },
        },
      },
    });
    if (!item || item.status === "BLOCKED") return jsonError("Не найдено", 404);

    const session = await getSessionUser();
    let favorited = false;
    if (session) {
      const fav = await prisma.favorite.findUnique({
        where: { userId_itemId: { userId: session.id, itemId: id } },
      });
      favorited = !!fav;
    }

    return jsonOk({
      item: {
        ...item,
        wantCategories: parseJsonArray(item.wantCategories),
        wantBrands: parseJsonArray(item.wantBrands),
        tags: parseJsonArray(item.tags),
        favorited,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const item = await prisma.item.findUnique({ where: { id } });
    if (!item) return jsonError("Не найдено", 404);
    if (item.ownerId !== user.id && user.role !== "ADMIN") {
      return jsonError("Нет доступа", 403);
    }
    if (item.status === "IN_TRADE") {
      return jsonError("Предмет участвует в сделке", 400);
    }
    await prisma.item.update({ where: { id }, data: { status: "HIDDEN" } });
    await writeAudit({ userId: user.id, action: "ITEM_HIDDEN", meta: { itemId: id } });
    return jsonOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
