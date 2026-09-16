export * from "./enums";

/** Standard error envelope returned by the API (see docs/03-backend-api.md §5). */
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Standard paginated response envelope. */
export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}
