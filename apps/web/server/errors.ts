/**
 * Typed application errors. Serialized into the standard error envelope:
 *   { error: { code, message, details? } }
 * See docs/03-backend-api.md §5.
 */
export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }

  static badRequest(code: string, message: string, details?: unknown): AppError {
    return new AppError(code, message, 400, details);
  }

  static unauthorized(message = "Authentication required"): AppError {
    return new AppError("UNAUTHORIZED", message, 401);
  }

  static forbidden(
    code = "FORBIDDEN",
    message = "You do not have access to this resource",
  ): AppError {
    return new AppError(code, message, 403);
  }

  static notFound(entity: string, details?: unknown): AppError {
    return new AppError(
      `${entity.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_NOT_FOUND`,
      `${entity} not found`,
      404,
      details,
    );
  }

  static conflict(code: string, message: string, details?: unknown): AppError {
    return new AppError(code, message, 409, details);
  }

  static tooMany(message = "Rate limit exceeded"): AppError {
    return new AppError("RATE_LIMITED", message, 429);
  }

  static notImplemented(code: string, message: string): AppError {
    return new AppError(code, message, 501);
  }
}
