import { NextResponse } from "next/server";
import { readMemberSession } from "@/lib/member-auth";
import { getTeamMemberByEmail } from "@/lib/team-data-store";
import {
  appendServiceObserverReport,
  SERVICE_OBSERVER_UNITS,
} from "@/lib/service-observer-sheet";

const SERVICES = new Set(["1st Service", "2nd Service", "3rd Service", "4th Service", "Thursday Service"]);
const UNITS = new Set<string>(SERVICE_OBSERVER_UNITS);

function text(value: unknown, max = 2_000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  try {
    const session = await readMemberSession();
    if (!session) return NextResponse.json({ ok: false, message: "Your member session has expired." }, { status: 401 });
    const member = await getTeamMemberByEmail(session.email);
    if (!member) return NextResponse.json({ ok: false, message: "Your email is not registered in Team Data." }, { status: 403 });
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ ok: false, message: "Invalid observer report." }, { status: 400 });

    const date = text(body.date, 10);
    const service = text(body.service, 40);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !SERVICES.has(service)) {
      return NextResponse.json({ ok: false, message: "Complete the date and service correctly." }, { status: 400 });
    }
    const rawUnits = Array.isArray(body.unitsReported) ? body.unitsReported : [];
    const unitsReported = [...new Set(rawUnits.map((unit) => text(unit, 80)).filter((unit) => UNITS.has(unit)))];
    if (unitsReported.length !== rawUnits.length) {
      return NextResponse.json({ ok: false, message: "One or more selected units are invalid." }, { status: 400 });
    }
    const rawReports = body.unitReports && typeof body.unitReports === "object" && !Array.isArray(body.unitReports)
      ? body.unitReports as Record<string, unknown>
      : {};
    const unitReports = Object.fromEntries(unitsReported.map((unit) => [unit, text(rawReports[unit])]));

    await appendServiceObserverReport({
      date, service, observerName: member.name,
      generalObservations: text(body.generalObservations),
      unitsReported, unitReports,
      recommendations: text(body.recommendations),
      conclusion: text(body.conclusion),
    });
    return NextResponse.json({ ok: true, message: "Service Observer report saved successfully." });
  } catch (error) {
    console.error("[service-observer] Report save failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ ok: false, message: "The observer report could not be saved. Please try again." }, { status: 502 });
  }
}
