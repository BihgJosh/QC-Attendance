export interface AppConfig {
  churchLat: string;
  churchLng: string;
  allowedRadius: string;
  sharedPassword: string;
  adminPassword: string;
  isOpen: string; // "true" | "false"
}

export interface AttendanceRecord {
  date: string;
  service: string;
  memberName: string;
  time: string;
  latitude: string;
  longitude: string;
  distance: string;
  status: "Approved" | "Rejected";
  reason: string;
  browser: string;
  device: string;
  deviceId: string;
}

export interface AttendanceRequest {
  name: string;
  password: string;
  latitude: number;
  longitude: number;
  browser: string;
  device: string;
  service: string;
  deviceId: string;
  adminPassword?: string;
}

export const ALLOWED_SERVICES = ["Sunday", "Thursday", "Other"] as const;
export const SPECIAL_SERVICE_PREFIX = "Other — ";

export function isAllowedAttendanceService(service: string) {
  if (ALLOWED_SERVICES.includes(service as (typeof ALLOWED_SERVICES)[number])) return true;
  if (!service.startsWith(SPECIAL_SERVICE_PREFIX)) return false;
  const name = service.slice(SPECIAL_SERVICE_PREFIX.length).trim();
  return name.length >= 2 && name.length <= 80 && !/[\u0000-\u001f\u007f]/.test(name);
}

export function isSpecialAttendanceService(service: string) {
  return service === "Other" || service.startsWith(SPECIAL_SERVICE_PREFIX);
}
