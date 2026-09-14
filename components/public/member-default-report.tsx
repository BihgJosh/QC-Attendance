"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, RefreshCcw, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STANDARD_SERVICE_REPORTS } from "@/lib/service-report-services";

type Member = { name: string; email: string };
type Report = { id: string; service_date: string; service: string; member_name: string; member_email: string; category: string; observed_time: string; details: string; member_informed: boolean; member_response?: string; immediate_action: string; severity: string; witnesses?: string; is_repeat: boolean; recommended_follow_up?: string; reporter_name: string; reporter_role: string; status: string; review_notes?: string; created_at: string };
const inputClass = "border-slate-300 bg-white text-slate-950";
function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }

export function MemberDefaultReport({ canReview }: { canReview: boolean }) {
  const [members, setMembers] = useState<Member[]>([]), [reports, setReports] = useState<Report[]>([]), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [search, setSearch] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const load = useCallback(async () => { setLoading(true); try { const response = await fetch("/api/member-defaults", { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setMembers(data.members || []); setReports(data.reports || []); } catch (error) { toast.error((error as Error).message || "The form could not be loaded."); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const visibleReports = useMemo(() => { const query = search.trim().toLowerCase(); return query ? reports.filter((report) => `${report.member_name} ${report.category} ${report.status}`.toLowerCase().includes(query)) : reports; }, [reports, search]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = Object.fromEntries(form.entries()) as Record<string, unknown>;
    payload.requestId = requestId; payload.memberInformed = form.get("memberInformed") === "yes"; payload.isRepeat = form.get("isRepeat") === "yes";
    try { const response = await fetch("/api/member-defaults", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); toast.success("Member default report filed."); formElement.reset(); setRequestId(crypto.randomUUID()); if (canReview) await load(); }
    catch (error) { toast.error((error as Error).message || "Report could not be filed."); } finally { setSaving(false); }
  }

  async function update(report: Report, status: string) {
    const reviewNotes = window.prompt("Review note (optional)", report.review_notes || ""); if (reviewNotes === null) return;
    try { const response = await fetch("/api/member-defaults", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: report.id, status, reviewNotes }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); toast.success(`Report marked ${status.toLowerCase()}.`); await load(); } catch (error) { toast.error((error as Error).message); }
  }

  return <div className="p-4 sm:p-7">
    <div className="max-w-3xl"><p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-700">Accountability record</p><h2 className="mt-2 text-3xl font-bold tracking-[-.04em]">Member default report</h2><p className="mt-3 text-sm leading-6 text-slate-600">Record only what was directly observed. The member and reporter identities are tied to official Team Data.</p></div>
    {loading ? <div className="grid min-h-56 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-cyan-600" /></div> : <>
      <form onSubmit={submit} className="mt-7 grid gap-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2 sm:p-6">
        <Field label="Service date" htmlFor="default-service-date"><Input id="default-service-date" type="date" value={today()} readOnly aria-readonly="true" className={`${inputClass} bg-slate-100`} /></Field>
        <Field label="Service" htmlFor="default-service"><select required id="default-service" name="service" defaultValue="" className="h-12 w-full rounded-[10px] border border-slate-300 bg-white px-4 text-base text-slate-950"><option value="" disabled>Select service</option>{STANDARD_SERVICE_REPORTS.map((service) => <option key={service} value={service}>{service}</option>)}</select></Field>
        <Field label="Member" htmlFor="default-member"><Input required id="default-member" name="memberName" list="default-member-suggestions" autoComplete="off" placeholder="Start typing a member's name" maxLength={160} className={inputClass} /><datalist id="default-member-suggestions">{members.map((member) => <option key={member.email} value={member.name} />)}</datalist></Field>
        <Field label="Category" htmlFor="default-category"><select required id="default-category" name="category" defaultValue="Uniform" className="h-12 w-full rounded-[10px] border border-slate-300 bg-white px-4 text-base text-slate-950"><option>Uniform</option><option>Behaviour</option><option>Duty</option></select></Field>
        <Field label="Time observed" htmlFor="default-time"><Input required id="default-time" name="observedTime" type="time" className={inputClass} /></Field>
        <Field label="Severity" htmlFor="default-severity"><select required id="default-severity" name="severity" className="h-12 w-full rounded-[10px] border border-slate-300 bg-white px-4 text-base text-slate-950"><option>Minor</option><option>Moderate</option><option>Serious</option></select></Field>
        <Field label="Factual description" htmlFor="default-details" wide><textarea required id="default-details" name="details" minLength={5} maxLength={2000} rows={4} className={`${inputClass} w-full rounded-[10px] border px-4 py-3 text-base`} placeholder="State what happened without assumptions or labels." /></Field>
        <Field label="Was the member informed?" htmlFor="default-informed"><select id="default-informed" name="memberInformed" className="h-12 w-full rounded-[10px] border border-slate-300 bg-white px-4 text-base text-slate-950"><option value="yes">Yes</option><option value="no">No</option></select></Field>
        <Field label="Repeat default?" htmlFor="default-repeat"><select id="default-repeat" name="isRepeat" className="h-12 w-full rounded-[10px] border border-slate-300 bg-white px-4 text-base text-slate-950"><option value="no">No</option><option value="yes">Yes</option></select></Field>
        <Field label="Member response" htmlFor="default-response"><textarea id="default-response" name="memberResponse" maxLength={1000} rows={3} className={`${inputClass} w-full rounded-[10px] border px-4 py-3 text-base`} /></Field>
        <Field label="Immediate action taken" htmlFor="default-action"><textarea required id="default-action" name="immediateAction" maxLength={1000} rows={3} className={`${inputClass} w-full rounded-[10px] border px-4 py-3 text-base`} /></Field>
        <Field label="Witnesses" htmlFor="default-witnesses"><Input id="default-witnesses" name="witnesses" maxLength={500} className={inputClass} placeholder="Names, if any" /></Field>
        <Field label="Recommended follow-up" htmlFor="default-follow-up"><textarea id="default-follow-up" name="recommendedFollowUp" maxLength={1000} rows={3} className={`${inputClass} w-full rounded-[10px] border px-4 py-3 text-base`} /></Field>
        <div className="sm:col-span-2"><Button type="submit" variant="gradient" disabled={saving} className="min-h-11 w-full sm:w-auto">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}File report</Button></div>
      </form>
      {canReview && <section className="mt-9"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-purple-700">Admin review</p><h3 className="mt-1 text-2xl font-bold">Filed reports</h3></div><div className="flex gap-2"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reports" className={`${inputClass} pl-9`} /></div><Button type="button" size="icon" variant="outline" onClick={load} aria-label="Refresh reports"><RefreshCcw className="h-4 w-4" /></Button></div></div><div className="mt-4 space-y-3">{visibleReports.map((report) => <article key={report.id} className="rounded-2xl border border-slate-200 p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-bold">{report.member_name} · {report.category}</p><p className="mt-1 text-sm text-slate-600">{report.service_date} · {report.service} · {report.observed_time}</p></div><span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{report.status}</span></div><p className="mt-3 text-sm leading-6">{report.details}</p><p className="mt-2 text-xs text-slate-500">{report.severity} · filed by {report.reporter_name}</p><div className="mt-4 flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => update(report, "Reviewed")}>Mark reviewed</Button><Button type="button" size="sm" onClick={() => update(report, "Resolved")}><CheckCircle2 className="mr-2 h-4 w-4" />Resolve</Button></div></article>)}{!visibleReports.length && <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No reports in this view.</p>}</div></section>}
    </>}
  </div>;
}

function Field({ label, htmlFor, wide, children }: { label: string; htmlFor: string; wide?: boolean; children: React.ReactNode }) { return <div className={`space-y-2 ${wide ? "sm:col-span-2" : ""}`}><Label htmlFor={htmlFor}>{label}</Label>{children}</div>; }
