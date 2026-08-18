"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISSED_KEY = "qcu-profile-update-prompt-dismissed";

export function ProfileUpdatePrompt() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setVisible(false);

    if (pathname === "/member/profile" || window.sessionStorage.getItem(DISMISSED_KEY) === "true") return;

    void fetch("/api/member/profile", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok || cancelled) return;
        const data = await response.json();
        if (!cancelled && data.profile?.profileComplete === false) setVisible(true);
      })
      .catch(() => undefined);

    return () => { cancelled = true; };
  }, [pathname]);

  function dismiss() {
    window.sessionStorage.setItem(DISMISSED_KEY, "true");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <aside role="dialog" aria-modal="false" aria-labelledby="profile-prompt-title" aria-describedby="profile-prompt-description" className="fixed inset-x-4 bottom-4 z-[80] mx-auto max-w-xl rounded-2xl border border-cyan-200 bg-white p-4 text-slate-950 shadow-2xl shadow-slate-950/20 sm:p-5">
      <button type="button" onClick={dismiss} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600" aria-label="Dismiss profile update reminder"><X className="h-4 w-4" /></button>
      <div className="flex gap-4 pr-10">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-100 text-cyan-800"><UserRound className="h-6 w-6" /></span>
        <div>
          <h2 id="profile-prompt-title" className="font-black tracking-tight">Complete your member profile</h2>
          <p id="profile-prompt-description" className="mt-1 text-sm leading-6 text-slate-600">Please confirm your name and add your contact details so your QC records stay accurate.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild className="bg-cyan-700 text-white hover:bg-cyan-800"><Link href="/member/profile">Update profile</Link></Button>
            <Button type="button" variant="ghost" onClick={dismiss}>Later</Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
