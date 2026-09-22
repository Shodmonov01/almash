import { prisma } from "@/lib/db";
import { notify, writeAudit } from "@/lib/utils";

export type JobResult = {
  expiredOffers: number;
  expiredMeetings: number;
  reminders24: number;
  reminders2: number;
  handoffReminders: number;
};

/** Background maintenance: expire offers, send meeting reminders. */
export async function runMaintenanceJobs(): Promise<JobResult> {
  const now = new Date();
  const result: JobResult = {
    expiredOffers: 0,
    expiredMeetings: 0,
    reminders24: 0,
    reminders2: 0,
    handoffReminders: 0,
  };

  // Expire stale offers
  const staleOffers = await prisma.trade.findMany({
    where: {
      status: { in: ["OFFER_SENT", "DRAFT"] },
      expiresAt: { lt: now },
    },
    include: { items: true },
  });

  for (const t of staleOffers) {
    const ids = t.items
      .filter((i) => i.version === t.currentVersion)
      .map((i) => i.itemId);
    await prisma.trade.update({
      where: { id: t.id },
      data: { status: "EXPIRED", cancelReason: "Истекло время предложения" },
    });
    if (ids.length) {
      await prisma.item.updateMany({
        where: { id: { in: ids }, status: "IN_TRADE" },
        data: { status: "ACTIVE" },
      });
    }
    await writeAudit({ tradeId: t.id, action: "TRADE_EXPIRED" });
    await notify({
      userId: t.initiatorId,
      tradeId: t.id,
      type: "EXPIRED",
      title: "Предложение истекло",
      body: `${t.publicId} больше не активно`,
    });
    await notify({
      userId: t.recipientId,
      tradeId: t.id,
      type: "EXPIRED",
      title: "Предложение истекло",
      body: `${t.publicId} больше не активно`,
    });
    result.expiredOffers++;
  }

  // Meeting not scheduled within 7 days after TERMS_AGREED
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const stuckTerms = await prisma.trade.findMany({
    where: {
      status: "TERMS_AGREED",
      termsLockedAt: { lt: weekAgo },
    },
    include: { items: true },
  });
  for (const t of stuckTerms) {
    const ids = t.items
      .filter((i) => i.version === t.currentVersion)
      .map((i) => i.itemId);
    await prisma.trade.update({
      where: { id: t.id },
      data: { status: "EXPIRED", cancelReason: "Встреча не назначена вовремя" },
    });
    if (ids.length) {
      await prisma.item.updateMany({
        where: { id: { in: ids }, status: "IN_TRADE" },
        data: { status: "ACTIVE" },
      });
    }
    result.expiredMeetings++;
  }

  // Reminders 24h / 2h before meeting
  const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);
  const in23h = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const soon24 = await prisma.trade.findMany({
    where: {
      status: { in: ["MEETING_SCHEDULED", "HANDOFF_PENDING"] },
      meetingAt: { gte: in23h, lte: in25h },
      reminder24Sent: false,
    },
  });
  for (const t of soon24) {
    for (const uid of [t.initiatorId, t.recipientId]) {
      await notify({
        userId: uid,
        tradeId: t.id,
        type: "MEETING_REMINDER",
        title: "Встреча через ~24 часа",
        body: `${t.publicId}: ${t.meetingPlace || "место уточните в чате"}`,
      });
    }
    await prisma.trade.update({
      where: { id: t.id },
      data: { reminder24Sent: true },
    });
    result.reminders24++;
  }

  const in3h = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const in1h = new Date(now.getTime() + 1 * 60 * 60 * 1000);
  const soon2 = await prisma.trade.findMany({
    where: {
      status: { in: ["MEETING_SCHEDULED", "HANDOFF_PENDING"] },
      meetingAt: { gte: in1h, lte: in3h },
      reminder2Sent: false,
    },
  });
  for (const t of soon2) {
    for (const uid of [t.initiatorId, t.recipientId]) {
      await notify({
        userId: uid,
        tradeId: t.id,
        type: "MEETING_REMINDER",
        title: "Встреча скоро (~2 часа)",
        body: `${t.publicId}: не забудьте предметы и код подтверждения`,
      });
    }
    await prisma.trade.update({
      where: { id: t.id },
      data: { reminder2Sent: true },
    });
    result.reminders2++;
  }

  // Handoff pending too long (>24h after one side confirmed)
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const pending = await prisma.trade.findMany({
    where: {
      status: { in: ["PARTY_A_CONFIRMED", "PARTY_B_CONFIRMED", "HANDOFF_PENDING"] },
      handoffReminderSent: false,
      updatedAt: { lt: dayAgo },
    },
  });
  for (const t of pending) {
    for (const uid of [t.initiatorId, t.recipientId]) {
      await notify({
        userId: uid,
        tradeId: t.id,
        type: "HANDOFF_REMINDER",
        title: "Ожидается подтверждение передачи",
        body: `${t.publicId}: сделка ждёт второго подтверждения`,
      });
    }
    await prisma.trade.update({
      where: { id: t.id },
      data: { handoffReminderSent: true },
    });
    result.handoffReminders++;
  }

  return result;
}
