"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Eye,
  Menu,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { ServiceManagerDashboard } from "@/components/public/service-manager-dashboard";

const SUITE_URL = "/qc-tools";

const tools = [
  {
    id: "post-report",
    eyebrow: "Post-level reporting",
    title: "Service Post",
    shortTitle: "Post report",
    description: "Capture headcount, standards, incidents and observations for one assigned service area.",
    icon: ClipboardCheck,
    href: `${SUITE_URL}/post-report`,
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
    href: `${SUITE_URL}/timer`,
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
    description: "Write one structured report across every unit visited during the service.",
    icon: Eye,
    href: `${SUITE_URL}/observer`,
    tone: "blue",
    details: [
      "Service date, service number and observer name",
      "General atmosphere and whole-service observations",
      "Select every unit covered during the review",
      "Separate written observation for each selected unit",
      "Recommendations for corrective action",
      "Conclusion and commendations for strong performance",
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
    href: `${SUITE_URL}/emergency`,
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
    id: "manager",
    eyebrow: "Leadership · restricted",
    title: "Service Manager",
    shortTitle: "Manager",
    description: "Review the compiled service picture and generate a draft leadership report.",
    icon: BarChart3,
    href: "/service-tools?tool=manager#workflow",
    tone: "slate",
    details: [
      "Password-protected leadership access",
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
};

export function ServiceToolsHub() {
  const [activeId, setActiveId] = useState<ToolId>("post-report");
  const [menuOpen, setMenuOpen] = useState(false);
  const activeTool = tools.find((tool) => tool.id === activeId) || tools[0];
  const ActiveIcon = activeTool.icon;

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tool") === "manager") {
      setActiveId("manager");
    }
  }, []);

  const showManager = () => {
    setActiveId("manager");
    window.history.replaceState(null, "", "/service-tools?tool=manager#workflow");
    window.requestAnimationFrame(() => document.getElementById("workflow")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const selectTool = (toolId: ToolId) => {
    if (toolId === "manager") {
      showManager();
      return;
    }
    setActiveId(toolId);
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
            <button type="button" className="flex h-10 w-10 items-center justify-center rounded-xl text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 md:hidden" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>
        {menuOpen && (
          <div className="mx-auto mt-2 max-w-7xl rounded-2xl border border-cyan-200/10 bg-[linear-gradient(145deg,rgba(2,12,32,0.98),rgba(74,20,96,0.96))] p-2 text-white shadow-2xl md:hidden">
            <Link href="/" onClick={() => setMenuOpen(false)} className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/10">Home <ArrowLeft className="h-4 w-4" /></Link>
            <a href="#tools" onClick={() => setMenuOpen(false)} className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/10">Service tools <ChevronRight className="h-4 w-4" /></a>
            <a href="#workflow" onClick={() => setMenuOpen(false)} className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/10">Workflow guide <ChevronRight className="h-4 w-4" /></a>
          </div>
        )}
      </header>

      <section className="relative overflow-hidden bg-[linear-gradient(125deg,#020c20_0%,#111b44_52%,#4a1460_100%)] px-4 pb-20 pt-32 text-white sm:px-6 sm:pb-24 sm:pt-40 lg:px-8">
        <div className="absolute -right-24 top-10 h-80 w-80 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-end gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-cyan-200"><Sparkles className="h-4 w-4" /> Live service operations</p>
            <h1 className="mt-5 max-w-4xl text-[clamp(3rem,8vw,6.5rem)] font-bold leading-[0.9] tracking-[-0.06em]">One service.<br /><span className="text-cyan-300">One clear record.</span></h1>
            <p className="mt-7 max-w-2xl text-base leading-7 text-white/65 sm:text-lg">Report what happened at your post, protect the service timeline, record cross-unit observations and escalate urgent incidents from one organised QC workspace.</p>
          </motion.div>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 shadow-2xl sm:grid-cols-3 lg:grid-cols-2">
            {[{ value: "05", label: "connected tools" }, { value: "01", label: "leadership view" }, { value: "WAT", label: "Abuja service time" }, { value: "LIVE", label: "existing suite" }].map((item) => (
              <div key={item.label} className="bg-slate-950/55 p-5 backdrop-blur-xl sm:p-6">
                <p className="text-2xl font-black tracking-tight text-white">{item.value}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="tools" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary"><ShieldCheck className="h-4 w-4" /> Choose your assignment</p>
            <h2 className="mt-4 text-3xl font-bold tracking-[-0.04em] sm:text-5xl">The right tool for every QC role.</h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground sm:text-base">Reporting tools open the live QC suite, while Service Manager compiles every service into one leadership summary here.</p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <article key={tool.id} className={`group flex min-h-64 flex-col rounded-3xl border p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${tool.id === "emergency" ? "border-red-300/30 bg-red-500/[0.05]" : "border-border/70 bg-card/80"}`}>
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
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white text-slate-950 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.28)]">
          <div className="border-b border-slate-200 bg-[linear-gradient(120deg,#f8fbff_0%,#eefcff_52%,#faf5ff_100%)] px-5 py-6 sm:px-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Workflow guide</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Know what each submission captures.</h2>
          </div>
          <div className="grid min-w-0 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <div className="flex min-w-0 gap-2 overflow-x-auto border-b border-slate-200 bg-slate-50/80 p-3 lg:block lg:border-b-0 lg:border-r lg:p-4">
              {tools.map((tool) => {
                const Icon = tool.icon;
                const active = tool.id === activeId;
                return (
                  <button key={tool.id} type="button" onClick={() => selectTool(tool.id)} className={`flex min-h-12 min-w-max items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 lg:mb-1 lg:w-full ${active ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/10" : "text-cyan-950/65 hover:bg-white hover:text-cyan-950"}`} aria-pressed={active}>
                    <Icon className={`h-4 w-4 ${active ? "text-white" : "text-slate-400"}`} />{tool.shortTitle}<ChevronRight className="ml-auto hidden h-4 w-4 lg:block" />
                  </button>
                );
              })}
            </div>
            {activeTool.id === "manager" ? <motion.div key="manager" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="min-w-0"><ServiceManagerDashboard /></motion.div> : <motion.div key={activeTool.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="min-w-0 p-5 sm:p-8 lg:p-10">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border ${toneClasses[activeTool.tone]}`}><ActiveIcon className="h-5 w-5" /></div>
                  <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-700">{activeTool.eyebrow}</p>
                  <h3 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{activeTool.title}</h3>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{activeTool.description}</p>
                </div>
              </div>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {activeTool.details.map((detail) => <div key={detail} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm leading-6 text-slate-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />{detail}</div>)}
              </div>
              <div className="mt-7 flex flex-col gap-4 rounded-2xl border border-cyan-200 bg-cyan-50/80 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-800">Result</p><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-700">{activeTool.outcome}</p></div>
                <Button asChild variant="gradient" className="min-h-11 shrink-0 rounded-full px-5"><a href={activeTool.href}>Open {activeTool.shortTitle.toLowerCase()} <ArrowRight className="ml-2 h-4 w-4" /></a></Button>
              </div>
            </motion.div>}
          </div>
        </div>
      </section>
    </main>
  );
}
