import "server-only";

import { getOptionalEnv } from "@/lib/env";
import { listAdminAccess, resolveUserAccess } from "@/lib/member-store";

const DEFAULT_PRIVILEGED_ADMINS = ["joshuaagusa001@gmail.com"];

export function getPrivilegedAdminEmails() {
  const configured = getOptionalEnv("PRIVILEGED_ADMIN_EMAILS")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...DEFAULT_PRIVILEGED_ADMINS, ...configured])];
}

export function isPrivilegedAdminEmail(email: string) {
  return getPrivilegedAdminEmails().includes(email.trim().toLowerCase());
}

export async function isAdminEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (isPrivilegedAdminEmail(normalized)) return true;
  if ((await listAdminAccess()).some((admin) => admin.email === normalized)) return true;
  try {
    const access = await resolveUserAccess(normalized);
    return access.role === "admin" || access.role === "super_admin";
  } catch { return false; }
}
