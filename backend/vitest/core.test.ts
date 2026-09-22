import { describe, expect, it } from "vitest";
import { createHash, createHmac } from "node:crypto";
import {
  canTransition,
  scanContent,
  computeRiskScore,
} from "../src/lib/antifraud";
import { scorePair, rankFeedForUser } from "../src/lib/services/matching";
import { hammingDistance } from "../src/lib/services/media";
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
    const initData = buildDemoInitData({
      id: 42,
      first_name: "Aliya",
      username: "aliya",
    });
    const result = validateTelegramInitData(initData);
    expect(result.ok).toBe(true);
    expect(result.user?.id).toBe(42);
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
