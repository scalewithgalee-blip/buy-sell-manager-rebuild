import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { parse as parseCookie } from "cookie";
import { ENV } from "./_core/env";

export const PUBLIC_ACCESS_COOKIE = "buy_sell_public_access";
export type PublicAccessRole = "admin" | "viewer";
export const ADMIN_ACCESS_PIN = process.env.BUY_SELL_ADMIN_PIN ?? "0909";
export const VIEWER_ACCESS_PIN = process.env.BUY_SELL_VIEWER_PIN ?? "2026";
const ACCESS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function signingSecret() {
  return ENV.cookieSecret || "buy-sell-manager-public-access-fallback";
}

function signature(timestamp: string, role: PublicAccessRole) {
  return createHmac("sha256", signingSecret())
    .update(`buy-sell-public-access:${role}:${timestamp}`)
    .digest("hex");
}

export function createPublicAccessToken(
  roleOrNow: PublicAccessRole | number = "viewer",
  maybeNow = Date.now()
) {
  const role: PublicAccessRole =
    typeof roleOrNow === "number" ? "viewer" : roleOrNow;
  const now = typeof roleOrNow === "number" ? roleOrNow : maybeNow;
  const timestamp = String(now);
  return `${timestamp}.${role}.${signature(timestamp, role)}`;
}

export function getPublicAccessRoleFromToken(
  token: string | undefined,
  now = Date.now()
): PublicAccessRole | null {
  if (!token) return null;
  const [timestamp, role, providedSignature] = token.split(".");
  if (
    !timestamp ||
    (role !== "admin" && role !== "viewer") ||
    !providedSignature ||
    !/^\d+$/.test(timestamp)
  )
    return null;
  const issuedAt = Number(timestamp);
  if (
    !Number.isSafeInteger(issuedAt) ||
    now - issuedAt < 0 ||
    now - issuedAt > ACCESS_TTL_MS
  )
    return null;
  const expected = signature(timestamp, role);
  if (providedSignature.length !== expected.length) return null;
  return timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expected))
    ? role
    : null;
}

export function isValidPublicAccessToken(
  token: string | undefined,
  now = Date.now()
) {
  return getPublicAccessRoleFromToken(token, now) !== null;
}

export function getPublicAccessRole(req: Request, now = Date.now()) {
  const token = parseCookie(req.headers.cookie ?? "")[PUBLIC_ACCESS_COOKIE];
  return getPublicAccessRoleFromToken(token, now);
}

export function hasPublicAccess(req: Request) {
  return getPublicAccessRole(req) !== null;
}

export const publicAccessCookieMaxAge = ACCESS_TTL_MS;
