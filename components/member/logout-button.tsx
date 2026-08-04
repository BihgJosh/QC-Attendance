"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MemberLogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  async function logout() {
    if ("serviceWorker" in navigator) {
      const subscription = await navigator.serviceWorker.ready.then((registration) => registration.pushManager.getSubscription()).catch(() => null);
      if (subscription) {
        await fetch("/api/notifications/subscription", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) }).catch(() => undefined);
        await subscription.unsubscribe().catch(() => false);
      }
    }
    await fetch("/api/member/logout", { method: "POST" });
    router.replace("/member/login"); router.refresh();
  }
  return <Button type="button" variant="ghost" size="sm" onClick={logout} className="text-white/70 hover:bg-white/10 hover:text-white"><LogOut className={compact ? "h-4 w-4" : "mr-2 h-4 w-4"} />{compact ? <span className="sr-only">Sign out</span> : "Sign out"}</Button>;
}
