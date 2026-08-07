"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "email" | "password" | "setup";

export function MemberLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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
      const action = step === "email" ? "identify" : step === "password" ? "login" : "setup";
      const response = await fetch("/api/member/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, email, password, rememberMe }) });
      const data = await response.json().catch(() => ({ error: "The sign-in service returned an invalid response." }));
      if (!response.ok) throw new Error(data.error || "Sign-in failed.");
      if (data.nextStep === "password" || data.nextStep === "setup") {
        setStep(data.nextStep);
        setPassword(""); setConfirm("");
      } else finish();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      setError(message === "Failed to fetch" || message === "fetch failed" ? "Unable to reach the sign-in service. Check your connection and try again." : message || "Sign-in failed. Please try again.");
    } finally { setLoading(false); }
  }

  return <form onSubmit={submit} className="space-y-5">
    {step !== "email" && <button type="button" onClick={() => { setStep("email"); setError(""); }} className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-100 hover:text-white"><ArrowLeft className="h-4 w-4" /> Use another email</button>}
    <div className="space-y-2"><Label htmlFor="member-email" className="font-semibold text-white">Team email</Label><Input id="member-email" type="email" autoComplete="email" required value={email} readOnly={step !== "email"} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="auth-input h-12 border-white/30 read-only:opacity-75" /></div>
    {step === "password" && <PasswordField label="Private password" value={password} setValue={setPassword} visible={visible} setVisible={setVisible} autoComplete="current-password" />}
    {step === "setup" && <>
      <PasswordField label="Create private password" value={password} setValue={setPassword} visible={visible} setVisible={setVisible} autoComplete="new-password" />
      <div className="space-y-2"><Label htmlFor="confirm-password" className="font-semibold text-white">Confirm private password</Label><Input id="confirm-password" type="password" autoComplete="new-password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} className="auth-input h-12 border-white/30" /></div>
      <p className="text-xs leading-5 text-white/80">Use at least 10 characters with uppercase, lowercase and a number.</p>
    </>}
    {step !== "email" && <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-white"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} className="h-4 w-4 rounded border-white/40 accent-cyan-400" /><span>Keep me logged in on this device</span></label>}
    {error && <div role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div>}
    <Button type="submit" variant="gradient" className="h-12 w-full" disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}{step === "email" ? "Continue" : step === "setup" ? "Create password and sign in" : "Sign in"}</Button>
    {step === "email" && <p className="text-center text-xs font-medium leading-5 text-white/80">Enter your registered team email. First-time users will create a private password—there is no shared password.</p>}
  </form>;
}

function PasswordField({ label, value, setValue, visible, setVisible, autoComplete }: { label: string; value: string; setValue: (value: string) => void; visible: boolean; setVisible: (value: boolean) => void; autoComplete: string }) {
  return <div className="space-y-2"><Label htmlFor="member-password" className="font-semibold text-white">{label}</Label><div className="relative"><Input id="member-password" type={visible ? "text" : "password"} autoComplete={autoComplete} required value={value} onChange={(event) => setValue(event.target.value)} className="auth-input h-12 border-white/30 pr-12" /><button type="button" onClick={() => setVisible(!visible)} className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-500 hover:text-slate-900" aria-label={visible ? "Hide password" : "Show password"}>{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>;
}
