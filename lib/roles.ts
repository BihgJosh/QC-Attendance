import "server-only";

import { getOptionalEnv } from "@/lib/env";
import { listAdminAccess } from "@/lib/member-store";

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
  return (await listAdminAccess()).some((admin) => admin.email === normalized);
}
