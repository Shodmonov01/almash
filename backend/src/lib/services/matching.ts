import { parseJsonArray } from "@/lib/utils";

export type MatchableItem = {
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
};

export function scorePair(
  mine: MatchableItem,
  theirs: MatchableItem,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const myWantCats = parseJsonArray(mine.wantCategories);
  const myWantBrands = parseJsonArray(mine.wantBrands);
  const theirWantCats = parseJsonArray(theirs.wantCategories);
  const theirWantBrands = parseJsonArray(theirs.wantBrands);

  const iWantTheirs =
    mine.wantType === "ANY" ||
    myWantCats.includes(theirs.subcategory || "") ||
    myWantCats.includes(theirs.category) ||
    (!!theirs.brand && myWantBrands.includes(theirs.brand)) ||
    (!!theirs.brand &&
      (mine.wantText || "").toLowerCase().includes(theirs.brand.toLowerCase())) ||
    (!!theirs.title &&
      (mine.wantText || "").toLowerCase().includes(theirs.title.toLowerCase().slice(0, 12)));

  const theyWantMine =
    theirs.wantType === "ANY" ||
    theirWantCats.includes(mine.subcategory || "") ||
    theirWantCats.includes(mine.category) ||
    (!!mine.brand && theirWantBrands.includes(mine.brand)) ||
    (!!mine.brand &&
      (theirs.wantText || "").toLowerCase().includes(mine.brand.toLowerCase()));

  if (iWantTheirs) {
    score += 40;
    reasons.push("подходит под ваши «хочу»");
  }
  if (theyWantMine) {
    score += 40;
    reasons.push("им подходит ваш предмет");
  }
  if (iWantTheirs && theyWantMine) {
    score += 20;
    reasons.unshift("взаимный обмен");
  }
  if (mine.city && theirs.city && mine.city === theirs.city) {
    score += 10;
    reasons.push("один город");
  }
  if (
    mine.brand &&
    theirs.brand &&
    mine.brand.toLowerCase() === theirs.brand.toLowerCase()
  ) {
    score += 5;
    reasons.push("общий бренд");
  }

  return { score: Math.min(100, score), reasons };
}

/** Rank feed items for "for_me" using viewer's inventory wants. */
export function rankFeedForUser<T extends MatchableItem>(
  myItems: MatchableItem[],
  candidates: T[],
): (T & { matchScore: number; matchReasons: string[] })[] {
  return candidates
    .map((c) => {
      let best = 0;
      let reasons: string[] = [];
      for (const mine of myItems) {
        const s = scorePair(mine, c);
        if (s.score > best) {
          best = s.score;
          reasons = s.reasons;
        }
      }
      // Also: does candidate want anything I have?
      if (myItems.length === 0) {
        best = c.wantType === "ANY" ? 20 : 5;
        reasons = ["новые объявления"];
      }
      return { ...c, matchScore: best, matchReasons: reasons };
    })
    .filter((c) => c.matchScore >= 30)
    .sort((a, b) => b.matchScore - a.matchScore);
}
