import { describe, expect, it } from "vitest";
import { isBlockedDomain } from "../blocklist";

describe("isBlockedDomain", () => {
  it("blocks known social/ad domains", () => {
    expect(isBlockedDomain("facebook.com")).toBe(true);
    expect(isBlockedDomain("www.LinkedIn.com")).toBe(true);
    expect(isBlockedDomain("ad.doubleclick.net")).toBe(true);
  });

  it("allows arbitrary other domains", () => {
    expect(isBlockedDomain("stripe.com")).toBe(false);
    expect(isBlockedDomain("some-random-saas.io")).toBe(false);
  });
});
