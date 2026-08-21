"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Eye,
  FileText,
  Loader2,
  Mail,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { MemberIdentityCard } from "@/components/member/member-identity";
import type { MemberIdentity } from "@/lib/member-store";

const SERVICES = ["1st Service", "2nd Service", "3rd Service", "4th Service", "Thursday Service"] as const;
type ServiceName = string;

type HeadcountRow = { department?: string; adults?: number; children?: number; total?: number };
type Emergency = { id?: string; service?: string; location?: string; description?: string; reportedBy?: string; reporterEmail?: string; submittedAt?: string; status?: string; identity?: MemberIdentity };
type TimerSegment = { label?: string; status?: string; min?: number; sec?: number };
type PostReporter = { name?: string; email?: string; identity?: MemberIdentity };
type DashboardData = {
  headcount?: { grandTotal?: number; byDepartment?: HeadcountRow[] };
  incidentCount?: number;
  emergencies?: Emergency[];
  ratings?: Record<string, string | number>;
  postReporters?: PostReporter[];
  timer?: { timerName?: string; reporterEmail?: string; identity?: MemberIdentity; serviceStart?: string; serviceEnd?: string; segments?: TimerSegment[]; generalObservation?: string } | null;
  observer?: { observerName?: string; reporterEmail?: string; identity?: MemberIdentity; generalObservations?: string; unitReports?: Record<string, string>; recommendations?: string; conclusion?: string; reporterRole?: string; postedLocation?: string; reportingLocation?: string; locationsReported?: string[]; locationObservations?: Record<string, string> } | null;
};

type ServiceResult = { service: ServiceName; data: DashboardData | null; message?: string };
type ManagerResult = {
  ok: boolean;
  message?: string;
  data?: DashboardData;
  url?: string;
  workbookUrl?: string;
  logRecordId?: string;
  emailLogId?: string;
  includedServices?: string[];
  skippedServices?: string[];
  warning?: string;
  services?: string[];
};

function abujaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function managerRequest(body: Record<string, string>): Promise<ManagerResult> {
  const response = await fetch("/api/service-manager", {
    method: "POST",
    signal: AbortSignal.timeout(30_000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const responseText = await response.text();
  let result: ManagerResult;
  try {
    result = JSON.parse(responseText) as typeof result;
  } catch {
    return { ok: false, message: response.ok ? "The operation completed but its confirmation was interrupted. Retry safely." : `The report service returned an invalid response (${response.status}).` };
  }
  return { ...result, data: normalizeDashboardData(result.data) || undefined };
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function textValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}

function adjustedHeadcount(value: unknown) {
  return Math.ceil(numberValue(value) * 1.02);
}

function identityValue(value: unknown): MemberIdentity | undefined {
  const identity = recordValue(value);
  if (!identity) return undefined;
  return { name: textValue(identity.name) || "Unknown member", email: textValue(identity.email) || "", phone: textValue(identity.phone) || "", avatarUrl: textValue(identity.avatarUrl) || null };
}

function normalizeDashboardData(value: unknown): DashboardData | null {
  const source = recordValue(value);
  if (!source) return null;
  const headcount = recordValue(source.headcount);
  const timer = recordValue(source.timer);
  const observer = recordValue(source.observer);
  const ratings = recordValue(source.ratings);
  const unitReports = recordValue(observer?.unitReports);
  return {
    headcount: headcount ? {
      grandTotal: numberValue(headcount.grandTotal),
      byDepartment: Array.isArray(headcount.byDepartment) ? headcount.byDepartment.flatMap((item) => {
        const row = recordValue(item);
        return row ? [{ department: textValue(row.department), adults: numberValue(row.adults), children: numberValue(row.children), total: numberValue(row.total) }] : [];
      }) : [],
    } : undefined,
    incidentCount: numberValue(source.incidentCount),
    emergencies: Array.isArray(source.emergencies) ? source.emergencies.flatMap((item) => {
      const emergency = recordValue(item);
      return emergency ? [{ id: textValue(emergency.id), service: textValue(emergency.service), location: textValue(emergency.location), description: textValue(emergency.description), reportedBy: textValue(emergency.reportedBy ?? emergency.reported_by), reporterEmail: textValue(emergency.reporterEmail ?? emergency.reporter_email), submittedAt: textValue(emergency.submittedAt ?? emergency.submitted_at), status: textValue(emergency.status), identity: identityValue(emergency.identity) }] : [];
    }) : [],
    ratings: ratings ? Object.fromEntries(Object.entries(ratings).map(([key, rating]) => [key, typeof rating === "number" ? rating : textValue(rating) || "Not provided"])) : {},
    postReporters: Array.isArray(source.postReporters) ? source.postReporters.flatMap((item) => { const reporter = recordValue(item); return reporter ? [{ name: textValue(reporter.name), email: textValue(reporter.email), identity: identityValue(reporter.identity) }] : []; }) : [],
    timer: timer ? {
      timerName: textValue(timer.timerName), reporterEmail: textValue(timer.reporterEmail), identity: identityValue(timer.identity), serviceStart: textValue(timer.serviceStart), serviceEnd: textValue(timer.serviceEnd), generalObservation: textValue(timer.generalObservation),
      segments: Array.isArray(timer.segments) ? timer.segments.flatMap((item) => {
        const segment = recordValue(item);
        return segment ? [{ label: textValue(segment.label), status: textValue(segment.status), min: numberValue(segment.min), sec: numberValue(segment.sec) }] : [];
      }) : [],
    } : null,
    observer: observer ? {
      observerName: textValue(observer.observerName), reporterEmail: textValue(observer.reporterEmail), identity: identityValue(observer.identity), generalObservations: textValue(observer.generalObservations), recommendations: textValue(observer.recommendations), conclusion: textValue(observer.conclusion), reporterRole: textValue(observer.reporterRole), postedLocation: textValue(observer.postedLocation), reportingLocation: textValue(observer.reportingLocation),
      unitReports: unitReports ? Object.fromEntries(Object.entries(unitReports).map(([key, text]) => [key, textValue(text) || "Not provided"])) : {},
      locationsReported: Array.isArray(observer.locationsReported) ? observer.locationsReported.flatMap((location) => { const value = textValue(location); return value ? [value] : []; }) : [],
      locationObservations: recordValue(observer.locationObservations) ? Object.fromEntries(Object.entries(recordValue(observer.locationObservations)!).map(([key, text]) => [key, textValue(text) || "Not provided"])) : {},
    } : null,
  };
}

export function ServiceManagerDashboard() {
  const token = "role-session";
  const [date, setDate] = useState(abujaToday);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<ServiceResult[]>([]);
  const [serviceNames, setServiceNames] = useState<string[]>([...SERVICES]);
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [emergenciesLoading, setEmergenciesLoading] = useState(false);
  const [emergencyUpdating, setEmergencyUpdating] = useState<{ id: string; status: "Resolved" | "Escalated" } | null>(null);
  const [emergencyMessage, setEmergencyMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceName | null>(null);
  const [reportLoading, setReportLoading] = useState<ServiceName | null>(null);
  const [headcountLoading, setHeadcountLoading] = useState<ServiceName | "All services" | null>(null);
  const [headcountDocument, setHeadcountDocument] = useState<{ scope: string; url: string; services: string[]; message?: string; warning?: string } | null>(null);
  const [generatedLog, setGeneratedLog] = useState<{ service: ServiceName; documentUrl: string; warning?: string } | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [shareType, setShareType] = useState<"summary" | "full">("summary");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareMessage, setShareMessage] = useState<{ kind: "success" | "warning" | "error"; text: string } | null>(null);
  const summaryRequest = useRef(0);
  const emailRequest = useRef<{ signature: string; id: string } | null>(null);
  const documentRequest = useRef<{ signature: string; id: string } | null>(null);
  const headcountRequest = useRef<{ signature: string; id: string } | null>(null);
  const emergencyRequest = useRef(0);

  const loadEmergencies = async (accessToken: string, selectedDate: string) => {
    const requestId = ++emergencyRequest.current;
    setEmergenciesLoading(true);
    try {
      const result = await managerRequest({ action: "getEmergencies", token: accessToken, date: selectedDate });
      if (requestId !== emergencyRequest.current) return;
      if (!result.ok) {
        setEmergencyMessage({ kind: "error", text: result.message || "Emergency flags could not be loaded." });
        return;
      }
      setEmergencies(result.data?.emergencies || []);
    } catch {
      if (requestId === emergencyRequest.current) setEmergencyMessage({ kind: "error", text: "Emergency flags could not be loaded." });
    } finally {
      if (requestId === emergencyRequest.current) setEmergenciesLoading(false);
    }
  };

  const loadAllServices = async (accessToken: string, selectedDate: string) => {
    const requestId = ++summaryRequest.current;
    setLoading(true);
    setError("");
    setEmergencyMessage(null);
    setSelectedService(null);
    try {
      const discovered = await managerRequest({ action: "getServices", token: accessToken, date: selectedDate });
      const names = [...SERVICES, ...(discovered.ok ? discovered.services || [] : [])];
      const [responses] = await Promise.all([
        Promise.all(names.map(async (service): Promise<ServiceResult> => {
          try {
            const result = await managerRequest({ action: "getDashboard", token: accessToken, date: selectedDate, service });
            return { service, data: result.ok ? result.data || null : null, message: result.message };
          } catch {
            return { service, data: null, message: "Could not load this service." };
          }
        })),
        loadEmergencies(accessToken, selectedDate),
      ]);
      if (requestId === summaryRequest.current) {
        setServiceNames(names);
        setResults(responses);
      }
    } catch {
      if (requestId === summaryRequest.current) setError("The service summary could not be loaded. Try again.");
    } finally {
      if (requestId === summaryRequest.current) setLoading(false);
    }
  };

  useEffect(() => { void loadAllServices(token, date); }, []);

  const summary = useMemo(() => {
    const totals = results.reduce(
      (total, result) => {
        const data = result.data;
        if (!data) return total;
        total.worshippers += adjustedHeadcount(data.headcount?.grandTotal);
        total.incidents += numberValue(data.incidentCount);
        total.loaded += 1;
        if (data.timer) total.timerLogs += 1;
        if (data.observer) total.observerLogs += 1;
        return total;
      },
      { worshippers: 0, incidents: 0, loaded: 0, timerLogs: 0, observerLogs: 0 },
    );
    return { ...totals, emergencies: emergencies.length };
  }, [results, emergencies]);

  const selected = results.find((result) => result.service === selectedService);

  const updateEmergency = async (emergency: Emergency, status: "Resolved" | "Escalated") => {
    if (!emergency.id || emergency.status === status) return;
    setEmergencyUpdating({ id: emergency.id, status });
    setEmergencyMessage(null);
    try {
      const result = await managerRequest({ action: "updateEmergency", token, date, emergencyId: emergency.id, status, requestId: crypto.randomUUID() });
      if (!result.ok) {
        setEmergencyMessage({ kind: "error", text: result.message || "The emergency status could not be updated." });
        return;
      }
      setEmergencyMessage({ kind: "success", text: result.message || `Emergency marked as ${status.toLowerCase()}.` });
      await loadEmergencies(token, date);
    } catch {
      setEmergencyMessage({ kind: "error", text: "The emergency status could not be updated. Try again." });
    } finally {
      setEmergencyUpdating(null);
    }
  };

  const generateReport = async (service: ServiceName) => {
    const signature = `${date}|${service}`;
    if (!documentRequest.current || documentRequest.current.signature !== signature) {
      documentRequest.current = { signature, id: crypto.randomUUID() };
    }
    const reportWindow = window.open("about:blank", "_blank");
    if (reportWindow) reportWindow.opener = null;
    setReportLoading(service);
    setError("");
    setGeneratedLog(null);
    try {
      const result = await managerRequest({ action: "generateReport", token, date, service, requestId: documentRequest.current.id });
      if (!result.ok || !result.url) {
        reportWindow?.close();
        setError(result.message || "The report document could not be generated.");
        return;
      }
      const reportUrl = new URL(result.url);
      if (reportUrl.protocol !== "https:" || reportUrl.hostname !== "docs.google.com") throw new Error("Unsafe report URL");
      setGeneratedLog({ service, documentUrl: reportUrl.toString(), warning: result.warning });
      documentRequest.current = null;
      if (reportWindow) reportWindow.location.href = reportUrl.toString();
      else setError("The report is ready. Use the document link below to open it.");
    } catch {
      reportWindow?.close();
      setError("The report document could not be generated.");
    } finally {
      setReportLoading(null);
    }
  };

  const generateHeadcount = async (scope: ServiceName | "All services") => {
    const signature = `${date}|${scope}`;
    if (!headcountRequest.current || headcountRequest.current.signature !== signature) {
      headcountRequest.current = { signature, id: crypto.randomUUID() };
    }
    const documentWindow = window.open("about:blank", "_blank");
    if (documentWindow) documentWindow.opener = null;
    setHeadcountLoading(scope);
    setError("");
    setHeadcountDocument(null);
    try {
      const result = await managerRequest({ action: "generateHeadcount", token, date, service: scope, requestId: headcountRequest.current.id });
      if (!result.ok || !result.url) {
        documentWindow?.close();
        setError(result.message || "The headcount document could not be generated.");
        return;
      }
      const documentUrl = new URL(result.url);
      if (documentUrl.protocol !== "https:" || documentUrl.hostname !== "docs.google.com") throw new Error("Unsafe document URL");
      setHeadcountDocument({
        scope,
        url: documentUrl.toString(),
        services: result.includedServices || [],
        message: result.message,
        warning: result.warning,
      });
      headcountRequest.current = null;
      if (documentWindow) documentWindow.location.href = documentUrl.toString();
      else setError("The headcount is ready, but the browser blocked the new tab. Use the document link below.");
    } catch {
      documentWindow?.close();
      setError("The headcount document could not be generated. Check the available service reports and try again.");
    } finally {
      setHeadcountLoading(null);
    }
  };

  const shareReport = async (event: React.FormEvent, service: ServiceName) => {
    event.preventDefault();
    const normalizedRecipient = recipient.trim().toLowerCase();
    const signature = `${date}|${service}|${normalizedRecipient}|${shareType}`;
    if (!emailRequest.current || emailRequest.current.signature !== signature) {
      emailRequest.current = { signature, id: crypto.randomUUID() };
    }
    setShareLoading(true);
    setShareMessage(null);
    try {
      const result = await managerRequest({
        action: "sendEmail",
        token,
        date,
        service,
        recipient: normalizedRecipient,
        reportType: shareType,
        requestId: emailRequest.current.id,
      });
      if (!result.ok) {
        setShareMessage({ kind: "error", text: result.message || "The report email could not be sent." });
        return;
      }
      setShareMessage({ kind: result.warning ? "warning" : "success", text: result.message || "Report email sent." });
      emailRequest.current = null;
      setRecipient("");
    } catch {
      setShareMessage({ kind: "error", text: "The report email could not be sent." });
    } finally {
      setShareLoading(false);
    }
  };

  if (selectedService && selected?.data) {
    const data = selected.data;
    return (
      <div className="p-4 sm:p-7 lg:p-9">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button type="button" onClick={() => setSelectedService(null)} className="mb-4 inline-flex items-center gap-2 rounded-full text-xs font-bold text-blue-700 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"><ArrowLeft className="h-4 w-4" /> All services</button>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">Full detailed report · {date}</p>
            <h3 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{selectedService}</h3>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button type="button" onClick={() => { setShareOpen((open) => !open); setShareMessage(null); }} aria-expanded={shareOpen} aria-controls="service-report-email-form" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-cyan-100 px-5 text-sm font-black text-cyan-900 transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2 sm:w-auto">
              <Mail className="h-4 w-4" /> Share by email
            </button>
            <button type="button" onClick={() => generateHeadcount(selectedService)} disabled={headcountLoading !== null} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-violet-100 px-5 text-sm font-black text-violet-950 transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
              {headcountLoading === selectedService ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />} Generate headcount
            </button>
            <button type="button" onClick={() => generateReport(selectedService)} disabled={reportLoading === selectedService} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-5 text-sm font-black text-slate-950 disabled:opacity-60 sm:w-auto">
              {reportLoading === selectedService ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Generate document
            </button>
          </div>
        </div>

        {error && <p role="alert" className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-800 ring-1 ring-inset ring-red-200">{error}</p>}
        {headcountDocument?.scope === selectedService && <HeadcountDocumentNotice document={headcountDocument} />}
        {shareOpen && <form id="service-report-email-form" onSubmit={(event) => shareReport(event, selectedService)} className="mt-5 rounded-2xl bg-cyan-50 p-4 ring-1 ring-inset ring-cyan-200 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="min-w-0 flex-1">
              <label htmlFor="report-recipient" className="text-xs font-black uppercase tracking-[0.12em] text-cyan-900">Recipient email</label>
              <input id="report-recipient" type="email" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="name@example.com" autoComplete="email" required className="mt-2 min-h-11 w-full rounded-xl border border-cyan-300 bg-white px-4 text-base text-slate-950 outline-none placeholder:text-slate-500 focus:border-cyan-700 focus:ring-2 focus:ring-cyan-200" />
            </div>
            <fieldset className="min-w-0 flex-1"><legend className="text-xs font-black uppercase tracking-[0.12em] text-cyan-900">Email content</legend><div className="mt-2 grid grid-cols-2 gap-2">
              <label className={`cursor-pointer rounded-xl p-3 ring-1 ring-inset transition ${shareType === "summary" ? "bg-cyan-100 text-cyan-950 ring-cyan-400" : "bg-white text-slate-950 ring-slate-300"}`}><input type="radio" name="report-type" value="summary" checked={shareType === "summary"} onChange={() => setShareType("summary")} className="sr-only" /><span className="block text-sm font-black">Summary</span><span className="mt-1 block text-[11px] opacity-70">Metrics and report coverage</span></label>
              <label className={`cursor-pointer rounded-xl p-3 ring-1 ring-inset transition ${shareType === "full" ? "bg-violet-100 text-violet-950 ring-violet-400" : "bg-white text-slate-950 ring-slate-300"}`}><input type="radio" name="report-type" value="full" checked={shareType === "full"} onChange={() => setShareType("full")} className="sr-only" /><span className="block text-sm font-black">Full report</span><span className="mt-1 block text-[11px] opacity-70">Details and document link</span></label>
            </div></fieldset>
            <button type="submit" disabled={shareLoading || !recipient.trim()} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-black text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600">{shareLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{shareLoading ? "Sending" : "Send email"}</button>
          </div>
          {shareMessage && <p role={shareMessage.kind === "error" ? "alert" : "status"} className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${shareMessage.kind === "success" ? "bg-emerald-100 text-emerald-900" : shareMessage.kind === "warning" ? "bg-amber-100 text-amber-950" : "bg-red-100 text-red-900"}`}>{shareMessage.text}</p>}
        </form>}
        {generatedLog?.service === selectedService && <div role="status" className={`mt-5 flex flex-col gap-3 rounded-xl p-4 text-sm font-semibold sm:flex-row sm:items-center sm:justify-between ${generatedLog.warning ? "bg-amber-100 text-amber-950" : "bg-emerald-100 text-emerald-900"}`}><span>{generatedLog.warning ? "Document generated; audit logging will retry separately." : `Document generated successfully for ${selectedService}.`}</span><a href={generatedLog.documentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-black underline underline-offset-4"><FileText className="h-4 w-4" /> Open generated document</a></div>}

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Metric label="Worshippers (+2%)" value={adjustedHeadcount(data.headcount?.grandTotal)} icon={Users} />
          <Metric label="Incidents" value={numberValue(data.incidentCount)} icon={AlertTriangle} />
          <Metric label="Today's emergency flags" value={emergencies.length} icon={ShieldCheck} />
        </div>

        <EmergencyActionQueue emergencies={emergencies} loading={emergenciesLoading} updatingId={emergencyUpdating} message={emergencyMessage} onUpdate={updateEmergency} />

        <ReportSection title="Worshipper headcount" icon={Users}>
          <div className="overflow-x-auto rounded-xl ring-1 ring-inset ring-slate-200"><table className="w-full min-w-[34rem] text-left text-sm"><thead className="bg-slate-100 text-[10px] uppercase tracking-wider text-slate-700"><tr><th className="px-4 py-3">Department</th><th className="px-4 py-3">Adults</th><th className="px-4 py-3">Children</th><th className="px-4 py-3">Total</th></tr></thead><tbody>{(data.headcount?.byDepartment || []).map((row, index) => <tr key={`${row.department}-${index}`} className="border-t border-slate-200 text-slate-800"><td className="px-4 py-3 font-semibold text-slate-950">{row.department || "Unspecified"}</td><td className="px-4 py-3">{numberValue(row.adults)}</td><td className="px-4 py-3">{numberValue(row.children)}</td><td className="px-4 py-3 font-black text-blue-800">{numberValue(row.total)}</td></tr>)}</tbody></table></div>
          {!data.headcount?.byDepartment?.length && <EmptyReport text="No department headcount was submitted." />}
        </ReportSection>

        <ReportSection title="Post ratings" icon={ClipboardList}>
          {!!data.postReporters?.length && <div className="mb-4 flex flex-wrap gap-3">{data.postReporters.map((reporter, index) => <MemberIdentityCard key={reporter.email || `${reporter.name}-${index}`} identity={reporter.identity} fallbackName={reporter.name || "Unknown reporter"} fallbackEmail={reporter.email} compact />)}</div>}
          <div className="grid gap-3 sm:grid-cols-2">{Object.entries(data.ratings || {}).map(([label, rating]) => <div key={label} className="flex items-center justify-between gap-4 rounded-xl bg-slate-100 p-4"><span className="text-sm font-semibold text-slate-800">{label}</span><span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-black text-cyan-900 ring-1 ring-inset ring-cyan-300">{String(rating)}</span></div>)}</div>
          {!Object.keys(data.ratings || {}).length && <EmptyReport text="No post ratings were submitted." />}
        </ReportSection>

        <ReportSection title={`Service timer${data.timer?.timerName ? ` · ${data.timer.timerName}` : ""}`} icon={Clock3}>
          {data.timer ? <><div className="mb-4"><MemberIdentityCard identity={data.timer.identity} fallbackName={data.timer.timerName || "Unknown timer"} fallbackEmail={data.timer.reporterEmail} /></div><p className="mb-4 text-sm font-semibold text-slate-700">{data.timer.serviceStart || "Start unavailable"} — {data.timer.serviceEnd || "End unavailable"}</p><div className="grid gap-2">{(data.timer.segments || []).map((segment, index) => <div key={`${segment.label}-${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-100 p-4"><span className="text-sm font-semibold text-slate-900">{segment.label || "Unnamed segment"}</span><span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${segment.status === "On Time" ? "bg-emerald-100 text-emerald-900 ring-emerald-300" : "bg-amber-100 text-amber-950 ring-amber-300"}`}>{segment.status || "No data"}{segment.status && segment.status !== "On Time" && segment.status !== "No data" ? ` · ${numberValue(segment.min)}m ${numberValue(segment.sec)}s` : ""}</span></div>)}</div>{data.timer.generalObservation && <Note title="Timer observation" text={data.timer.generalObservation} />}</> : <EmptyReport text="No timer log was submitted." />}
        </ReportSection>

        <ReportSection title={`Observer report${data.observer?.observerName ? ` · ${data.observer.observerName}` : ""}`} icon={Eye}>
          {data.observer ? <div className="space-y-3"><MemberIdentityCard identity={data.observer.identity} fallbackName={data.observer.observerName || "Unknown observer"} fallbackEmail={data.observer.reporterEmail} />{(data.observer.reporterRole || data.observer.reportingLocation || data.observer.postedLocation) && <Note title="Reporter details" text={[data.observer.reporterRole && `Who: ${data.observer.reporterRole}`, data.observer.postedLocation && `Posted at: ${data.observer.postedLocation}`, data.observer.reportingLocation && `Reporting locations: ${data.observer.reportingLocation}`].filter(Boolean).join("\n")} />}{Object.entries(data.observer.locationObservations || {}).map(([location, text]) => <Note key={`location-${location}`} title={`Location · ${location}`} text={text} />)}{data.observer.generalObservations && <Note title="General observations" text={data.observer.generalObservations} />}{Object.entries(data.observer.unitReports || {}).map(([unit, text]) => <Note key={unit} title={unit} text={text} />)}{data.observer.recommendations && <Note title="Recommendations" text={data.observer.recommendations} />}{data.observer.conclusion && <Note title="Conclusion" text={data.observer.conclusion} />}</div> : <EmptyReport text="No observer report was submitted." />}
        </ReportSection>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-7 lg:p-9">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-700"><Sparkles className="h-4 w-4" /> Daily command view</p>
          <h3 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">All services at a glance.</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Compare attendance, incidents and report coverage before opening any individual service.</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto">
          <label className="min-w-48 text-xs font-bold text-slate-700"><span className="mb-2 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-cyan-700" /> Report date</span><input type="date" value={date} onChange={(event) => { setDate(event.target.value); setHeadcountDocument(null); if (event.target.value) void loadAllServices(token, event.target.value); }} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-200" /></label>
          <button type="button" onClick={() => generateHeadcount("All services")} disabled={headcountLoading !== null || summary.loaded === 0} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 text-sm font-black text-white transition hover:bg-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600">
            {headcountLoading === "All services" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Generate all headcounts
          </button>
        </div>
      </div>

      {error && <p role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</p>}
      {headcountDocument?.scope === "All services" && <HeadcountDocumentNotice document={headcountDocument} />}

      <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Total worshippers (+2%)" value={summary.worshippers} icon={Users} prominent />
        <Metric label="Incidents" value={summary.incidents} icon={AlertTriangle} />
        <Metric label="Emergency flags" value={summary.emergencies} icon={ShieldCheck} />
        <Metric label="Reports loaded" value={`${summary.loaded}/${serviceNames.length}`} icon={FileText} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full bg-cyan-50 px-3 py-1.5 text-cyan-900 ring-1 ring-inset ring-cyan-200">Timer logs {summary.timerLogs}/{serviceNames.length}</span><span className="rounded-full bg-violet-50 px-3 py-1.5 text-violet-900 ring-1 ring-inset ring-violet-200">Observer logs {summary.observerLogs}/{serviceNames.length}</span><span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700 ring-1 ring-inset ring-slate-200">Headcounts include a 2% adjustment</span></div>

      <EmergencyActionQueue emergencies={emergencies} loading={emergenciesLoading} updatingId={emergencyUpdating} message={emergencyMessage} onUpdate={updateEmergency} />

      {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-cyan-700" /><span className="ml-3 text-sm font-semibold text-slate-600">Compiling every service…</span></div> : (
        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {serviceNames.map((service) => {
            const result = results.find((item) => item.service === service);
            const data = result?.data;
            const coverage = [data?.headcount?.byDepartment?.length, data?.timer, data?.observer].filter(Boolean).length;
            return <article key={service} className="flex min-h-72 flex-col rounded-2xl bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.12)]">
              <div className="flex items-center justify-between gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-800"><ClipboardList className="h-5 w-5" /></span><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ring-1 ring-inset ${data ? "bg-emerald-100 text-emerald-800 ring-emerald-300" : "bg-slate-100 text-slate-700 ring-slate-300"}`}>{data ? "Available" : "No data"}</span></div>
              <h4 className="mt-5 text-lg font-black tracking-tight text-slate-950">{service}</h4>
              <p className="mt-1 text-xs font-semibold text-slate-600">{date}</p>
              <div className="mt-5 grid grid-cols-2 gap-2"><MiniMetric label="Worshippers +2%" value={adjustedHeadcount(data?.headcount?.grandTotal)} /><MiniMetric label="Incidents" value={numberValue(data?.incidentCount)} /><MiniMetric label="Emergency" value={data?.emergencies?.length || 0} /><MiniMetric label="Coverage" value={`${coverage}/3`} /></div>
              <div className="mt-auto grid gap-2 pt-5">
                <button type="button" disabled={!data || headcountLoading !== null} onClick={() => generateHeadcount(service)} className="flex min-h-10 items-center justify-center gap-2 rounded-xl bg-violet-100 px-3 text-xs font-black text-violet-950 transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500">
                  {headcountLoading === service ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />} Headcount doc
                </button>
                <button type="button" disabled={!data} onClick={() => setSelectedService(service)} className="flex min-h-11 items-center justify-between rounded-xl bg-blue-700 px-4 text-sm font-black text-white shadow-[0_6px_16px_rgba(29,78,216,0.24)] transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-white disabled:text-slate-600 disabled:ring-1 disabled:ring-inset disabled:ring-slate-300 disabled:shadow-none">View report <ChevronRight className="h-4 w-4" /></button>
              </div>
              {!data && result?.message && <p className="mt-2 text-[10px] font-medium leading-4 text-slate-600">{result.message}</p>}
            </article>;
          })}
        </div>
      )}
    </div>
  );
}

function EmergencyActionQueue({ emergencies, loading, updatingId, message, onUpdate }: { emergencies: Emergency[]; loading: boolean; updatingId: { id: string; status: "Resolved" | "Escalated" } | null; message: { kind: "success" | "error"; text: string } | null; onUpdate: (emergency: Emergency, status: "Resolved" | "Escalated") => void }) {
  const ordered = [...emergencies].sort((left, right) => Number(right.status === "Active") - Number(left.status === "Active"));
  return <section className="mt-6 rounded-2xl bg-rose-50 p-4 ring-1 ring-inset ring-rose-200 sm:p-5" aria-labelledby="emergency-action-title">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 id="emergency-action-title" className="flex items-center gap-2 text-sm font-black text-rose-950"><AlertTriangle className="h-4 w-4" /> Today&apos;s emergency actions</h4><p className="mt-1 text-xs leading-5 text-rose-800">Account for emergencies flagged today. Previous-day flags are not shown.</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-black text-rose-900 ring-1 ring-inset ring-rose-200">{emergencies.length} flagged</span></div>
    {message && <p role={message.kind === "error" ? "alert" : "status"} className={`mt-3 rounded-xl px-3 py-2 text-xs font-bold ${message.kind === "error" ? "bg-red-100 text-red-900" : "bg-emerald-100 text-emerald-900"}`}>{message.text}</p>}
    {loading ? <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-rose-800"><Loader2 className="h-4 w-4 animate-spin" /> Loading emergency flags</p> : ordered.length ? <div className="mt-4 grid gap-3">{ordered.map((emergency, index) => {
      const active = !emergency.status || emergency.status === "Active" || emergency.status === "Open";
      const busy = emergency.id === updatingId?.id;
      const statusTone = emergency.status === "Resolved" ? "bg-emerald-100 text-emerald-900" : emergency.status === "Escalated" ? "bg-amber-100 text-amber-950" : "bg-rose-100 text-rose-900";
      return <article key={emergency.id || `${emergency.location}-${index}`} className="rounded-xl bg-white p-4 shadow-[0_6px_18px_rgba(127,29,29,0.08)]"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0 flex-1 [overflow-wrap:anywhere]"><p className="font-black text-slate-950">{emergency.location || "Location not provided"}</p><p className="mt-1 text-sm leading-5 text-slate-700">{emergency.description || "No description provided."}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${statusTone}`}>{emergency.status || "Active"}</span></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><MemberIdentityCard identity={emergency.identity} fallbackName={emergency.reportedBy || "Unknown reporter"} fallbackEmail={emergency.reporterEmail} compact />{emergency.submittedAt && <span className="text-xs font-semibold text-slate-500">{new Date(emergency.submittedAt).toLocaleString()}</span>}</div>{active && emergency.id && <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2"><button type="button" disabled={busy} onClick={() => onUpdate(emergency, "Resolved")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-xs font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60">{busy && updatingId?.status === "Resolved" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {busy && updatingId?.status === "Resolved" ? "Resolving" : "Mark resolved"}</button><button type="button" disabled={busy} onClick={() => onUpdate(emergency, "Escalated")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-xs font-black text-amber-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60">{busy && updatingId?.status === "Escalated" ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />} {busy && updatingId?.status === "Escalated" ? "Escalating" : "Escalate"}</button></div>}</article>;
    })}</div> : <p className="mt-4 rounded-xl bg-white p-3 text-sm font-semibold text-slate-700">No emergency has been flagged today.</p>}
  </section>;
}

function HeadcountDocumentNotice({ document }: { document: { scope: string; url: string; services: string[]; message?: string; warning?: string } }) {
  return <div role="status" className={`mt-5 flex flex-col gap-3 rounded-xl p-4 text-sm sm:flex-row sm:items-center sm:justify-between ${document.warning ? "bg-amber-100 text-amber-950" : "bg-violet-100 text-violet-950"}`}>
    <div><p className="font-black">Headcount document generated</p><p className="mt-1 text-xs font-semibold">{document.message || `${document.services.length} service${document.services.length === 1 ? "" : "s"} included.`}</p></div>
    <a href={document.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 font-black text-white transition hover:bg-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-700 focus-visible:ring-offset-2"><FileText className="h-4 w-4" /> Open Google Doc</a>
  </div>;
}

function Metric({ label, value, icon: Icon, prominent = false }: { label: string; value: number | string; icon: typeof Users; prominent?: boolean }) {
  return <div className={`rounded-2xl p-4 sm:p-5 ${prominent ? "bg-cyan-100 text-cyan-950" : "bg-slate-100 text-slate-950"}`}><div className="flex items-center justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-80">{label}</p><Icon className={`h-4 w-4 ${prominent ? "text-cyan-800" : "text-blue-700"}`} /></div><p className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">{value}</p></div>;
}

function MiniMetric({ label, value }: { label: string; value: number | string }) {
  const tone = label === "Worshippers" ? "bg-cyan-100 text-cyan-950" : label === "Incidents" ? "bg-amber-100 text-amber-950" : label === "Emergency" ? "bg-rose-100 text-rose-950" : "bg-violet-100 text-violet-950";
  return <div className={`rounded-xl p-3 ${tone}`}><p className="text-lg font-black">{value}</p><p className="mt-0.5 text-[9px] font-black uppercase tracking-wider opacity-80">{label}</p></div>;
}

function ReportSection({ title, icon: Icon, danger = false, children }: { title: string; icon: typeof Users; danger?: boolean; children: React.ReactNode }) {
  return <section className={`mt-7 rounded-2xl p-4 sm:p-6 ${danger ? "bg-red-50 ring-1 ring-inset ring-red-200" : "bg-white shadow-[0_10px_30px_rgba(15,23,42,0.08)]"}`}><h4 className={`mb-5 flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] ${danger ? "text-red-900" : "text-cyan-800"}`}><Icon className="h-4 w-4" />{title}</h4>{children}</section>;
}

function Note({ title, text }: { title: string; text: string }) {
  return <div className="rounded-xl bg-slate-100 p-4"><p className="text-xs font-black text-slate-950">{title}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{text}</p></div>;
}

function EmptyReport({ text }: { text: string }) {
  return <p className="flex items-center gap-2 rounded-xl bg-slate-100 p-4 text-sm font-medium text-slate-700"><CheckCircle2 className="h-4 w-4 text-slate-500" />{text}</p>;
}
