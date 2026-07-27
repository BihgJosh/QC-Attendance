import { NextResponse } from "next/server";
import {
  appendAttendance,
  AttendanceStoreError,
  getAttendanceSettings,
  getAttendanceStatus,
  getWhitelist,
  hasDeviceSignedToday,
} from "@/lib/attendance-store";
import { calculateDistance } from "@/lib/geofencing";
import { getAttendanceEnvConfig } from "@/lib/env";
import { formatAbujaTime, formatAbujaDate } from "@/lib/timezone";
import { isValidAdminPassword } from "@/lib/auth";
import { ALLOWED_SERVICES, type AttendanceRecord } from "@/types";

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const { name, password, latitude, longitude, browser, device, service, deviceId, adminPassword } = body as Record<string, unknown>;

    const boundedString = (value: unknown, min: number, max: number): value is string =>
      typeof value === "string" && value.trim().length >= min && value.length <= max;

    if (
      !boundedString(name, 2, 160) ||
      !boundedString(password, 1, 256) ||
      !boundedString(deviceId, 8, 200) ||
      typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
      typeof service !== "string"
    ) {
      return NextResponse.json({ error: "Invalid or missing attendance fields." }, { status: 400 });
    }

    if (!ALLOWED_SERVICES.includes(service as (typeof ALLOWED_SERVICES)[number])) {
      return NextResponse.json({ error: "Invalid service type." }, { status: 400 });
    }

    if (browser !== undefined && !boundedString(browser, 1, 80)) {
      return NextResponse.json({ error: "Invalid browser information." }, { status: 400 });
    }
    if (device !== undefined && !boundedString(device, 1, 80)) {
      return NextResponse.json({ error: "Invalid device information." }, { status: 400 });
    }
    if (adminPassword !== undefined && !boundedString(adminPassword, 1, 256)) {
      return NextResponse.json({ error: "Invalid admin override." }, { status: 400 });
    }

    const envConfig = getAttendanceEnvConfig();

    if (!(await getAttendanceStatus())) {
      return NextResponse.json({ error: "Attendance is currently closed." }, { status: 403 });
    }

    if (!envConfig.sharedPassword) {
      return NextResponse.json({ error: "Shared password is not configured." }, { status: 500 });
    }

    if (password !== envConfig.sharedPassword) {
      return NextResponse.json({ error: "Invalid shared password." }, { status: 401 });
    }

    const whitelist = await getWhitelist();
    const inputName = name.trim().toLowerCase();
    const inputWords = inputName.split(/\s+/).filter(Boolean);

    const isWhitelisted = whitelist.some((whitelistName: string) => {
      const whitelistWords = whitelistName.split(/\s+/);
      return inputWords.every((word: string) => whitelistWords.includes(word));
    });

    if (!isWhitelisted) {
      return NextResponse.json({ error: "Member not found in whitelist." }, { status: 403 });
    }

    // ── Device restriction check ───────────────────────────────────────
    const today = formatAbujaDate(new Date());
    const existingSignIn = await hasDeviceSignedToday(deviceId, today);

    let adminOverrideUsed = false;
    if (existingSignIn) {
      // If an admin password is provided and valid, allow the override
      if (adminPassword && isValidAdminPassword(adminPassword)) {
        adminOverrideUsed = true;
        // Admin override — fall through to record attendance
      } else {
        return NextResponse.json({
          error: "device_already_signed",
          message: `This device has already signed in for ${existingSignIn} today.`,
          signedAs: existingSignIn,
        }, { status: 409 });
      }
    }

    const settings = await getAttendanceSettings();
    const churchLat = parseFloat(settings.churchLat || envConfig.churchLat);
    const churchLng = parseFloat(settings.churchLng || envConfig.churchLng);
    const allowedRadius = parseFloat(settings.allowedRadius || envConfig.allowedRadius);

    if (![churchLat, churchLng, allowedRadius].every(Number.isFinite)) {
      return NextResponse.json({ error: "Attendance location is not configured." }, { status: 503 });
    }

    const distance = calculateDistance(latitude, longitude, churchLat, churchLng);
    const isInside = distance <= allowedRadius;

    const now = new Date();
    const record: AttendanceRecord = {
      date: today,
      service: service,
      memberName: name,
      time: formatAbujaTime(now),
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      distance: distance.toFixed(2),
      status: isInside ? "Approved" : "Rejected",
      reason: isInside ? "Inside geofence" : "Outside geofence",
      browser: browser || "Unknown",
      device: device || "Unknown",
      deviceId: deviceId,
    };

    await appendAttendance(record, adminOverrideUsed);

    if (!isInside) {
      return NextResponse.json({ error: "Attendance rejected: You are outside the church geofence." }, { status: 403 });
    }

    return NextResponse.json({ success: true, message: "Attendance signed successfully!" });
  } catch (error) {
    if (error instanceof AttendanceStoreError && error.code === "device_already_signed") {
      return NextResponse.json({ error: "device_already_signed", message: error.message }, { status: 409 });
    }
    console.error("Attendance Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
