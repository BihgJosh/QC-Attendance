import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

export function MemberAuthShell({ eyebrow, title, copy, children }: { eyebrow: string; title: string; copy: string; children: ReactNode }) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#050d1f] px-4 py-10 text-white sm:px-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(57,169,219,.22),transparent_32%),radial-gradient(circle_at_90%_80%,rgba(142,20,168,.24),transparent_36%)]" />
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] shadow-2xl shadow-black/40 backdrop-blur-xl lg:grid-cols-[.85fr_1.15fr]">
        <section className="hidden flex-col justify-between bg-[linear-gradient(150deg,rgba(25,46,91,.98),rgba(94,20,115,.95))] p-10 lg:flex">
          <Link href="/member/login" className="flex w-fit items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" aria-label="QC member sign in">
            <span className="relative h-12 w-12 overflow-hidden rounded-xl bg-white"><Image src="/soja-logo.jpeg" alt="" fill sizes="48px" className="object-cover" /></span>
            <span><strong className="block text-sm text-white">Quality Control Unit</strong><small className="text-cyan-50/85">Streams of Joy Abuja</small></span>
          </Link>
          <div>
            <ShieldCheck className="mb-6 h-10 w-10 text-cyan-300" />
            <p className="max-w-sm text-3xl font-bold leading-tight">One secure doorway to every QC workspace.</p>
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/85">Membership is verified against the official team register before access is granted.</p>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-white/80">Excellence is our culture</p>
        </section>
        <section className="p-6 sm:p-10 lg:p-12">
          <Link href="/member/login" aria-label="QC member sign in" className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="relative h-10 w-10 overflow-hidden rounded-xl bg-white"><Image src="/soja-logo.jpeg" alt="" fill sizes="40px" className="object-cover" /></span>
            <span className="text-sm font-bold">QC · Streams of Joy Abuja</span>
          </Link>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-lg text-sm font-medium leading-6 text-white/80">{copy}</p>
          <div className="mt-8">{children}</div>
        </section>
      </div>
    </main>
  );
}
