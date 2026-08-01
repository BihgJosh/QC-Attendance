import { NextResponse } from "next/server";
import { readMemberSession } from "@/lib/member-auth";
import { getTeamMemberByEmail } from "@/lib/team-data-store";
import { appendServicePostReport } from "@/lib/service-post-sheet";
import { isIsoCalendarDate } from "@/lib/validation";

const SERVICES = new Set(["1st Service", "2nd Service", "3rd Service", "4th Service", "Thursday Service"]);
const RATINGS = new Set(["Excellent", "Good", "Fair", "Poor"]);
const OVERALL_RATINGS = new Set(["Excellent", "Very Good", "Good", "Fair", "Poor"]);

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

    const service = text(body.service, 40);
    const date = text(body.date, 10);
    const area = text(body.area, 160);
    const adultsHeadcount = count(body.adultsHeadcount);
    const childrenHeadcount = count(body.childrenHeadcount);
    const requiredRatings = ["preparedness", "neatness", "orderliness", "conduct", "compliance", "coordination"] as const;
    if (!isIsoCalendarDate(date) || !SERVICES.has(service) || !area || adultsHeadcount === null || childrenHeadcount === null) {
      return NextResponse.json({ ok: false, message: "Complete the date, service, area and headcounts correctly." }, { status: 400 });
    }
    if (requiredRatings.some((field) => !RATINGS.has(text(body[field], 30))) || !OVERALL_RATINGS.has(text(body.overallRating, 30))) {
      return NextResponse.json({ ok: false, message: "Complete every required observation rating." }, { status: 400 });
    }
    if (body.confirmAccurate !== true) {
      return NextResponse.json({ ok: false, message: "Confirm that the report is accurate." }, { status: 400 });
    }

    await appendServicePostReport({
      date, service, area, adultsHeadcount, childrenHeadcount,
      name: member.name, email: member.email,
      preparedness: text(body.preparedness, 30), neatness: text(body.neatness, 30),
      orderliness: text(body.orderliness, 30), conduct: text(body.conduct, 30),
      compliance: text(body.compliance, 30), coordination: text(body.coordination, 30),
      overallRating: text(body.overallRating, 30), whatWentWell: text(body.whatWentWell),
      areasForImprovement: text(body.areasForImprovement), recommendations: text(body.recommendations),
      incidentFlag: text(body.incidentFlag, 10), incidentDescribe: text(body.incidentDescribe),
      ma: stringRecord(body.ma), teens: stringRecord(body.teens),
      additionalComments: text(body.additionalComments), confirmAccurate: true,
    });
    return NextResponse.json({ ok: true, message: "Service Post report saved successfully." });
  } catch (error) {
    console.error("[service-post] Report save failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ ok: false, message: "The report could not be saved. Please try again." }, { status: 502 });
  }
}
