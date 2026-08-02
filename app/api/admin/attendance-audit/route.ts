import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { buildAttendanceAudit, validateAuditFilters, writeAttendanceAudit, type AuditFilters } from "@/lib/attendance-audit";

export const runtime = "nodejs";
export const maxDuration = 60;

function filtersFromUrl(request: Request): AuditFilters {
  const url = new URL(request.url);
  return {
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
    service: url.searchParams.get("service") || "All",
  };
}

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const filters = filtersFromUrl(request);
    validateAuditFilters(filters);
    return NextResponse.json(await buildAttendanceAudit(filters));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The audit preview could not be prepared." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    const filters: AuditFilters = {
      from: typeof body.from === "string" ? body.from : undefined,
      to: typeof body.to === "string" ? body.to : undefined,
      service: typeof body.service === "string" ? body.service : "All",
    };
    validateAuditFilters(filters);
    const matrix = await buildAttendanceAudit(filters);
    const sheet = await writeAttendanceAudit(matrix);
    return NextResponse.json({ ...sheet, memberCount: matrix.members.length, serviceCount: matrix.columns.length, approvedCount: matrix.approvedCount });
  } catch (error) {
    console.error("[attendance-audit] generation failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "The attendance audit sheet could not be generated." }, { status: 500 });
  }
}
