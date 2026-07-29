import "server-only";

import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";
import { MEMBER_SESSION_COOKIE } from "@/lib/member-auth";
import { getMemberSession } from "@/lib/member-store";
import { isAdminEmail } from "@/lib/roles";

export const ADMIN_SESSION_COOKIE = "admin_session";

function createSessionToken(adminPassword: string) {
  return createHash("sha256")
    .update(`qcu-attendance-admin-session:${adminPassword}`)
    .digest("hex");
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

  if (!adminPassword) {
    return false;
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, createSessionToken(adminPassword), {
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
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (adminPassword && session && safeCompare(session, createSessionToken(adminPassword))) {
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
