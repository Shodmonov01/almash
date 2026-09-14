/** Detect money / payment talk and contact leaks in messages & listings. */

const MONEY_PATTERNS: { reason: string; re: RegExp }[] = [
  { reason: "сумма", re: /\d{2,}\s*(сум|руб|usd|eur|\$|₽)/iu },
  { reason: "валюта", re: /(доллар|евро|рубл|долларов|суммов)/iu },
  { reason: "карта", re: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/ },
  { reason: "доплата", re: /допла[тч][а-яё]*/iu },
  { reason: "перевод денег", re: /(перевед[иь]|скинь\s+деньг|отправь\s+деньг)\w*/iu },
  {
    reason: "оплата",
    re: /(оплат|заплат|плат[её]ж|продам|куплю|цена|стоимость)\w*/iu,
  },
  {
    reason: "платёжная система",
    re: /(click|payme|uzum|paypal|qiwi|crypto|bitcoin|usdt)/iu,
  },
  { reason: "кошелёк", re: /(кошел[её]к|wallet)/iu },
];

const CONTACT_PATTERNS: { reason: string; re: RegExp }[] = [
  { reason: "телефон", re: /(\+?\d[\d\s\-()]{8,}\d)/ },
  { reason: "telegram", re: /(@[a-zA-Z0-9_]{4,}|t\.me\/\w+)/i },
  { reason: "WhatsApp", re: /(whatsapp|ватсап|вацап)/iu },
];

export type ContentFlag = {
  blocked: boolean;
  reasons: string[];
  message: string;
};

export function scanContent(
  text: string,
  opts: { allowContacts?: boolean } = {},
): ContentFlag {
  const reasons: string[] = [];

  for (const p of MONEY_PATTERNS) {
    if (p.re.test(text)) reasons.push(p.reason);
  }

  if (!opts.allowContacts) {
    for (const p of CONTACT_PATTERNS) {
      if (p.re.test(text)) reasons.push(p.reason);
    }
  }

  const unique = [...new Set(reasons)];
  if (unique.length === 0) {
    return { blocked: false, reasons: [], message: "" };
  }

  const moneyHit = unique.some((r) =>
    MONEY_PATTERNS.some((p) => p.reason === r),
  );

  return {
    blocked: true,
    reasons: unique,
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
}): number {
  let score = 0;
  if (signals.isNewAccount) score += 15;
  if (signals.manyListings) score += 10;
  if (signals.moneyTalk) score += 40;
  if (signals.externalContact) score += 25;
  if (signals.manyCancels) score += 20;
  if (signals.manyDisputes) score += 25;
  return Math.min(100, score);
}
