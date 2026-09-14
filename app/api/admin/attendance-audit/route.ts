import { NextResponse } from "next/server";
import { isContentAdminAuthenticated } from "@/lib/auth";
import { buildAttendanceAudit, validateAuditFilters, writeAttendanceAudit, type AuditFilters } from "@/lib/attendance-audit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  if (!(await isContentAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const filters: AuditFilters = {};
    validateAuditFilters(filters);
    return NextResponse.json(await buildAttendanceAudit(filters));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The audit preview could not be prepared." }, { status: 400 });
  }
}

export async function POST() {
  if (!(await isContentAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const filters: AuditFilters = {};
    validateAuditFilters(filters);
    const matrix = await buildAttendanceAudit(filters);
    const sheet = await writeAttendanceAudit(matrix);
    return NextResponse.json({ ...sheet, memberCount: matrix.members.length, serviceCount: matrix.columns.length, approvedCount: matrix.approvedCount });
  } catch (error) {
    console.error("[attendance-audit] generation failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "The attendance audit sheet could not be generated." }, { status: 500 });
  }
}
