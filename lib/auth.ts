import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";
import { MEMBER_SESSION_COOKIE } from "@/lib/member-auth";
import { getMemberSession } from "@/lib/member-store";
import { isAdminEmail } from "@/lib/roles";

export const ADMIN_SESSION_COOKIE = "admin_session";

function adminPasswordVersion(adminPassword: string) {
  return createHash("sha256").update(`qcu-admin-password-version:${adminPassword}`).digest("hex").slice(0, 16);
}

function createSessionToken(adminPassword: string, sessionSecret: string) {
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    nonce: randomBytes(18).toString("base64url"),
    passwordVersion: adminPasswordVersion(adminPassword),
  })).toString("base64url");
  const signature = createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function validSessionToken(token: string, adminPassword: string, sessionSecret: string) {
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return false;
  const expectedSignature = createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  if (!safeCompare(suppliedSignature, expectedSignature)) return false;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: unknown; passwordVersion?: unknown };
    return typeof claims.exp === "number" && claims.exp > Date.now() / 1000 && claims.passwordVersion === adminPasswordVersion(adminPassword);
  } catch { return false; }
}

function safeCompare(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function getAdminPassword() {
  return getEnv("ADMIN_PASSWORD");
}

export function isValidAdminPassword(password: string) {
  const adminPassword = getAdminPassword();

  if (!adminPassword) {
    return false;
  }

  return safeCompare(password, adminPassword);
}

export async function setAdminSession() {
  const adminPassword = getAdminPassword();
  const sessionSecret = getEnv("ADMIN_SESSION_SECRET");

  if (!adminPassword || !sessionSecret) {
    return false;
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, createSessionToken(adminPassword, sessionSecret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return true;
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}

export async function isAdminAuthenticated() {
  const adminPassword = getAdminPassword();
  const sessionSecret = getEnv("ADMIN_SESSION_SECRET");
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (adminPassword && sessionSecret && session && validSessionToken(session, adminPassword, sessionSecret)) {
    return true;
  }

  const memberToken = cookieStore.get(MEMBER_SESSION_COOKIE)?.value;
  if (!memberToken) return false;
  try {
    const member = await getMemberSession(memberToken);
    return !member.mustChangePassword && await isAdminEmail(member.email);
  } catch {
    return false;
  }
}
