import "server-only";

import { cookies } from "next/headers";
import { getMemberSession } from "@/lib/member-store";

export const MEMBER_SESSION_COOKIE = "qcu_member_session";
export const MEMBER_SESSION_MAX_AGE = 60 * 60 * 24 * 180;

export async function setMemberSession(token: string) {
  const store = await cookies();
  store.set(MEMBER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: MEMBER_SESSION_MAX_AGE,
  });
}

export async function clearMemberSession() {
  const store = await cookies();
  store.delete(MEMBER_SESSION_COOKIE);
}

export async function readMemberSession(options: { allowPasswordChange?: boolean } = {}) {
  const store = await cookies();
  const token = store.get(MEMBER_SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const session = { token, ...(await getMemberSession(token)) };
    if (session.mustChangePassword && !options.allowPasswordChange) return null;
    return session;
  } catch {
    return null;
  }
}
