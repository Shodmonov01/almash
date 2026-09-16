import { prisma } from "@/lib/db";
import { notify } from "@/lib/utils";
import { scorePair, type MatchableItem } from "@/lib/services/matching";

export type SwipeDirection = "LIKE" | "PASS";

export type DeckCard = {
  id: string;
  title: string;
  description: string;
  category: string;
  subcategory: string | null;
  brand: string | null;
  condition: string;
  city: string;
  district: string | null;
  wantType: string;
  wantText: string | null;
  media: { url: string }[];
  owner: {
    id: string;
    name: string;
    avatarUrl: string | null;
    city: string;
    rating: number;
    trustLevel: string;
  };
  matchScore: number;
  matchReasons: string[];
  suggestedOffer: { id: string; title: string; media: { url: string }[] } | null;
};

function toMatchable(item: {
  id: string;
  ownerId: string;
  title: string;
  category: string;
  subcategory: string | null;
  brand: string | null;
  city: string;
  wantType: string;
  wantText: string | null;
  wantCategories: string | null;
  wantBrands: string | null;
}): MatchableItem {
  return item;
}

/** Build ranked swipe deck: active items user hasn't decided on yet. */
export async function getSwipeDeck(userId: string, limit = 20): Promise<{
  cards: DeckCard[];
  myItemCount: number;
}> {
  const myItems = await prisma.item.findMany({
    where: { ownerId: userId, status: "ACTIVE" },
    include: { media: { take: 1, orderBy: { sortOrder: "asc" } } },
  });

  const already = await prisma.swipe.findMany({
    where: { userId },
    select: { itemId: true },
  });
  const seenIds = already.map((s) => s.itemId);

  const candidates = await prisma.item.findMany({
    where: {
      status: "ACTIVE",
      NOT: { ownerId: userId },
      ...(seenIds.length ? { id: { notIn: seenIds } } : {}),
    },
    include: {
      media: { orderBy: { sortOrder: "asc" }, take: 3 },
      owner: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          city: true,
          rating: true,
          trustLevel: true,
          status: true,
        },
      },
    },
    take: 120,
    orderBy: { createdAt: "desc" },
  });

  const scored: DeckCard[] = candidates
    .filter((c) => c.owner.status === "ACTIVE")
    .map((c) => {
      let best = 15;
      let reasons: string[] = ["новые объявления"];
      let suggested: (typeof myItems)[number] | null = null;

      for (const mine of myItems) {
        const s = scorePair(toMatchable(mine), toMatchable(c));
        if (s.score >= best) {
          best = s.score;
          reasons = s.reasons.length ? s.reasons : reasons;
          suggested = mine;
        }
      }

      if (myItems.length === 0) {
        best = 20;
        reasons = ["добавьте свою игрушку, чтобы обмениваться"];
      }

      return {
        id: c.id,
        title: c.title,
        description: c.description,
        category: c.category,
        subcategory: c.subcategory,
        brand: c.brand,
        condition: c.condition,
        city: c.city,
        district: c.district,
        wantType: c.wantType,
        wantText: c.wantText,
        media: c.media.map((m) => ({ url: m.url })),
        owner: {
          id: c.owner.id,
          name: c.owner.name,
          avatarUrl: c.owner.avatarUrl,
          city: c.owner.city,
          rating: c.owner.rating,
          trustLevel: c.owner.trustLevel,
        },
        matchScore: best,
        matchReasons: reasons,
        suggestedOffer: suggested
          ? {
              id: suggested.id,
              title: suggested.title,
              media: suggested.media.map((m) => ({ url: m.url })),
            }
          : null,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);

  return { cards: scored, myItemCount: myItems.length };
}

export type SwipeResult = {
  direction: SwipeDirection;
  match: null | {
    theirItemId: string;
    theirItemTitle: string;
    myItemId: string;
    myItemTitle: string;
    theirUserId: string;
    theirUserName: string;
  };
};

/** Record LIKE/PASS; detect mutual like and notify. */
export async function recordSwipe(params: {
  userId: string;
  itemId: string;
  direction: SwipeDirection;
  offeredItemId?: string | null;
}): Promise<SwipeResult> {
  const target = await prisma.item.findUnique({
    where: { id: params.itemId },
    include: {
      owner: { select: { id: true, name: true, status: true } },
      media: { take: 1 },
    },
  });
  if (!target || target.status !== "ACTIVE") {
    throw Object.assign(new Error("Предмет недоступен"), { status: 404 });
  }
  if (target.ownerId === params.userId) {
    throw Object.assign(new Error("Нельзя свайпать свои вещи"), { status: 400 });
  }
  if (target.owner.status !== "ACTIVE") {
    throw Object.assign(new Error("Пользователь недоступен"), { status: 400 });
  }

  let offeredItemId = params.offeredItemId ?? null;
  let offeredTitle = "";

  if (params.direction === "LIKE") {
    if (offeredItemId) {
      const offered = await prisma.item.findFirst({
        where: {
          id: offeredItemId,
          ownerId: params.userId,
          status: "ACTIVE",
        },
      });
      if (!offered) {
        throw Object.assign(new Error("Ваш предмет недоступен"), { status: 400 });
      }
      offeredTitle = offered.title;
    } else {
      const myItems = await prisma.item.findMany({
        where: { ownerId: params.userId, status: "ACTIVE" },
      });
      if (myItems.length === 0) {
        throw Object.assign(
          new Error("Сначала добавьте свою игрушку для обмена"),
          { status: 400 },
        );
      }
      let best = myItems[0];
      let bestScore = -1;
      for (const mine of myItems) {
        const s = scorePair(toMatchable(mine), toMatchable(target));
        if (s.score > bestScore) {
          bestScore = s.score;
          best = mine;
        }
      }
      offeredItemId = best.id;
      offeredTitle = best.title;
    }
  }

  await prisma.swipe.upsert({
    where: {
      userId_itemId: { userId: params.userId, itemId: params.itemId },
    },
    create: {
      userId: params.userId,
      itemId: params.itemId,
      direction: params.direction,
      offeredItemId,
    },
    update: {
      direction: params.direction,
      offeredItemId,
    },
  });

  if (params.direction !== "LIKE" || !offeredItemId) {
    return { direction: params.direction, match: null };
  }

  // Mutual: they already liked the item we're offering
  const reciprocal = await prisma.swipe.findFirst({
    where: {
      userId: target.ownerId,
      itemId: offeredItemId,
      direction: "LIKE",
    },
    include: {
      item: { select: { id: true, title: true } },
    },
  });

  // Or they liked any of our items while offering this target
  const reciprocalAlt =
    reciprocal ||
    (await prisma.swipe.findFirst({
      where: {
        userId: target.ownerId,
        direction: "LIKE",
        offeredItemId: params.itemId,
        item: { ownerId: params.userId },
      },
      include: {
        item: { select: { id: true, title: true } },
      },
    }));

  if (!reciprocalAlt) {
    // Soft notify owner: someone liked their item
    const me = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { name: true },
    });
    await notify({
      userId: target.ownerId,
      type: "SWIPE_LIKE",
      title: "Кто-то хочет ваш обмен",
      body: `${me?.name || "Пользователь"} свайпнул вправо «${target.title}». Свайпните их вещи, чтобы открыть матч.`,
    });
    return { direction: "LIKE", match: null };
  }

  const myItemId = reciprocalAlt.itemId;
  const myItemTitle = reciprocalAlt.item.title;

  const me = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { name: true },
  });

  await notify({
    userId: target.ownerId,
    type: "SWIPE_MATCH",
    title: "Взаимный матч!",
    body: `Вы и ${me?.name || "пользователь"} хотите обменяться: «${myItemTitle}» ⇄ «${target.title}».`,
  });
  await notify({
    userId: params.userId,
    type: "SWIPE_MATCH",
    title: "Взаимный матч!",
    body: `Вы и ${target.owner.name} хотите обменяться: «${offeredTitle || myItemTitle}» ⇄ «${target.title}».`,
  });

  return {
    direction: "LIKE",
    match: {
      theirItemId: target.id,
      theirItemTitle: target.title,
      myItemId: offeredItemId || myItemId,
      myItemTitle: offeredTitle || myItemTitle,
      theirUserId: target.ownerId,
      theirUserName: target.owner.name,
    },
  };
}

export async function listMutualMatches(userId: string) {
  const myLikes = await prisma.swipe.findMany({
    where: { userId, direction: "LIKE", offeredItemId: { not: null } },
    include: {
      item: {
        include: {
          media: { take: 1, orderBy: { sortOrder: "asc" } },
          owner: {
            select: { id: true, name: true, avatarUrl: true, city: true },
          },
        },
      },
      offeredItem: {
        include: { media: { take: 1, orderBy: { sortOrder: "asc" } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const mutual = [];
  for (const like of myLikes) {
    if (!like.offeredItemId || !like.offeredItem) continue;
    const theirs = await prisma.swipe.findFirst({
      where: {
        userId: like.item.ownerId,
        direction: "LIKE",
        OR: [
          { itemId: like.offeredItemId },
          { offeredItemId: like.itemId, item: { ownerId: userId } },
        ],
      },
    });
    if (!theirs) continue;
    mutual.push({
      theirItem: like.item,
      myItem: like.offeredItem,
      swipedAt: like.createdAt,
    });
  }
  return mutual;
}
