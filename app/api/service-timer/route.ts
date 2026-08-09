import { NextResponse } from "next/server";
import { readMemberSession } from "@/lib/member-auth";
import { getTeamMemberByEmail } from "@/lib/team-data-store";
import {
  appendServiceTimerLog,
  SERVICE_TIMER_SEGMENTS,
  type TimerSegment,
} from "@/lib/service-timer-sheet";
import { isClockTime, isIsoCalendarDate } from "@/lib/validation";

const SERVICES = new Set(["1st Service", "2nd Service", "3rd Service", "4th Service", "Thursday Service"]);
const STATUSES = new Set(["", "On Time", "Overshot", "Finished Early"]);

function text(value: unknown, max = 2_000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function integer(value: unknown, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= max ? parsed : null;
}

function timing(value: unknown): TimerSegment | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { status: "", min: 0, sec: 0 };
  const record = value as Record<string, unknown>;
  const status = text(record.status, 30);
  const min = integer(record.min, 1_440);
  const sec = integer(record.sec, 59);
  if (!STATUSES.has(status) || min === null || sec === null) return null;
  return status === "On Time" || !status ? { status, min: 0, sec: 0 } : { status, min, sec };
}

export async function POST(request: Request) {
  try {
    const session = await readMemberSession();
    if (!session) return NextResponse.json({ ok: false, message: "Your member session has expired." }, { status: 401 });
    const member = await getTeamMemberByEmail(session.email);
    if (!member) return NextResponse.json({ ok: false, message: "Your email is not registered in Team Data." }, { status: 403 });
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ ok: false, message: "Invalid timer log." }, { status: 400 });

    const date = text(body.date, 10);
    const submissionId = text(body.submissionId, 36);
    const service = text(body.service, 40);
    const serviceStart = text(body.serviceStart, 5);
    const serviceEnd = text(body.serviceEnd, 5);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId) || !isIsoCalendarDate(date) || !SERVICES.has(service)) {
      return NextResponse.json({ ok: false, message: "Complete the date and service correctly." }, { status: 400 });
    }
    if ((serviceStart && !isClockTime(serviceStart)) || (serviceEnd && !isClockTime(serviceEnd))) {
      return NextResponse.json({ ok: false, message: "Enter valid service start and end times." }, { status: 400 });
    }

    const rawSegments = body.segments && typeof body.segments === "object" && !Array.isArray(body.segments)
      ? body.segments as Record<string, unknown>
      : {};
    const segments: Record<string, TimerSegment> = {};
    for (const [id] of SERVICE_TIMER_SEGMENTS) {
      const segment = timing(rawSegments[id]);
      if (!segment) return NextResponse.json({ ok: false, message: "Enter valid segment timing values." }, { status: 400 });
      segments[id] = segment;
    }
    const rawExtra = body.extra && typeof body.extra === "object" && !Array.isArray(body.extra)
      ? body.extra as Record<string, unknown>
      : {};
    const extraTiming = timing(rawExtra);
    if (!extraTiming) return NextResponse.json({ ok: false, message: "Enter valid extra-segment timing values." }, { status: 400 });

    await appendServiceTimerLog({
      submissionId, date, service, name: member.name, serviceStart, serviceEnd, segments,
      extra: { name: text(rawExtra.name, 160), ...extraTiming },
      generalObservation: text(body.generalObservation),
    });
    return NextResponse.json({ ok: true, message: "Service Timer log saved successfully." });
  } catch (error) {
    console.error("[service-timer] Timer save failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ ok: false, message: "The timer log could not be saved. Please try again." }, { status: 502 });
  }
}
