import { Suspense } from "react";
import { MemberAuthShell } from "@/components/member/auth-shell";
import { MemberLoginForm } from "@/components/member/login-form";

export default function MemberLoginPage() {
  return <MemberAuthShell eyebrow="Member access" title="Welcome back" copy="Sign in with the same email address listed in the official QC team register."><Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-white/5" />}><MemberLoginForm /></Suspense></MemberAuthShell>;
}
