import type { AppRole } from "@/lib/member-store";

const SUBMIT_ROLES = new Set<AppRole>(["complaince", "service_manager", "hod", "super_admin"]);
const REVIEW_ROLES = new Set<AppRole>(["hod"]);

export function canSubmitMemberDefault(role: AppRole) {
  return SUBMIT_ROLES.has(role);
}

export function canReviewMemberDefault(role: AppRole) {
  return REVIEW_ROLES.has(role);
}
