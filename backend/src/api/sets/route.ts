import type { AppRequest } from "@/lib/http";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";

const createSetSchema = z.object({
  title: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  itemIds: z.array(z.string()).min(1, "Выберите хотя бы один предмет"),
});

export async function GET(req: AppRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const ownerId = searchParams.get("ownerId") || user.id;

    const sets = await prisma.itemSet.findMany({
      where: { ownerId },
      include: {
        items: {
          include: {
            item: {
              include: {
                media: { orderBy: { sortOrder: "asc" } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return jsonOk({ sets });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: AppRequest) {
  try {
    const user = await requireUser();
    const body = createSetSchema.parse(await req.json());

    // Validate that all items belong to this user
    const items = await prisma.item.findMany({
      where: {
        id: { in: body.itemIds },
        ownerId: user.id,
        status: { notIn: ["BLOCKED"] },
      },
    });

    if (items.length !== body.itemIds.length) {
      return jsonError(
        "Некоторые предметы недоступны или не принадлежат вам",
        400,
      );
    }

    const set = await prisma.itemSet.create({
      data: {
        ownerId: user.id,
        title: body.title,
        description: body.description,
        items: {
          create: body.itemIds.map((itemId) => ({ itemId })),
        },
      },
      include: {
        items: {
          include: {
            item: {
              include: {
                media: { orderBy: { sortOrder: "asc" } },
              },
            },
          },
        },
      },
    });

    return jsonOk({ set }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: AppRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id");

    if (!id) {
      try {
        const body = (await req.json()) as { id?: string };
        id = body.id || null;
      } catch {
        // no body
      }
    }

    if (!id) return jsonError("id набора обязателен", 400);

    const set = await prisma.itemSet.findUnique({ where: { id } });
    if (!set) return jsonError("Набор не найден", 404);

    if (set.ownerId !== user.id && user.role !== "ADMIN") {
      return jsonError("Нет доступа к удалению набора", 403);
    }

    await prisma.itemSet.delete({ where: { id } });
    return jsonOk({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
