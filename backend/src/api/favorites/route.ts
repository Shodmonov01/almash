import type { AppRequest } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";

export async function GET() {
  try {
    const user = await requireUser();
    const favorites = await prisma.favorite.findMany({
      where: { userId: user.id },
      include: {
        item: {
          include: {
            media: { orderBy: { sortOrder: "asc" }, take: 1 },
            owner: {
              select: { id: true, name: true, rating: true, city: true, trustLevel: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return jsonOk({ favorites });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: AppRequest) {
  try {
    const user = await requireUser();
    const { itemId } = await req.json();
    if (!itemId) return jsonError("itemId обязателен", 400);

    const existing = await prisma.favorite.findUnique({
      where: { userId_itemId: { userId: user.id, itemId } },
    });
    if (existing) {
      await prisma.favorite.delete({ where: { id: existing.id } });
      return jsonOk({ favorited: false });
    }
    await prisma.favorite.create({ data: { userId: user.id, itemId } });
    return jsonOk({ favorited: true });
  } catch (e) {
    return handleApiError(e);
  }
}
