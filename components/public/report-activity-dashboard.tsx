"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarRange, FileText, Loader2, RefreshCcw, Search, UsersRound, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ActivityUser = { name: string; email: string; total: number; lastSubmittedAt: string; reportTypes: Record<string, number> };
type Range = { from: string; to: string };

function currentMonth(): Range {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  return { from: `${local.slice(0, 8)}01`, to: local };
}

export function ReportActivityDashboard() {
  const defaults = useMemo(currentMonth, []);
  const [users, setUsers] = useState<ActivityUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Range>(defaults);
  const [range, setRange] = useState<Range>(defaults);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams(range);
      const response = await fetch(`/api/admin/report-activity?${query}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Report activity could not be loaded.");
      setUsers(data.users || []);
    } catch (error) { toast.error((error as Error).message); }
    finally { setLoading(false); }
  }, [range]);
  useEffect(() => { void load(); }, [load]);
  const visible = useMemo(() => { const query = search.trim().toLowerCase(); return query ? users.filter((user) => `${user.name} ${user.email} ${Object.keys(user.reportTypes).join(" ")}`.toLowerCase().includes(query)) : users; }, [search, users]);
  const totalReports = users.reduce((sum, user) => sum + user.total, 0);
  const reportTypes = new Set(users.flatMap((user) => Object.keys(user.reportTypes))).size;
  const invalid = Boolean(draft.from && draft.to && draft.from > draft.to);
  const label = range.from || range.to ? `${range.from || "Beginning"} → ${range.to || "Today"}` : "All dates";
  function apply(event: FormEvent) { event.preventDefault(); if (!invalid) setRange(draft); }
  function showAll() { const empty = { from: "", to: "" }; setDraft(empty); setRange(empty); }

  return <div className="min-w-0 overflow-hidden rounded-2xl bg-[#07152f] text-white shadow-[0_24px_70px_-32px_rgba(2,6,23,.72)]">
    <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.2),transparent_38%),linear-gradient(125deg,#07152f,#25184f_68%,#4a1460)] p-5 sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-cyan-300">Admin intelligence</p><h2 className="mt-3 text-3xl font-black tracking-[-.04em] sm:text-5xl">Report activity</h2><p className="mt-3 max-w-xl text-sm leading-6 text-white/60">See who is reporting, how often, and through which QC tool. Every total follows the selected date range.</p></div><div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10"><Metric value={users.length} label="Reporters" /><Metric value={totalReports} label="Reports" /><Metric value={reportTypes} label="Tool types" /></div></div>
    </div>
    <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="h-fit rounded-2xl border border-white/10 bg-white/[.05] p-4 lg:sticky lg:top-28"><div className="flex items-center gap-2 text-sm font-bold"><CalendarRange className="h-4 w-4 text-cyan-300" />Reporting period</div><p className="mt-2 text-xs leading-5 text-white/45">Current month is selected by default.</p><form onSubmit={apply} className="mt-4 space-y-4"><div className="space-y-2"><Label htmlFor="activity-from" className="text-white/70">From</Label><Input id="activity-from" type="date" value={draft.from} onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))} className="border-white/10 bg-black/20 text-white" /></div><div className="space-y-2"><Label htmlFor="activity-to" className="text-white/70">To</Label><Input id="activity-to" type="date" value={draft.to} onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))} className="border-white/10 bg-black/20 text-white" /></div>{invalid && <p role="alert" className="text-xs font-semibold text-red-300">Start date must be before end date.</p>}<Button type="submit" variant="gradient" className="w-full" disabled={invalid || loading}>Apply dates</Button><Button type="button" variant="ghost" className="w-full text-white/65 hover:bg-white/10 hover:text-white" onClick={showAll}><X className="mr-2 h-4 w-4" />Show all dates</Button></form></aside>
      <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[.04]"><div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold">Reporter ledger</p><p className="mt-1 text-xs text-white/45">{label}</p></div><div className="flex gap-2"><div className="relative min-w-0 flex-1 sm:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people or report types" className="border-white/10 bg-black/20 pl-9 text-white placeholder:text-white/30" /></div><Button size="icon" variant="ghost" aria-label="Refresh" onClick={load} disabled={loading} className="text-white hover:bg-white/10"><RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button></div></div>{loading ? <div className="grid min-h-64 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-cyan-300" /></div> : visible.length ? <div className="divide-y divide-white/10">{visible.map((user) => <article key={user.email || user.name} className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-center"><div className="flex min-w-0 items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-300"><UsersRound className="h-5 w-5" /></span><div className="min-w-0"><h3 className="truncate font-bold">{user.name}</h3>{user.email && <p className="truncate text-xs text-white/45">{user.email}</p>}<p className="mt-1 text-[11px] text-white/35">Last report {user.lastSubmittedAt ? new Date(user.lastSubmittedAt).toLocaleString("en-NG") : "unavailable"}</p></div></div><div className="flex flex-wrap gap-2">{Object.entries(user.reportTypes).map(([type, count]) => <Badge key={type} variant="outline" className="border-white/15 bg-white/[.04] text-white/70"><FileText className="mr-1 h-3 w-3" />{type} · {count}</Badge>)}</div><div className="text-left xl:min-w-20 xl:text-right"><p className="text-2xl font-black text-cyan-300">{user.total}</p><p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Total filed</p></div></article>)}</div> : <div className="grid min-h-64 place-items-center p-8 text-center"><div><UsersRound className="mx-auto h-8 w-8 text-white/25" /><p className="mt-3 font-semibold">No activity in this view</p><p className="mt-1 text-sm text-white/40">Change the dates or search term.</p></div></div>}</section>
    </div>
  </div>;
}

function Metric({ value, label }: { value: number; label: string }) { return <div className="min-w-24 bg-black/25 px-4 py-4 sm:min-w-28"><p className="text-2xl font-black">{value}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-white/40">{label}</p></div>; }
