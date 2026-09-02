import { NextResponse } from "next/server";
import { getAttendanceStatus, updateAttendanceStatus } from "@/lib/attendance-store";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET() {
  try {
    return NextResponse.json(await getAttendanceStatus());
  } catch (error) {
    console.error("Failed to fetch attendance status:", error);
    return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { isOpen, closesAt = null } = await req.json();
    if (typeof isOpen !== "boolean") {
      return NextResponse.json({ error: "isOpen must be true or false." }, { status: 400 });
    }
    if (closesAt !== null && (typeof closesAt !== "string" || !Number.isFinite(Date.parse(closesAt)))) {
      return NextResponse.json({ error: "closesAt must be a valid date-time or null." }, { status: 400 });
    }
    if (isOpen && closesAt !== null && Date.parse(closesAt) <= Date.now()) {
      return NextResponse.json({ error: "Closing time must be in the future." }, { status: 400 });
    }
    const result = await updateAttendanceStatus(isOpen, isOpen ? closesAt : null);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to update attendance status:", error);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}
