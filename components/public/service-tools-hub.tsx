"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Eye,
  Menu,
  ShieldCheck,
  X,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ServiceManagerDashboard } from "@/components/public/service-manager-dashboard";
import { ServiceToolForm } from "@/components/public/service-tool-forms";
import { ReportActivityDashboard } from "@/components/public/report-activity-dashboard";

const tools = [
  {
    id: "post-report",
    eyebrow: "Post-level reporting",
    title: "Service Post",
    shortTitle: "Post report",
    description: "Capture headcount, standards, incidents and observations for one assigned service area.",
    icon: ClipboardCheck,
    href: "/service-tools?tool=post-report#workflow",
    tone: "cyan",
    details: [
      "Date, service, observer and assigned area",
      "Adult and children headcount",
      "Preparedness, neatness, orderliness and conduct ratings",
      "Church-guideline compliance and overall coordination",
      "What went well, improvements and recommendations",
      "Leadership incidents and specialist children/teens notes",
    ],
    outcome: "Produces the post-level evidence used in the compiled service report.",
  },
  {
    id: "timer",
    eyebrow: "Program timing",
    title: "Service Timer",
    shortTitle: "Timer",
    description: "Track each program segment against schedule and record the size of every deviation.",
    icon: Clock3,
    href: "/service-tools?tool=timer#workflow",
    tone: "purple",
    details: [
      "Service date, service number and timer name",
      "Actual service start and end times",
      "On-time, early or late status per program segment",
      "Minutes and seconds for each timing variance",
      "Optional extra segment for unscheduled moments",
      "Closing observation on the service timeline",
    ],
    outcome: "Creates a segment-by-segment timing log for leadership review.",
  },
  {
    id: "observer",
    eyebrow: "Roving quality review",
    title: "Observer Report",
    shortTitle: "Observer",
    description: "Write one structured report across every location and unit visited during the service.",
    icon: Eye,
    href: "/service-tools?tool=observer#workflow",
    tone: "blue",
    details: [
      "Service date, service number and observer name",
      "Select multiple reporting locations",
      "Separate written observation for each selected location",
      "General atmosphere and whole-service observations",
      "Select every unit covered during the review",
      "Separate written observation for each selected unit",
      "Shared recommendations, conclusion and commendations",
    ],
    outcome: "Consolidates a roving observer’s findings into one leadership-ready record.",
  },
  {
    id: "emergency",
    eyebrow: "Urgent incident channel",
    title: "Emergency Flag",
    shortTitle: "Emergency",
    description: "Raise an urgent incident immediately with a precise location and short description.",
    icon: AlertTriangle,
    href: "/service-tools?tool=emergency#workflow",
    tone: "red",
    details: [
      "Reporter’s name",
      "Exact location of the incident",
      "Concise description of what is happening",
      "Immediate submission to the emergency feed",
      "Visible alert for connected QC service tools",
      "Incident status included in the leadership dashboard",
    ],
    outcome: "Signals a time-sensitive issue without waiting for the end-of-service report.",
  },
  {
    id: "report-activity",
    eyebrow: "Admin intelligence · restricted",
    title: "Report Activity",
    shortTitle: "Activity",
    description: "Explore who submitted reports, submission frequency and tool usage across a selected date range.",
    icon: Activity,
    href: "/service-tools?tool=report-activity#workflow",
    tone: "emerald",
    details: [
      "Current-month and custom date-range analysis",
      "Reporter totals and last submission time",
      "Breakdown by Service Post, Timer, Observer and Emergency tools",
      "Instant search by name, email or report type",
      "All-time view and live refresh",
      "Restricted to Admin and Super Admin roles",
    ],
    outcome: "Gives administrators an interactive accountability view of QC reporting activity.",
  },
  {
    id: "manager",
    eyebrow: "Leadership · restricted",
    title: "Service Manager",
    shortTitle: "Manager",
    description: "Review the compiled service picture and generate a draft leadership report.",
    icon: BarChart3,
    href: "/service-tools?tool=manager#workflow",
    tone: "slate",
    details: [
      "Role-based leadership access from the active posting schedule",
      "Filter by date and specific service",
      "Combined worshipper headcount by department",
      "Post ratings, timer status and observer notes",
      "Emergency flags and leadership incidents",
      "Generate and open the draft report document",
    ],
    outcome: "Turns individual submissions into a single operational view for QC leadership.",
  },
] as const;

type ToolId = (typeof tools)[number]["id"];

const toneClasses = {
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-700",
  purple: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  red: "border-red-200 bg-red-50 text-red-700",
  slate: "border-slate-200 bg-slate-100 text-slate-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export function ServiceToolsHub({ canViewServiceManager, canViewFinalHeadcount, canViewReportActivity }: { canViewServiceManager: boolean; canViewFinalHeadcount: boolean; canViewReportActivity: boolean }) {
  const [activeId, setActiveId] = useState<ToolId | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const availableTools = tools.filter((tool) => (tool.id !== "manager" || canViewServiceManager) && (tool.id !== "report-activity" || canViewReportActivity));
  const activeTool = availableTools.find((tool) => tool.id === activeId);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tool") as ToolId | null;
    if (requested && availableTools.some((tool) => tool.id === requested)) setActiveId(requested);
  }, [canViewServiceManager, canViewReportActivity]);

  const showManager = () => {
    setActiveId("manager");
    window.history.replaceState(null, "", "/service-tools?tool=manager#workflow");
    window.requestAnimationFrame(() => document.getElementById("workflow")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const selectTool = (toolId: ToolId) => {
    setActiveId(toolId);
    window.history.replaceState(null, "", `/service-tools?tool=${toolId}#workflow`);
  };

  return (
    <main className="relative z-10 min-h-screen overflow-x-hidden pb-20">
      <header className="safe-top-nav fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-5">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-2 rounded-2xl border border-cyan-200/10 bg-[linear-gradient(110deg,rgba(2,12,32,0.96),rgba(26,20,69,0.95)_58%,rgba(74,20,96,0.94))] px-3 py-2.5 text-white shadow-2xl shadow-slate-950/20 backdrop-blur-xl sm:px-5" aria-label="Service tools navigation">
          <Link href="/" aria-label="Go to homepage" className="flex min-w-0 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:gap-3">
            <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm">
              <Image src="/soja-logo.jpeg" alt="" width={40} height={40} className="h-full w-full object-cover" priority />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-xs font-bold tracking-tight sm:text-sm">Quality Control Unit</span>
              <span className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/60 min-[360px]:block">Service tools</span>
            </span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            <Link href="/" className="rounded-full px-4 py-2 text-sm font-medium text-white/65 transition hover:bg-white/10 hover:text-white">Home</Link>
            <a href="#tools" className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white">Service Tools</a>
            <a href="#workflow" className="rounded-full px-4 py-2 text-sm font-medium text-white/65 transition hover:bg-white/10 hover:text-white">Workflow guide</a>
          </div>

          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <button type="button" className="flex h-10 w-10 items-center justify-center rounded-xl text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 md:hidden" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="service-tools-mobile-menu" onClick={() => setMenuOpen((value) => !value)}>
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>
        {menuOpen && (
          <div id="service-tools-mobile-menu" className="mx-auto mt-2 max-w-7xl rounded-2xl border border-cyan-200/10 bg-[linear-gradient(145deg,rgba(2,12,32,0.98),rgba(74,20,96,0.96))] p-2 text-white shadow-2xl md:hidden">
            <Link href="/" onClick={() => setMenuOpen(false)} className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/10">Home <ArrowLeft className="h-4 w-4" /></Link>
            <a href="#tools" onClick={() => setMenuOpen(false)} className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/10">Service tools <ChevronRight className="h-4 w-4" /></a>
            <a href="#workflow" onClick={() => setMenuOpen(false)} className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/10">Workflow guide <ChevronRight className="h-4 w-4" /></a>
          </div>
        )}
      </header>

      <section id="tools" className="scroll-mt-24 px-4 pb-12 pt-32 sm:px-6 sm:pb-16 sm:pt-36 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary"><ShieldCheck className="h-4 w-4" /> Choose your assignment</p>
            <h2 className="mt-4 text-3xl font-bold tracking-[-0.04em] sm:text-5xl">The right tool for every QC role.</h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground sm:text-base">{canViewServiceManager ? "Reporting tools capture live service data, while Service Manager compiles every service into one leadership summary here." : "Use your assigned reporting tools to capture accurate live service data."}</p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {availableTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <article key={tool.id} className={`group flex min-h-64 flex-col rounded-2xl border p-5 shadow-[var(--surface-shadow)] transition-[border-color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:-translate-y-0.5 hover:shadow-[var(--surface-shadow-raised)] ${tool.id === "emergency" ? "border-red-300/30 bg-red-500/[0.05]" : "border-border/70 bg-card/80"}`}>
                  <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${toneClasses[tool.tone]}`}><Icon className="h-5 w-5" /></div>
                  <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{tool.eyebrow}</p>
                  <h3 className="mt-2 text-xl font-bold tracking-tight">{tool.title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">{tool.description}</p>
                  {tool.id === "manager" ? <button type="button" onClick={showManager} className="mt-5 flex min-h-11 w-full items-center justify-between rounded-2xl border border-border/70 px-4 text-sm font-bold transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Open service summary <ChevronRight className="h-4 w-4 text-primary" /></button> : <a href={tool.href} className="mt-5 flex min-h-11 items-center justify-between rounded-2xl border border-border/70 px-4 text-sm font-bold transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    {tool.id === "emergency" ? "Report now" : "Open live form"}<ArrowRight className="h-4 w-4 text-primary" />
                  </a>}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="workflow" className="scroll-mt-24 px-4 pb-16 sm:px-6 sm:pb-24 lg:px-8">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.28)]">
          <div className="border-b border-slate-200 bg-[linear-gradient(120deg,#f8fbff_0%,#eefcff_52%,#faf5ff_100%)] px-5 py-6 sm:px-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Workflow guide</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Know what each submission captures.</h2>
          </div>
          <div className="grid min-w-0 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <div className="flex min-w-0 gap-2 overflow-x-auto border-b border-slate-200 bg-slate-50/80 p-3 lg:block lg:border-b-0 lg:border-r lg:p-4">
              {availableTools.map((tool) => {
                const Icon = tool.icon;
                const active = tool.id === activeId;
                return (
                  <button key={tool.id} type="button" onClick={() => selectTool(tool.id)} className={`flex min-h-12 min-w-max items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 lg:mb-1 lg:w-full ${active ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/10" : "text-cyan-950/65 hover:bg-white hover:text-cyan-950"}`} aria-pressed={active}>
                    <Icon className={`h-4 w-4 ${active ? "text-white" : "text-slate-400"}`} />{tool.shortTitle}<ChevronRight className="ml-auto hidden h-4 w-4 lg:block" />
                  </button>
                );
              })}
            </div>
            {!activeTool ? (
              <div className="flex min-h-80 min-w-0 items-center justify-center p-6 text-center sm:p-10" role="status">
                <div className="max-w-md">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700"><ClipboardCheck className="h-5 w-5" /></span>
                  <h3 className="mt-5 text-xl font-bold tracking-tight text-slate-950">Select a tool to continue</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Choose a tool from the workflow menu to view its guide and open the form.</p>
                </div>
              </div>
            ) : activeTool.id === "manager" ? <motion.div key="manager" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="min-w-0"><ServiceManagerDashboard canViewFinalHeadcount={canViewFinalHeadcount} /></motion.div> : activeTool.id === "report-activity" ? <motion.div key="report-activity" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="min-w-0 p-3 sm:p-5"><ReportActivityDashboard /></motion.div> : <motion.div key={activeTool.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="min-w-0"><ServiceToolForm tool={activeTool.id} /></motion.div>}
          </div>
        </div>
      </section>
    </main>
  );
}
