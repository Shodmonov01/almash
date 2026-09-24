import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runHttp } from "./lib/context";
import { toAppRequest, type AppRequest } from "./lib/http";
import type { ApiResult } from "./lib/api";
import { runMaintenanceJobs } from "./lib/jobs/maintenance";
import { processTelegramOutbox } from "./lib/services/telegram-notify";

import * as auth from "./api/auth/route";
import * as register from "./api/auth/register/route";
import * as me from "./api/me/route";
import * as meAvatar from "./api/me/avatar/route";
import * as meta from "./api/meta/route";
import * as demoUsers from "./api/demo-users/route";
import * as items from "./api/items/route";
import * as itemById from "./api/items/[id]/route";
import * as upload from "./api/upload/route";
import * as trades from "./api/trades/route";
import * as tradeById from "./api/trades/[id]/route";
import * as tradeActions from "./api/trades/[id]/actions/route";
import * as tradeMessages from "./api/trades/[id]/messages/route";
import * as tradeVersions from "./api/trades/[id]/versions/route";
import * as tradeDisputes from "./api/trades/[id]/disputes/route";
import * as tradeReviews from "./api/trades/[id]/reviews/route";
import * as swipe from "./api/swipe/route";
import * as swipeDeck from "./api/swipe/deck/route";
import * as favorites from "./api/favorites/route";
import * as matches from "./api/matches/route";
import * as notifications from "./api/notifications/route";
import * as reports from "./api/reports/route";
import * as admin from "./api/admin/route";
import * as jobs from "./api/jobs/route";
import * as users from "./api/users/[id]/route";
import * as sets from "./api/sets/route";
import * as uploadAudio from "./api/upload-audio/route";
import * as uploadVideo from "./api/upload-video/route";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || "0.0.0.0";

function wrap(fn: (...args: any[]) => Promise<unknown>) {
  return async (
    req: Parameters<typeof runHttp>[0],
    reply: Parameters<typeof runHttp>[1],
  ) => {
    return runHttp(req, reply, async () => {
      const result = await fn(toAppRequest(req), {
        params: Promise.resolve((req.params || {}) as Record<string, string>),
      });
      if (
        result &&
        typeof result === "object" &&
        "status" in result &&
        "body" in result
      ) {
        const api = result as ApiResult;
        return reply.code(api.status).send(api.body);
      }
      return reply.send(result);
    });
  };
}

function assertProductionConfig() {
  if (process.env.NODE_ENV !== "production") return;
  const problems: string[] = [];
  const jwt = process.env.JWT_SECRET || "";
  if (jwt.length < 32 || jwt === "change-me") problems.push("JWT_SECRET (32+ символов)");
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.warn("TELEGRAM_BOT_TOKEN is not set — Telegram login is disabled");
  }
  if (problems.length) {
    throw new Error(`Production config missing: ${problems.join(", ")}`);
  }
}

async function main() {
  assertProductionConfig();
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });
  await app.register(cookie);
  await app.register(multipart, {
    attachFieldsToBody: true,
    // Per-route checks keep images/audio at 8 MB; videos may be up to 50 MB.
    limits: { fileSize: uploadVideo.MAX_VIDEO_BYTES },
  });
  const uploadsDir = path.join(__dirname, "../uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });
  await app.register(fastifyStatic, {
    root: uploadsDir,
    prefix: "/uploads/",
    decorateReply: true,
  });

  const publicDir = process.env.FRONTEND_DIST
    ? path.resolve(process.env.FRONTEND_DIST)
    : path.join(__dirname, "../public");
  const frontendIndex = path.join(publicDir, "index.html");
  const serveFrontend = fs.existsSync(frontendIndex);

  app.get("/api/health", async () => ({ ok: true }));

  app.get("/api/auth", wrap(auth.GET));
  app.post("/api/auth", wrap(auth.POST));
  app.delete("/api/auth", wrap(auth.DELETE));
  app.put("/api/auth", wrap(auth.PUT));
  app.post("/api/auth/register", wrap(register.POST));

  app.patch("/api/me", wrap(me.PATCH));
  app.post("/api/me/avatar", wrap(meAvatar.POST));
  app.get("/api/meta", wrap(meta.GET));
  app.get("/api/demo-users", wrap(demoUsers.GET));

  app.get("/api/items", wrap(items.GET));
  app.post("/api/items", wrap(items.POST));
  app.get("/api/items/:id", wrap(itemById.GET));
  app.patch("/api/items/:id", wrap(itemById.PATCH));
  app.delete("/api/items/:id", wrap(itemById.DELETE));
  app.post("/api/upload", wrap(upload.POST));

  app.get("/api/trades", wrap(trades.GET));
  app.post("/api/trades", wrap(trades.POST));
  app.get("/api/trades/:id", wrap(tradeById.GET));
  app.post("/api/trades/:id/actions", wrap(tradeActions.POST));
  app.get("/api/trades/:id/messages", wrap(tradeMessages.GET));
  app.post("/api/trades/:id/messages", wrap(tradeMessages.POST));
  app.get("/api/trades/:id/versions", wrap(tradeVersions.GET));
  app.post("/api/trades/:id/disputes", wrap(tradeDisputes.POST));
  app.post("/api/trades/:id/reviews", wrap(tradeReviews.POST));

  app.post("/api/swipe", wrap(swipe.POST));
  app.get("/api/swipe/deck", wrap(swipeDeck.GET));
  app.get("/api/favorites", wrap(favorites.GET));
  app.post("/api/favorites", wrap(favorites.POST));
  app.get("/api/matches", wrap(matches.GET));
  app.get("/api/notifications", wrap(notifications.GET));
  app.post("/api/notifications", wrap(notifications.POST));
  app.post("/api/reports", wrap(reports.POST));
  app.get("/api/admin", wrap(admin.GET));
  app.post("/api/admin", wrap(admin.POST));
  app.get("/api/jobs", wrap(jobs.GET));
  app.post("/api/jobs", wrap(jobs.POST));
  app.get("/api/users/:id", wrap(users.GET));
  app.get("/api/sets", wrap(sets.GET));
  app.post("/api/sets", wrap(sets.POST));
  app.delete("/api/sets", wrap(sets.DELETE));
  app.post("/api/upload-audio", wrap(uploadAudio.POST));
  app.post("/api/upload-video", wrap(uploadVideo.POST));

  if (serveFrontend) {
    // index.html must never be cached (Telegram's WebView holds it for days,
    // so users kept an old build after deploys); Vite's hashed assets can be.
    const NO_CACHE = "no-cache, no-store, must-revalidate";
    await app.register(fastifyStatic, {
      root: publicDir,
      prefix: "/",
      wildcard: false,
      decorateReply: false,
      cacheControl: false,
      setHeaders: (res, filePath) => {
        res.setHeader(
          "Cache-Control",
          filePath.includes(`${path.sep}assets${path.sep}`)
            ? "public, max-age=31536000, immutable"
            : NO_CACHE,
        );
      },
    });
    app.setNotFoundHandler((req, reply) => {
      const url = req.url.split("?")[0];
      // A missing build file (old page asking for an asset a deploy removed)
      // must 404: answering with index.html made the browser run HTML as JS
      // and the Mini App stayed white.
      if (url.startsWith("/api") || url.startsWith("/uploads") || url.startsWith("/assets/")) {
        return reply.code(404).header("Cache-Control", NO_CACHE).send({ error: "Не найдено" });
      }
      return reply
        .header("Cache-Control", NO_CACHE)
        .type("text/html")
        .send(fs.readFileSync(frontendIndex));
    });
  }

  await app.listen({ port: PORT, host: HOST });

  // TZ §40: offer expiry (48h), 7-day scheduling timeout, 24h/2h reminders.
  const jobsEveryMs = Number(process.env.JOBS_INTERVAL_MS || 5 * 60 * 1000);
  if (jobsEveryMs > 0) {
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      try {
        const result = await runMaintenanceJobs();
        app.log.info({ result }, "maintenance jobs");
      } catch (err) {
        app.log.error(err, "maintenance jobs failed");
      } finally {
        running = false;
      }
    };
    setInterval(tick, jobsEveryMs).unref();
    void tick();
  }

  // TZ §50: Telegram outbox — delivers pending pushes and retries failed ones.
  const tgEveryMs = Number(process.env.TELEGRAM_OUTBOX_INTERVAL_MS || 30_000);
  if (process.env.TELEGRAM_BOT_TOKEN && tgEveryMs > 0) {
    let tgRunning = false;
    const tgTick = async () => {
      if (tgRunning) return;
      tgRunning = true;
      try {
        await processTelegramOutbox();
      } catch (err) {
        app.log.error(err, "telegram outbox failed");
      } finally {
        tgRunning = false;
      }
    };
    setInterval(tgTick, tgEveryMs).unref();
    void tgTick();
  }
  if (serveFrontend) {
    app.log.info(`UI+API http://${HOST}:${PORT}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
