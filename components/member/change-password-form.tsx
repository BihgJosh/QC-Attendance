"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordForm({ nextPath = "/" }: { nextPath?: string }) {
  const router = useRouter();
  const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const rules = [{ label: "8 or more characters", ok: password.length >= 8 }, { label: "Uppercase and lowercase", ok: /[A-Z]/.test(password) && /[a-z]/.test(password) }, { label: "At least one number", ok: /\d/.test(password) }];
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (password !== confirm) return setError("The passwords do not match.");
    if (!rules.every((rule) => rule.ok)) return setError("Your new password does not meet all requirements.");
    setLoading(true);
    try {
      const response = await fetch("/api/member/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Password could not be changed.");
      router.replace(nextPath); router.refresh();
    } catch (cause) { setError((cause as Error).message); } finally { setLoading(false); }
  }
  return <form onSubmit={submit} className="space-y-5">
    <div className="space-y-2"><Label htmlFor="new-password" className="font-semibold text-white">New password</Label><Input id="new-password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="auth-input h-12 border-white/30" /></div>
    <div className="space-y-2"><Label htmlFor="confirm-password" className="font-semibold text-white">Confirm new password</Label><Input id="confirm-password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="auth-input h-12 border-white/30" /></div>
    <ul className="grid gap-2 text-xs font-medium sm:grid-cols-3">{rules.map((rule) => <li key={rule.label} className={`flex items-center gap-2 ${rule.ok ? "text-cyan-100" : "text-white/80"}`}><Check className="h-3.5 w-3.5 shrink-0" />{rule.label}</li>)}</ul>
    {error && <div role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div>}
    <Button type="submit" variant="gradient" className="h-12 w-full" disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />} Save private password</Button>
  </form>;
}
