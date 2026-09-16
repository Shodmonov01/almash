import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/db";

const schema = z.object({
  onboardingDone: z.boolean().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  bio: z.string().max(500).optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireUser();
    const body = schema.parse(await req.json());
    const user = await prisma.user.update({
      where: { id: session.id },
      data: body,
      select: {
        id: true,
        name: true,
        onboardingDone: true,
        city: true,
        district: true,
        bio: true,
      },
    });
    return jsonOk({ user });
  } catch (e) {
    return handleApiError(e);
  }
}
