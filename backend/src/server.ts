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

import * as auth from "./api/auth/route";
import * as register from "./api/auth/register/route";
import * as me from "./api/me/route";
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

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });
  await app.register(cookie);
  await app.register(multipart, {
    attachFieldsToBody: true,
    limits: { fileSize: 8 * 1024 * 1024 },
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

  if (serveFrontend) {
    await app.register(fastifyStatic, {
      root: publicDir,
      prefix: "/",
      wildcard: false,
      decorateReply: false,
    });
    app.setNotFoundHandler((req, reply) => {
      const url = req.url.split("?")[0];
      if (url.startsWith("/api") || url.startsWith("/uploads")) {
        return reply.code(404).send({ error: "Не найдено" });
      }
      return reply.type("text/html").send(fs.readFileSync(frontendIndex));
    });
  }

  await app.listen({ port: PORT, host: HOST });
  if (serveFrontend) {
    app.log.info(`UI+API http://${HOST}:${PORT}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
