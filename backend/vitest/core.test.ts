import { describe, expect, it } from "vitest";
import { createHash, createHmac } from "node:crypto";
import {
  canTransition,
  scanContent,
  computeRiskScore,
} from "../src/lib/antifraud";
import { scorePair, rankFeedForUser } from "../src/lib/services/matching";
import { hammingDistance } from "../src/lib/services/media";
import { matchesForbidden } from "../src/lib/services/risk";
import {
  buildTelegramMessage,
  classifyTelegramResponse,
} from "../src/lib/services/telegram-notify";
import { hashPassword, verifyPassword } from "../src/lib/password";
import {
  buildDemoInitData,
  validateTelegramInitData,
  validateTelegramLoginWidget,
} from "../src/lib/services/telegram-auth";

describe("scanContent", () => {
  it("blocks money top-up talk", () => {
    const r = scanContent("доплачу 50000 сум");
    expect(r.blocked).toBe(true);
    expect(r.reasons).toEqual(expect.arrayContaining(["доплата", "сумма"]));
  });

  it("allows normal meetup chat", () => {
    const r = scanContent("Давай в 15:00 у метро Юнусабад");
    expect(r.blocked).toBe(false);
  });

  it("blocks card numbers", () => {
    const r = scanContent("карта 8600123412341234");
    expect(r.blocked).toBe(true);
    expect(r.reasons).toContain("карта");
  });

  it("blocks contacts before terms", () => {
    const r = scanContent("пиши в @username_tg");
    expect(r.blocked).toBe(true);
  });

  it("allows contacts after terms if opted in", () => {
    const r = scanContent("пиши в @username_tg", { allowContacts: true });
    expect(r.blocked).toBe(false);
  });

  it.each([
    "оплата картой",
    "заплати мне сначала",
    "продам за 50",
    "цена какая?",
    "покупаю такую же",
    "стоимость большая",
    "скинь деньги",
    "дам игрушку + 50 000 сум",
    "pul o'tkazib ber",
    "narxi qancha",
    "to'lov qilasizmi",
    "100 ming so'm qo'shimcha pul",
    "sotib olaman",
    "kartaga o'tkazib bering",
  ])("detects money talk: %s", (text) => {
    const r = scanContent(text);
    expect(r.blocked).toBe(true);
    expect(r.message).toBe("Внутри платформы запрещены денежные расчёты.");
  });

  it.each([
    "Отличный набор LEGO, всё на месте",
    "Встретимся у торгового центра в субботу",
    "Состояние хорошее, есть пара царапин",
    "Mashinka yaxshi holatda",
    "Капуста, пульт от машинки в комплекте",
  ])("does not flag normal text: %s", (text) => {
    expect(scanContent(text).blocked).toBe(false);
  });
});

describe("forbidden categories", () => {
  it("allows toy weapons (TZ §3)", () => {
    expect(matchesForbidden("Игрушечное оружие\nБластер Nerf", "оружие")).toBe(false);
    expect(matchesForbidden("детское оружие из пластика", "оружие")).toBe(false);
  });
  it("blocks real weapons (TZ §34)", () => {
    expect(matchesForbidden("Продаю оружие", "оружие")).toBe(true);
    expect(matchesForbidden("набор: оружие и патроны", "оружие")).toBe(true);
  });
  it("does not match inside other words", () => {
    expect(matchesForbidden("вооружие", "оружие")).toBe(false);
  });
});

describe("telegram notifications", () => {
  it("escapes HTML and adds a Mini App button to the trade", () => {
    const p = buildTelegramMessage(
      { title: "Новое <предложение>", body: "A & B", tradeId: "t1" },
      "42",
      "https://retoy.example",
    ) as { text: string; chat_id: string; reply_markup: { inline_keyboard: { web_app: { url: string } }[][] } };
    expect(p.chat_id).toBe("42");
    expect(p.text).toBe("<b>Новое &lt;предложение&gt;</b>\nA &amp; B");
    expect(p.reply_markup.inline_keyboard[0][0].web_app.url).toBe("https://retoy.example/trades/t1");
  });
  it("omits the button without a public https URL", () => {
    const p = buildTelegramMessage({ title: "t", body: "b", tradeId: null }, "1", "http://localhost:5173");
    expect(p.reply_markup).toBeUndefined();
  });
  it("classifies Bot API responses", () => {
    expect(classifyTelegramResponse(200, { ok: true }).kind).toBe("sent");
    expect(classifyTelegramResponse(403, { ok: false, error_code: 403, description: "bot was blocked" }).kind).toBe("permanent");
    expect(classifyTelegramResponse(400, { ok: false, error_code: 400, description: "chat not found" }).kind).toBe("permanent");
    const rl = classifyTelegramResponse(429, { ok: false, error_code: 429, parameters: { retry_after: 7 } });
    expect(rl).toEqual({ kind: "retry", reason: expect.any(String), retryAfterMs: 7000 });
    expect(classifyTelegramResponse(502, null).kind).toBe("retry");
  });
});

describe("risk score signals", () => {
  it("counts new TZ §33 signals", () => {
    expect(computeRiskScore({ manyReports: true })).toBe(25);
    expect(computeRiskScore({ duplicateDescriptions: true, noShows: true })).toBe(45);
  });
});

describe("trade transitions", () => {
  it("allows offer to negotiation", () => {
    expect(canTransition("OFFER_SENT", "NEGOTIATION")).toBe(true);
  });
  it("forbids completed to offer", () => {
    expect(canTransition("COMPLETED", "OFFER_SENT")).toBe(false);
  });
  it("allows disputed back to negotiation", () => {
    expect(canTransition("DISPUTED", "NEGOTIATION")).toBe(true);
  });
});

describe("risk score", () => {
  it("caps at 100", () => {
    expect(
      computeRiskScore({
        isNewAccount: true,
        manyListings: true,
        moneyTalk: true,
        externalContact: true,
        manyCancels: true,
        manyDisputes: true,
        duplicatePhotos: true,
        sharedDevice: true,
      }),
    ).toBe(100);
  });
});

describe("matching", () => {
  const lego = {
    id: "1",
    ownerId: "a",
    title: "LEGO City",
    category: "Игрушки",
    subcategory: "Конструкторы",
    brand: "LEGO",
    city: "Ташкент",
    wantType: "CATEGORY",
    wantText: "машинки",
    wantCategories: JSON.stringify(["Машинки"]),
    wantBrands: JSON.stringify([]),
  };
  const car = {
    id: "2",
    ownerId: "b",
    title: "Hot Wheels",
    category: "Игрушки",
    subcategory: "Машинки",
    brand: "Hot Wheels",
    city: "Ташкент",
    wantType: "BRAND",
    wantText: "LEGO",
    wantCategories: JSON.stringify(["Конструкторы"]),
    wantBrands: JSON.stringify(["LEGO"]),
  };

  it("scores mutual match high", () => {
    const s = scorePair(lego, car);
    expect(s.score).toBeGreaterThanOrEqual(90);
    expect(s.reasons.some((r) => r.includes("взаимный"))).toBe(true);
  });

  it("ranks feed", () => {
    const ranked = rankFeedForUser([lego], [car]);
    expect(ranked[0].id).toBe("2");
    expect(ranked[0].matchScore).toBeGreaterThan(50);
  });
});

describe("phash hamming", () => {
  it("identical hashes distance 0", () => {
    expect(hammingDistance("ffff", "ffff")).toBe(0);
  });
  it("detects difference", () => {
    expect(hammingDistance("0000", "ffff")).toBeGreaterThan(0);
  });
});

describe("password hashing", () => {
  it("verifies the original password", async () => {
    const stored = await hashPassword("demo1234");
    expect(await verifyPassword("demo1234", stored)).toBe(true);
    expect(await verifyPassword("wrong-pass", stored)).toBe(false);
  });
});

describe("telegram signatures", () => {
  it("accepts demo Mini App initData", () => {
    // demo signatures only work while no real bot token is configured
    const saved = process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_BOT_TOKEN;
    try {
      const initData = buildDemoInitData({
        id: 42,
        first_name: "Aliya",
        username: "aliya",
      });
      const result = validateTelegramInitData(initData);
      expect(result.ok).toBe(true);
      expect(result.user?.id).toBe(42);
    } finally {
      if (saved !== undefined) process.env.TELEGRAM_BOT_TOKEN = saved;
    }
  });

  it("accepts Login Widget payload signed with bot token", () => {
    const token = "123456:test-token";
    const payload: Record<string, string | number> = {
      id: 99,
      first_name: "Bobur",
      username: "bobur",
      auth_date: Math.floor(Date.now() / 1000),
    };
    const dataCheckString = Object.keys(payload)
      .sort()
      .map((key) => `${key}=${payload[key]}`)
      .join("\n");
    const secret = createHash("sha256").update(token).digest();
    const hash = createHmac("sha256", secret)
      .update(dataCheckString)
      .digest("hex");
    const result = validateTelegramLoginWidget({ ...payload, hash }, token);
    expect(result.ok).toBe(true);
    expect(result.user?.id).toBe(99);
  });
});
