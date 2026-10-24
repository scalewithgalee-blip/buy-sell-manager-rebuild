import { describe, expect, it } from "vitest";
import {
  createPublicAccessToken,
  getPublicAccessRoleFromToken,
  isValidPublicAccessToken,
} from "./publicAccess";

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

  it("preserves admin and viewer roles in signed tokens", () => {
    const issuedAt = Date.now();
    const adminToken = createPublicAccessToken("admin", issuedAt);
    const viewerToken = createPublicAccessToken("viewer", issuedAt);

    expect(getPublicAccessRoleFromToken(adminToken, issuedAt + 1_000)).toBe("admin");
    expect(getPublicAccessRoleFromToken(viewerToken, issuedAt + 1_000)).toBe("viewer");
    expect(getPublicAccessRoleFromToken(adminToken.replace("admin", "viewer"), issuedAt + 1_000)).toBeNull();
  });
});
