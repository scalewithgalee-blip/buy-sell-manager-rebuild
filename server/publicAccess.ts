import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { parse as parseCookie } from "cookie";
import { ENV } from "./_core/env";

export const PUBLIC_ACCESS_COOKIE = "buy_sell_public_access";
export const PUBLIC_ACCESS_PIN = process.env.BUY_SELL_PUBLIC_PIN ?? "8080";
const ACCESS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function signingSecret() {
  return ENV.cookieSecret || "buy-sell-manager-public-access-fallback";
}

function signature(timestamp: string) {
  return createHmac("sha256", signingSecret()).update(`buy-sell-public-access:${timestamp}`).digest("hex");
}

export function createPublicAccessToken(now = Date.now()) {
  const timestamp = String(now);
  return `${timestamp}.${signature(timestamp)}`;
}

export function isValidPublicAccessToken(token: string | undefined, now = Date.now()) {
  if (!token) return false;
  const [timestamp, providedSignature] = token.split(".");
  if (!timestamp || !providedSignature || !/^\d+$/.test(timestamp)) return false;
  const issuedAt = Number(timestamp);
  if (!Number.isSafeInteger(issuedAt) || now - issuedAt < 0 || now - issuedAt > ACCESS_TTL_MS) return false;
  const expected = signature(timestamp);
  if (providedSignature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expected));
}

export function hasPublicAccess(req: Request) {
  const token = parseCookie(req.headers.cookie ?? "")[PUBLIC_ACCESS_COOKIE];
  return isValidPublicAccessToken(token);
}

export const publicAccessCookieMaxAge = ACCESS_TTL_MS;
