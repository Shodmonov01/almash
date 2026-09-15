import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { recordSwipe } from "@/lib/services/swipe";

const schema = z.object({
  itemId: z.string().min(1),
  direction: z.enum(["LIKE", "PASS"]),
  offeredItemId: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const me = await requireUser();
    const body = schema.parse(await req.json());
    const result = await recordSwipe({
      userId: me.id,
      itemId: body.itemId,
      direction: body.direction,
      offeredItemId: body.offeredItemId,
    });
    return jsonOk(result);
  } catch (e) {
    if (e && typeof e === "object" && "status" in e && "message" in e) {
      const err = e as { status: number; message: string };
      if (typeof err.status === "number") {
        return jsonError(err.message, err.status);
      }
    }
    return handleApiError(e);
  }
}
