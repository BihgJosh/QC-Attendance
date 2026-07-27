import type { AttendanceRecord } from "@/types";
import { getEnv, getSupabaseEnv } from "@/lib/env";

type AttendanceSettings = {
  isOpen: boolean;
  churchLat: string;
  churchLng: string;
  allowedRadius: string;
  locationName: string;
  timezoneLabel: string;
};

type GatewayOperation =
  | "status.get"
  | "status.update"
  | "settings.get"
  | "settings.update"
  | "members.list"
  | "attendance.list"
  | "attendance.device-check"
  | "attendance.insert"
  | "migration.import";

export class AttendanceStoreError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.name = "AttendanceStoreError";
    this.status = status;
    this.code = code;
  }
}

function gatewayConfig() {
  const config = getSupabaseEnv();
  return { url: config.url, key: config.anonKey };
}

async function callGateway<T>(
  operation: GatewayOperation,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const { url, key } = gatewayConfig();
  const secret = getEnv("SUPABASE_GATEWAY_SECRET");
  const response = await fetch(`${url}/functions/v1/qcu-attendance`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
      "x-qcu-operation-secret": secret,
    },
    body: JSON.stringify({ operation, ...payload }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AttendanceStoreError(
      typeof data.error === "string" ? data.error : "Attendance storage request failed.",
      response.status,
      typeof data.code === "string" ? data.code : undefined,
    );
  }

  return data as T;
}

export async function getAttendanceStatus() {
  const data = await callGateway<{ isOpen: boolean }>("status.get");
  return data.isOpen;
}

export async function updateAttendanceStatus(isOpen: boolean) {
  return callGateway<{ success: boolean; isOpen: boolean }>("status.update", { isOpen });
}

export async function getAttendanceSettings() {
  return callGateway<AttendanceSettings>("settings.get");
}

export async function updateAttendanceSettings(settings: Pick<AttendanceSettings, "churchLat" | "churchLng" | "allowedRadius">) {
  return callGateway<{ success: boolean }>("settings.update", settings);
}

export async function getWhitelist() {
  const data = await callGateway<{ names: string[] }>("members.list");
  return data.names;
}

export async function getAttendanceRecords() {
  const data = await callGateway<{ records: AttendanceRecord[] }>("attendance.list");
  return data.records;
}

export async function hasDeviceSignedToday(deviceId: string, date: string) {
  const data = await callGateway<{ memberName: string | null }>("attendance.device-check", { deviceId, date });
  return data.memberName;
}

export async function appendAttendance(record: AttendanceRecord, adminOverride = false) {
  return callGateway<{ success: boolean }>("attendance.insert", { record, adminOverride });
}
