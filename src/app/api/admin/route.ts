import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { writeAudit } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const tab = new URL(req.url).searchParams.get("tab") || "overview";

    if (tab === "overview") {
      const [users, items, trades, disputes, reports, riskEvents] = await Promise.all([
        prisma.user.count(),
        prisma.item.count(),
        prisma.trade.count(),
        prisma.dispute.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }),
        prisma.report.count({ where: { status: "OPEN" } }),
        prisma.riskEvent.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
      ]);
      return jsonOk({ overview: { users, items, trades, openDisputes: disputes, openReports: reports, riskEvents } });
    }

    if (tab === "users") {
      const users = await prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return jsonOk({ users });
    }

    if (tab === "items") {
      const items = await prisma.item.findMany({
        where: { status: { in: ["PENDING_MODERATION", "ACTIVE", "BLOCKED"] } },
        include: {
          owner: { select: { id: true, name: true, username: true } },
          media: { take: 1 },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return jsonOk({ items });
    }

    if (tab === "trades") {
      const trades = await prisma.trade.findMany({
        orderBy: { updatedAt: "desc" },
        take: 100,
        include: {
          parties: { include: { user: { select: { id: true, name: true } } } },
        },
      });
      return jsonOk({ trades });
    }

    if (tab === "disputes") {
      const disputes = await prisma.dispute.findMany({
        include: {
          trade: true,
          openedBy: { select: { id: true, name: true, username: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return jsonOk({ disputes });
    }

    if (tab === "reports") {
      const reports = await prisma.report.findMany({
        include: {
          reporter: { select: { id: true, name: true } },
          targetUser: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return jsonOk({ reports });
    }

    if (tab === "moderation") {
      const queue = await prisma.moderationQueue.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return jsonOk({ queue });
    }

    return jsonError("Unknown tab", 400);
  } catch (e) {
    return handleApiError(e);
  }
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("block_user"),
    userId: z.string(),
    reason: z.string().optional(),
  }),
  z.object({
    action: z.literal("warn_user"),
    userId: z.string(),
  }),
  z.object({
    action: z.literal("moderate_item"),
    itemId: z.string(),
    decision: z.enum(["APPROVE", "BLOCK", "DELETE"]),
  }),
  z.object({
    action: z.literal("resolve_dispute"),
    disputeId: z.string(),
    resolution: z.enum(["RESOLVED_A", "RESOLVED_B", "RETURNED", "CLOSED"]),
    note: z.string().optional(),
  }),
  z.object({
    action: z.literal("review_report"),
    reportId: z.string(),
    status: z.enum(["REVIEWED", "ACTION_TAKEN", "DISMISSED"]),
  }),
  z.object({
    action: z.literal("review_moderation"),
    queueId: z.string(),
    status: z.enum(["REVIEWED", "DISMISSED"]),
  }),
  z.object({
    action: z.literal("run_jobs"),
  }),
]);

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = actionSchema.parse(await req.json());

    switch (body.action) {
      case "block_user": {
        await prisma.user.update({
          where: { id: body.userId },
          data: { status: "BLOCKED" },
        });
        await writeAudit({
          userId: admin.id,
          action: "ADMIN_BLOCK_USER",
          meta: { userId: body.userId, reason: body.reason },
        });
        break;
      }
      case "warn_user": {
        await prisma.user.update({
          where: { id: body.userId },
          data: { warningCount: { increment: 1 }, status: "WARNED" },
        });
        await writeAudit({
          userId: admin.id,
          action: "ADMIN_WARN_USER",
          meta: { userId: body.userId },
        });
        break;
      }
      case "moderate_item": {
        const status =
          body.decision === "APPROVE"
            ? "ACTIVE"
            : body.decision === "BLOCK"
              ? "BLOCKED"
              : "HIDDEN";
        await prisma.item.update({
          where: { id: body.itemId },
          data: { status },
        });
        await writeAudit({
          userId: admin.id,
          action: "ADMIN_MODERATE_ITEM",
          meta: { itemId: body.itemId, decision: body.decision },
        });
        break;
      }
      case "resolve_dispute": {
        const dispute = await prisma.dispute.update({
          where: { id: body.disputeId },
          data: {
            status: body.resolution,
            resolution: body.note,
            resolvedById: admin.id,
          },
        });
        if (body.resolution === "RETURNED") {
          await prisma.trade.update({
            where: { id: dispute.tradeId },
            data: { status: "NEGOTIATION", termsLockedAt: null },
          });
          await prisma.tradeParty.updateMany({
            where: { tradeId: dispute.tradeId },
            data: { confirmedTerms: false },
          });
        } else if (body.resolution === "CLOSED") {
          // leave trade disputed/cancelled handled separately
        } else {
          await prisma.trade.update({
            where: { id: dispute.tradeId },
            data: { status: "CANCELLED", cancelReason: `Спор: ${body.resolution}` },
          });
        }
        await writeAudit({
          userId: admin.id,
          tradeId: dispute.tradeId,
          action: "ADMIN_RESOLVE_DISPUTE",
          meta: { resolution: body.resolution },
        });
        break;
      }
      case "review_report": {
        await prisma.report.update({
          where: { id: body.reportId },
          data: { status: body.status },
        });
        break;
      }
      case "review_moderation": {
        await prisma.moderationQueue.update({
          where: { id: body.queueId },
          data: {
            status: body.status,
            reviewedAt: new Date(),
            reviewedBy: admin.id,
          },
        });
        await writeAudit({
          userId: admin.id,
          action: "ADMIN_REVIEW_MODERATION",
          meta: { queueId: body.queueId, status: body.status },
        });
        break;
      }
      case "run_jobs": {
        const { runMaintenanceJobs } = await import("@/lib/jobs/maintenance");
        const result = await runMaintenanceJobs();
        await writeAudit({
          userId: admin.id,
          action: "JOBS_RUN",
          meta: result,
        });
        break;
      }
    }

    return jsonOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
