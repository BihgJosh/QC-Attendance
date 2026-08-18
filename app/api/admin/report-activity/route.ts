import { NextResponse } from "next/server";
import { callServiceReportGateway } from "@/lib/service-report-store";
import { readMemberSession } from "@/lib/member-auth";
import { resolveUserAccess } from "@/lib/member-store";
import { identityKey, identityMap } from "@/lib/report-identities";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const session = await readMemberSession();
  if (!session) return NextResponse.json({ error: "Sign in with your member account." }, { status: 401 });
  const access = await resolveUserAccess(session.email);
  if (!["admin", "super_admin"].includes(access.role)) return NextResponse.json({ error: "Admin or Super Admin access is required." }, { status: 403 });
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    if ((from && !ISO_DATE.test(from)) || (to && !ISO_DATE.test(to)) || (from && to && from > to)) return NextResponse.json({ error: "Choose a valid report date range." }, { status: 400 });
    const result = await callServiceReportGateway<{ users?: Array<Record<string, unknown>> }>("admin.report-activity", { from, to });
    const users = result.users || [];
    const identities: Awaited<ReturnType<typeof identityMap>> = await identityMap(session.token, users.map((user) => ({ name: String(user.name || ""), email: String(user.email || "") }))).catch(() => ({}));
    return NextResponse.json({ users: users.map((user) => ({ ...user, identity: identities[identityKey({ name: String(user.name || ""), email: String(user.email || "") })] })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Report activity could not be loaded." }, { status: 502 });
  }
}
