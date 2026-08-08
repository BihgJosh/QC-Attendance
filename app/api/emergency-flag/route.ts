import { NextResponse } from "next/server";
import { readMemberSession } from "@/lib/member-auth";
import { getTeamMemberByEmail } from "@/lib/team-data-store";
import { appendEmergencyFlag } from "@/lib/emergency-flag-sheet";
import { notifyTeam } from "@/lib/web-push";

const LEGACY_EMERGENCY_API_URL =
  "https://script.google.com/macros/s/AKfycbzZJ5LEnQGUAC8ChcZ--oxUfUkJMYG8jg-IRUu2i_KcqFD6GByKk5ahTIrbMXz8sjDNMQ/exec";

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  try {
    const session = await readMemberSession();
    if (!session) return NextResponse.json({ ok: false, message: "Your member session has expired." }, { status: 401 });
    const member = await getTeamMemberByEmail(session.email);
    if (!member) return NextResponse.json({ ok: false, message: "Your email is not registered in Team Data." }, { status: 403 });
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ ok: false, message: "Invalid emergency flag." }, { status: 400 });

    const location = text(body.location, 200);
    const description = text(body.description, 2_000);
    if (!location || !description) {
      return NextResponse.json({ ok: false, message: "Enter the emergency location and description." }, { status: 400 });
    }
    const flag = { location, description, reportedBy: member.name };

    const broadcastResponse = await fetch(LEGACY_EMERGENCY_API_URL, {
      method: "POST",
      signal: AbortSignal.timeout(12_000),
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(flag),
    });
    const broadcastResult = await broadcastResponse.json().catch(() => null) as { ok?: unknown; message?: unknown } | null;
    if (!broadcastResponse.ok || broadcastResult?.ok !== true) {
      throw new Error("The emergency alert broadcast was not accepted.");
    }

    let notificationWarning = "";
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
      if (notificationResult.total === 0) notificationWarning = "no_subscribed_devices";
      else if (notificationResult.failed > 0) notificationWarning = "partial_notification_delivery";
    } catch (error) {
      notificationWarning = "notification_delivery_failed";
      console.error("[emergency-flag] Device notification broadcast failed", error instanceof Error ? error.message : "Unknown error");
    }

    try {
      await appendEmergencyFlag(flag);
      return NextResponse.json({
        ok: true,
        message: notificationWarning ? "Emergency flag sent and saved. Some devices may not have received the notification." : "Emergency flag sent to subscribed user devices and saved successfully.",
        ...(notificationWarning ? { warning: notificationWarning } : {}),
      });
    } catch (error) {
      console.error("[emergency-flag] Alert sent but sheet logging failed", error instanceof Error ? error.message : "Unknown error");
      return NextResponse.json({ ok: true, message: "Emergency alert sent. The report log will need follow-up.", warning: "logging_failed" });
    }
  } catch (error) {
    console.error("[emergency-flag] Emergency save failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({
      ok: false,
      message: "The emergency flag could not be completed. Alert Medical or Security in person immediately.",
    }, { status: 502 });
  }
}
