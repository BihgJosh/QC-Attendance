"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { EmptyState } from "@/components/ui/empty-state";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { CustomSelect } from "@/components/ui/custom-select";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, Lock, Unlock, Settings,
  Search, Loader2, ShieldCheck, Clock, MapPin, Users,
  TrendingUp, ChevronLeft, ChevronRight, ArrowUp, ArrowDown,
  Download, CalendarIcon, SlidersHorizontal,
  KeyRound, LayoutDashboard, UserCog, FileSpreadsheet,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ContentManager } from "@/components/admin/content-manager";
import { MemberPasswordManager } from "@/components/admin/member-password-manager";
import { AdminAccessManager } from "@/components/admin/admin-access-manager";
import { RoleManager } from "@/components/admin/role-manager";
import { AttendanceAudit } from "@/components/admin/attendance-audit";

interface Settings {
  churchLat: string;
  churchLng: string;
  allowedRadius: string;
}

interface AttendanceRecord {
  date: string;
  service: string;
  memberName: string;
  time: string;
  latitude: string;
  longitude: string;
  distance: string;
  status: string;
  reason: string;
  browser: string;
  device: string;
}

type SortField = "memberName" | "time" | "distance" | "date";
type SortDir = "asc" | "desc";

function attendanceDateKey(value: string) {
  const trimmed = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) return trimmed;

  const displayDate = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (!displayDate) return "";
  const [, day, month, year] = displayDate;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [searchApproved, setSearchApproved] = useState("");
  const [searchRejected, setSearchRejected] = useState("");
  const [pageApproved, setPageApproved] = useState(1);
  const [pageRejected, setPageRejected] = useState(1);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [adminView, setAdminView] = useState<"operations" | "audit" | "passwords" | "access" | "roles">("operations");

  /* ---------- Sort state ---------- */
  const [sortField, setSortField] = useState<SortField>("time");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  /* ---------- Date range filter ---------- */
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  /* ---------- Service filter ---------- */
  const [serviceFilter, setServiceFilter] = useState<string>("All");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, recordsRes, settingsRes] = await Promise.all([
        fetch("/api/admin/status"),
        fetch("/api/admin/attendance"),
        fetch("/api/admin/settings"),
      ]);

      if (statusRes.ok) setIsOpen((await statusRes.json()).isOpen);
      if (recordsRes.ok) setRecords(await recordsRes.json());
      if (settingsRes.ok) setSettings(await settingsRes.json());
    } catch {
      toast.error("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ---------- Keyboard shortcuts ---------- */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "o" || e.key === "O") {
        e.preventDefault();
        if (!confirmToggle) setConfirmToggle(true);
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        toast.info("Refreshing dashboard...");
        fetchData();
      } else if (e.key === "Escape") {
        setConfirmToggle(false);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [confirmToggle, fetchData]);

  /* ---------- Sort ---------- */
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  // Parse a 12-hour time string like "6:30 AM" / "12:05 PM" into minutes since midnight.
  const timeToMinutes = (t: string) => {
    const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i.exec((t || "").trim());
    if (!m) return Number.MAX_SAFE_INTEGER; // unparseable times sort last
    let hours = parseInt(m[1], 10) % 12;
    const minutes = parseInt(m[2], 10);
    const seconds = m[3] ? parseInt(m[3], 10) : 0;
    if (/PM/i.test(m[4])) hours += 12;
    return hours * 3600 + minutes * 60 + seconds;
  };

  const sortRecords = (list: AttendanceRecord[]) => {
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "memberName") cmp = a.memberName.localeCompare(b.memberName);
      else if (sortField === "time") cmp = timeToMinutes(a.time) - timeToMinutes(b.time);
      else if (sortField === "distance") cmp = parseFloat(a.distance || "0") - parseFloat(b.distance || "0");
      else if (sortField === "date") cmp = attendanceDateKey(a.date).localeCompare(attendanceDateKey(b.date));
      return sortDir === "asc" ? cmp : -cmp;
    });
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? (
      <ArrowUp className="w-3 h-3 ml-1 inline" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1 inline" />
    );
  };

  const toggleStatus = async () => {
    setTogglingStatus(true);
    try {
      const res = await fetch("/api/admin/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOpen: !isOpen }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      setIsOpen(!isOpen);
      toast.success(`Attendance is now ${!isOpen ? "OPEN" : "CLOSED"}`);
    } catch {
      toast.error("Failed to update status.");
    } finally {
      setTogglingStatus(false);
      setConfirmToggle(false);
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      toast.success("Settings updated successfully.");
      fetchData();
    } catch {
      toast.error("Failed to save settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  /* ---------- Date range filter ---------- */
  const filterByDate = (list: AttendanceRecord[]) => {
    if (!dateFrom && !dateTo) return list;
    return list.filter((r) => {
      const recordDate = attendanceDateKey(r.date);
      if (!recordDate) return false;
      if (dateFrom && recordDate < dateFrom) return false;
      if (dateTo && recordDate > dateTo) return false;
      return true;
    });
  };

  const invalidDateRange = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  /* ---------- Data processing ---------- */
  let approved = records.filter((r) => r.status === "Approved");
  let rejected = records.filter((r) => r.status === "Rejected");

  /* Service filter */
  if (serviceFilter !== "All") {
    const matchesService = (value: string) => serviceFilter === "Other" ? value === "Other" || value.startsWith("Other — ") : value === serviceFilter;
    approved = approved.filter((r) => matchesService(r.service));
    rejected = rejected.filter((r) => matchesService(r.service));
  }

  approved = invalidDateRange ? [] : filterByDate(approved);
  rejected = invalidDateRange ? [] : filterByDate(rejected);

  const approvalRate = (approved.length + rejected.length) > 0
    ? Math.round((approved.length / (approved.length + rejected.length)) * 100)
    : 0;

  /* Search */
  const filteredApproved = approved.filter((r) =>
    r.memberName.toLowerCase().includes(searchApproved.toLowerCase())
  );
  const filteredRejected = rejected.filter((r) =>
    r.memberName.toLowerCase().includes(searchRejected.toLowerCase())
  );

  /* Sort */
  const sortedApproved = sortRecords(filteredApproved);
  const sortedRejected = sortRecords(filteredRejected);

  /* Pagination */
  const itemsPerPage = 6;
  const paginatedApproved = sortedApproved.slice(
    (pageApproved - 1) * itemsPerPage,
    pageApproved * itemsPerPage
  );
  const paginatedRejected = sortedRejected.slice(
    (pageRejected - 1) * itemsPerPage,
    pageRejected * itemsPerPage
  );

  /* ---------- Export CSV ---------- */
  const downloadCSV = (data: AttendanceRecord[], label: string) => {
    if (data.length === 0) {
      toast.error(`No ${label.toLowerCase()} records to export.`);
      return;
    }
    const headers = ["Date", "Service", "Member Name", "Time", "Latitude", "Longitude", "Distance (m)", "Status", "Reason", "Browser", "Device"];
    const rows = data.map((r) => [
      r.date, r.service, r.memberName, r.time,
      r.latitude, r.longitude, r.distance, r.status,
      r.reason, r.browser, r.device,
    ]);
    const escape = (c: string) => `"${String(c ?? "").replace(/"/g, '""')}"`;
    const csv = [headers.join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qcu-${label.toLowerCase()}-attendance-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${label} attendance exported (${data.length} record${data.length === 1 ? "" : "s"}).`);
  };

  const exportApproved = () => downloadCSV(sortedApproved, "Approved");
  const exportRejected = () => downloadCSV(sortedRejected, "Rejected");
  const exportAll = () => downloadCSV([...sortedApproved, ...sortedRejected], "All");

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen relative z-10">
      {/* Keyboard shortcut hints */}
      <div className="sr-only" aria-live="polite" role="status">
        Keyboard shortcuts: O to toggle attendance, R to refresh, Escape to cancel.
      </div>

      {/* Top Navigation */}
      <header className="sticky top-0 z-50 glass border-b border-border/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" aria-label="Go to homepage" className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <div className="w-9 h-9 rounded-xl glass-card flex items-center justify-center overflow-hidden dark:bg-white/10">
              <Image
                src="/soja-logo.jpeg"
                alt="SoJ"
                width={28}
                height={28}
                className="rounded-lg object-cover dark:brightness-[1.1] dark:contrast-[1.1]"
              />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold font-display leading-tight">QCU Dashboard</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Streams of Joy</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-[10px] text-muted-foreground/50 uppercase tracking-wider mr-1">
              <kbd className="px-1 py-0.5 rounded bg-muted/50 text-[9px] font-mono">O</kbd> toggle&nbsp;
              <kbd className="px-1 py-0.5 rounded bg-muted/50 text-[9px] font-mono">R</kbd> refresh
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="border-b border-border/40 bg-background/75 backdrop-blur">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8" role="tablist" aria-label="Admin sections">
          <Button type="button" size="sm" variant={adminView === "operations" ? "gradient" : "ghost"} role="tab" aria-selected={adminView === "operations"} onClick={() => setAdminView("operations")}><LayoutDashboard className="mr-2 h-4 w-4" />Operations</Button>
          <Button type="button" size="sm" variant={adminView === "audit" ? "gradient" : "ghost"} role="tab" aria-selected={adminView === "audit"} onClick={() => setAdminView("audit")}><FileSpreadsheet className="mr-2 h-4 w-4" />Attendance audit</Button>
          <Button type="button" size="sm" variant={adminView === "passwords" ? "gradient" : "ghost"} role="tab" aria-selected={adminView === "passwords"} onClick={() => setAdminView("passwords")}><KeyRound className="mr-2 h-4 w-4" />Password resets</Button>
          <Button type="button" size="sm" variant={adminView === "access" ? "gradient" : "ghost"} role="tab" aria-selected={adminView === "access"} onClick={() => setAdminView("access")}><UserCog className="mr-2 h-4 w-4" />Admin access</Button>
          <Button type="button" size="sm" variant={adminView === "roles" ? "gradient" : "ghost"} role="tab" aria-selected={adminView === "roles"} onClick={() => setAdminView("roles")}><ShieldCheck className="mr-2 h-4 w-4" />Role manager</Button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {adminView === "audit" ? <AttendanceAudit /> : adminView === "passwords" ? <MemberPasswordManager /> : adminView === "access" ? <AdminAccessManager /> : adminView === "roles" ? <RoleManager /> : <>
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card variant="glass" className="h-full">
              <CardContent className="pt-6 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Attendance Status</p>
                  {isOpen ? (
                    <Badge variant="success" className="text-sm px-3 py-1">OPEN</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-sm px-3 py-1">CLOSED</Badge>
                  )}
                </div>
                <div className={`p-3 rounded-2xl ${isOpen ? "bg-success/10" : "bg-destructive/10"}`}>
                  {isOpen ? <Unlock className="w-6 h-6 text-success" /> : <Lock className="w-6 h-6 text-destructive" />}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card variant="glass" className="h-full">
              <CardContent className="pt-6 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Approved</p>
                  <h3 className="text-3xl font-bold font-display">
                    <AnimatedCounter value={approved.length} />
                  </h3>
                </div>
                <div className="p-3 rounded-2xl bg-success/10">
                  <CheckCircle2 className="w-6 h-6 text-success" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card variant="glass" className="h-full">
              <CardContent className="pt-6 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Rejected</p>
                  <h3 className="text-3xl font-bold font-display">
                    <AnimatedCounter value={rejected.length} />
                  </h3>
                </div>
                <div className="p-3 rounded-2xl bg-destructive/10">
                  <XCircle className="w-6 h-6 text-destructive" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card variant="glass" className="h-full">
              <CardContent className="pt-6 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Approval Rate</p>
                  <h3 className="text-3xl font-bold font-display">
                    <AnimatedCounter value={approvalRate} />%
                  </h3>
                </div>
                <div className="p-3 rounded-2xl bg-primary/10">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Control & Settings */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Attendance Control */}
          <Card variant="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                Attendance Control
              </CardTitle>
              <CardDescription>Open or close attendance checking globally.</CardDescription>
            </CardHeader>
            <CardContent>
              <AnimatePresence mode="wait">
                {confirmToggle ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="space-y-3"
                  >
                    <p className="text-sm text-muted-foreground text-center">
                      Are you sure you want to {isOpen ? "close" : "open"} attendance?
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant={isOpen ? "destructive" : "gradient"}
                        className="flex-1"
                        onClick={toggleStatus}
                        disabled={togglingStatus}
                      >
                        {togglingStatus ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Confirm
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={() => setConfirmToggle(false)}>
                        Cancel
                      </Button>
                    </div>
                    <p className="text-[10px] text-center text-muted-foreground/50">
                      Press <kbd className="px-1 py-0.5 rounded bg-muted/50 text-[9px] font-mono">Esc</kbd> to cancel
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <Button
                      variant={isOpen ? "destructive" : "gradient"}
                      className="w-full h-12 text-base font-semibold"
                      onClick={() => setConfirmToggle(true)}
                    >
                      {isOpen ? <Lock className="w-5 h-5 mr-2" /> : <Unlock className="w-5 h-5 mr-2" />}
                      {isOpen ? "Close Attendance" : "Open Attendance"}
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground/50 mt-2">
                      Press <kbd className="px-1 py-0.5 rounded bg-muted/50 text-[9px] font-mono">O</kbd> to toggle
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-4 flex items-center justify-center">
                <div className={`relative w-3 h-3 rounded-full ${isOpen ? "bg-success" : "bg-destructive"}`}>
                  {isOpen && (
                    <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-75" />
                  )}
                </div>
                <span className="ml-2 text-xs text-muted-foreground">
                  {isOpen ? "Live — accepting check-ins" : "Inactive — no check-ins accepted"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Settings Form */}
          <Card variant="glass" className="lg:col-span-2" id="settings">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-accent" />
                Geofence Configuration
              </CardTitle>
              <CardDescription>Configure the Abuja church coordinates and allowed radius. Attendance dates use Abuja WAT.</CardDescription>
            </CardHeader>
            <CardContent>
              {settings && (
                <form onSubmit={saveSettings} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lat" className="text-xs uppercase tracking-wide text-muted-foreground">Abuja Church Latitude</Label>
                    <Input
                      id="lat"
                      value={settings.churchLat}
                      onChange={e => setSettings({ ...settings, churchLat: e.target.value })}
                      required
                      placeholder="e.g. 6.5244"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lng" className="text-xs uppercase tracking-wide text-muted-foreground">Abuja Church Longitude</Label>
                    <Input
                      id="lng"
                      value={settings.churchLng}
                      onChange={e => setSettings({ ...settings, churchLng: e.target.value })}
                      required
                      placeholder="e.g. 3.3792"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="radius" className="text-xs uppercase tracking-wide text-muted-foreground">Allowed Radius (meters)</Label>
                    <Input
                      id="radius"
                      type="number"
                      value={settings.allowedRadius}
                      onChange={e => setSettings({ ...settings, allowedRadius: e.target.value })}
                      required
                      placeholder="e.g. 100"
                    />
                  </div>
                  <div className="md:col-span-2 flex items-end gap-3">
                    <Button type="submit" variant="gradient" disabled={savingSettings} className="h-12">
                      {savingSettings ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Save Settings
                    </Button>
                    <Button type="button" variant="glass" className="h-12" onClick={exportAll}>
                      <Download className="w-4 h-4 mr-2" />
                      Export All
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        <ContentManager />

        {/* Filters — Service + Date Range */}
        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CalendarIcon className="w-4 h-4 text-muted-foreground" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-4">
              {/* Service filter */}
              <div className="space-y-1.5">
                <Label htmlFor="attendance-service-filter" className="text-[10px] uppercase tracking-wide text-muted-foreground">Service</Label>
                <CustomSelect
                  id="attendance-service-filter"
                  ariaLabel="Filter by service"
                  options={[
                    { value: "All", label: "All Services" },
                    { value: "Sunday", label: "Sunday" },
                    { value: "Thursday", label: "Thursday" },
                    { value: "Other", label: "Other" },
                  ]}
                  value={serviceFilter}
                  onChange={(v) => { setServiceFilter(v); setPageApproved(1); setPageRejected(1); }}
                  placeholder="All Services"
                  size="sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dateFrom" className="text-[10px] uppercase tracking-wide text-muted-foreground">From</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  aria-invalid={invalidDateRange}
                  onChange={(e) => { setDateFrom(e.target.value); setPageApproved(1); setPageRejected(1); }}
                  className="h-9 text-xs w-40"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dateTo" className="text-[10px] uppercase tracking-wide text-muted-foreground">To</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  aria-invalid={invalidDateRange}
                  onChange={(e) => { setDateTo(e.target.value); setPageApproved(1); setPageRejected(1); }}
                  className="h-9 text-xs w-40"
                />
              </div>
              {(serviceFilter !== "All" || dateFrom || dateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-xs"
                  onClick={() => { setServiceFilter("All"); setDateFrom(""); setDateTo(""); setPageApproved(1); setPageRejected(1); }}
                >
                  Clear filters
                </Button>
              )}
            </div>
            {invalidDateRange && (
              <p className="mt-3 text-xs font-medium text-destructive" role="alert">
                The From date must be on or before the To date.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Approved Table */}
          <Card variant="glass">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-success">
                  <CheckCircle2 className="w-4 h-4" />
                  Approved Attendance
                </CardTitle>
                <CardDescription className="mt-1">Members inside the geofence</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="glass"
                  size="sm"
                  className="h-9 gap-2 text-success shrink-0"
                  onClick={exportApproved}
                  disabled={sortedApproved.length === 0}
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
                <div className="relative w-28 sm:w-40">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/50" />
                  <Input
                    placeholder="Search..."
                    className="pl-9 h-9 text-xs"
                    value={searchApproved}
                    onChange={e => { setSearchApproved(e.target.value); setPageApproved(1); }}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("memberName")}>
                      Name <SortIcon field="memberName" />
                    </TableHead>
                    <TableHead className="cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("time")}>
                      Time <SortIcon field="time" />
                    </TableHead>
                    <TableHead className="cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("distance")}>
                      Distance <SortIcon field="distance" />
                    </TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedApproved.length > 0 ? paginatedApproved.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.memberName}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center text-muted-foreground">
                          <Clock className="w-3 h-3 mr-1" />{r.time}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center text-muted-foreground">
                          <MapPin className="w-3 h-3 mr-1" />{r.distance}m
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="success" className="text-xs">Approved</Badge>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={4} className="p-0">
                        <EmptyState
                          icon={Users}
                          title="No approved attendance yet"
                          description="As members check in from within the geofence, approved records will appear here."
                          actionLabel="Configure Geofence"
                          actionHref="#settings"
                          action={() => document.getElementById("settings")?.scrollIntoView({ behavior: "smooth" })}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <Pagination page={pageApproved} setPage={setPageApproved} total={filteredApproved.length} itemsPerPage={itemsPerPage} />
            </CardContent>
          </Card>

          {/* Rejected Table */}
          <Card variant="glass">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <XCircle className="w-4 h-4" />
                  Rejected Attendance
                </CardTitle>
                <CardDescription className="mt-1">Members outside geofence or invalid</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="glass"
                  size="sm"
                  className="h-9 gap-2 text-destructive shrink-0"
                  onClick={exportRejected}
                  disabled={sortedRejected.length === 0}
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
                <div className="relative w-28 sm:w-40">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/50" />
                  <Input
                    placeholder="Search..."
                    className="pl-9 h-9 text-xs"
                    value={searchRejected}
                    onChange={e => { setSearchRejected(e.target.value); setPageRejected(1); }}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("memberName")}>
                      Name <SortIcon field="memberName" />
                    </TableHead>
                    <TableHead className="cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("time")}>
                      Time <SortIcon field="time" />
                    </TableHead>
                    <TableHead className="cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("distance")}>
                      Distance <SortIcon field="distance" />
                    </TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRejected.length > 0 ? paginatedRejected.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.memberName}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center text-muted-foreground">
                          <Clock className="w-3 h-3 mr-1" />{r.time}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center text-muted-foreground">
                          <MapPin className="w-3 h-3 mr-1" />{r.distance}m
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate" title={r.reason}>{r.reason}</TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="text-xs">Rejected</Badge>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} className="p-0">
                        <EmptyState
                          icon={XCircle}
                          title="No rejected attendance"
                          description="No out-of-bounds check-in attempts have been recorded. The geofence is working correctly."
                          actionLabel="Review Settings"
                          actionHref="#settings"
                          action={() => document.getElementById("settings")?.scrollIntoView({ behavior: "smooth" })}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <Pagination page={pageRejected} setPage={setPageRejected} total={filteredRejected.length} itemsPerPage={itemsPerPage} />
            </CardContent>
          </Card>
        </div>
        </>}
      </main>
    </div>
  );
}

function Pagination({ page, setPage, total, itemsPerPage }: { page: number, setPage: (p: number) => void, total: number, itemsPerPage: number }) {
  const totalPages = Math.ceil(total / itemsPerPage);
  if (totalPages === 0) return null;
  return (
    <div className="flex items-center justify-between py-4">
      <span className="text-xs text-muted-foreground">
        {total} {total === 1 ? "record" : "records"}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-xs text-muted-foreground min-w-[60px] text-center">Page {page} of {totalPages}</span>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
