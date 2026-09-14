/** Content scanning for money talk / contact leaks — Cyrillic-aware. */

type Pattern = {
  reason: string;
  re: RegExp;
  /** Soft reasons alone don't block unless combined with money signals. */
  soft?: boolean;
};

const MONEY_PATTERNS: Pattern[] = [
  { reason: "сумма", re: /\d{2,3}([ \u00a0]?\d{3})*\s*(сум|руб(?:л(?:ей|я)?)?|usd|eur|\$|₽)/iu },
  { reason: "валюта", re: /(доллар(?:ов|а)?|евро|рубл(?:ей|я|ь)?)/iu },
  { reason: "карта", re: /\b\d{4}([\s-]?\d{4}){3}\b/ },
  { reason: "доплата", re: /допла[тч][а-яё]*/iu },
  {
    reason: "перевод денег",
    re: /(перевед[иьу]|скинь\s+деньг|отправь\s+деньг|кинь\s+деньг)[а-яё]*/iu,
  },
  {
    reason: "продажа",
    re: /\b(продам|куплю|продаю|покупаю|цена|стоимость)\b/iu,
  },
  {
    reason: "оплата",
    re: /\b(оплат[аыуе]|заплат[иь]|плат[её]ж)[а-яё]*/iu,
  },
  {
    reason: "платёжная система",
    re: /\b(click\.uz|payme|uzum|paypal|qiwi|crypto|bitcoin|usdt|trc20)\b/iu,
  },
  { reason: "кошелёк", re: /(кошел[её]к|wallet)/iu },
];

const CONTACT_PATTERNS: Pattern[] = [
  { reason: "телефон", re: /(\+?998[\s-]?)?\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/ },
  { reason: "telegram", re: /(@[a-zA-Z][a-zA-Z0-9_]{3,}|t\.me\/\w+)/i },
  { reason: "WhatsApp", re: /(whatsapp|ватсап|вацап)/iu },
];

export type ContentFlag = {
  blocked: boolean;
  reasons: string[];
  message: string;
  severity: "none" | "soft" | "hard";
};

export function scanContent(
  text: string,
  opts: { allowContacts?: boolean } = {},
): ContentFlag {
  const reasons: string[] = [];
  let hard = false;

  for (const p of MONEY_PATTERNS) {
    // Reset lastIndex for safety
    p.re.lastIndex = 0;
    if (p.re.test(text)) {
      reasons.push(p.reason);
      if (!p.soft) hard = true;
    }
  }

  if (!opts.allowContacts) {
    for (const p of CONTACT_PATTERNS) {
      p.re.lastIndex = 0;
      if (p.re.test(text)) {
        reasons.push(p.reason);
        hard = true;
      }
    }
  }

  const unique = [...new Set(reasons)];
  if (unique.length === 0) {
    return { blocked: false, reasons: [], message: "", severity: "none" };
  }

  const moneyHit = unique.some((r) =>
    [
      "сумма",
      "валюта",
      "карта",
      "доплата",
      "перевод денег",
      "продажа",
      "оплата",
      "платёжная система",
      "кошелёк",
    ].includes(r),
  );

  return {
    blocked: hard,
    reasons: unique,
    severity: hard ? "hard" : "soft",
    message: moneyHit
      ? "Внутри платформы запрещены денежные расчёты."
      : "Обмен контактами до подтверждения сделки ограничен.",
  };
}

export function computeRiskScore(signals: {
  isNewAccount?: boolean;
  manyListings?: boolean;
  moneyTalk?: boolean;
  externalContact?: boolean;
  manyCancels?: boolean;
  manyDisputes?: boolean;
  duplicatePhotos?: boolean;
  sharedDevice?: boolean;
}): number {
  let score = 0;
  if (signals.isNewAccount) score += 15;
  if (signals.manyListings) score += 10;
  if (signals.moneyTalk) score += 40;
  if (signals.externalContact) score += 25;
  if (signals.manyCancels) score += 20;
  if (signals.manyDisputes) score += 25;
  if (signals.duplicatePhotos) score += 35;
  if (signals.sharedDevice) score += 20;
  return Math.min(100, score);
}

/** Pure helpers exported for unit tests — trade status transitions. */
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["OFFER_SENT", "CANCELLED"],
  OFFER_SENT: ["NEGOTIATION", "CANCELLED", "EXPIRED"],
  NEGOTIATION: ["TERMS_AGREED", "CANCELLED", "EXPIRED"],
  TERMS_AGREED: ["MEETING_SCHEDULED", "NEGOTIATION", "CANCELLED", "EXPIRED"],
  MEETING_SCHEDULED: ["HANDOFF_PENDING", "PARTY_A_CONFIRMED", "PARTY_B_CONFIRMED", "CANCELLED", "DISPUTED"],
  HANDOFF_PENDING: ["PARTY_A_CONFIRMED", "PARTY_B_CONFIRMED", "CANCELLED", "DISPUTED"],
  PARTY_A_CONFIRMED: ["COMPLETED", "DISPUTED", "CANCELLED"],
  PARTY_B_CONFIRMED: ["COMPLETED", "DISPUTED", "CANCELLED"],
  COMPLETED: ["DISPUTED"],
  DISPUTED: ["NEGOTIATION", "CANCELLED", "COMPLETED"],
  CANCELLED: [],
  BLOCKED: [],
  EXPIRED: [],
};

export function canTransition(from: string, to: string): boolean {
  return (ALLOWED_TRANSITIONS[from] || []).includes(to);
}
