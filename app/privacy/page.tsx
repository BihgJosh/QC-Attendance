import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Database, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Privacy Policy | Quality Control Unit",
  description: "How the Streams of Joy Abuja Quality Control Unit attendance platform processes and protects member information.",
};

const sections = [
  ["Information we process", "We may process your name, email address, phone number, profile photograph, attendance date and time, selected service, approximate attendance location, device identifier, browser and device type, assigned role, service assignments, operational reports, emergency-alert activity, and security records."],
  ["How we use information", "We use this information to authenticate members, protect platform access, confirm and audit attendance, manage profiles and postings, operate role-based service tools, deliver authorized notifications, investigate misuse, correct inaccurate records, maintain the platform, and meet applicable obligations."],
  ["Who can see member information", "Access is based on operational role. Phone numbers, email addresses and emergency alerts are restricted to authorized Service Managers, Heads of Department, Administrators and Super Administrators. General users are not permitted to view member contact details."],
  ["Service providers", "We use contracted providers for hosting, database storage, operational documents, email and push notifications. Information is shared only as necessary to operate those services or meet a lawful obligation."],
  ["Retention and security", "Records are retained for legitimate operational, accountability and security purposes. We apply reasonable technical and organizational safeguards, but no internet service can guarantee absolute security."],
  ["Your rights", "Subject to applicable law, you may request access, correction, restriction, objection, portability or deletion of eligible personal data, and you may complain to the Nigeria Data Protection Commission."],
] as const;

export default function PrivacyPage() {
  return (
    <main className="relative z-10 min-h-screen px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <article className="mx-auto max-w-4xl overflow-hidden rounded-2xl bg-card shadow-[var(--surface-shadow-raised)]">
        <header className="bg-[linear-gradient(135deg,#07152f,#24315f_58%,#6d0e83)] px-5 py-7 text-white sm:px-10 sm:py-10">
          <div className="flex items-center justify-between gap-4">
            <Link href="/member/login" className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
              <Image src="/soja-logo.jpeg" alt="" width={44} height={44} className="h-11 w-11 rounded-xl object-cover" />
              <span className="min-w-0"><strong className="block truncate text-sm">Quality Control Unit</strong><span className="block text-xs text-cyan-100/75">Streams of Joy Abuja</span></span>
            </Link>
            <Button asChild variant="ghost" className="text-white/85 hover:bg-white/10 hover:text-white"><Link href="/member/login"><ArrowLeft className="mr-2 h-4 w-4" />Sign in</Link></Button>
          </div>
          <ShieldCheck className="mt-10 h-9 w-9 text-cyan-300" aria-hidden="true" />
          <h1 className="mt-5 text-3xl font-bold tracking-[-0.03em] sm:text-5xl">Privacy Policy</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">Effective 7 September 2026. This policy explains how the QC Attendance Platform processes member information and the responsibilities attached to platform access.</p>
        </header>

        <div className="space-y-8 px-5 py-8 sm:px-10 sm:py-10">
          <section aria-labelledby="credential-responsibility" className="rounded-2xl bg-cyan-50 p-5 text-cyan-950 sm:p-6">
            <div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-700 text-white"><KeyRound className="h-5 w-5" /></span><div><h2 id="credential-responsibility" className="text-xl font-bold tracking-[-0.02em]">Credential and access responsibility</h2><p className="mt-2 text-sm leading-6 text-cyan-900">By signing in, you agree that your password, session and account access are personal to you.</p></div></div>
            <ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-6 text-cyan-900">
              <li>Do not disclose, share, lend or transfer your credentials to another person.</li>
              <li>Do not allow another person to use the platform through your account or authenticated device.</li>
              <li>Do not obtain or use another member&apos;s credentials.</li>
              <li>Report suspected unauthorized access or credential exposure immediately.</li>
              <li>Administrators may suspend access, end active sessions or require a password reset where misuse is suspected.</li>
            </ul>
            <p className="mt-4 text-sm font-semibold leading-6 text-cyan-950">An administrator using the designated attendance feature to sign in another member is not sharing account access.</p>
          </section>

          <div className="grid gap-7 sm:grid-cols-2">
            {sections.map(([title, copy], index) => <section key={title}><div className="flex items-center gap-3">{index < 2 ? <Database className="h-5 w-5 text-primary" /> : <LockKeyhole className="h-5 w-5 text-primary" />}<h2 className="text-lg font-bold tracking-[-0.02em]">{title}</h2></div><p className="mt-3 text-sm leading-6 text-muted-foreground">{copy}</p></section>)}
          </div>

          <section aria-labelledby="cookies"><h2 id="cookies" className="text-xl font-bold tracking-[-0.02em]">Cookies and device storage</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">We use essential cookies and local device storage to keep you securely signed in, remember basic preferences, manage PWA prompts, assign an attendance device identifier and protect the platform from misuse. We do not currently use advertising or third-party analytics cookies. Clearing browser storage may sign you out, reset preferences or require your device to be recognized again.</p></section>

          <section aria-labelledby="agreement" className="border-t border-border pt-7"><h2 id="agreement" className="text-xl font-bold tracking-[-0.02em]">Your agreement</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">When you select the agreement checkbox and sign in, you confirm that you have read and understood this policy, will protect your credentials, will not share or transfer platform access, and will use only your authorized account.</p></section>
        </div>
      </article>
    </main>
  );
}
