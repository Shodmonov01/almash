import { prisma } from "@/lib/db";
import { handleApiError, jsonOk } from "@/lib/api";

/** Demo login list (Telegram Mini App stand-in). */
export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        avatarUrl: true,
        city: true,
        role: true,
        trustLevel: true,
      },
      orderBy: { name: "asc" },
    });
    return jsonOk({ users });
  } catch (e) {
    return handleApiError(e);
  }
}
