import { describe, expect, it } from "vitest";
import { normalizeUrlForDedup, getDomain } from "../normalize-url";

describe("normalizeUrlForDedup", () => {
  it("strips fragments, trailing slashes, and tracking params", () => {
    const a = normalizeUrlForDedup("https://Example.com/features/?utm_source=x#section");
    const b = normalizeUrlForDedup("https://example.com/features?utm_source=y");
    expect(a).toBe(b);
  });

  it("rejects non-http(s) schemes", () => {
    expect(normalizeUrlForDedup("mailto:hi@example.com")).toBeNull();
    expect(normalizeUrlForDedup("javascript:void(0)")).toBeNull();
  });

  it("rejects invalid URLs", () => {
    expect(normalizeUrlForDedup("not a url")).toBeNull();
  });

  it("keeps the root path as /", () => {
    expect(normalizeUrlForDedup("https://example.com/")).toBe("https://example.com/");
  });
});

describe("getDomain", () => {
  it("returns the lowercased hostname", () => {
    expect(getDomain("https://Example.COM/path")).toBe("example.com");
  });

  it("returns null for invalid URLs", () => {
    expect(getDomain("not a url")).toBeNull();
  });
});
