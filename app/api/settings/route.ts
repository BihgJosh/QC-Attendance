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
    const newSettings = await req.json();
    const current = await getAttendanceSettings();
    await updateAttendanceSettings({
      churchLat: newSettings.churchLat || current.churchLat,
      churchLng: newSettings.churchLng || current.churchLng,
      allowedRadius: newSettings.allowedRadius || current.allowedRadius,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
