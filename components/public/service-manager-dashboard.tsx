"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Eye,
  FileSpreadsheet,
  FileText,
  Loader2,
  LockKeyhole,
  Mail,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

const SERVICES = ["1st Service", "2nd Service", "3rd Service", "4th Service", "Thursday Service"] as const;
type ServiceName = (typeof SERVICES)[number];

type HeadcountRow = { department?: string; adults?: number; children?: number; total?: number };
type Emergency = { location?: string; description?: string; reportedBy?: string; submittedAt?: string; status?: string };
type TimerSegment = { label?: string; status?: string; min?: number; sec?: number };
type DashboardData = {
  headcount?: { grandTotal?: number; byDepartment?: HeadcountRow[] };
  incidentCount?: number;
  emergencies?: Emergency[];
  ratings?: Record<string, string | number>;
  timer?: { timerName?: string; serviceStart?: string; serviceEnd?: string; segments?: TimerSegment[]; generalObservation?: string } | null;
  observer?: { observerName?: string; generalObservations?: string; unitReports?: Record<string, string>; recommendations?: string; conclusion?: string } | null;
};

type ServiceResult = { service: ServiceName; data: DashboardData | null; message?: string };

function abujaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function managerRequest(body: Record<string, string>) {
  const response = await fetch("/api/service-manager", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json() as Promise<{
    ok: boolean;
    message?: string;
    data?: DashboardData;
    url?: string;
    workbookUrl?: string;
    logRecordId?: string;
    emailLogId?: string;
  }>;
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function ServiceManagerDashboard() {
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [date, setDate] = useState(abujaToday);
  const [loading, setLoading] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<ServiceResult[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceName | null>(null);
  const [reportLoading, setReportLoading] = useState<ServiceName | null>(null);
  const [generatedLog, setGeneratedLog] = useState<{ service: ServiceName; workbookUrl: string; recordId: string } | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [shareType, setShareType] = useState<"summary" | "full">("summary");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareMessage, setShareMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const summaryRequest = useRef(0);
  const emailRequest = useRef<{ signature: string; id: string } | null>(null);

  const loadAllServices = async (accessToken: string, selectedDate: string) => {
    const requestId = ++summaryRequest.current;
    setLoading(true);
    setError("");
    setSelectedService(null);
    try {
      const responses = await Promise.all(
        SERVICES.map(async (service): Promise<ServiceResult> => {
          try {
            const result = await managerRequest({ action: "getDashboard", token: accessToken, date: selectedDate, service });
            return { service, data: result.ok ? result.data || null : null, message: result.message };
          } catch {
            return { service, data: null, message: "Could not load this service." };
          }
        }),
      );
      if (requestId === summaryRequest.current) setResults(responses);
    } catch {
      if (requestId === summaryRequest.current) setError("The service summary could not be loaded. Try again.");
    } finally {
      if (requestId === summaryRequest.current) setLoading(false);
    }
  };

  const unlock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password.trim()) return;
    setUnlocking(true);
    setError("");
    try {
      const result = await managerRequest({ action: "checkPassword", token: password });
      if (!result.ok) {
        setError("That password is not recognised.");
        return;
      }
      const accessToken = password;
      setToken(accessToken);
      setPassword("");
      await loadAllServices(accessToken, date);
    } catch {
      setError("The manager workspace could not be unlocked. Try again.");
    } finally {
      setUnlocking(false);
    }
  };

  const summary = useMemo(() => {
    return results.reduce(
      (total, result) => {
        const data = result.data;
        if (!data) return total;
        total.worshippers += numberValue(data.headcount?.grandTotal);
        total.incidents += numberValue(data.incidentCount);
        total.emergencies += data.emergencies?.length || 0;
        total.loaded += 1;
        if (data.timer) total.timerLogs += 1;
        if (data.observer) total.observerLogs += 1;
        return total;
      },
      { worshippers: 0, incidents: 0, emergencies: 0, loaded: 0, timerLogs: 0, observerLogs: 0 },
    );
  }, [results]);

  const selected = results.find((result) => result.service === selectedService);

  const generateReport = async (service: ServiceName) => {
    const reportWindow = window.open("about:blank", "_blank");
    if (reportWindow) reportWindow.opener = null;
    setReportLoading(service);
    setError("");
    setGeneratedLog(null);
    try {
      const result = await managerRequest({ action: "generateReport", token, date, service });
      if (!result.ok || !result.url) {
        reportWindow?.close();
        setError(result.message || "The report document could not be generated.");
        return;
      }
      const reportUrl = new URL(result.url);
      if (reportUrl.protocol !== "https:") throw new Error("Unsafe report URL");
      if (result.workbookUrl && result.logRecordId) {
        const workbookUrl = new URL(result.workbookUrl);
        if (workbookUrl.protocol !== "https:" || workbookUrl.hostname !== "docs.google.com") throw new Error("Unsafe workbook URL");
        setGeneratedLog({ service, workbookUrl: workbookUrl.toString(), recordId: String(result.logRecordId) });
      }
      if (reportWindow) reportWindow.location.href = reportUrl.toString();
      else setError("The report is ready, but the browser blocked the new tab. Allow pop-ups and try again.");
    } catch {
      reportWindow?.close();
      setError("The report document could not be generated.");
    } finally {
      setReportLoading(null);
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
      setShareMessage({ kind: "success", text: result.message || "Report email sent." });
      emailRequest.current = null;
      setRecipient("");
    } catch {
      setShareMessage({ kind: "error", text: "The report email could not be sent." });
    } finally {
      setShareLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="relative overflow-hidden p-5 sm:p-8 lg:p-10">
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-fuchsia-200/35 blur-3xl" />
        <div className="relative mx-auto max-w-lg py-4 sm:py-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50 text-cyan-700 shadow-lg shadow-cyan-900/10"><LockKeyhole className="h-6 w-6" /></div>
          <p className="mt-5 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-700">Leadership access</p>
          <h3 className="mt-2 text-center text-3xl font-bold tracking-tight text-slate-950">Service Manager</h3>
          <p className="mx-auto mt-3 max-w-md text-center text-sm leading-6 text-slate-600">Unlock the daily command view to compare every Sunday and Thursday service at a glance.</p>
          <form onSubmit={unlock} className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
            <label htmlFor="manager-password" className="text-xs font-bold text-slate-700">Manager password</label>
            <input id="manager-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" className="mt-2 min-h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200" placeholder="Enter password" />
            {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={unlocking || !password.trim()} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-5 text-sm font-black text-slate-950 shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
              {unlocking ? <><Loader2 className="h-4 w-4 animate-spin" /> Checking access</> : <>Open service summary <ChevronRight className="h-4 w-4" /></>}
            </button>
          </form>
        </div>
      </div>
    );
  }

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
            <button type="button" onClick={() => { setShareOpen((open) => !open); setShareMessage(null); }} aria-expanded={shareOpen} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-cyan-100 px-5 text-sm font-black text-cyan-900 transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2 sm:w-auto">
              <Mail className="h-4 w-4" /> Share by email
            </button>
            <button type="button" onClick={() => generateReport(selectedService)} disabled={reportLoading === selectedService} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-5 text-sm font-black text-slate-950 disabled:opacity-60 sm:w-auto">
              {reportLoading === selectedService ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Generate document
            </button>
          </div>
        </div>

        {error && <p role="alert" className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-800 ring-1 ring-inset ring-red-200">{error}</p>}
        {shareOpen && <form onSubmit={(event) => shareReport(event, selectedService)} className="mt-5 rounded-2xl bg-cyan-50 p-4 ring-1 ring-inset ring-cyan-200 sm:p-5">
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
          {shareMessage && <p role={shareMessage.kind === "error" ? "alert" : "status"} className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${shareMessage.kind === "success" ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-900"}`}>{shareMessage.text}</p>}
        </form>}
        {generatedLog?.service === selectedService && <div role="status" className="mt-5 flex flex-col gap-3 rounded-xl bg-emerald-100 p-4 text-sm font-semibold text-emerald-900 sm:flex-row sm:items-center sm:justify-between"><span>Document generated and logged under {selectedService}.</span><a href={generatedLog.workbookUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-black text-emerald-950 underline decoration-emerald-600 underline-offset-4"><FileSpreadsheet className="h-4 w-4" /> Open service workbook</a></div>}

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Metric label="Worshippers" value={numberValue(data.headcount?.grandTotal)} icon={Users} />
          <Metric label="Incidents" value={numberValue(data.incidentCount)} icon={AlertTriangle} />
          <Metric label="Emergency flags" value={data.emergencies?.length || 0} icon={ShieldCheck} />
        </div>

        {!!data.emergencies?.length && <ReportSection title="Emergency flags" icon={AlertTriangle} danger>{data.emergencies.map((item, index) => <div key={`${item.location}-${index}`} className="rounded-xl bg-red-100 p-4"><p className="font-bold text-red-950">{item.location || "Location not provided"}</p><p className="mt-1 text-sm leading-6 text-red-900">{item.description || "No description"}</p><p className="mt-2 text-xs font-medium text-red-800">{item.reportedBy || "Unknown reporter"} · {item.submittedAt || "Time unavailable"} · {item.status || "Status unavailable"}</p></div>)}</ReportSection>}

        <ReportSection title="Worshipper headcount" icon={Users}>
          <div className="overflow-x-auto rounded-xl ring-1 ring-inset ring-slate-200"><table className="w-full min-w-[34rem] text-left text-sm"><thead className="bg-slate-100 text-[10px] uppercase tracking-wider text-slate-700"><tr><th className="px-4 py-3">Department</th><th className="px-4 py-3">Adults</th><th className="px-4 py-3">Children</th><th className="px-4 py-3">Total</th></tr></thead><tbody>{(data.headcount?.byDepartment || []).map((row, index) => <tr key={`${row.department}-${index}`} className="border-t border-slate-200 text-slate-800"><td className="px-4 py-3 font-semibold text-slate-950">{row.department || "Unspecified"}</td><td className="px-4 py-3">{numberValue(row.adults)}</td><td className="px-4 py-3">{numberValue(row.children)}</td><td className="px-4 py-3 font-black text-blue-800">{numberValue(row.total)}</td></tr>)}</tbody></table></div>
          {!data.headcount?.byDepartment?.length && <EmptyReport text="No department headcount was submitted." />}
        </ReportSection>

        <ReportSection title="Post ratings" icon={ClipboardList}>
          <div className="grid gap-3 sm:grid-cols-2">{Object.entries(data.ratings || {}).map(([label, rating]) => <div key={label} className="flex items-center justify-between gap-4 rounded-xl bg-slate-100 p-4"><span className="text-sm font-semibold text-slate-800">{label}</span><span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-black text-cyan-900 ring-1 ring-inset ring-cyan-300">{String(rating)}</span></div>)}</div>
          {!Object.keys(data.ratings || {}).length && <EmptyReport text="No post ratings were submitted." />}
        </ReportSection>

        <ReportSection title={`Service timer${data.timer?.timerName ? ` · ${data.timer.timerName}` : ""}`} icon={Clock3}>
          {data.timer ? <><p className="mb-4 text-sm font-semibold text-slate-700">{data.timer.serviceStart || "Start unavailable"} — {data.timer.serviceEnd || "End unavailable"}</p><div className="grid gap-2">{(data.timer.segments || []).map((segment, index) => <div key={`${segment.label}-${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-100 p-4"><span className="text-sm font-semibold text-slate-900">{segment.label || "Unnamed segment"}</span><span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${segment.status === "On Time" ? "bg-emerald-100 text-emerald-900 ring-emerald-300" : "bg-amber-100 text-amber-950 ring-amber-300"}`}>{segment.status || "No data"}{segment.status && segment.status !== "On Time" && segment.status !== "No data" ? ` · ${numberValue(segment.min)}m ${numberValue(segment.sec)}s` : ""}</span></div>)}</div>{data.timer.generalObservation && <Note title="Timer observation" text={data.timer.generalObservation} />}</> : <EmptyReport text="No timer log was submitted." />}
        </ReportSection>

        <ReportSection title={`Observer report${data.observer?.observerName ? ` · ${data.observer.observerName}` : ""}`} icon={Eye}>
          {data.observer ? <div className="space-y-3">{data.observer.generalObservations && <Note title="General observations" text={data.observer.generalObservations} />}{Object.entries(data.observer.unitReports || {}).map(([unit, text]) => <Note key={unit} title={unit} text={text} />)}{data.observer.recommendations && <Note title="Recommendations" text={data.observer.recommendations} />}{data.observer.conclusion && <Note title="Conclusion" text={data.observer.conclusion} />}</div> : <EmptyReport text="No observer report was submitted." />}
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
        <label className="min-w-48 text-xs font-bold text-slate-700"><span className="mb-2 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-cyan-700" /> Report date</span><input type="date" value={date} onChange={(event) => { setDate(event.target.value); if (event.target.value) void loadAllServices(token, event.target.value); }} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-200" /></label>
      </div>

      {error && <p role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</p>}

      <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Total worshippers" value={summary.worshippers} icon={Users} prominent />
        <Metric label="Incidents" value={summary.incidents} icon={AlertTriangle} />
        <Metric label="Emergency flags" value={summary.emergencies} icon={ShieldCheck} />
        <Metric label="Reports loaded" value={`${summary.loaded}/${SERVICES.length}`} icon={FileText} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full bg-cyan-50 px-3 py-1.5 text-cyan-900 ring-1 ring-inset ring-cyan-200">Timer logs {summary.timerLogs}/{SERVICES.length}</span><span className="rounded-full bg-violet-50 px-3 py-1.5 text-violet-900 ring-1 ring-inset ring-violet-200">Observer logs {summary.observerLogs}/{SERVICES.length}</span></div>

      {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-cyan-700" /><span className="ml-3 text-sm font-semibold text-slate-600">Compiling every service…</span></div> : (
        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {SERVICES.map((service) => {
            const result = results.find((item) => item.service === service);
            const data = result?.data;
            const coverage = [data?.headcount?.byDepartment?.length, data?.timer, data?.observer].filter(Boolean).length;
            return <article key={service} className="flex min-h-72 flex-col rounded-2xl bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.12)]">
              <div className="flex items-center justify-between gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-800"><ClipboardList className="h-5 w-5" /></span><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ring-1 ring-inset ${data ? "bg-emerald-100 text-emerald-800 ring-emerald-300" : "bg-slate-100 text-slate-700 ring-slate-300"}`}>{data ? "Available" : "No data"}</span></div>
              <h4 className="mt-5 text-lg font-black tracking-tight text-slate-950">{service}</h4>
              <p className="mt-1 text-xs font-semibold text-slate-600">{date}</p>
              <div className="mt-5 grid grid-cols-2 gap-2"><MiniMetric label="Worshippers" value={numberValue(data?.headcount?.grandTotal)} /><MiniMetric label="Incidents" value={numberValue(data?.incidentCount)} /><MiniMetric label="Emergency" value={data?.emergencies?.length || 0} /><MiniMetric label="Coverage" value={`${coverage}/3`} /></div>
              <button type="button" disabled={!data} onClick={() => setSelectedService(service)} className="mt-auto flex min-h-11 items-center justify-between rounded-xl bg-blue-700 px-4 text-sm font-black text-white shadow-[0_6px_16px_rgba(29,78,216,0.24)] transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-white disabled:text-slate-600 disabled:ring-1 disabled:ring-inset disabled:ring-slate-300 disabled:shadow-none">View report <ChevronRight className="h-4 w-4" /></button>
              {!data && result?.message && <p className="mt-2 text-[10px] font-medium leading-4 text-slate-600">{result.message}</p>}
            </article>;
          })}
        </div>
      )}
    </div>
  );
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
