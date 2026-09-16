"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

type Step = "login" | "setup";

export function MemberLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState<Step>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const passwordReady = password.length >= 10 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);

  function finish() {
    const requested = params.get("next");
    const safeNext = requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/";
    router.replace(safeNext);
    router.refresh();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true); setError("");
    try {
      if (step === "setup" && password !== confirm) throw new Error("The passwords do not match.");
      if (step === "setup" && !passwordReady) throw new Error("Use at least 10 characters with uppercase, lowercase and a number.");
      if (!privacyAccepted) throw new Error("Accept the Privacy Policy before signing in.");
      const response = await fetch("/api/member/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: step, email, password, privacyAccepted }) });
      const data = await response.json().catch(() => ({ error: "The sign-in service returned an invalid response." }));
      if (!response.ok) throw new Error(data.error || "Sign-in failed.");
      if (data.nextStep === "setup") {
        setStep("setup");
        setConfirm("");
      } else finish();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      setError(message === "Failed to fetch" || message === "fetch failed" ? "Unable to reach the sign-in service. Check your connection and try again." : message || "Sign-in failed. Please try again.");
    } finally { setLoading(false); }
  }

  return <form onSubmit={submit} className="space-y-5">
    {step === "setup" && <button type="button" onClick={() => { setStep("login"); setPassword(""); setConfirm(""); setError(""); }} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-cyan-100 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"><ArrowLeft className="h-4 w-4" /> Use another email</button>}
    <div className="space-y-2"><Label htmlFor="member-email" className="font-semibold text-white">Team email</Label><Input id="member-email" type="email" autoComplete="email" required value={email} readOnly={step === "setup"} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="auth-input h-12 border-white/30 read-only:opacity-75" /></div>
    {step === "login" && <PasswordField label="Private password" value={password} setValue={setPassword} visible={visible} setVisible={setVisible} autoComplete="current-password" />}
    {step === "setup" && <>
      <PasswordField label="Create private password" value={password} setValue={setPassword} visible={visible} setVisible={setVisible} autoComplete="new-password" />
      <div className="space-y-2"><Label htmlFor="confirm-password" className="font-semibold text-white">Confirm private password</Label><Input id="confirm-password" type="password" autoComplete="new-password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} className="auth-input h-12 border-white/30" /></div>
      <p className="text-xs leading-5 text-white/80">Use at least 10 characters with uppercase, lowercase and a number.</p>
    </>}
    {error && <div role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div>}
    <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-white/[0.07] p-4 text-sm leading-5 text-white/85"><input type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} required className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-400" /><span>I have read and accept the <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="font-bold text-cyan-200 underline underline-offset-2 hover:text-white">Privacy Policy</Link>. I will not share my credentials or give another person access to the platform.</span></label>
    <Button type="submit" variant="gradient" className="h-12 w-full" disabled={loading || !privacyAccepted}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}{step === "setup" ? "Create password and sign in" : "Sign in"}</Button>
    {step === "login" && <p className="text-center text-xs font-medium leading-5 text-white/80">First time here? Enter the password you want to use. You’ll confirm it before your account is created.</p>}
  </form>;
}

function PasswordField({ label, value, setValue, visible, setVisible, autoComplete }: { label: string; value: string; setValue: (value: string) => void; visible: boolean; setVisible: (value: boolean) => void; autoComplete: string }) {
  return <div className="space-y-2"><Label htmlFor="member-password" className="font-semibold text-white">{label}</Label><div className="relative"><Input id="member-password" type={visible ? "text" : "password"} autoComplete={autoComplete} required value={value} onChange={(event) => setValue(event.target.value)} className="auth-input h-12 border-white/30 pr-12" /><button type="button" onClick={() => setVisible(!visible)} className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-500 hover:text-slate-900" aria-label={visible ? "Hide password" : "Show password"}>{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>;
}
