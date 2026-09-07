import { NextResponse } from "next/server";
import { getWhitelist } from "@/lib/attendance-store";
import { readMemberSession } from "@/lib/member-auth";
import { resolveUserAccess } from "@/lib/member-store";
import { canSignAttendanceForOthers } from "@/lib/member-permissions";

export async function GET() {
  const session = await readMemberSession();
  if (!session) return NextResponse.json({ error: "Your member session has expired." }, { status: 401 });
  const access = await resolveUserAccess(session.email);
  if (!canSignAttendanceForOthers(access.role)) {
    return NextResponse.json({ error: "Only administrators can sign attendance for another member." }, { status: 403 });
  }
  return NextResponse.json({ names: await getWhitelist() }, { headers: { "Cache-Control": "private, no-store" } });
}
