"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "qcu-install-prompt-dismissed-until";
const DISMISS_DAYS = 7;

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function PWAInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const dismissedUntil = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (isStandalone() || dismissedUntil > Date.now()) return;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      setDismissed(false);
    };
    const onInstalled = () => {
      setInstallPrompt(null);
      setShowIOSInstructions(false);
      setDismissed(true);
      localStorage.removeItem(DISMISS_KEY);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);
    if (isIOS && isSafari) {
      setShowIOSInstructions(true);
      setDismissed(false);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000));
    setDismissed(true);
  }

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setDismissed(true);
    setInstallPrompt(null);
  }

  if (dismissed || (!installPrompt && !showIOSInstructions)) return null;

  return (
    <aside aria-label="Install QC unit app" className="fixed inset-x-3 z-[100] mx-auto max-w-xl animate-in slide-in-from-bottom-4 fade-in duration-300" style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
      <div className="relative overflow-hidden rounded-[1.4rem] border border-white/15 bg-[#071225]/95 p-4 text-white shadow-[0_24px_70px_rgba(3,8,24,.45)] backdrop-blur-xl sm:p-5">
        <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-cyan-400 via-blue-500 to-fuchsia-500" />
        <div className="flex items-center gap-3 pl-1">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-fuchsia-600 shadow-lg shadow-fuchsia-950/40">
            {showIOSInstructions ? <Share className="h-5 w-5" /> : <Download className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold tracking-tight sm:text-base">Install QC unit app</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-300">
              {showIOSInstructions
                ? <>Tap <strong className="text-white">Share</strong>, then choose <strong className="text-white">Add to Home Screen</strong>.</>
                : "Open attendance, postings and service tools from your home screen."}
            </p>
          </div>
          {installPrompt && <Button type="button" size="sm" variant="gradient" className="shrink-0 rounded-xl" onClick={install}>Install</Button>}
          <button type="button" aria-label="Dismiss install prompt" onClick={dismiss} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
