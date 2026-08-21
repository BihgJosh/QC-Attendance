import { NextResponse } from "next/server";
import { appendAttendance, AttendanceStoreError, getAttendanceSettings, getAttendanceStatus } from "@/lib/attendance-store";
import { calculateDistance } from "@/lib/geofencing";
import { getAttendanceEnvConfig } from "@/lib/env";
import { formatAbujaTime, formatAbujaDate } from "@/lib/timezone";
import { isValidAdminPassword } from "@/lib/auth";
import { isAllowedAttendanceService, type AttendanceRecord } from "@/types";
import { readMemberSession } from "@/lib/member-auth";
import { getTeamMemberByEmail } from "@/lib/team-data-store";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const { latitude, longitude, browser, device, service, deviceId, adminPassword } = body as Record<string, unknown>;
    const boundedString = (value: unknown, min: number, max: number): value is string =>
      typeof value === "string" && value.trim().length >= min && value.length <= max;

    if (
      !boundedString(deviceId, 8, 200) ||
      typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
      typeof service !== "string"
    ) {
      return NextResponse.json({ error: "Invalid or missing attendance fields." }, { status: 400 });
    }
    const normalizedService = service.trim().replace(/\s+/g, " ");
    if (!isAllowedAttendanceService(normalizedService)) {
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
    const session = await readMemberSession();
    if (!session) return NextResponse.json({ error: "Your member session has expired." }, { status: 401 });
    const teamMember = await getTeamMemberByEmail(session.email);
    if (!teamMember) return NextResponse.json({ error: "Your email is not registered in Team Data." }, { status: 403 });
    const name = teamMember.name;
    if (!(await getAttendanceStatus())) {
      return NextResponse.json({ error: "Attendance is currently closed." }, { status: 403 });
    }

    const adminOverrideUsed = typeof adminPassword === "string" && adminPassword.length > 0;
    if (adminOverrideUsed && !isValidAdminPassword(adminPassword)) {
      return NextResponse.json({ error: "Invalid admin override." }, { status: 401 });
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
      date: formatAbujaDate(now),
      service: normalizedService,
      memberName: name,
      time: formatAbujaTime(now),
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      distance: distance.toFixed(2),
      status: isInside ? "Approved" : "Rejected",
      reason: isInside ? "Inside geofence" : "Outside geofence",
      browser: browser || "Unknown",
      device: device || "Unknown",
      deviceId,
    };

    await appendAttendance(record, adminOverrideUsed);
    if (!isInside) {
      return NextResponse.json({ error: "Attendance rejected: You are outside the church geofence." }, { status: 403 });
    }
    return NextResponse.json({ success: true, message: "Attendance signed successfully!" });
  } catch (error) {
    if (error instanceof AttendanceStoreError && error.code === "device_already_signed") {
      return NextResponse.json({
        error: "device_already_signed",
        message: "This device has already signed attendance for this service today.",
      }, { status: 409 });
    }
    console.error("Attendance Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
