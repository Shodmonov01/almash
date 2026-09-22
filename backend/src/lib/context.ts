import { AsyncLocalStorage } from "node:async_hooks";
import type { FastifyReply, FastifyRequest } from "fastify";

export type HttpStore = {
  req: FastifyRequest;
  reply: FastifyReply;
};

export const httpAls = new AsyncLocalStorage<HttpStore>();

export function httpStore(): HttpStore | undefined {
  return httpAls.getStore();
}

export async function runHttp<T>(
  req: FastifyRequest,
  reply: FastifyReply,
  fn: () => Promise<T>,
): Promise<T> {
  return httpAls.run({ req, reply }, fn);
}
