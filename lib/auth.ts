import "server-only";

import { readMemberSession } from "@/lib/member-auth";
import { resolveUserAccess, type AppRole } from "@/lib/member-store";

export type AdminRole = Extract<AppRole, "operations" | "admin" | "super_admin">;
const ADMIN_ROLES = new Set<AppRole>(["operations", "admin", "super_admin"]);

export async function getAuthenticatedAdminRole(): Promise<AdminRole | null> {
  const session = await readMemberSession();
  if (!session) return null;
  try {
    const access = await resolveUserAccess(session.email);
    return ADMIN_ROLES.has(access.role) ? access.role as AdminRole : null;
  } catch {
    return null;
  }
}

export async function isAdminAuthenticated() {
  return Boolean(await getAuthenticatedAdminRole());
}

export async function isContentAdminAuthenticated() {
  const role = await getAuthenticatedAdminRole();
  return role === "admin" || role === "super_admin";
}

export async function isSuperAdminAuthenticated() {
  return (await getAuthenticatedAdminRole()) === "super_admin";
}
