import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/errors/app-error";
import type { ApiFailure, ApiSuccess } from "@/types/api";

export function apiSuccess<T>(data: T, init?: ResponseInit, meta?: Record<string, unknown>) {
  return NextResponse.json<ApiSuccess<T>>({ success: true, data, ...(meta ? { meta } : {}) }, init);
}

export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json<ApiFailure>(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Request validation failed.", details: error.flatten() } },
      { status: 422 },
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json<ApiFailure>(
      { success: false, error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } },
      { status: error.statusCode },
    );
  }

  // Do not emit arbitrary error objects: database/provider errors can contain input or credentials.
  console.error("Unhandled API error", { name: error instanceof Error ? error.name : typeof error, code: typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : undefined });
  return NextResponse.json<ApiFailure>(
    { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected server error occurred." } },
    { status: 500 },
  );
}

export function withApiErrorHandling<TArgs extends unknown[], TResult>(handler: (...args: TArgs) => Promise<TResult>) {
  return async (...args: TArgs) => {
    try {
      return await handler(...args);
    } catch (error) {
      return apiError(error);
    }
  };
}
