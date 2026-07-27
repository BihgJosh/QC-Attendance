import "server-only";

import { getOptionalEnv } from "@/lib/env";

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
