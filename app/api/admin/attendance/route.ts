import { NextResponse } from "next/server";
import { getAttendanceRecords } from "@/lib/attendance-store";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const records = await getAttendanceRecords();
    return NextResponse.json(records);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch attendance records" }, { status: 500 });
  }
}
