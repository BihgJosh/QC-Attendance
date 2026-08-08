"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, BellRing, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(window.atob(base64), (character) => character.charCodeAt(0));
}

async function persistSubscription(subscription: PushSubscription) {
  const response = await fetch("/api/notifications/subscription", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: subscription.toJSON() }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "This device could not be subscribed.");
}

export function NotificationPrompt() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const allowButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    setVisible(false);
    setMessage("");
    setIsError(false);
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    void (async () => {
      const eligibility = await fetch("/api/member/session", { cache: "no-store" });
      if (!eligibility.ok || cancelled) return;
      if (Notification.permission === "denied") {
        setMessage("Notifications are blocked in this browser. Allow them in your site settings, then reload this page.");
        setIsError(true);
        setVisible(true);
        return;
      }
      const keyResponse = await fetch("/api/notifications/public-key", { cache: "no-store" });
      if (!keyResponse.ok || cancelled) return;
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        try { await persistSubscription(subscription); return; }
        catch { if (!cancelled) { setMessage("Reconnect this device to team notifications."); setIsError(true); setVisible(true); } return; }
      }
      if (!cancelled) setVisible(true);
    })().catch(() => undefined);
    return () => { cancelled = true; };
  }, [pathname]);

  useEffect(() => { if (visible) allowButton.current?.focus(); }, [visible]);

  const dismiss = () => {
    setVisible(false);
  };

  const enable = async () => {
    setWorking(true); setMessage(""); setIsError(false);
    let subscription: PushSubscription | null = null;
    let created = false;
    try {
      const keyResponse = await fetch("/api/notifications/public-key", { cache: "no-store" });
      const keyData = await keyResponse.json().catch(() => ({}));
      if (!keyResponse.ok) throw new Error(keyData.error || "Notifications are unavailable.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notifications were not allowed. You can enable them later in your device settings.");
      const registration = await navigator.serviceWorker.ready;
      subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(keyData.publicKey) });
        created = true;
      }
      await persistSubscription(subscription);
      setMessage("Notifications are enabled on this device.");
      window.setTimeout(() => setVisible(false), 1600);
    } catch (cause) {
      if (created && subscription) await subscription.unsubscribe().catch(() => false);
      setIsError(true);
      setMessage(cause instanceof Error ? cause.message : "Notifications could not be enabled.");
    } finally { setWorking(false); }
  };

  if (!visible) return null;
  return (
    <aside role="dialog" aria-modal="false" aria-labelledby="notification-prompt-title" aria-describedby="notification-prompt-description notification-prompt-message" className="fixed inset-x-4 bottom-4 z-[80] mx-auto max-w-xl rounded-2xl border border-cyan-200 bg-white p-4 text-slate-950 shadow-2xl shadow-slate-950/20 sm:p-5">
      <button type="button" onClick={dismiss} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600" aria-label="Dismiss notification prompt"><X className="h-4 w-4" /></button>
      <div className="flex gap-4 pr-10">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-100 text-cyan-800"><BellRing className="h-6 w-6" /></span>
        <div><h2 id="notification-prompt-title" className="font-black tracking-tight">Stay updated with the QC team</h2>
          <p id="notification-prompt-description" className="mt-1 text-sm leading-6 text-slate-600">Allow notifications to receive new announcements, postings and uniform updates on this device. Signing out removes this device subscription.</p>
          {message && <p id="notification-prompt-message" className="mt-2 text-sm font-semibold text-slate-800" role={isError ? "alert" : "status"}>{message}</p>}
          <div className="mt-4 flex flex-wrap gap-2"><Button ref={allowButton} type="button" onClick={enable} disabled={working} className="bg-cyan-700 text-white hover:bg-cyan-800">{working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}Allow notifications</Button><Button type="button" variant="ghost" onClick={dismiss} disabled={working}>Not now</Button></div>
        </div>
      </div>
    </aside>
  );
}
