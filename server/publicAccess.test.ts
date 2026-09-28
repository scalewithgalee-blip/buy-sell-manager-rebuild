import { describe, expect, it } from "vitest";
import { createPublicAccessToken, isValidPublicAccessToken } from "./publicAccess";

describe("public PIN access", () => {
  it("accepts a freshly issued signed token", () => {
    const issuedAt = Date.now();
    expect(isValidPublicAccessToken(createPublicAccessToken(issuedAt), issuedAt + 1_000)).toBe(true);
  });

  it("rejects expired and tampered tokens", () => {
    const issuedAt = Date.now() - 31 * 24 * 60 * 60 * 1_000;
    const token = createPublicAccessToken(issuedAt);
    expect(isValidPublicAccessToken(token, Date.now())).toBe(false);
    expect(isValidPublicAccessToken(`${Date.now()}.tampered`, Date.now())).toBe(false);
  });
});
