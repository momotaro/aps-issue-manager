import type { ErrorHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import {
  ConcurrencyError,
  DomainError,
  InvalidTransitionError,
  NotFoundError,
} from "../../domain/services/errors.js";
import { InvalidParameterError } from "../serializers/externalId.js";

const errorJson = (code: string, message: string) => ({
  error: { code, message },
});

export const errorHandler: ErrorHandler = (error, c) => {
  if (error instanceof InvalidParameterError) {
    return c.json(errorJson("INVALID_PARAMETER", error.message), 400);
  }
  if (error instanceof NotFoundError) {
    return c.json(errorJson("NOT_FOUND", error.message), 404);
  }
  if (error instanceof InvalidTransitionError) {
    return c.json(errorJson("INVALID_TRANSITION", error.message), 409);
  }
  if (error instanceof ConcurrencyError) {
    return c.json(errorJson("CONCURRENCY_CONFLICT", error.message), 409);
  }
  if (error instanceof DomainError) {
    return c.json(errorJson("DOMAIN_ERROR", error.message), 400);
  }
  console.error("Unhandled error:", error);
  return c.json(errorJson("INTERNAL_ERROR", "Internal server error"), 500);
};

export const mapResultErrorToStatus = (code: string): ContentfulStatusCode => {
  if (code.endsWith("_NOT_FOUND")) return 404;
  if (code === "INVALID_TRANSITION" || code === "CONCURRENCY_CONFLICT")
    return 409;
  if (code === "NO_CHANGES" || code === "INVALID_FILE_EXTENSION") return 400;
  return 500;
};
