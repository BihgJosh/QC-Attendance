"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Clock3, ExternalLink, FileSpreadsheet, Loader2, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AuditMatrix = {
  generatedAt: string;
  members: string[];
  columns: Array<{ key: string; date: string; service: string; label: string }>;
  rows: Array<{ memberName: string; times: string[] }>;
  approvedCount: number;
};

export function AttendanceAudit() {
  const [matrix, setMatrix] = useState<AuditMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setSheetUrl("");
    try {
      const response = await fetch("/api/admin/attendance-audit", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "The audit preview could not be loaded.");
      setMatrix(data);
    } catch (error) {
      setMatrix(null);
      toast.error(error instanceof Error ? error.message : "The audit preview could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadPreview(); }, [loadPreview]);

  const generateSheet = async () => {
    setGenerating(true);
    setSheetUrl("");
    try {
      const response = await fetch("/api/admin/attendance-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "The audit sheet could not be generated.");
      const url = new URL(String(data.url));
      if (url.protocol !== "https:" || url.hostname !== "docs.google.com") throw new Error("The sheet link returned by the server was invalid.");
      setSheetUrl(url.toString());
      toast.success(`${data.title || "Attendance Audit"} updated for ${data.memberCount} members across ${data.serviceCount} services.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The audit sheet could not be generated.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section aria-labelledby="attendance-audit-title" className="space-y-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 id="attendance-audit-title" className="text-2xl font-bold tracking-tight sm:text-3xl">Attendance audit</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Every registered member appears vertically. Each Sunday since launch is a dated column, and an approved check-in shows the earliest recorded attendance time.</p>
        </div>
        <Button type="button" variant="gradient" className="min-h-11 shrink-0" onClick={generateSheet} disabled={generating || loading || !matrix}>
          {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
          {generating ? "Updating sheet" : "Generate audit sheet"}
        </Button>
      </div>

      <Card variant="glass">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-5 w-5 text-primary" />Sunday attendance only</CardTitle>
              <CardDescription className="mt-1">From the first live Sunday on 19 July 2026. Thursday, special-service and incorrectly dated Sunday records are excluded.</CardDescription>
            </div>
            <Button type="button" variant="outline" className="min-h-11" onClick={loadPreview} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh preview</Button>
          </div>
        </CardHeader>
      </Card>

      {sheetUrl && <div role="status" className="flex flex-col gap-3 rounded-2xl border border-emerald-300/40 bg-emerald-500/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="font-medium text-emerald-800 dark:text-emerald-200">The dated attendance report tab is updated and ready.</span><a href={sheetUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 font-bold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"><ExternalLink className="h-4 w-4" />Open Google Sheet</a></div>}

      <Card variant="glass" className="overflow-hidden">
        <CardHeader className="border-b border-border/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><CardTitle>Matrix preview</CardTitle><CardDescription className="mt-1">Blank cells mean no approved attendance was recorded for that service.</CardDescription></div>
            {matrix && <div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5"><Users className="h-3.5 w-3.5" />{matrix.members.length} members</span><span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5"><CalendarDays className="h-3.5 w-3.5" />{matrix.columns.length} services</span><span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5"><Clock3 className="h-3.5 w-3.5" />{matrix.approvedCount} check-ins</span></div>}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />Building the audit matrix…</div> : !matrix ? <div className="min-h-64 p-8 text-center text-sm text-muted-foreground">The preview is unavailable. Adjust the filters and try again.</div> : matrix.columns.length === 0 ? <div className="min-h-64 p-8 text-center"><FileSpreadsheet className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-semibold">No service records in this range</p><p className="mt-1 text-sm text-muted-foreground">Choose a wider date range to populate the audit columns.</p></div> : <div className="max-h-[34rem] overflow-auto">
            <table className="w-max min-w-full border-collapse text-sm">
              <thead className="sticky top-0 z-20 bg-background shadow-sm"><tr><th rowSpan={2} className="sticky left-0 z-30 min-w-56 border-b border-r border-border bg-background px-4 py-3 text-left font-bold">Member name</th>{matrix.columns.map((column) => <th key={column.key} className="min-w-32 border-b border-r border-border bg-primary/5 px-3 py-2 text-center text-xs font-bold">{column.label}</th>)}</tr><tr>{matrix.columns.map((column) => <th key={column.key} className="border-b border-r border-border bg-primary/5 px-3 py-2 text-center text-[11px] font-medium text-muted-foreground">{column.service}</th>)}</tr></thead>
              <tbody>{matrix.rows.map((row) => <tr key={row.memberName} className="even:bg-muted/25 hover:bg-primary/[0.04]"><th scope="row" className="sticky left-0 z-10 border-b border-r border-border bg-background px-4 py-3 text-left font-medium shadow-[5px_0_8px_-8px_rgba(15,23,42,.5)]">{row.memberName}</th>{row.times.map((time, index) => <td key={matrix.columns[index].key} className="border-b border-r border-border px-3 py-3 text-center text-xs"><span className={time ? "font-semibold text-emerald-700 dark:text-emerald-300" : "text-muted-foreground/35"}>{time || "—"}</span></td>)}</tr>)}</tbody>
            </table>
          </div>}
        </CardContent>
      </Card>
    </section>
  );
}
