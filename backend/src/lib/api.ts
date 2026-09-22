import { ZodError } from "zod";
import { AuthError } from "./auth";

export type ApiResult = { status: number; body: unknown };

export function jsonOk<T>(data: T, init?: { status?: number }): ApiResult {
  return { status: init?.status ?? 200, body: data };
}

export function jsonError(
  message: string,
  status = 400,
  extra?: object,
): ApiResult {
  return { status, body: { error: message, ...extra } };
}

export function handleApiError(err: unknown): ApiResult {
  if (err instanceof AuthError) {
    return jsonError(err.message, err.status);
  }
  if (err instanceof ZodError) {
    return jsonError("Некорректные данные", 400, {
      issues: err.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  if (
    err instanceof Error &&
    "status" in err &&
    typeof (err as Error & { status?: unknown }).status === "number"
  ) {
    return jsonError(err.message, (err as Error & { status: number }).status);
  }
  console.error(err);
  return jsonError("Внутренняя ошибка сервера", 500);
}
