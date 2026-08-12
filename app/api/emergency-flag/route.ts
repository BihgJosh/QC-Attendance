import { NextResponse } from "next/server";
import { readMemberSession } from "@/lib/member-auth";
import { getTeamMemberByEmail } from "@/lib/team-data-store";
import { appendEmergencyFlag } from "@/lib/emergency-flag-sheet";
import { notifyTeam } from "@/lib/web-push";
import { callServiceReportGateway } from "@/lib/service-report-store";

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function abujaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export async function GET(request: Request) {
  try {
    const session = await readMemberSession();
    if (!session) return NextResponse.json({ ok: false, message: "Your member session has expired." }, { status: 401 });
    if (!(await getTeamMemberByEmail(session.email))) return NextResponse.json({ ok: false, message: "Your email is not registered in Team Data." }, { status: 403 });
    const sinceValue = Number(new URL(request.url).searchParams.get("since") || 0);
    const since = Number.isFinite(sinceValue) && sinceValue >= 0 ? sinceValue : 0;
    const result = await callServiceReportGateway<{ rows?: Record<string, unknown>[] }>("emergency.list", { date: abujaToday() });
    const emergencies = (result.rows || []).flatMap((row) => {
      const submittedAtMs = Number(row.submitted_at_ms || new Date(String(row.submitted_at || "")).getTime());
      if (!Number.isFinite(submittedAtMs) || submittedAtMs <= since) return [];
      return [{
        id: String(row.id || ""),
        location: String(row.location || "Location not provided"),
        description: String(row.description || "No description provided"),
        reportedBy: String(row.reported_by || "Unknown reporter"),
        submittedAt: String(row.submitted_at || ""),
        submittedAtMs,
      }];
    });
    return NextResponse.json({ ok: true, emergencies, serverNow: Date.now() }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("[emergency-flag] Emergency poll failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ ok: false, emergencies: [], serverNow: Date.now() }, { status: 502 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await readMemberSession();
    if (!session) return NextResponse.json({ ok: false, message: "Your member session has expired." }, { status: 401 });
    const member = await getTeamMemberByEmail(session.email);
    if (!member) return NextResponse.json({ ok: false, message: "Your email is not registered in Team Data." }, { status: 403 });
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ ok: false, message: "Invalid emergency flag." }, { status: 400 });

    const submissionId = text(body.submissionId, 36);
    const location = text(body.location, 200);
    const description = text(body.description, 2_000);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId) || !location || !description) {
      return NextResponse.json({ ok: false, message: "Enter the emergency location and description." }, { status: 400 });
    }
    const flag = { submissionId, location, description, reportedBy: member.name };

    await appendEmergencyFlag(flag);
    const warnings: string[] = [];
    try {
      const notificationResult = await notifyTeam({
        title: `Emergency — ${location}`,
        body: `${description} — reported by ${member.name}`,
        url: "/qc-tools/emergency",
        tag: `qc-emergency-${Date.now()}`,
        urgency: "high",
        ttlSeconds: 60 * 60 * 24,
        requireInteraction: true,
      });
      if (notificationResult.total === 0) warnings.push("no_subscribed_devices");
      else if (notificationResult.failed > 0) warnings.push("partial_notification_delivery");
    } catch (error) {
      warnings.push("notification_delivery_failed");
      console.error("[emergency-flag] Device notification broadcast failed", error instanceof Error ? error.message : "Unknown error");
    }

    return NextResponse.json({
      ok: true,
      message: warnings.length ? "Emergency saved and sent through available notification channels." : "Emergency saved and sent to subscribed user devices successfully.",
      ...(warnings.length ? { warning: warnings.join(",") } : {}),
    });
  } catch (error) {
    console.error("[emergency-flag] Emergency save failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({
      ok: false,
      message: "The emergency flag could not be completed. Alert Medical or Security in person immediately.",
    }, { status: 502 });
  }
}
