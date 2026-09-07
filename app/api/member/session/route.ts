import { NextResponse } from "next/server";
import { readMemberSession } from "@/lib/member-auth";
import { isPrivilegedAdminEmail } from "@/lib/roles";
import { getTeamMemberByEmail } from "@/lib/team-data-store";
import { resolveUserAccess } from "@/lib/member-store";
import { canOverrideAttendance, canSignAttendanceForOthers, canViewEmergencyAlerts, canViewMemberDetails } from "@/lib/member-permissions";

export async function GET() {
  const session = await readMemberSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
  const member = await getTeamMemberByEmail(session.email);
  if (!member && !isPrivilegedAdminEmail(session.email)) return NextResponse.json({ error: "This account is no longer on the QC team list." }, { status: 403 });
  const access = await resolveUserAccess(session.email);
  return NextResponse.json({
    email: session.email,
    name: member?.name || session.email,
    role: access.role,
    mustChangePassword: session.mustChangePassword,
    canViewMemberDetails: canViewMemberDetails(access.role),
    canViewEmergencyAlerts: canViewEmergencyAlerts(access.role),
    canSignAttendanceForOthers: canSignAttendanceForOthers(access.role),
    canOverrideAttendance: canOverrideAttendance(access.role),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
