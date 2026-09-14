import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";

export async function GET() {
  try {
    const user = await requireUser();
    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const unread = notifications.filter((n) => !n.read).length;
    return jsonOk({ notifications, unread });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { ids } = await req.json().catch(() => ({ ids: [] as string[] }));
    if (Array.isArray(ids) && ids.length) {
      await prisma.notification.updateMany({
        where: { userId: user.id, id: { in: ids } },
        data: { read: true },
      });
    } else {
      await prisma.notification.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true },
      });
    }
    return jsonOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
