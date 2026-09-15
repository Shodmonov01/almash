import { requireUser } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { getSwipeDeck, listMutualMatches } from "@/lib/services/swipe";

export async function GET() {
  try {
    const me = await requireUser();
    const [deck, mutual] = await Promise.all([
      getSwipeDeck(me.id),
      listMutualMatches(me.id),
    ]);
    return jsonOk({
      cards: deck.cards,
      myItemCount: deck.myItemCount,
      mutualMatches: mutual.map((m) => ({
        theirItem: {
          id: m.theirItem.id,
          title: m.theirItem.title,
          city: m.theirItem.city,
          media: m.theirItem.media,
          owner: m.theirItem.owner,
        },
        myItem: {
          id: m.myItem.id,
          title: m.myItem.title,
          media: m.myItem.media,
        },
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
