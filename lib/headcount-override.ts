export function canOverrideHeadcount(role: string) {
  return ["service_manager", "hod", "admin", "super_admin"].includes(role);
}

