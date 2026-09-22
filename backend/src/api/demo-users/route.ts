import { prisma } from "@/lib/db";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";

/** Demo login list for local development only. */
export async function GET() {
  try {
    if (process.env.NODE_ENV === "production") {
      return jsonError("Не найдено", 404);
    }
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
