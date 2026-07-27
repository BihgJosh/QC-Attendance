"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

/**
 * Prompts the user to install the app (Chrome Android)
 * or shows instructions (iOS Safari).
 */
export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    /* ── Chrome Android: beforeinstallprompt ── */
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    /* ── iOS Safari: detect standalone vs browser ── */
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    const hasPrompted = localStorage.getItem("qcu_pwa_ios_prompted");

    if (isIOS && !isStandalone && !hasPrompted) {
      // Delay slightly so it doesn't appear immediately on page load
      setTimeout(() => setShowIOSPrompt(true), 3000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  const dismissIOS = () => {
    setShowIOSPrompt(false);
    localStorage.setItem("qcu_pwa_ios_prompted", "true");
    setDismissed(true);
  };

  const dismissAll = () => setDismissed(true);

  if (dismissed) return null;

  return (
    <AnimatePresence>
      {/* Chrome Android install prompt */}
      {deferredPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto"
        >
          <div className="glass-card p-4 flex items-center gap-3 shadow-2xl">
            <div className="w-10 h-10 rounded-xl brand-gradient flex items-center justify-center flex-shrink-0">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Install QCU Attendance</p>
              <p className="text-xs text-muted-foreground truncate">Add to your home screen for quick access</p>
            </div>
            <Button size="sm" variant="gradient" className="flex-shrink-0" onClick={handleInstall}>
              Install
            </Button>
            <button
              type="button"
              aria-label="Dismiss install prompt"
              onClick={dismissAll}
              className="grid h-11 w-11 flex-shrink-0 place-items-center text-muted-foreground/50 hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* iOS Safari instructions */}
      {showIOSPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto"
        >
          <div className="glass-card p-5 shadow-2xl relative">
            {/* Arrow pointing to Share button */}
            <div className="absolute -top-2 right-12 w-4 h-4 rotate-45 bg-card border-l border-t border-border" />
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Download className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold mb-1">Install QCU Attendance</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Tap the <strong className="text-foreground">Share</strong> button{" "}
                  <span className="inline-block text-base">⎙</span> in Safari, then scroll down and tap{" "}
                  <strong className="text-foreground">Add to Home Screen</strong>.
                </p>
                <Button size="sm" variant="ghost" className="mt-3 h-8 text-xs" onClick={dismissIOS}>
                  Got it
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
