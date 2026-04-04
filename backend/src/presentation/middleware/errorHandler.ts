import type { ErrorHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import {
  ConcurrencyError,
  DomainError,
  InvalidTransitionError,
  NotFoundError,
} from "../../domain/services/errors.js";

export const errorHandler: ErrorHandler = (error, c) => {
  if (error instanceof NotFoundError) {
    return c.json({ error: error.message }, 404);
  }
  if (error instanceof InvalidTransitionError) {
    return c.json({ error: error.message }, 409);
  }
  if (error instanceof ConcurrencyError) {
    return c.json({ error: error.message }, 409);
  }
  if (error instanceof DomainError) {
    return c.json({ error: error.message }, 400);
  }
  // base62→UUID 変換失敗など、不正なパスパラメータ
  if (error instanceof Error && error.message.includes("Invalid")) {
    return c.json({ error: "Invalid request parameter" }, 400);
  }
  console.error("Unhandled error:", error);
  return c.json({ error: "Internal server error" }, 500);
};

export const mapResultErrorToStatus = (code: string): ContentfulStatusCode => {
  if (code.endsWith("_NOT_FOUND")) return 404;
  if (code === "INVALID_TRANSITION") return 409;
  if (code === "NO_CHANGES" || code === "INVALID_FILE_EXTENSION") return 400;
  return 500;
};
