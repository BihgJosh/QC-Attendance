"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MemberLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/member/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await response.json().catch(() => ({ error: "The sign-in service returned an invalid response. Please try again." }));
      if (!response.ok) throw new Error(data.error || "Sign-in failed.");
      const requested = params.get("next");
      const safeNext = requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/";
      router.replace(data.mustChangePassword ? `/member/change-password?next=${encodeURIComponent(safeNext)}` : safeNext);
      router.refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      setError(message === "Failed to fetch" || message === "fetch failed"
        ? "Unable to reach the sign-in service. Check your connection and try again."
        : message || "Sign-in failed. Please try again.");
    }
    finally { setLoading(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2"><Label htmlFor="member-email" className="font-semibold text-white">Team email</Label><Input id="member-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="auth-input h-12 border-white/30" /></div>
      <div className="space-y-2">
        <Label htmlFor="member-password" className="font-semibold text-white">Password</Label>
        <div className="relative"><Input id="member-password" type={visible ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="auth-input h-12 border-white/30 pr-12" /><button type="button" onClick={() => setVisible((value) => !value)} className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-500 hover:text-slate-900" aria-label={visible ? "Hide password" : "Show password"}>{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
      </div>
      {error && <div role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div>}
      <Button type="submit" variant="gradient" className="h-12 w-full" disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />} Sign in</Button>
      <p className="text-center text-xs font-medium leading-5 text-white/80">First visit? Use the temporary team password provided by QC leadership. You will create a private password immediately.</p>
    </form>
  );
}
