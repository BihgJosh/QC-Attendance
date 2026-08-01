import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { EmailConfigurationError, sendBrevoEmail } from "@/lib/brevo-email";
import {
  appendEmailDeliveryLog,
  appendGeneratedDocumentLog,
  SERVICE_REPORT_WORKBOOK_URL,
} from "@/lib/service-report-workbook";
import { isIsoCalendarDate } from "@/lib/validation";

const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycby9y-TP-NfdLurUyqW9hXg5WaHIyl-bW4kJoAOoUpW-ObemJLjmRV0RVS1kwtPJCx9iFg/exec";
const API_URL = process.env.QC_SUITE_API_URL || DEFAULT_API_URL;
const SERVICES = new Set(["1st Service", "2nd Service", "3rd Service", "4th Service", "Thursday Service"]);
const ACTIONS = new Set(["checkPassword", "getDashboard", "generateReport", "sendEmail"]);

type SuiteResult = {
  ok?: boolean;
  url?: unknown;
  message?: unknown;
  data?: Record<string, unknown>;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function trustedGoogleDocumentUrl(value: unknown) {
  if (typeof value !== "string") throw new Error("The document URL is missing.");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "docs.google.com") {
    throw new Error("The generated document URL is not a trusted Google Docs link.");
  }
  return url.toString();
}

async function callSuite(action: "checkPassword" | "getDashboard" | "generateReport", token: string, date?: string, service?: string) {
  const params = new URLSearchParams({ action, token });
  if (date && service) {
    params.set("date", date);
    params.set("service", service);
  }
  const timeouts = [12_000, 7_000];
  for (let attempt = 0; attempt < timeouts.length; attempt += 1) {
    try {
      const response = await fetch(`${API_URL}?${params.toString()}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(timeouts[attempt]),
      });
      if (!response.ok) {
        if (response.status >= 500 && attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          continue;
        }
        throw new Error(`QC suite responded with ${response.status}`);
      }
      return await response.json() as SuiteResult;
    } catch (error) {
      if (attempt === 0 && (
        error instanceof TypeError
        || (error instanceof Error && (error.name === "TimeoutError" || error instanceof SyntaxError))
      )) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        continue;
      }
      throw error;
    }
  }
  throw new Error("QC suite did not respond.");
}

function reportEmailHtml(input: {
  service: string;
  date: string;
  reportType: "summary" | "full";
  data: Record<string, unknown>;
  documentUrl?: string;
}) {
  const data = input.data;
  const headcount = data.headcount && typeof data.headcount === "object" ? data.headcount as Record<string, unknown> : {};
  const emergencies = Array.isArray(data.emergencies) ? data.emergencies as Record<string, unknown>[] : [];
  const ratings = data.ratings && typeof data.ratings === "object" ? data.ratings as Record<string, unknown> : {};
  const timer = data.timer && typeof data.timer === "object" ? data.timer as Record<string, unknown> : null;
  const observer = data.observer && typeof data.observer === "object" ? data.observer as Record<string, unknown> : null;
  const departments = Array.isArray(headcount.byDepartment) ? headcount.byDepartment as Record<string, unknown>[] : [];
  const segments = timer && Array.isArray(timer.segments) ? timer.segments as Record<string, unknown>[] : [];
  const unitReports = observer?.unitReports && typeof observer.unitReports === "object"
    ? observer.unitReports as Record<string, unknown>
    : {};
  const section = (title: string, content: string) => `<div style="margin-top:22px;padding:18px;border:1px solid #dbeafe;border-radius:16px;background:#f8fbff"><h2 style="margin:0 0 12px;color:#102044;font-size:16px">${escapeHtml(title)}</h2>${content}</div>`;
  const rows = (items: string) => `<table role="presentation" style="width:100%;border-collapse:collapse;font-size:13px">${items}</table>`;
  const row = (label: unknown, value: unknown) => `<tr><td style="padding:7px 4px;color:#64748b;border-bottom:1px solid #e2e8f0">${escapeHtml(label)}</td><td style="padding:7px 4px;text-align:right;font-weight:700;color:#0f172a;border-bottom:1px solid #e2e8f0">${escapeHtml(value)}</td></tr>`;

  const detailed = input.reportType === "full" ? [
    section("Worshipper headcount", departments.length
      ? rows(departments.map((item) => row(item.department || "Unspecified", `${numberValue(item.adults)} adults · ${numberValue(item.children)} children · ${numberValue(item.total)} total`)).join(""))
      : "<p style=\"color:#64748b\">No department headcount was submitted.</p>"),
    section("Post ratings", Object.keys(ratings).length
      ? rows(Object.entries(ratings).map(([label, value]) => row(label, value)).join(""))
      : "<p style=\"color:#64748b\">No post ratings were submitted.</p>"),
    section("Service timer", timer
      ? `${rows([row("Timer", timer.timerName || "Not provided"), row("Service time", `${timer.serviceStart || "—"} – ${timer.serviceEnd || "—"}`), ...segments.map((item) => row(item.label || "Segment", `${item.status || "No data"}${item.min || item.sec ? ` · ${numberValue(item.min)}m ${numberValue(item.sec)}s` : ""}`))].join(""))}${timer.generalObservation ? `<p style="color:#475569;line-height:1.6">${escapeHtml(timer.generalObservation)}</p>` : ""}`
      : "<p style=\"color:#64748b\">No timer log was submitted.</p>"),
    section("Observer report", observer
      ? `${observer.generalObservations ? `<p style="color:#475569;line-height:1.6">${escapeHtml(observer.generalObservations)}</p>` : ""}${rows(Object.entries(unitReports).map(([unit, text]) => row(unit, text)).join(""))}${observer.recommendations ? `<p><strong>Recommendations:</strong> ${escapeHtml(observer.recommendations)}</p>` : ""}${observer.conclusion ? `<p><strong>Conclusion:</strong> ${escapeHtml(observer.conclusion)}</p>` : ""}`
      : "<p style=\"color:#64748b\">No observer report was submitted.</p>"),
    emergencies.length
      ? section("Emergency flags", emergencies.map((item) => `<p style="padding:10px;border-left:4px solid #ef4444;background:#fff1f2;color:#7f1d1d"><strong>${escapeHtml(item.location || "Location not provided")}</strong><br>${escapeHtml(item.description || "No description")}<br><small>${escapeHtml(item.reportedBy || "Unknown reporter")} · ${escapeHtml(item.status || "Status unavailable")}</small></p>`).join(""))
      : "",
  ].join("") : "";

  const documentCta = input.documentUrl
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(input.documentUrl)}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:linear-gradient(90deg,#22c7ee,#c43ce4);color:#071225;text-decoration:none;font-weight:800">Open generated document</a></p>`
    : "";

  return `<!doctype html><html><body style="margin:0;background:#eef4ff;font-family:Arial,sans-serif;color:#0f172a"><div style="max-width:680px;margin:0 auto;padding:24px"><div style="padding:24px;border-radius:22px;background:#0b1738;color:white"><p style="margin:0;color:#67e8f9;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">QC Unit · Service report</p><h1 style="margin:8px 0 4px;font-size:28px">${escapeHtml(input.service)}</h1><p style="margin:0;color:#cbd5e1">${escapeHtml(input.date)} · ${input.reportType === "full" ? "Full report" : "Summary"}</p></div><div style="margin-top:16px;padding:20px;border-radius:18px;background:white">${rows([
    row("Worshippers", numberValue(headcount.grandTotal)),
    row("Incidents", numberValue(data.incidentCount)),
    row("Emergency flags", emergencies.length),
    row("Timer log", timer ? "Available" : "Not submitted"),
    row("Observer report", observer ? "Available" : "Not submitted"),
  ].join(""))}${detailed}${documentCta}<p style="margin-top:26px;font-size:12px;color:#64748b">This report was shared from the Streams of Joy Quality Control Unit service workspace. <a href="${SERVICE_REPORT_WORKBOOK_URL}" style="color:#2563eb">Open service workbook</a></p></div></div></body></html>`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const date = typeof body.date === "string" ? body.date : "";
    const service = typeof body.service === "string" ? body.service : "";
    if (!ACTIONS.has(action) || !token || token.length > 200) {
      return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
    }
    if (action !== "checkPassword" && (!isIsoCalendarDate(date) || !SERVICES.has(service))) {
      return NextResponse.json({ ok: false, message: "Choose a valid date and service." }, { status: 400 });
    }

    if (action === "sendEmail") {
      const recipient = typeof body.recipient === "string" ? body.recipient.trim().toLowerCase() : "";
      const reportType = body.reportType === "full" ? "full" : body.reportType === "summary" ? "summary" : "";
      const requestId = typeof body.requestId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId)
        ? body.requestId
        : randomUUID();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient) || recipient.length > 254 || !reportType) {
        return NextResponse.json({ ok: false, message: "Enter a valid recipient email and choose a report type." }, { status: 400 });
      }
      const dashboard = await callSuite("getDashboard", token, date, service);
      if (!dashboard.ok || !dashboard.data) {
        return NextResponse.json({ ok: false, message: typeof dashboard.message === "string" ? dashboard.message : "The service data could not be loaded." }, { status: 502 });
      }

      let documentUrl: string | undefined;
      let documentLoggingFailed = false;
      if (reportType === "full") {
        const generated = await callSuite("generateReport", token, date, service);
        if (!generated.ok) {
          return NextResponse.json({ ok: false, message: typeof generated.message === "string" ? generated.message : "The full report document could not be generated." }, { status: 502 });
        }
        documentUrl = trustedGoogleDocumentUrl(generated.url);
        try {
          await appendGeneratedDocumentLog({ date, service, url: documentUrl, actor: `Email delivery to ${recipient}` });
        } catch (error) {
          documentLoggingFailed = true;
          console.error("[service-manager] Generated email document logging failed", error instanceof Error ? error.message : "Unknown error");
        }
      }

      const subject = `QC Unit: ${service} ${reportType === "full" ? "full report" : "summary"} · ${date}`;
      const delivery = await sendBrevoEmail({
        to: recipient,
        subject,
        html: reportEmailHtml({ service, date, reportType, data: dashboard.data, documentUrl }),
        idempotencyKey: requestId,
      });
      try {
        const emailLogId = await appendEmailDeliveryLog({
          date, service, recipient, reportType, subject,
          providerMessageId: delivery.messageId, documentUrl,
        });
        return NextResponse.json({
          ok: true,
          message: documentLoggingFailed
            ? `${reportType === "full" ? "Full report" : "Summary"} sent to ${recipient}, but its document log could not be saved.`
            : `${reportType === "full" ? "Full report" : "Summary"} sent to ${recipient}.`,
          emailLogId,
          ...(documentLoggingFailed ? { warning: "document_logging_failed" } : {}),
        });
      } catch (error) {
        console.error("[service-manager] Email sent but delivery logging failed", error instanceof Error ? error.message : "Unknown error");
        return NextResponse.json({
          ok: true,
          message: `Email sent to ${recipient}, but the delivery log could not be saved. Brevo ID: ${delivery.messageId}`,
          warning: "logging_failed",
        });
      }
    }

    const result = await callSuite(action as "checkPassword" | "getDashboard" | "generateReport", token, date || undefined, service || undefined);
    if (action === "generateReport" && result.ok) {
      try {
        const documentUrl = trustedGoogleDocumentUrl(result.url);
        const log = await appendGeneratedDocumentLog({ date, service, url: documentUrl });
        return NextResponse.json({ ...result, url: documentUrl, workbookUrl: log.workbookUrl, logRecordId: log.recordId }, {
          headers: { "Cache-Control": "no-store, max-age=0" },
        });
      } catch (error) {
        console.error("[service-manager] Generated document logging failed", error instanceof Error ? error.message : "Unknown error");
        return NextResponse.json({ ok: false, message: "The document was generated but could not be logged in the service workbook." }, { status: 502 });
      }
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Service manager request failed", message);
    if (error instanceof EmailConfigurationError) {
      return NextResponse.json({ ok: false, message }, { status: 503 });
    }
    return NextResponse.json({ ok: false, message: "The service reports are temporarily unavailable." }, { status: 502 });
  }
}
