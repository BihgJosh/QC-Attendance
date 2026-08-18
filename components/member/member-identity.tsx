"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Mail, X } from "lucide-react";
import type { MemberIdentity } from "@/lib/member-store";

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "QC";
}

export function IdentityAvatar({ identity, name, size = "md", dark = false }: { identity?: MemberIdentity; name: string; size?: "sm" | "md" | "lg"; dark?: boolean }) {
  const dimension = size === "sm" ? "h-8 w-8 text-xs" : size === "lg" ? "h-20 w-20 text-xl" : "h-11 w-11 text-xs";
  return <span className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full font-black ring-1 ring-inset ${dimension} ${dark ? "bg-cyan-300/15 text-cyan-100 ring-white/20" : "bg-cyan-100 text-cyan-950 ring-cyan-200"}`}>
    {identity?.avatarUrl ? <img src={identity.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials(identity?.name || name)}
  </span>;
}

export function MemberIdentityCard({ identity, fallbackName, fallbackEmail = "", dark = false, compact = false }: { identity?: MemberIdentity; fallbackName: string; fallbackEmail?: string; dark?: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const name = identity?.name || fallbackName || "Unknown member";
  const email = identity?.email || fallbackEmail;

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!open) return;
    const position = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      if (!trigger) return;
      if (window.innerWidth < 640) setStyle({ left: 16, right: 16, bottom: 16 });
      else {
        const width = 288;
        const left = Math.min(window.innerWidth - width - 16, Math.max(16, trigger.left));
        const below = trigger.bottom + 10;
        setStyle({ width, left, top: below + 190 < window.innerHeight ? below : Math.max(16, trigger.top - 180) });
      }
    };
    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !cardRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => { window.removeEventListener("resize", position); window.removeEventListener("scroll", position, true); document.removeEventListener("pointerdown", outside); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { triggerRef.current?.focus(); setOpen(false); } };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open]);

  const enter = () => { if (closeTimer.current) clearTimeout(closeTimer.current); setOpen(true); };
  const leave = () => { closeTimer.current = setTimeout(() => setOpen(false), 140); };

  return <>
    <button ref={triggerRef} type="button" aria-label={`View ${name}'s profile identity`} aria-expanded={open} onClick={() => setOpen((value) => !value)} onFocus={enter} onPointerEnter={(event) => { if (event.pointerType === "mouse") enter(); }} onPointerLeave={(event) => { if (event.pointerType === "mouse") leave(); }} className={`flex min-w-0 items-center rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 ${compact ? "gap-2" : "gap-3"}`}>
      <IdentityAvatar identity={identity} name={name} size={compact ? "sm" : "md"} dark={dark} />
      <span className="min-w-0"><span className={`block truncate font-bold ${compact ? "text-xs" : ""}`}>{name}</span>{!compact && email && <span className={`block truncate text-xs ${dark ? "text-white/50" : "text-slate-500"}`}>{email}</span>}</span>
    </button>
    {mounted && open && createPortal(<div ref={cardRef} role="dialog" aria-label={`${name}'s profile identity`} style={style} onPointerEnter={enter} onPointerLeave={leave} className="fixed z-[100] overflow-hidden rounded-2xl bg-white text-slate-950 shadow-[0_22px_52px_-24px_rgba(15,23,42,.45)] ring-1 ring-inset ring-slate-200">
      <div className="h-12 bg-[linear-gradient(115deg,#0e7490,#2563eb_52%,#7e22ce)]" />
      <button type="button" onClick={() => { triggerRef.current?.focus(); setOpen(false); }} className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-xl bg-slate-950/25 text-white hover:bg-slate-950/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Close identity card"><X className="h-4 w-4" /></button>
      <div className="px-5 pb-5"><div className="-mt-8"><IdentityAvatar identity={identity} name={name} size="lg" /></div><p className="mt-3 break-words text-lg font-black tracking-tight">{name}</p>{email ? <p className="mt-2 flex min-w-0 items-center gap-2 break-all text-sm text-slate-600"><Mail className="h-4 w-4 shrink-0 text-cyan-700" />{email}</p> : <p className="mt-2 text-sm text-slate-500">Email unavailable for this historical report.</p>}</div>
    </div>, document.body)}
  </>;
}
