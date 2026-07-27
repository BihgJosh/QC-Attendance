"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CakeSlice, CalendarHeart, Sparkles } from "lucide-react";
import type { BirthdayNoticeEntry } from "@/lib/birthday-types";

export function BirthdayNotice({ birthdays }: { birthdays: BirthdayNoticeEntry[] }) {
  const reduceMotion = useReducedMotion();
  if (!birthdays.length) return null;
  const today = birthdays.filter((birthday) => birthday.isToday);
  const upcoming = birthdays.filter((birthday) => !birthday.isToday).slice(0, today.length ? 3 : 5);
  return (
    <motion.aside initial={reduceMotion ? false : { opacity: 0, y: 18 }} whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} className="relative mb-5 overflow-hidden rounded-[2rem] border border-fuchsia-200/15 bg-[linear-gradient(125deg,#07152f_0%,#2c1e5f_48%,#791780_100%)] p-6 text-white shadow-2xl shadow-purple-950/20 sm:p-8">
      <div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden="true">
        {["left-[7%] top-7", "left-[28%] top-14", "right-[29%] top-8", "right-[8%] top-16", "left-[48%] bottom-7"].map((position, index) => <span key={position} className={`absolute ${position} h-1.5 w-1.5 rotate-45 rounded-sm ${index % 2 ? "bg-fuchsia-300" : "bg-cyan-300"}`} />)}
      </div>
      <div className="relative grid gap-7 lg:grid-cols-[1.15fr_.85fr] lg:items-center">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-cyan-200"><Sparkles className="h-4 w-4" /> QC celebrates</p>
          <div className="mt-5 flex items-start gap-4"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15"><CakeSlice className="h-7 w-7 text-fuchsia-200" /></span><div>{today.length ? <><p className="text-sm font-semibold text-white/70">Happy birthday to</p><h3 className="mt-1 text-3xl font-black tracking-[-.035em] sm:text-4xl">{today.map((birthday) => birthday.name).join(" & ")}</h3><p className="mt-3 max-w-xl text-sm leading-6 text-white/75">Your QC family celebrates you today. May this new year overflow with joy, grace and greater impact.</p></> : <><p className="text-sm font-semibold text-white/70">Our next celebration</p><h3 className="mt-1 text-3xl font-black tracking-[-.035em] sm:text-4xl">Birthday moments ahead</h3><p className="mt-3 max-w-xl text-sm leading-6 text-white/75">Save the dates and celebrate the people who help us guard the standard.</p></>}</div></div>
        </div>
        {upcoming.length > 0 && <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 backdrop-blur-sm"><p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-fuchsia-100"><CalendarHeart className="h-4 w-4" /> Coming up</p><div className="space-y-2">{upcoming.map((birthday) => <div key={`${birthday.name}-${birthday.dateLabel}`} className="flex items-center justify-between gap-3 rounded-xl bg-slate-950/25 px-3.5 py-3"><span className="min-w-0 truncate text-sm font-bold">{birthday.name}</span><span className="shrink-0 rounded-full bg-cyan-300 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-950">{birthday.dateLabel}</span></div>)}</div></div>}
      </div>
    </motion.aside>
  );
}
