export const CONDITIONS = [
  "новое",
  "как новое",
  "хорошее",
  "есть следы использования",
  "требует восстановления",
  "неполный комплект",
] as const;

export const CATEGORIES: Record<string, string[]> = {
  Игрушки: [
    "Конструкторы",
    "Машинки",
    "Куклы",
    "Мягкие игрушки",
    "Фигурки",
    "Настольные игры",
    "Пазлы",
    "Роботы",
    "Игрушечное оружие",
    "Радиоуправляемые",
    "Развивающие",
    "Наборы",
  ],
  Аксессуары: [
    "Детские рюкзаки",
    "Игровые аксессуары",
    "Аксессуары для кукол",
    "Аксессуары для конструкторов",
    "Игровые коврики",
    "Домики",
    "Гаражи",
    "Фигурки-дополнения",
    "Комплектующие",
  ],
};

export const TRADE_STATUSES = [
  "DRAFT",
  "OFFER_SENT",
  "NEGOTIATION",
  "TERMS_AGREED",
  "MEETING_SCHEDULED",
  "HANDOFF_PENDING",
  "PARTY_A_CONFIRMED",
  "PARTY_B_CONFIRMED",
  "COMPLETED",
  "DISPUTED",
  "CANCELLED",
  "BLOCKED",
  "EXPIRED",
] as const;

export type TradeStatus = (typeof TRADE_STATUSES)[number];

export const TRADE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  OFFER_SENT: "Предложение отправлено",
  NEGOTIATION: "Переговоры",
  TERMS_AGREED: "Условия согласованы",
  MEETING_SCHEDULED: "Встреча назначена",
  HANDOFF_PENDING: "Ожидание передачи",
  PARTY_A_CONFIRMED: "Подтвердил участник A",
  PARTY_B_CONFIRMED: "Подтвердил участник B",
  COMPLETED: "Завершён",
  DISPUTED: "Спор",
  CANCELLED: "Отменён",
  BLOCKED: "Заблокирован",
  EXPIRED: "Истёк",
};

export const DISPUTE_REASONS = [
  "предмет не передан",
  "передан другой предмет",
  "отсутствует часть комплекта",
  "скрытый дефект",
  "состояние существенно хуже описанного",
  "пользователь исчез",
  "пользователь отменил обмен после передачи",
  "попытка мошенничества",
  "нарушение договорённостей",
  "подозрение на подделку",
  "другое",
] as const;

export const REPORT_REASONS = [
  "просит деньги",
  "пытается перевести разговор на стороннюю площадку",
  "описание не соответствует предмету",
  "использует чужие фото",
  "угрожает",
  "не явился",
  "передал другой предмет",
  "другой вид мошенничества",
] as const;

export const REVIEW_TAGS = [
  "предмет соответствовал описанию",
  "человек приехал вовремя",
  "описание было честным",
  "комплектность совпала",
  "обмен прошёл без проблем",
] as const;

export const SAFE_MEETING_PLACES = [
  "Торговый центр (фойе / фудкорт)",
  "Кафе в людном районе",
  "Игровой центр",
  "Парк у входа / остановки",
  "Общественное место у метро / остановки",
];

export const TRUST_LEVELS = {
  NEW: { label: "Новый", minTrades: 0 },
  VERIFIED: { label: "Проверенный", minTrades: 5 },
  RELIABLE: { label: "Надёжный", minTrades: 20 },
  TRUSTED: { label: "Trusted", minTrades: 100 },
} as const;

export const OFFER_TTL_HOURS = 48;
export const MEETING_SCHEDULE_DAYS = 7;
