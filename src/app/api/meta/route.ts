import { jsonOk } from "@/lib/api";
import {
  CATEGORIES,
  CONDITIONS,
  DISPUTE_REASONS,
  REPORT_REASONS,
  REVIEW_TAGS,
  SAFE_MEETING_PLACES,
  TRADE_STATUS_LABELS,
  TRUST_LEVELS,
} from "@/lib/constants";
import { prisma } from "@/lib/db";

export async function GET() {
  const forbidden = await prisma.forbiddenCategory.findMany({
    where: { enabled: true },
  });
  return jsonOk({
    categories: CATEGORIES,
    conditions: CONDITIONS,
    disputeReasons: DISPUTE_REASONS,
    reportReasons: REPORT_REASONS,
    reviewTags: REVIEW_TAGS,
    safeMeetingPlaces: SAFE_MEETING_PLACES,
    tradeStatusLabels: TRADE_STATUS_LABELS,
    trustLevels: TRUST_LEVELS,
    forbiddenCategories: forbidden.map((f) => f.name),
    philosophy:
      "Мы не продаём игрушки. Мы не оцениваем игрушки в деньгах. Мы не принимаем деньги. Мы соединяем людей для безопасного обмена вещами.",
  });
}
