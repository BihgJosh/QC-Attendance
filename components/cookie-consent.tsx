"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const CONSENT_KEY = "qcu-cookie-consent-v1";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try { setVisible(localStorage.getItem(CONSENT_KEY) !== "accepted"); }
    catch { setVisible(true); }
  }, []);

  if (!visible) return null;

  return (
    <aside aria-labelledby="cookie-consent-title" className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-2xl bg-slate-950 p-4 text-white shadow-[0_16px_48px_-18px_rgba(2,6,23,.85)] sm:bottom-5 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-300/15 text-cyan-200"><Cookie className="h-5 w-5" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h2 id="cookie-consent-title" className="font-bold tracking-tight">Essential cookies and device storage</h2>
          <p className="mt-1 text-sm leading-6 text-white/75">We use necessary cookies and local storage for secure sign-in, preferences, PWA prompts and attendance fraud prevention. We do not use advertising or analytics cookies.</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button type="button" variant="gradient" className="min-h-11" onClick={() => { try { localStorage.setItem(CONSENT_KEY, "accepted"); } catch { /* Consent remains valid for this page view when storage is unavailable. */ } setVisible(false); }}><ShieldCheck className="mr-2 h-4 w-4" />Accept and continue</Button>
            <Button asChild type="button" variant="ghost" className="min-h-11 text-white/85 hover:bg-white/10 hover:text-white"><Link href="/privacy">View Privacy Policy</Link></Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
