"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { AttendanceCard } from "@/components/public/attendance-card";
import { Button } from "@/components/ui/button";

export default function AttendancePage() {
  const [isOpen, setIsOpen] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    const fetchStatus = async () => {
      try {
        const response = await fetch("/api/admin/status", { cache: "no-store" });
        if (response.ok && active) setIsOpen((await response.json()).isOpen);
      } catch {
        if (active) setIsOpen(null);
      }
    };

    void fetchStatus();
    const interval = window.setInterval(() => {
      if (!document.hidden) void fetchStatus();
    }, 15_000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <main className="relative z-10 min-h-screen overflow-x-hidden px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Button asChild variant="ghost" className="mb-8 rounded-full">
          <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back to homepage</Link>
        </Button>

        <section className="grid items-start gap-10 xl:grid-cols-[0.9fr_1.1fr] xl:gap-12">
          <div className="xl:sticky xl:top-12">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary"><ClipboardCheck className="h-4 w-4" /> Member attendance</p>
            <h1 className="mt-5 text-4xl font-bold tracking-[-0.045em] sm:text-5xl">Present, prepared and in position.</h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">Sign in only when you are physically at church and ready to serve. Your location is checked to confirm your presence.</p>
            <div className="mt-8 inline-flex items-center gap-3 rounded-2xl border border-border bg-card/70 px-4 py-3 shadow-sm">
              <span className={`h-2.5 w-2.5 rounded-full ${isOpen ? "animate-pulse bg-success" : "bg-destructive"}`} />
              <span className="text-sm font-semibold">{isOpen === null ? "Checking attendance status…" : isOpen ? "Attendance is open" : "Attendance is currently closed"}</span>
            </div>
            <div className="mt-8 space-y-3 text-sm text-muted-foreground">
              {["Choose the correct service", "Select your name from the member list", "Allow location access and confirm"].map((step, index) => (
                <div key={step} className="flex items-center gap-3"><span className="font-mono text-xs font-bold text-primary">0{index + 1}</span><span>{step}</span></div>
              ))}
            </div>
          </div>
          <div className="flex justify-center xl:justify-end">
            <AttendanceCard isOpen={isOpen} />
          </div>
        </section>
      </div>
    </main>
  );
}
