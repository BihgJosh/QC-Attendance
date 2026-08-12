import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { EmailConfigurationError, sendBrevoEmail } from "@/lib/brevo-email";
import {
  appendEmailDeliveryLog,
  appendGeneratedDocumentLog,
  SERVICE_REPORT_WORKBOOK_URL,
} from "@/lib/service-report-workbook";
import { syncFinalReportForDate } from "@/lib/final-report-sheet";
import { isIsoCalendarDate } from "@/lib/validation";
import { updateHeadcountGoogleDocument, type HeadcountService } from "@/lib/headcount-google-doc";
import { updateEmergencyFlagStatus } from "@/lib/emergency-flag-sheet";
import { callServiceReportGateway } from "@/lib/service-report-store";
import { readMemberSession } from "@/lib/member-auth";
import { resolveUserAccess } from "@/lib/member-store";

const SERVICES = new Set(["1st Service", "2nd Service", "3rd Service", "4th Service", "Thursday Service"]);
const ACTIONS = new Set(["checkPassword", "getDashboard", "getEmergencies", "updateEmergency", "generateReport", "generateHeadcount", "sendEmail"]);

function abujaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

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

async function loadDashboard(date: string, service: string) {
  return callServiceReportGateway<SuiteResult>("manager.dashboard", { date, service });
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
  const rows = (items: string) => `<table style="width:100%;border-collapse:collapse;font-size:13px">${items}</table>`;
  const row = (label: unknown, value: unknown) => `<tr><th scope="row" style="padding:7px 4px;text-align:left;font-weight:500;color:#64748b;border-bottom:1px solid #e2e8f0">${escapeHtml(label)}</th><td style="padding:7px 4px;text-align:right;font-weight:700;color:#0f172a;border-bottom:1px solid #e2e8f0">${escapeHtml(value)}</td></tr>`;

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
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(input.documentUrl)}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:linear-gradient(90deg,#22c7ee,#c43ce4);color:#071225;text-decoration:none;font-weight:800">Open compiled service report</a></p>`
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
    const date = typeof body.date === "string" ? body.date : "";
    const service = typeof body.service === "string" ? body.service : "";
    const requestId = typeof body.requestId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId)
      ? body.requestId
      : randomUUID();
    if (!ACTIONS.has(action)) {
      return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
    }
    const session = await readMemberSession();
    if (!session) return NextResponse.json({ ok: false, message: "Sign in with your member account first." }, { status: 401 });
    const access = await resolveUserAccess(session.email);
    const elevated = access.role === "admin" || access.role === "super_admin";
    const activeAssignments = access.assignments
      .filter((assignment) => !date || assignment.serviceDate === date)
      .filter((assignment) => !service || assignment.service === "All services" || service === "All services" || assignment.service === service);
    if (!elevated && access.role !== "service_manager") return NextResponse.json({ ok: false, message: "Service Manager access is required." }, { status: 403 });
    if (!elevated && activeAssignments.length === 0) return NextResponse.json({ ok: false, message: "Your posting schedule does not grant access to this service or the access window has expired." }, { status: 403 });
    if (action === "checkPassword") return NextResponse.json({ ok: true, data: { assignments: access.assignments } }, { headers: { "Cache-Control": "no-store, max-age=0" } });
    const isAllServicesHeadcount = action === "generateHeadcount" && service === "All services";
    const isEmergencyAction = action === "getEmergencies" || action === "updateEmergency";
    if (action !== "checkPassword" && (!isIsoCalendarDate(date) || (!isEmergencyAction && !SERVICES.has(service) && !isAllServicesHeadcount))) {
      return NextResponse.json({ ok: false, message: "Choose a valid date and service." }, { status: 400 });
    }

    if (isEmergencyAction) {
      const emergencyDate = abujaToday();
      if (action === "getEmergencies") {
        const result = await callServiceReportGateway<{ rows?: Record<string, unknown>[] }>("emergency.list", { date: emergencyDate });
        return NextResponse.json({ ok: true, data: { emergencies: result.rows || [] } }, { headers: { "Cache-Control": "no-store, max-age=0" } });
      }

      const emergencyId = typeof body.emergencyId === "string" ? body.emergencyId : "";
      const emergencyStatus = body.status === "Resolved" ? "Resolved" : body.status === "Escalated" ? "Escalated" : "";
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(emergencyId) || !emergencyStatus) {
        return NextResponse.json({ ok: false, message: "Choose a valid emergency action." }, { status: 400 });
      }
      const emergency = await updateEmergencyFlagStatus({ id: emergencyId, date: emergencyDate, status: emergencyStatus });
      await callServiceReportGateway("activity.insert", {
        source_event_id: requestId,
        logged_at: new Date().toISOString(),
        report_date: emergencyDate,
        service: String(emergency.service || ""),
        category: "Emergency",
        action: emergencyStatus,
        actor: "Service Manager",
        summary: `${emergencyStatus}: ${String(emergency.location || "Emergency flag")}`,
        source_record_id: emergencyId,
        status: "Success",
        source_fingerprint: `activity:emergency:${emergencyId}:${emergencyStatus}`,
      }).catch((error) => console.error("[service-manager] Emergency activity logging failed", error instanceof Error ? error.message : error));
      return NextResponse.json({ ok: true, message: `Emergency marked as ${emergencyStatus.toLowerCase()} and added to the daily report.` }, { headers: { "Cache-Control": "no-store, max-age=0" } });
    }

    if (action === "generateHeadcount") {
      const requestedServices = isAllServicesHeadcount ? Array.from(SERVICES) : [service];
      const dashboards = await Promise.all(requestedServices.map(async (serviceName) => {
        try {
          return { service: serviceName, result: await loadDashboard(date, serviceName) };
        } catch {
          return { service: serviceName, result: null };
        }
      }));
      const available: HeadcountService[] = dashboards.flatMap(({ service: serviceName, result }) => {
        if (!result?.ok || !result.data) return [];
        const rawHeadcount = result.data.headcount;
        const headcount = rawHeadcount && typeof rawHeadcount === "object" ? rawHeadcount as HeadcountService["headcount"] : {};
        const rows = Array.isArray(headcount.byDepartment) ? headcount.byDepartment : [];
        if (!rows.length && Number(headcount.grandTotal || 0) <= 0) return [];
        return [{ service: serviceName, headcount }];
      });
      if (!available.length) {
        return NextResponse.json({ ok: false, message: "No submitted headcount data is available for this selection." }, { status: 404 });
      }
      let document: Awaited<ReturnType<typeof updateHeadcountGoogleDocument>>;
      let headcountLoggingFailed = false;
      try {
        document = await updateHeadcountGoogleDocument(date, available);
      } catch (error) {
        console.error("[service-manager] Shared headcount document update failed", error instanceof Error ? error.message : "Unknown error");
        return NextResponse.json({ ok: false, message: "The shared headcount Google Doc could not be updated. Confirm that the service account has Editor access and the Google Docs API is enabled." }, { status: 502 });
      }
      try {
        await appendGeneratedDocumentLog({
          date,
          service: isAllServicesHeadcount ? "All services" : service,
          url: document.url,
          requestId,
          actor: "Service Manager · Shared headcount",
        });
      } catch (error) {
        headcountLoggingFailed = true;
        console.error("[service-manager] Shared headcount document logging failed", error instanceof Error ? error.message : "Unknown error");
      }
      const skippedServices = requestedServices.filter((serviceName) => !available.some((item) => item.service === serviceName));
      return NextResponse.json({
        ok: true,
        url: document.url,
        includedServices: available.map((item) => item.service),
        skippedServices,
        message: skippedServices.length
          ? `Headcount document generated for ${available.length} service${available.length === 1 ? "" : "s"}; ${skippedServices.length} service${skippedServices.length === 1 ? " was" : "s were"} skipped because data was unavailable.`
          : `Headcount document generated for ${available.length} service${available.length === 1 ? "" : "s"}.`,
        ...((headcountLoggingFailed || skippedServices.length) ? { warning: headcountLoggingFailed ? "logging_failed" : "partial_data" } : {}),
      }, { headers: { "Cache-Control": "no-store, max-age=0" } });
    }

    if (action === "sendEmail") {
      const recipient = typeof body.recipient === "string" ? body.recipient.trim().toLowerCase() : "";
      const reportType = body.reportType === "full" ? "full" : body.reportType === "summary" ? "summary" : "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient) || recipient.length > 254 || !reportType) {
        return NextResponse.json({ ok: false, message: "Enter a valid recipient email and choose a report type." }, { status: 400 });
      }
      const dashboard = await loadDashboard(date, service);
      if (!dashboard.ok || !dashboard.data) {
        return NextResponse.json({ ok: false, message: typeof dashboard.message === "string" ? dashboard.message : "The service data could not be loaded." }, { status: 502 });
      }

      let documentUrl: string | undefined;
      let documentLoggingFailed = false;
      if (reportType === "full") {
        const report = await syncFinalReportForDate(date);
        documentUrl = report.url;
        try {
          await appendGeneratedDocumentLog({ date, service, url: documentUrl, actor: `Email delivery to ${recipient}`, requestId });
        } catch (error) {
          documentLoggingFailed = true;
          console.error("[service-manager] Compiled email report logging failed", error instanceof Error ? error.message : "Unknown error");
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
          providerMessageId: delivery.messageId, documentUrl, requestId,
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

    if (action === "generateReport") {
      const report = await syncFinalReportForDate(date);
      await callServiceReportGateway("manager.finalize", { date, service });
      try {
        const log = await appendGeneratedDocumentLog({ date, service, url: report.url, requestId });
        return NextResponse.json({ ok: true, url: report.url, workbookUrl: log.workbookUrl, logRecordId: log.recordId, message: `Compiled service report refreshed in ${report.title}.` }, {
          headers: { "Cache-Control": "no-store, max-age=0" },
        });
      } catch (error) {
        console.error("[service-manager] Compiled report logging failed", error instanceof Error ? error.message : "Unknown error");
        return NextResponse.json({
          ok: true,
          url: report.url,
          message: "Compiled service report refreshed. Its audit log will be retried separately.",
          warning: "logging_failed",
        }, { headers: { "Cache-Control": "no-store, max-age=0" } });
      }
    }
    const result = action === "getDashboard"
      ? await loadDashboard(date, service)
      : { ok: true, data: { assignments: access.assignments } };
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
