import { NextResponse } from "next/server";
import { getAttendanceSettings, updateAttendanceSettings } from "@/lib/attendance-store";
import { isAdminAuthenticated } from "@/lib/auth";
import { getLocationEnvConfig } from "@/lib/env";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const config = await getAttendanceSettings();
    const envConfig = getLocationEnvConfig();

    return NextResponse.json({
      churchLat: config.churchLat || envConfig.churchLat || "",
      churchLng: config.churchLng || envConfig.churchLng || "",
      allowedRadius: config.allowedRadius || envConfig.allowedRadius || "",
      locationName: config.locationName || "Abuja",
      timezoneLabel: config.timezoneLabel || "WAT",
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const newSettings = await req.json() as Record<string, unknown>;
    const current = await getAttendanceSettings();
    const latitude = Number(newSettings.churchLat ?? current.churchLat);
    const longitude = Number(newSettings.churchLng ?? current.churchLng);
    const radius = Number(newSettings.allowedRadius ?? current.allowedRadius);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
      || !Number.isFinite(longitude) || longitude < -180 || longitude > 180
      || !Number.isFinite(radius) || radius <= 0 || radius > 10_000) {
      return NextResponse.json({ error: "Enter a valid latitude, longitude and radius between 1 and 10,000 metres." }, { status: 400 });
    }
    await updateAttendanceSettings({
      churchLat: String(latitude),
      churchLng: String(longitude),
      allowedRadius: String(radius),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
