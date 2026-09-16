import type { NextRequest } from "next/server";
import { ZodError, type ZodType, type ZodTypeDef } from "zod";
import { AppError } from "./errors";

export interface RouteCtx<P extends Record<string, string> = Record<string, string>> {
  req: NextRequest;
  params: P;
}

/** JSON.stringify replacer: Prisma returns BigInt for `sizeBytes`, which JSON can't encode. */
function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, bigintReplacer), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return json(
      { error: { code: error.code, message: error.message, details: error.details } },
      error.status,
    );
  }

  if (error instanceof ZodError) {
    return json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: error.flatten(),
        },
      },
      422,
    );
  }

  console.error("[pixelhub] unhandled error:", error);
  return json(
    { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
    500,
  );
}

/**
 * Next.js uses thrown errors with a `digest` to control rendering
 * (dynamic usage, redirects, notFound). Never swallow those.
 */
function isNextInternalError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string";
}

/**
 * Wraps a route handler: catches errors, converts Zod failures to 422 and
 * AppErrors to their envelope. Return a plain value to send JSON, or a
 * `Response` to control headers (e.g. Set-Cookie).
 */
export function route<P extends Record<string, string> = Record<string, string>>(
  fn: (ctx: RouteCtx<P>) => Promise<Response | unknown>,
): (req: NextRequest, ctx: { params: P }) => Promise<Response> {
  return async (req, ctx) => {
    try {
      const result = await fn({ req, params: ctx.params });
      return result instanceof Response ? result : json(result);
    } catch (error) {
      if (isNextInternalError(error)) throw error;
      return toErrorResponse(error);
    }
  };
}

export async function parseBody<Output>(
  req: NextRequest,
  schema: ZodType<Output, ZodTypeDef, unknown>,
): Promise<Output> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw AppError.badRequest("INVALID_JSON", "Request body must be valid JSON");
  }
  return schema.parse(raw);
}

export function parseQuery<Output>(
  req: NextRequest,
  schema: ZodType<Output, ZodTypeDef, unknown>,
): Output {
  const entries = Object.fromEntries(req.nextUrl.searchParams.entries());
  return schema.parse(entries);
}

export function getSearchParam(req: NextRequest, key: string): string | null {
  return req.nextUrl.searchParams.get(key);
}
