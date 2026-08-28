import { describe, expect, it } from "vitest";

import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
  isAppError,
  toErrorEnvelope,
} from "./index.js";

const cases = [
  [NotFoundError, "NOT_FOUND", 404],
  [ConflictError, "CONFLICT", 409],
  [ValidationError, "VALIDATION", 400],
  [ForbiddenError, "FORBIDDEN", 403],
  [UnauthorizedError, "UNAUTHORIZED", 401],
  [RateLimitError, "RATE_LIMIT", 429],
] as const;

describe("AppError hierarchy", () => {
  it.each(cases)("%o carries the right code and status", (Ctor, code, status) => {
    const err = new Ctor("boom");

    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe(code);
    expect(err.httpStatus).toBe(status);
    expect(err.message).toBe("boom");
    expect(err.name).toBe(Ctor.name);
  });

  it("preserves cause and details when provided", () => {
    const cause = new Error("root");
    const err = new ConflictError("stale", { cause, details: { version: 3 } });

    expect(err.cause).toBe(cause);
    expect(err.details).toEqual({ version: 3 });
  });

  it("leaves details undefined when omitted", () => {
    const err = new NotFoundError("missing");

    expect(err.details).toBeUndefined();
    expect("details" in err).toBe(false);
  });
});

describe("isAppError", () => {
  it("narrows AppError instances", () => {
    expect(isAppError(new NotFoundError("x"))).toBe(true);
  });

  it("rejects plain errors and non-errors", () => {
    expect(isAppError(new TypeError("x"))).toBe(false);
    expect(isAppError("nope")).toBe(false);
    expect(isAppError(null)).toBe(false);
  });
});

describe("toErrorEnvelope", () => {
  it("renders an AppError with its details", () => {
    const env = toErrorEnvelope(
      new NotFoundError("missing", { details: { id: 1 } }),
    );

    expect(env).toEqual({
      error: { code: "NOT_FOUND", message: "missing", httpStatus: 404, details: { id: 1 } },
    });
  });

  it("omits details when absent", () => {
    const env = toErrorEnvelope(new ForbiddenError("nope"));

    expect(env.error).toEqual({ code: "FORBIDDEN", message: "nope", httpStatus: 403 });
    expect("details" in env.error).toBe(false);
  });

  it("collapses unknown throwables to a generic 500 without leaking the message", () => {
    expect(toErrorEnvelope(new TypeError("secret internals"))).toEqual({
      error: { code: "INTERNAL", message: "Internal server error", httpStatus: 500 },
    });
    expect(toErrorEnvelope("just a string")).toEqual({
      error: { code: "INTERNAL", message: "Internal server error", httpStatus: 500 },
    });
  });
});
