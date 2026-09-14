import { NextResponse } from "next/server";
import { readMemberSession } from "@/lib/member-auth";
import { getMemberProfile, resolveUserAccess } from "@/lib/member-store";
import { getTeamMemberByEmail, listTeamMembers } from "@/lib/team-data-store";
import { callServiceReportGateway } from "@/lib/service-report-store";
import { isValidServiceReportName } from "@/lib/service-report-services";
import { canReviewMemberDefault, canSubmitMemberDefault } from "@/lib/member-default-permissions";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
const abujaDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export async function GET() {
  const session = await readMemberSession();
  if (!session) return NextResponse.json({ error: "Sign in with your member account." }, { status: 401 });
  const access = await resolveUserAccess(session.email);
  if (!canSubmitMemberDefault(access.role)) return NextResponse.json({ error: "This reporting tool is restricted." }, { status: 403 });
  const members = await listTeamMembers();
  if (!canReviewMemberDefault(access.role)) return NextResponse.json({ members });
  const result = await callServiceReportGateway<{ rows?: unknown[] }>("default-report.list", {});
  return NextResponse.json({ members, reports: result.rows || [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const session = await readMemberSession();
  if (!session) return NextResponse.json({ error: "Sign in with your member account." }, { status: 401 });
  const access = await resolveUserAccess(session.email);
  if (!canSubmitMemberDefault(access.role)) return NextResponse.json({ error: "Complaince, Service Manager, HOD or Super Admin access is required." }, { status: 403 });
  const reporter = await getTeamMemberByEmail(session.email);
  if (!reporter) return NextResponse.json({ error: "Your email is not registered in Team Data." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  const members = await listTeamMembers();
  const memberName = clean(body.memberName, 160).toLowerCase();
  const matches = members.filter((candidate) => clean(candidate.name, 160).toLowerCase() === memberName);
  if (matches.length !== 1) return NextResponse.json({ error: matches.length ? "More than one Team Data member has this name. Ask an administrator to correct the duplicate." : "Enter a member name from the suggestions." }, { status: 400 });
  const member = matches[0];
  const category = clean(body.category, 20);
  const serviceDate = abujaDate();
  const observedTime = clean(body.observedTime, 5);
  const severity = clean(body.severity, 20);
  const requestId = clean(body.requestId, 36);
  if (!UUID.test(requestId) || !TIME.test(observedTime) || !["Uniform", "Behaviour", "Duty"].includes(category) || !["Minor", "Moderate", "Serious"].includes(severity) || typeof body.memberInformed !== "boolean" || typeof body.isRepeat !== "boolean") return NextResponse.json({ error: "Check the time, category and severity." }, { status: 400 });
  const service = clean(body.service, 80), details = clean(body.details, 2000), immediateAction = clean(body.immediateAction, 1000);
  if (!isValidServiceReportName(service) || details.length < 5 || !immediateAction) return NextResponse.json({ error: "Complete all required report details." }, { status: 400 });
  const profile = await getMemberProfile(session.token).catch(() => null);
  const reporterName = profile ? [profile.firstName, profile.middleName, profile.lastName].filter(Boolean).join(" ") : reporter.name;
  const result = await callServiceReportGateway<{ created?: boolean; row?: unknown }>("default-report.insert", {
    id: crypto.randomUUID(), request_id: requestId, service_date: serviceDate, service,
    member_name: member.name, member_email: member.email.toLowerCase(), category, observed_time: observedTime,
    details, member_informed: body.memberInformed === true, member_response: clean(body.memberResponse, 1000) || null,
    immediate_action: immediateAction, severity, witnesses: clean(body.witnesses, 500) || null, is_repeat: body.isRepeat === true,
    recommended_follow_up: clean(body.recommendedFollowUp, 1000) || null, reporter_name: reporterName || reporter.name,
    reporter_email: session.email.toLowerCase(), reporter_role: access.role,
  });
  return NextResponse.json({ success: true, created: result.created !== false, report: result.row }, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await readMemberSession();
  if (!session) return NextResponse.json({ error: "Sign in with your member account." }, { status: 401 });
  const access = await resolveUserAccess(session.email);
  if (!canReviewMemberDefault(access.role)) return NextResponse.json({ error: "HOD access is required to review records." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const id = clean(body?.id, 36), status = clean(body?.status, 20), reviewNotes = clean(body?.reviewNotes, 2000);
  if (!id || !["Open", "Reviewed", "Resolved"].includes(status)) return NextResponse.json({ error: "Choose a valid report status." }, { status: 400 });
  const result = await callServiceReportGateway<{ row?: unknown }>("default-report.update", { id, status, reviewNotes, reviewedBy: session.email.toLowerCase() });
  return NextResponse.json({ success: true, report: result.row });
}
