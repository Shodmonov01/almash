import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PLACEHOLDER = (seed: string, label: string) =>
  `https://placehold.co/600x600/1a5f4a/ffffff/png?text=${encodeURIComponent(label)}&font=roboto`;

async function main() {
  await prisma.message.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.riskEvent.deleteMany();
  await prisma.report.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.review.deleteMany();
  await prisma.tradeVersion.deleteMany();
  await prisma.tradeItem.deleteMany();
  await prisma.tradeParty.deleteMany();
  await prisma.trade.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.setItem.deleteMany();
  await prisma.itemSet.deleteMany();
  await prisma.itemMedia.deleteMany();
  await prisma.item.deleteMany();
  await prisma.forbiddenCategory.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      telegramId: "1000",
      name: "Админ",
      username: "admin",
      city: "Ташкент",
      district: "Мирабад",
      role: "ADMIN",
      trustLevel: "TRUSTED",
      rating: 5,
      ratingCount: 12,
      completedTrades: 120,
      onboardingDone: true,
      avatarUrl: PLACEHOLDER("admin", "Admin"),
    },
  });

  const aliya = await prisma.user.create({
    data: {
      telegramId: "1001",
      name: "Алия",
      username: "aliya",
      city: "Ташкент",
      district: "Юнусабад",
      trustLevel: "VERIFIED",
      rating: 4.8,
      ratingCount: 8,
      completedTrades: 7,
      onboardingDone: true,
      avatarUrl: PLACEHOLDER("aliya", "Алия"),
    },
  });

  const bobur = await prisma.user.create({
    data: {
      telegramId: "1002",
      name: "Бобур",
      username: "bobur",
      city: "Ташкент",
      district: "Чиланзар",
      trustLevel: "NEW",
      rating: 0,
      ratingCount: 0,
      completedTrades: 0,
      onboardingDone: false,
      avatarUrl: PLACEHOLDER("bobur", "Бобур"),
    },
  });

  const dilnoza = await prisma.user.create({
    data: {
      telegramId: "1003",
      name: "Дильноза",
      username: "dilnoza",
      city: "Самарканд",
      district: "Центр",
      trustLevel: "RELIABLE",
      rating: 4.9,
      ratingCount: 22,
      completedTrades: 24,
      onboardingDone: true,
      avatarUrl: PLACEHOLDER("dilnoza", "Дильноза"),
    },
  });

  const itemsData = [
    {
      ownerId: aliya.id,
      title: "LEGO Technic 42115",
      description:
        "Набор LEGO Technic Lamborghini. Полный комплект, инструкция есть. Небольшие следы использования на коробке.",
      category: "Игрушки",
      subcategory: "Конструкторы",
      brand: "LEGO",
      model: "42115",
      condition: "хорошее",
      completeness: "полный комплект",
      ageFrom: 18,
      ageTo: 99,
      city: "Ташкент",
      district: "Юнусабад",
      wantType: "CATEGORY",
      wantText: "LEGO City / LEGO Technic / машинки",
      wantCategories: JSON.stringify(["Конструкторы", "Машинки"]),
      wantBrands: JSON.stringify(["LEGO", "Hot Wheels"]),
      defectsConfirmed: true,
      tags: JSON.stringify(["lego", "technic"]),
      photos: ["LEGO+1", "LEGO+2", "LEGO+3"],
    },
    {
      ownerId: aliya.id,
      title: "Набор фигурок LEGO",
      description: "3 фигурки LEGO City, без повреждений.",
      category: "Игрушки",
      subcategory: "Фигурки",
      brand: "LEGO",
      condition: "как новое",
      completeness: "полный комплект",
      city: "Ташкент",
      district: "Юнусабад",
      wantType: "ANY",
      wantText: "Рассмотрю любые предложения",
      defectsConfirmed: true,
      tags: JSON.stringify(["lego", "фигурки"]),
      photos: ["Figs+1", "Figs+2"],
    },
    {
      ownerId: bobur.id,
      title: "Hot Wheels машинка + трек",
      description: "Красная машинка Hot Wheels и короткий трек. Есть царапина на бампере.",
      category: "Игрушки",
      subcategory: "Машинки",
      brand: "Hot Wheels",
      condition: "есть следы использования",
      completeness: "машинка + трек",
      hasDamage: true,
      damageNotes: "Царапина на бампере",
      city: "Ташкент",
      district: "Чиланзар",
      wantType: "CATEGORY",
      wantText: "Конструкторы LEGO",
      wantCategories: JSON.stringify(["Конструкторы"]),
      wantBrands: JSON.stringify(["LEGO"]),
      defectsConfirmed: true,
      tags: JSON.stringify(["hotwheels", "машинки"]),
      photos: ["HW+1", "HW+2"],
    },
    {
      ownerId: bobur.id,
      title: "Фигурка супергероя",
      description: "Фигурка 15 см, подвижные суставы.",
      category: "Игрушки",
      subcategory: "Фигурки",
      brand: "Hasbro",
      condition: "хорошее",
      city: "Ташкент",
      district: "Чиланзар",
      wantType: "ANY",
      wantText: "Рассмотрю любые предложения",
      defectsConfirmed: true,
      photos: ["Hero+1", "Hero+2"],
    },
    {
      ownerId: dilnoza.id,
      title: "Кукла Barbie Dreamhouse аксессуары",
      description: "Набор мебели и одежды для кукол. Без самой куклы.",
      category: "Аксессуары",
      subcategory: "Аксессуары для кукол",
      brand: "Barbie",
      condition: "хорошее",
      city: "Самарканд",
      district: "Центр",
      wantType: "CATEGORY",
      wantText: "Куклы или мягкие игрушки",
      wantCategories: JSON.stringify(["Куклы", "Мягкие игрушки"]),
      defectsConfirmed: true,
      photos: ["Barbie+1", "Barbie+2", "Barbie+3"],
    },
    {
      ownerId: dilnoza.id,
      title: "Мягкий медведь 40 см",
      description: "Чистый, стиранный, без пятен.",
      category: "Игрушки",
      subcategory: "Мягкие игрушки",
      condition: "как новое",
      city: "Самарканд",
      district: "Центр",
      wantType: "BRAND",
      wantText: "LEGO или настольные игры",
      wantBrands: JSON.stringify(["LEGO"]),
      wantCategories: JSON.stringify(["Конструкторы", "Настольные игры"]),
      defectsConfirmed: true,
      photos: ["Bear+1", "Bear+2"],
    },
  ];

  for (const raw of itemsData) {
    const { photos, ...data } = raw;
    const item = await prisma.item.create({ data });
    await prisma.itemMedia.createMany({
      data: photos.map((p, i) => ({
        itemId: item.id,
        type: "PHOTO",
        url: PLACEHOLDER(item.id + i, p),
        hash: `hash-${item.id}-${i}`,
        sortOrder: i,
      })),
    });
  }

  await prisma.forbiddenCategory.createMany({
    data: [
      { name: "оружие" },
      { name: "боеприпасы" },
      { name: "наркотические вещества" },
      { name: "опасные химикаты" },
      { name: "поддельные товары" },
      { name: "ворованные вещи" },
      { name: "интимные товары" },
    ],
  });

  console.log("Seed OK");
  console.log({ admin: admin.username, aliya: aliya.username, bobur: bobur.username, dilnoza: dilnoza.username });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
