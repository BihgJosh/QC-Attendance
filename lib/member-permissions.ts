import type { AppRole } from "@/lib/member-store";

const DETAIL_ROLES = new Set<AppRole>(["service_manager", "hod", "admin", "super_admin"]);
const SIGN_FOR_OTHERS_ROLES = new Set<AppRole>(["admin", "super_admin"]);
const ADMIN_ROLES = new Set<AppRole>(["admin", "super_admin"]);

export function canAccessAdmin(role: AppRole) {
  return ADMIN_ROLES.has(role);
}

export function canViewMemberDetails(role: AppRole) {
  return DETAIL_ROLES.has(role);
}

export function canViewEmergencyAlerts(role: AppRole) {
  return DETAIL_ROLES.has(role);
}

export function canSignAttendanceForOthers(role: AppRole) {
  return SIGN_FOR_OTHERS_ROLES.has(role);
}
