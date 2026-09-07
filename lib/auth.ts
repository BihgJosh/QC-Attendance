import "server-only";

import { readMemberSession } from "@/lib/member-auth";
import { resolveUserAccess } from "@/lib/member-store";

export async function isAdminAuthenticated() {
  const session = await readMemberSession();
  if (!session) return false;
  try {
    const access = await resolveUserAccess(session.email);
    return access.role === "admin" || access.role === "super_admin";
  } catch {
    return false;
  }
}
