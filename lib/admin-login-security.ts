import "server-only";

import { createHash } from "node:crypto";
import { getOptionalEnv } from "@/lib/env";
import { isValidAdminPassword } from "@/lib/auth";
import { checkAdminLoginAttempt, recordAdminLoginAttempt } from "@/lib/member-store";

function clientAddress(request: Request) {
  const realIp = request.headers.get("x-real-ip")?.trim();
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return (realIp || forwarded || "unknown").slice(0, 128);
}

function clientKey(request: Request) {
  const pepper = getOptionalEnv("ADMIN_PASSWORD");
  return createHash("sha256").update(`admin-login:${clientAddress(request)}:${pepper}`).digest("hex");
}

export type AdminVerification =
  | { ok: true }
  | { ok: false; status: 401 | 429 | 503; error: string };

export async function verifySharedAdminAccess(request: Request, password: string): Promise<AdminVerification> {
  if (getOptionalEnv("ADMIN_SESSION_SECRET").length < 32) {
    return { ok: false, status: 503, error: "Administrator sign-in security is not configured. Use a named administrator account." };
  }
  const fingerprint = clientKey(request);
  const globalKey = createHash("sha256").update(`admin-login:global:${getOptionalEnv("ADMIN_SESSION_SECRET")}`).digest("hex");
  const [current, global] = await Promise.all([checkAdminLoginAttempt(fingerprint), checkAdminLoginAttempt(globalKey)]);
  if (!current.allowed || !global.allowed) return { ok: false, status: 429, error: "Too many attempts. Try again in 15 minutes." };

  const valid = isValidAdminPassword(password);
  const recorded = await recordAdminLoginAttempt(fingerprint, valid, 5);
  const globalRecorded = await recordAdminLoginAttempt(globalKey, valid, 25);
  if (!recorded.allowed || !globalRecorded.allowed) return { ok: false, status: 429, error: "Too many attempts. Try again in 15 minutes." };
  if (!valid) return { ok: false, status: 401, error: "Invalid administrator credentials." };
  return { ok: true };
}
