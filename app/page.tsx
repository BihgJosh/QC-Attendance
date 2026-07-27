"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Lock,
  Megaphone,
  Menu,
  PanelsTopLeft,
  ShieldAlert,
  ShieldCheck,
  Shirt,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { AttendanceCard } from "@/components/public/attendance-card";
import { BirthdayNotice } from "@/components/public/birthday-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { MemberLogoutButton } from "@/components/member/logout-button";
import { formatAbujaDateLong, formatAbujaTimeWithSeconds } from "@/lib/timezone";
import { DEFAULT_HOMEPAGE_CONTENT, SERVICE_DAYS, type HomepageContent, type ServiceDay } from "@/lib/homepage-content";
import type { BirthdayNoticeEntry } from "@/lib/birthday-types";

const navigation = [
  { label: "Home", href: "#home" },
  { label: "Postings / Uniform", href: "#postings" },
  { label: "Attendance", href: "#attendance" },
  { label: "Service Tools", href: "/service-tools" },
];

const accentClasses = {
  primary: "bg-primary",
  accent: "bg-accent",
  success: "bg-success",
};

export default function HomePage() {
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [isOpen, setIsOpen] = useState<boolean | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [content, setContent] = useState<HomepageContent>(DEFAULT_HOMEPAGE_CONTENT);
  const [openPosting, setOpenPosting] = useState<string | null>(null);
  const [postingDay, setPostingDay] = useState<ServiceDay>("Sunday");
  const [birthdays, setBirthdays] = useState<BirthdayNoticeEntry[]>([]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(formatAbujaTimeWithSeconds(now));
      setCurrentDate(formatAbujaDateLong(now));
    };

    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/admin/status");
        if (res.ok) {
          const data = await res.json();
          setIsOpen(data.isOpen);
        }
      } catch {
        // The attendance card remains safely unavailable when status cannot be confirmed.
      }
    };

    const fetchContent = async () => {
      try {
        const response = await fetch("/api/content");
        if (response.ok) setContent(await response.json());
      } catch {
        // Keep the built-in brief when published content cannot be loaded.
      }
    };

    const fetchBirthdays = async () => {
      try {
        const response = await fetch("/api/birthdays", { cache: "no-store" });
        if (response.ok) setBirthdays((await response.json()).birthdays || []);
      } catch {
        // Birthday notices remain hidden when the private sheet is unavailable.
      }
    };

    updateTime();
    fetchStatus();
    fetchContent();
    fetchBirthdays();
    const clockInterval = setInterval(updateTime, 1000);
    const refreshVisibleStatus = () => {
      if (!document.hidden) fetchStatus();
    };
    const statusInterval = setInterval(refreshVisibleStatus, 15000);
    document.addEventListener("visibilitychange", refreshVisibleStatus);

    return () => {
      clearInterval(clockInterval);
      clearInterval(statusInterval);
      document.removeEventListener("visibilitychange", refreshVisibleStatus);
    };
  }, []);

  return (
    <main className="relative z-10 min-h-screen overflow-x-hidden">
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-5">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-2 rounded-2xl border border-cyan-200/10 bg-[linear-gradient(110deg,rgba(2,12,32,0.96),rgba(26,20,69,0.95)_58%,rgba(74,20,96,0.94))] px-3 py-2.5 text-white shadow-2xl shadow-slate-950/20 backdrop-blur-xl sm:px-5" aria-label="Main navigation">
          <Link href="/" aria-label="Go to homepage" className="flex min-w-0 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:gap-3">
            <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm">
              <Image src="/soja-logo.jpeg" alt="" width={40} height={40} className="h-full w-full object-cover" priority />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-xs font-bold tracking-tight sm:text-sm">Quality Control Unit</span>
              <span className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/60 min-[360px]:block">Streams of Joy</span>
            </span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {navigation.map((item) => (
              item.href.startsWith("/") ? (
                <Link key={item.href} href={item.href} className="rounded-full px-4 py-2 text-sm font-medium text-white/65 transition-colors hover:bg-white/10 hover:text-white">{item.label}</Link>
              ) : (
                <a key={item.href} href={item.href} className="rounded-full px-4 py-2 text-sm font-medium text-white/65 transition-colors hover:bg-white/10 hover:text-white">{item.label}</a>
              )
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <Button asChild variant="ghost" size="sm" className="hidden gap-2 text-white/70 hover:bg-white/10 hover:text-white sm:flex">
              <Link href="/admin">
                <Lock className="h-4 w-4" /> Admin
              </Link>
            </Button>
            <ThemeToggle />
            <span className="hidden sm:inline-flex"><MemberLogoutButton compact /></span>
            <button
              type="button"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 md:hidden"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((value) => !value)}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>

        {menuOpen && (
          <div className="mx-auto mt-2 max-w-7xl rounded-2xl border border-cyan-200/10 bg-[linear-gradient(145deg,rgba(2,12,32,0.98),rgba(74,20,96,0.96))] p-2 text-white shadow-2xl backdrop-blur-xl md:hidden">
            {navigation.map((item) => (
              item.href.startsWith("/") ? (
                <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white">{item.label}<ChevronRight className="h-4 w-4 text-cyan-100/50" /></Link>
              ) : (
                <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white">{item.label}<ChevronRight className="h-4 w-4 text-cyan-100/50" /></a>
              )
            ))}
            <Link href="/admin" className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white">
              Admin login <Lock className="h-4 w-4 text-cyan-100/50" />
            </Link>
            <div className="px-1 py-1"><MemberLogoutButton /></div>
          </div>
        )}
      </header>

      <section id="home" className="relative flex min-h-[94vh] scroll-mt-24 items-center px-4 pb-14 pt-28 sm:px-6 sm:pb-16 sm:pt-36 lg:px-8">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Excellence is our culture
            </div>
            <h1 className="max-w-3xl text-[clamp(2.65rem,7vw,5.5rem)] font-bold leading-[0.96] tracking-[-0.055em]">
              We guard the <span className="brand-gradient-text">standard</span> behind every service.
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              The Quality Control Unit helps every Streams of Joy experience feel orderly, welcoming and excellent—from the first arrival to the final handover.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild variant="gradient" size="lg" className="h-12 rounded-full px-6">
                <a href="#announcements">View unit brief <ArrowDown className="ml-2 h-4 w-4" /></a>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 rounded-full px-6 glass-card">
                <a href="#attendance">Sign attendance <ArrowRight className="ml-2 h-4 w-4" /></a>
              </Button>
            </div>
            <Link
              href="/service-tools"
              className="group mt-5 flex max-w-xl items-center gap-3 rounded-2xl border border-primary/20 bg-card/70 p-3.5 shadow-sm backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:p-4"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#39A9DB,#8E14A8)] text-white shadow-md shadow-primary/15">
                <PanelsTopLeft className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold tracking-tight sm:text-base">QC Service Tools</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground sm:text-sm">Post reports, service timing, observations and emergency flags.</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.15 }} className="relative">
            <div className="absolute -inset-10 brand-gradient rounded-full opacity-10 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-[linear-gradient(145deg,rgba(12,30,64,0.97),rgba(109,14,131,0.92))] p-6 text-white shadow-2xl shadow-purple-950/20 sm:p-8">
              <div className="flex items-start justify-between gap-6 border-b border-white/15 pb-7">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-200">Today at QC</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight">Unit briefing board</p>
                </div>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
                  <ClipboardCheck className="h-6 w-6 text-cyan-200" />
                </span>
              </div>

              <div className="grid gap-3 py-7 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/[0.08] p-4">
                  <CalendarDays className="mb-5 h-5 w-5 text-cyan-200" />
                  <p className="text-xs text-white/55">Abuja date</p>
                  <p className="mt-1 text-sm font-semibold">{currentDate || "Loading date…"}</p>
                </div>
                <div className="rounded-2xl bg-white/[0.08] p-4">
                  <Clock className="mb-5 h-5 w-5 text-fuchsia-200" />
                  <p className="text-xs text-white/55">Local time</p>
                  <p className="mt-1 font-mono text-sm font-semibold tabular-nums">{currentTime || "--:--:--"}</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-2xl bg-white p-4 text-slate-950">
                <div className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${isOpen ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Attendance desk</p>
                    <p className="text-sm font-bold">{isOpen === null ? "Checking status" : isOpen ? "Open for check-in" : "Currently closed"}</p>
                  </div>
                </div>
                {isOpen ? <ShieldCheck className="h-5 w-5 text-emerald-500" /> : <ShieldAlert className="h-5 w-5 text-rose-500" />}
              </div>

              <div className="pointer-events-none absolute -bottom-8 -right-10 rotate-[-10deg] text-[5.5rem] font-black uppercase leading-none tracking-[-0.08em] text-white/[0.035] sm:text-[7rem]">
                Standard
              </div>
            </div>
            <div className="absolute -bottom-5 left-7 right-7 flex rotate-[-2deg] items-center justify-between rounded-xl bg-cyan-300 px-5 py-3 text-slate-950 shadow-xl">
              <span className="text-xs font-black uppercase tracking-[0.18em]">Excellence is a habit</span>
              <span className="text-xs font-semibold">QC / SOJ</span>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="announcements" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary"><Megaphone className="h-4 w-4" /> Unit announcements</p>
              <h2 className="max-w-2xl text-3xl font-bold tracking-[-0.04em] sm:text-5xl">Know the brief before you take your post.</h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">The latest operational notes for every QC member. Confirm details with your team lead when instructed.</p>
          </div>

          <BirthdayNotice birthdays={birthdays} />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {content.announcements.map((announcement, index) => (
              <motion.article key={announcement.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ delay: index * 0.08 }} className="glass-card group relative overflow-hidden p-6 transition-transform duration-300 hover:-translate-y-1 sm:p-7">
                <div className={`absolute inset-x-0 top-0 h-1 ${accentClasses[announcement.accent]}`} />
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{announcement.date}</p>
                <h3 className="mt-8 text-xl font-bold tracking-tight">{announcement.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{announcement.copy}</p>
                <div className="mt-8 flex items-center gap-2 text-xs font-semibold text-primary"><Check className="h-4 w-4" /> Noted by every member</div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section id="postings" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-7xl items-stretch gap-5 lg:grid-cols-2">
          <div data-testid="posting-panel" className="relative flex overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-2xl sm:p-8 lg:h-[42rem] lg:p-10">
            <div className="relative z-10 flex min-h-0 w-full flex-col">
            <div className="absolute right-0 top-0 h-64 w-64 translate-x-1/3 -translate-y-1/3 rounded-full bg-primary/30 blur-3xl" />
            <p className="relative text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Current posting</p>
            <h2 className="relative mt-5 max-w-md text-4xl font-bold tracking-[-0.045em] sm:text-5xl">Take your place. Hold the standard.</h2>
            <div className="relative mt-6 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.07] p-3">
              <div>
                <label htmlFor="public-posting-day" className="text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-200">Service day</label>
                <p className="text-xs text-white/50">Choose a schedule</p>
              </div>
              <select id="public-posting-day" value={postingDay} onChange={(event) => { setPostingDay(event.target.value as ServiceDay); setOpenPosting(null); }} className="h-10 min-w-36 rounded-xl border border-white/15 bg-slate-900 px-3 text-sm font-semibold text-white outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20">
                {SERVICE_DAYS.map((day) => <option key={day} value={day}>{day}</option>)}
              </select>
            </div>
            <div className="relative mt-8 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-thin sm:mt-10">
              {content.postings.filter((posting) => posting.day === postingDay).map((posting, index) => {
                const expanded = openPosting === posting.id;
                const hasAssignments = posting.rows.some((row) => row.assignments.some((names) => names.length > 0));
                return (
                  <div key={posting.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06]">
                    <button type="button" aria-expanded={expanded} aria-controls={`posting-members-${posting.id}`} onClick={() => setOpenPosting(expanded ? null : posting.id)} className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-300 text-xs font-black text-slate-950">{index + 1}</span>
                      <span className="min-w-0 flex-1"><span className="block font-semibold">{posting.name}</span><span className="block text-xs text-white/50">{posting.role}</span></span>
                      <ChevronDown className={`h-4 w-4 shrink-0 text-cyan-200 transition-transform ${expanded ? "rotate-180" : ""}`} />
                    </button>
                    <AnimatePresence initial={false}>
                      {expanded && (
                        <motion.div id={`posting-members-${posting.id}`} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="border-t border-white/10 px-4 py-3">
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200">Members posted here</p>
                            {hasAssignments ? (
                              <div className="space-y-3">
                                {posting.rows.map((row) => {
                                  const rowHasAssignments = row.assignments.some((names) => names.length > 0);
                                  if (!rowHasAssignments) return null;
                                  return (
                                    <div key={row.id} className="rounded-xl bg-white/[0.05] p-3">
                                      <p className="mb-2 text-xs font-bold text-white">{row.label}</p>
                                      <div className="grid gap-2 sm:grid-cols-2">
                                        {posting.columns.map((column, columnIndex) => {
                                          const names = row.assignments[columnIndex] || [];
                                          if (!names.length) return null;
                                          return (
                                            <div key={`${row.id}-${column}`}>
                                              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-cyan-200/70">{column}</p>
                                              <ul className="mt-1 space-y-1">
                                                {names.map((member, memberIndex) => <li key={`${member}-${memberIndex}`} className="flex items-start gap-2 text-xs text-white/80"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />{member}</li>)}
                                              </ul>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : <p className="text-xs text-white/50">No members have been assigned yet.</p>}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
            <p className="relative mt-5 shrink-0 text-xs leading-5 text-white/50">Posting assignments are confirmed by team leads during the pre-service briefing.</p>
            </div>
          </div>

          <div data-testid="uniform-panel" className="glass-card flex rounded-[2rem] p-6 sm:p-8 lg:h-[42rem] lg:p-10">
            <div className="flex w-full flex-col">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-accent"><Shirt className="h-4 w-4" /> Sunday uniform</p>
                <h2 className="mt-5 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">Simple. Sharp. Service-ready.</h2>
              </div>
              <span className="hidden h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 sm:flex"><Shirt className="h-7 w-7 text-accent" /></span>
            </div>
            <p className="mt-5 max-w-xl text-sm leading-6 text-muted-foreground">Our appearance should communicate order before we say a word. Come fully dressed and ready for inspection before briefing.</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {content.uniformItems.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/60 p-4">
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-success/10"><Check className="h-4 w-4 text-success" /></span>
                  <span className="text-sm font-semibold">{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-auto flex items-center gap-3 rounded-2xl bg-warning/10 p-4 text-sm text-foreground lg:mt-8">
              <Users className="h-5 w-5 flex-none text-warning" /> {content.uniformNote}
            </div>
            </div>
          </div>
        </div>
      </section>

      <section id="attendance" className="scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-7xl items-start gap-10 xl:grid-cols-[0.9fr_1.1fr] xl:gap-12">
          <div className="xl:sticky xl:top-32">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary"><ClipboardCheck className="h-4 w-4" /> Attendance</p>
            <h2 className="mt-5 text-4xl font-bold tracking-[-0.045em] sm:text-5xl">Present, prepared and in position.</h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">Sign in only when you are physically at church and ready to serve. Your location is checked to confirm your presence.</p>
            <div className="mt-8 inline-flex items-center gap-3 rounded-2xl border border-border bg-card/70 px-4 py-3 shadow-sm">
              <span className={`h-2.5 w-2.5 rounded-full ${isOpen ? "bg-success animate-pulse" : "bg-destructive"}`} />
              <span className="text-sm font-semibold">{isOpen === null ? "Checking attendance status…" : isOpen ? "Attendance is open" : "Attendance is currently closed"}</span>
            </div>
            <div className="mt-8 space-y-3 text-sm text-muted-foreground">
              {["Choose the correct service", "Enter your name and unit password", "Allow location access and confirm"].map((step, index) => (
                <div key={step} className="flex items-center gap-3"><span className="font-mono text-xs font-bold text-primary">0{index + 1}</span><span>{step}</span></div>
              ))}
            </div>
          </div>
          <div className="flex justify-center xl:justify-end">
            <AttendanceCard isOpen={isOpen} />
          </div>
        </div>
      </section>

      <footer className="border-t border-border/70 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" aria-label="Go to homepage" className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <Image src="/soja-logo.jpeg" alt="Streams of Joy International" width={36} height={36} className="h-9 w-9 rounded-xl object-cover" />
            <div><p className="text-sm font-bold">Quality Control Unit</p><p className="text-xs text-muted-foreground">Streams of Joy International</p></div>
          </Link>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Excellence, accountability and service.</p>
        </div>
      </footer>
    </main>
  );
}
