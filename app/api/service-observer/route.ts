import { NextResponse } from "next/server";
import { readMemberSession } from "@/lib/member-auth";
import { getTeamMemberByEmail } from "@/lib/team-data-store";
import { resolveUserAccess, type AppRole } from "@/lib/member-store";
import {
  appendServiceObserverReport,
  SERVICE_OBSERVER_UNITS,
} from "@/lib/service-observer-sheet";
import { isIsoCalendarDate } from "@/lib/validation";
import { randomUUID } from "crypto";

const SERVICES = new Set(["1st Service", "2nd Service", "3rd Service", "4th Service", "Thursday Service"]);
const UNITS = new Set<string>(SERVICE_OBSERVER_UNITS);
const REPORTING_LOCATIONS = new Set(["Outside", "Emporium", "Toilet", "Children Section", "Vendors", "Overflow", "Main Auditorium"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(value: unknown, max = 2_000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

const ROLE_LABELS: Record<AppRole, string> = {
  general_user: "General User",
  service_manager: "Service Manager",
  hod: "HOD",
  admin: "Admin",
  super_admin: "Super Admin",
};

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 100_000) return NextResponse.json({ ok: false, message: "The observer report is too large." }, { status: 413 });
    const session = await readMemberSession();
    if (!session) return NextResponse.json({ ok: false, message: "Your member session has expired." }, { status: 401 });
    const member = await getTeamMemberByEmail(session.email);
    if (!member) return NextResponse.json({ ok: false, message: "Your email is not registered in Team Data." }, { status: 403 });
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ ok: false, message: "Invalid observer report." }, { status: 400 });

    const date = text(body.date, 10);
    const service = text(body.service, 40);
    if (!isIsoCalendarDate(date) || !SERVICES.has(service)) {
      return NextResponse.json({ ok: false, message: "Complete the date and service correctly." }, { status: 400 });
    }
    const access = await resolveUserAccess(session.email);
    const rawLocations = Array.isArray(body.locationsReported) ? body.locationsReported : [];
    const locationsReported = [...new Set(rawLocations.map((location) => text(location, 80)).filter((location) => REPORTING_LOCATIONS.has(location)))];
    if (locationsReported.length === 0 || locationsReported.length !== rawLocations.length) {
      return NextResponse.json({ ok: false, message: "Select at least one valid reporting location." }, { status: 400 });
    }
    const rawLocationObservations = body.locationObservations && typeof body.locationObservations === "object" && !Array.isArray(body.locationObservations)
      ? body.locationObservations as Record<string, unknown>
      : {};
    const locationObservations = Object.fromEntries(locationsReported.map((location) => [location, text(rawLocationObservations[location])]));
    if (locationsReported.some((location) => !locationObservations[location])) {
      return NextResponse.json({ ok: false, message: "Add an observation for every selected location." }, { status: 400 });
    }
    const rawUnits = Array.isArray(body.unitsReported) ? body.unitsReported : [];
    if (rawUnits.length > SERVICE_OBSERVER_UNITS.length) {
      return NextResponse.json({ ok: false, message: "Too many observer units were submitted." }, { status: 400 });
    }
    const unitsReported = [...new Set(rawUnits.map((unit) => text(unit, 80)).filter((unit) => UNITS.has(unit)))];
    if (unitsReported.length !== rawUnits.length) {
      return NextResponse.json({ ok: false, message: "One or more selected units are invalid." }, { status: 400 });
    }
    const rawReports = body.unitReports && typeof body.unitReports === "object" && !Array.isArray(body.unitReports)
      ? body.unitReports as Record<string, unknown>
      : {};
    const unitReports = Object.fromEntries(unitsReported.map((unit) => [unit, text(rawReports[unit])]));
    if (unitsReported.some((unit) => !unitReports[unit])) {
      return NextResponse.json({ ok: false, message: "Add an observation for every selected unit." }, { status: 400 });
    }
    const otherUnitName = text(body.otherUnitName, 80);
    if (unitsReported.includes("Other") && !otherUnitName) {
      return NextResponse.json({ ok: false, message: "Name the other unit or area you observed." }, { status: 400 });
    }
    const namedOtherUnit = otherUnitName ? `Other — ${otherUnitName}` : "Other";
    const savedUnits = unitsReported.map((unit) => unit === "Other" ? namedOtherUnit : unit);
    const savedUnitReports = Object.fromEntries(Object.entries(unitReports).map(([unit, report]) => [unit === "Other" ? namedOtherUnit : unit, report]));
    const generalObservations = text(body.generalObservations);
    const reporterRole = ROLE_LABELS[access.role];
    const reportingLocation = locationsReported.join(", ");

    await appendServiceObserverReport({
      submissionId: UUID_PATTERN.test(text(body.submissionId, 36)) ? text(body.submissionId, 36) : randomUUID(),
      date, service, observerName: member.name,
      generalObservations,
      unitsReported: savedUnits, unitReports: savedUnitReports,
      recommendations: text(body.recommendations),
      conclusion: text(body.conclusion),
      reporterRole, postedLocation: "", reportingLocation,
      locationsReported, locationObservations,
    });
    return NextResponse.json({ ok: true, message: "Service Observer report saved successfully." });
  } catch (error) {
    console.error("[service-observer] Report save failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ ok: false, message: "The observer report could not be saved. Please try again." }, { status: 502 });
  }
}

export async function GET() {
  const session = await readMemberSession();
  if (!session) return NextResponse.json({ ok: false, message: "Your member session has expired." }, { status: 401 });
  const member = await getTeamMemberByEmail(session.email);
  if (!member) return NextResponse.json({ ok: false, message: "Your email is not registered in Team Data." }, { status: 403 });
  const access = await resolveUserAccess(session.email);
  return NextResponse.json({ ok: true, name: member.name, role: ROLE_LABELS[access.role] }, { headers: { "Cache-Control": "no-store" } });
}
