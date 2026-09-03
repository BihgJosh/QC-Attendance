"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="qc-not-found">
      <div className="qc-not-found__glow" aria-hidden="true" />
      <section className="qc-not-found__content">
        <Link href="/" className="qc-not-found__brand" aria-label="QC Streams of Joy Abuja home">
          <Image src="/icon.png" alt="" width={52} height={52} priority />
          <span><strong>QC</strong><small>Streams of Joy Abuja</small></span>
        </Link>

        <div className="qc-not-found__art" aria-hidden="true">
          <span className="qc-not-found__number">404</span>
          <svg viewBox="0 0 620 150" focusable="false">
            <path d="M12 72c92 76 191 40 216-4 17-30-14-49-36-24-29 33 12 88 94 79 57-6 83-35 117-44" />
          </svg>
          <Image src="/icon.png" alt="" width={118} height={118} priority className="qc-not-found__bird" />
        </div>

        <div className="qc-not-found__message">
          <p className="qc-not-found__eyebrow">Page not found</p>
          <h1>This page flew off course</h1>
          <p>The page you’re looking for may have moved or no longer exists.</p>
        </div>

        <div className="qc-not-found__actions">
          <Button asChild variant="gradient" size="lg">
            <Link href="/"><Home className="mr-2 h-4 w-4" />Return home</Link>
          </Button>
          <Button type="button" variant="ghost" size="lg" className="text-cyan-300 hover:bg-white/10 hover:text-white" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />Go back
          </Button>
        </div>
      </section>
    </main>
  );
}
