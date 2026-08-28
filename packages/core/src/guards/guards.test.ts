import { describe, expect, it } from "vitest";

import { assertNever, invariant } from "./index.js";

describe("invariant", () => {
  it("passes through truthy conditions", () => {
    expect(() => invariant(1)).not.toThrow();
    expect(() => invariant("x")).not.toThrow();
  });

  it("throws on falsy conditions with the given message", () => {
    expect(() => invariant(0, "must be set")).toThrow("must be set");
    expect(() => invariant(null)).toThrow("Invariant failed");
    expect(() => invariant(undefined)).toThrow("Invariant failed");
  });

  it("narrows the type after the assertion", () => {
    const maybe: string | undefined = "here";
    invariant(maybe);
    expect(maybe.length).toBe(4);
  });
});

describe("assertNever", () => {
  it("always throws", () => {
    expect(() => assertNever("unexpected" as never)).toThrow("Unexpected value: unexpected");
  });

  it("uses a custom message when given", () => {
    expect(() => assertNever(1 as never, "bad kind")).toThrow("bad kind");
  });
});
