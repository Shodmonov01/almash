import { NextResponse } from "next/server";
import { AuthError } from "./auth";
import { ZodError } from "zod";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(message: string, status = 400, extra?: object) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function handleApiError(err: unknown) {
  if (err instanceof AuthError) {
    return jsonError(err.message, err.status);
  }
  if (err instanceof ZodError) {
    return jsonError("Некорректные данные", 400, {
      issues: err.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  console.error(err);
  return jsonError("Внутренняя ошибка сервера", 500);
}
