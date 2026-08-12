import { NextResponse } from "next/server";
import { readMemberSession } from "@/lib/member-auth";
import { getTeamMemberByEmail } from "@/lib/team-data-store";
import { resolveUserAccess } from "@/lib/member-store";
import { appendServicePostReport } from "@/lib/service-post-sheet";
import { isIsoCalendarDate } from "@/lib/validation";

const SERVICES = new Set(["1st Service", "2nd Service", "3rd Service", "4th Service", "Thursday Service"]);
const RATINGS = new Set(["Excellent", "Good", "Needs Improvement", "Poor"]);
const RATING_SCORES: Record<string, number> = { Excellent: 4, Good: 3, "Needs Improvement": 2, Poor: 1 };

function text(value: unknown, max = 2_000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function count(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 100_000 ? parsed : null;
}

function stringRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, text(item, 500)]));
}

export async function POST(request: Request) {
  try {
    const session = await readMemberSession();
    if (!session) return NextResponse.json({ ok: false, message: "Your member session has expired." }, { status: 401 });
    const member = await getTeamMemberByEmail(session.email);
    if (!member) return NextResponse.json({ ok: false, message: "Your email is not registered in Team Data." }, { status: 403 });
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ ok: false, message: "Invalid report." }, { status: 400 });

    const reportFor = text(body.reportFor, 20) || "Me";
    const requestedName = text(body.reportForName, 160);
    let reportForName = member.name;
    if (reportFor === "Someone else") {
      const access = await resolveUserAccess(session.email);
      if (!["service_manager", "hod", "admin", "super_admin"].includes(access.role)) return NextResponse.json({ ok: false, message: "Your role does not allow you to submit a report for someone else." }, { status: 403 });
      if (!requestedName) return NextResponse.json({ ok: false, message: "Enter the name of the person this report is for." }, { status: 400 });
      reportForName = requestedName;
    } else if (reportFor !== "Me") {
      return NextResponse.json({ ok: false, message: "Choose who this report is for." }, { status: 400 });
    }

    const service = text(body.service, 40);
    const submissionId = text(body.submissionId, 36);
    const date = text(body.date, 10);
    const area = text(body.area, 160);
    const adultsHeadcount = count(body.adultsHeadcount);
    const childrenHeadcount = count(body.childrenHeadcount);
    const observationFields = ["preparedness", "neatness", "orderliness", "conduct", "compliance", "coordination"] as const;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId) || !isIsoCalendarDate(date) || !SERVICES.has(service) || !area || adultsHeadcount === null || childrenHeadcount === null) {
      return NextResponse.json({ ok: false, message: "Complete the date, service, area and headcounts correctly." }, { status: 400 });
    }
    const selectedRatings = observationFields.map((field) => text(body[field], 30)).filter(Boolean);
    if (selectedRatings.length === 0) {
      return NextResponse.json({ ok: false, message: "Select and rate at least one observation before submitting." }, { status: 400 });
    }
    if (selectedRatings.some((rating) => !RATINGS.has(rating))) {
      return NextResponse.json({ ok: false, message: "Choose a valid rating for each selected observation." }, { status: 400 });
    }
    const averageRating = selectedRatings.length ? selectedRatings.reduce((sum, rating) => sum + RATING_SCORES[rating], 0) / selectedRatings.length : 0;
    const overallRating = !selectedRatings.length ? "" : averageRating >= 3.5 ? "Excellent" : averageRating >= 2.5 ? "Good" : averageRating >= 1.5 ? "Needs Improvement" : "Poor";
    const whatWentWell = text(body.whatWentWell);
    const areasForImprovement = text(body.areasForImprovement);
    const recommendations = text(body.recommendations);
    if (selectedRatings.includes("Excellent") && !whatWentWell) {
      return NextResponse.json({ ok: false, message: "Describe what went well when an observation is rated Excellent." }, { status: 400 });
    }
    if (selectedRatings.some((rating) => rating === "Poor" || rating === "Needs Improvement") && !areasForImprovement) {
      return NextResponse.json({ ok: false, message: "Describe the areas that need improvement when an observation is rated Poor or Needs Improvement." }, { status: 400 });
    }
    const incidentFlag = text(body.incidentFlag, 10);
    const incidentDescribe = text(body.incidentDescribe);
    if (!new Set(["No", "Yes"]).has(incidentFlag)) {
      return NextResponse.json({ ok: false, message: "Choose whether the incident requires leadership attention." }, { status: 400 });
    }
    if (incidentFlag === "Yes" && !incidentDescribe) {
      return NextResponse.json({ ok: false, message: "Describe the incident requiring leadership attention." }, { status: 400 });
    }
    if (body.confirmAccurate !== true) {
      return NextResponse.json({ ok: false, message: "Confirm that the report is accurate." }, { status: 400 });
    }

    await appendServicePostReport({
      submissionId, date, service, area, adultsHeadcount, childrenHeadcount,
      name: reportForName, email: member.email, submittedByName: member.name, submittedByEmail: member.email,
      preparedness: text(body.preparedness, 30), neatness: text(body.neatness, 30),
      orderliness: text(body.orderliness, 30), conduct: text(body.conduct, 30),
      compliance: text(body.compliance, 30), coordination: text(body.coordination, 30),
      overallRating, whatWentWell,
      areasForImprovement, recommendations,
      incidentFlag, incidentDescribe,
      ma: stringRecord(body.ma), teens: stringRecord(body.teens),
      additionalComments: text(body.additionalComments), confirmAccurate: true,
    });
    return NextResponse.json({ ok: true, message: "Service Post report saved successfully." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[service-post] Report save failed", message);
    const duplicate = /already been submitted|duplicate/i.test(message);
    return NextResponse.json({ ok: false, message: duplicate ? message : "The report could not be saved. Please try again." }, { status: duplicate ? 409 : 502 });
  }
}

export async function GET() {
  const session = await readMemberSession();
  if (!session) return NextResponse.json({ ok: false, message: "Your member session has expired." }, { status: 401 });
  const member = await getTeamMemberByEmail(session.email);
  if (!member) return NextResponse.json({ ok: false, message: "Your email is not registered in Team Data." }, { status: 403 });
  const access = await resolveUserAccess(session.email);
  return NextResponse.json({ ok: true, name: member.name, canDelegate: ["service_manager", "hod", "admin", "super_admin"].includes(access.role) }, { headers: { "Cache-Control": "no-store" } });
}
