"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Camera, Check, Loader2, MailCheck, Save, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { MemberLogoutButton } from "@/components/member/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Role = "general_user" | "service_manager" | "hod" | "admin" | "super_admin";
type Profile = { email: string; firstName: string; middleName: string; lastName: string; phone: string; birthMonth: number | null; birthDay: number | null; avatarUrl: string | null; role: Role };

const roleLabels: Record<Role, string> = { general_user: "General User", service_manager: "Service Manager", hod: "HOD", admin: "Admin", super_admin: "Super Admin" };
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function initials(profile: Profile | null) {
  if (!profile) return "QC";
  return [profile.firstName, profile.lastName].filter(Boolean).map((part) => part[0]?.toUpperCase()).join("") || "QC";
}

function daysInMonth(month: number | null) {
  return month ? new Date(2000, month, 0).getDate() : 31;
}

async function processImage(file: File) {
  const extension = file.name.toLowerCase().split(".").pop() || "";
  const imageExtensions = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif", "avif", "gif", "tif", "tiff", "bmp"]);
  if (!file.type.startsWith("image/") && !imageExtensions.has(extension)) throw new Error("Choose a supported photo from your device.");
  if (!file.size || file.size > 15 * 1024 * 1024) throw new Error("Choose an image smaller than 15 MB.");
  const objectUrl = URL.createObjectURL(file);
  const source = await new Promise<HTMLImageElement | null>((resolve) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = objectUrl;
  });
  if (!source) { URL.revokeObjectURL(objectUrl); return file; }
  const side = Math.min(source.naturalWidth, source.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) { URL.revokeObjectURL(objectUrl); return file; }
  context.drawImage(source, (source.naturalWidth - side) / 2, (source.naturalHeight - side) / 2, side, side, 0, 0, 512, 512);
  URL.revokeObjectURL(objectUrl);
  for (const type of ["image/webp", "image/jpeg"]) {
    for (const quality of [0.82, 0.7, 0.58]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
      if (blob && blob.size <= 400 * 1024 && blob.type === type) {
        const extension = type === "image/webp" ? "webp" : "jpg";
        return new File([blob], `profile.${extension}`, { type });
      }
    }
  }
  return file;
}

export function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [code, setCode] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dayCount = useMemo(() => daysInMonth(profile?.birthMonth ?? null), [profile?.birthMonth]);

  async function load() {
    setLoading(true); setLoadError("");
    try {
      const response = await fetch("/api/member/profile", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setProfile(data.profile);
    } catch (error) { const message = (error as Error).message; setLoadError(message); toast.error(message); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  function set<K extends keyof Profile>(key: K, value: Profile[K]) { setProfile((current) => current ? { ...current, [key]: value } : current); }

  async function save(event: FormEvent) {
    event.preventDefault(); if (!profile) return;
    setSaving(true);
    try {
      const response = await fetch("/api/member/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      toast.success("Your profile has been updated."); await load();
    } catch (error) { toast.error((error as Error).message); }
    finally { setSaving(false); }
  }

  async function changePhoto(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0]; event.target.value = ""; if (!selected) return;
    setPhotoBusy(true);
    try {
      const image = await processImage(selected); const form = new FormData(); form.set("image", image);
      const response = await fetch("/api/member/profile/image", { method: "POST", body: form });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      set("avatarUrl", data.avatarUrl); toast.success("Profile picture updated.");
    } catch (error) { toast.error((error as Error).message); }
    finally { setPhotoBusy(false); }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    try {
      const response = await fetch("/api/member/profile/image", { method: "DELETE" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      set("avatarUrl", null); toast.success("Profile picture removed.");
    } catch (error) { toast.error((error as Error).message); }
    finally { setPhotoBusy(false); }
  }

  async function requestEmail(event: FormEvent) {
    event.preventDefault(); setEmailBusy(true);
    try {
      const response = await fetch("/api/member/profile/email/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: pendingEmail }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setVerificationSent(true); toast.success(`Verification code sent to ${data.email}.`);
    } catch (error) { toast.error((error as Error).message); }
    finally { setEmailBusy(false); }
  }

  async function confirmEmail(event: FormEvent) {
    event.preventDefault(); setEmailBusy(true);
    try {
      const response = await fetch("/api/member/profile/email/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setVerificationSent(false); setPendingEmail(""); setCode(""); toast.success("Your sign-in email has been changed."); await load();
    } catch (error) { toast.error((error as Error).message); }
    finally { setEmailBusy(false); }
  }

  return <main className="relative z-10 min-h-screen pb-24">
    <header className="safe-top-nav px-3 pt-3 sm:px-6 sm:pt-5">
      <nav className="mx-auto flex max-w-6xl items-center justify-between rounded-2xl bg-[linear-gradient(110deg,#020c20,#1a1445_58%,#4a1460)] px-3 py-2.5 text-white shadow-[0_18px_50px_-24px_rgba(2,6,23,.72)] sm:px-5" aria-label="Profile navigation">
        <Link href="/" className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
          <span className="relative h-10 w-10 overflow-hidden rounded-xl bg-white"><Image src="/soja-logo.jpeg" alt="" fill sizes="40px" className="object-cover" /></span>
          <span className="min-w-0"><strong className="block truncate text-sm">Quality Control Unit</strong><small className="block text-[10px] font-semibold uppercase tracking-[.16em] text-cyan-100/65">My profile</small></span>
        </Link>
        <div className="flex items-center gap-1"><ThemeToggle /><MemberLogoutButton compact /></div>
      </nav>
    </header>

    <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
      <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><ArrowLeft className="h-4 w-4" />Back to home</Link>
      {loading ? <div className="grid min-h-[60vh] place-items-center" role="status"><Loader2 className="h-7 w-7 animate-spin text-primary" /><span className="sr-only">Loading profile</span></div> : loadError || !profile ? <section className="mx-auto mt-16 max-w-lg rounded-2xl bg-card p-8 text-center shadow-[var(--surface-shadow)]" role="alert"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-100 text-red-700"><UserRound className="h-6 w-6" /></span><h1 className="mt-5 text-2xl font-bold tracking-[-.03em]">Your profile could not be loaded</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{loadError || "The profile service did not return your details."}</p><Button type="button" className="mt-6" onClick={() => void load()}>Try again</Button></section> : <div className="mt-4 grid items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-2xl bg-[#07152f] text-white shadow-[0_24px_70px_-34px_rgba(2,6,23,.8)] lg:sticky lg:top-6">
          <div className="relative h-28 bg-[radial-gradient(circle_at_15%_20%,rgba(57,169,219,.8),transparent_45%),linear-gradient(135deg,#102d5c,#6d0e83)]" />
          <div className="px-6 pb-7">
            <div className="relative -mt-14 h-28 w-28 overflow-hidden rounded-full bg-cyan-100 text-cyan-950 ring-4 ring-[#07152f] shadow-lg">
              {profile.avatarUrl ? <img src={profile.avatarUrl} alt={`${profile.firstName} ${profile.lastName}`} className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-3xl font-bold">{initials(profile)}</span>}
              {photoBusy && <span className="absolute inset-0 grid place-items-center bg-slate-950/60"><Loader2 className="h-6 w-6 animate-spin" /></span>}
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-[-.03em]">{[profile.firstName, profile.middleName, profile.lastName].filter(Boolean).join(" ") || "My Profile"}</h1>
            <p className="mt-1 break-all text-sm text-cyan-50/70">{profile.email}</p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-cyan-300/15 px-3 py-1.5 text-xs font-bold text-cyan-200"><ShieldCheck className="h-4 w-4" />{roleLabels[profile.role]}</div>
            <p className="mt-3 text-xs leading-5 text-white/55">Your role is assigned by an administrator and cannot be changed here.</p>
            <input ref={fileRef} type="file" accept="image/*,.heic,.heif,.avif,.tif,.tiff,.bmp" className="sr-only" onChange={changePhoto} />
            <div className="mt-6 grid gap-2">
              <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()} disabled={photoBusy}><Camera className="mr-2 h-4 w-4" />{profile.avatarUrl ? "Replace picture" : "Add profile picture"}</Button>
              {profile.avatarUrl && <Button type="button" variant="ghost" className="text-white/70 hover:bg-white/10 hover:text-white" onClick={removePhoto} disabled={photoBusy}><Trash2 className="mr-2 h-4 w-4" />Remove picture</Button>}
            </div>
            <p className="mt-4 text-xs leading-5 text-white/45">JPG, PNG, WebP, HEIC, HEIF, AVIF, GIF, TIFF or BMP up to 15 MB. Cropping and optimization are automatic.</p>
          </div>
        </aside>

        <div className="space-y-6">
          <form onSubmit={save} className="overflow-hidden rounded-2xl bg-card shadow-[var(--surface-shadow)]">
            <div className="border-b border-border/70 px-5 py-6 sm:px-8"><h2 className="text-2xl font-bold tracking-[-.03em]">Personal information</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Keep the name and contact details connected to your QC account accurate.</p></div>
            <div className="space-y-8 px-5 py-6 sm:px-8 sm:py-8">
              <section aria-labelledby="name-heading"><h3 id="name-heading" className="text-base font-bold">Your name</h3><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="First name" id="first-name"><Input id="first-name" autoComplete="given-name" value={profile.firstName} onChange={(event) => set("firstName", event.target.value)} maxLength={80} required /></Field><Field label="Middle name" id="middle-name"><Input id="middle-name" autoComplete="additional-name" value={profile.middleName} onChange={(event) => set("middleName", event.target.value)} maxLength={80} /></Field><Field label="Last name" id="last-name"><Input id="last-name" autoComplete="family-name" value={profile.lastName} onChange={(event) => set("lastName", event.target.value)} maxLength={80} required /></Field><Field label="Phone number" id="phone"><Input id="phone" type="tel" inputMode="tel" autoComplete="tel" value={profile.phone} onChange={(event) => set("phone", event.target.value)} maxLength={30} placeholder="e.g. +234 800 000 0000" /></Field></div></section>
              <section aria-labelledby="birthday-heading"><h3 id="birthday-heading" className="text-base font-bold">Birthday</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Only the month and day are collected. We never ask for your birth year.</p><div className="mt-4 grid gap-4 sm:max-w-md sm:grid-cols-2"><SelectField label="Month" id="birth-month" value={profile.birthMonth ?? ""} onChange={(value) => { const month = Number(value) || null; set("birthMonth", month); if (profile.birthDay && profile.birthDay > daysInMonth(month)) set("birthDay", null); }} options={months.map((label, index) => ({ value: index + 1, label }))} /><SelectField label="Day" id="birth-day" value={profile.birthDay ?? ""} onChange={(value) => set("birthDay", Number(value) || null)} options={Array.from({ length: dayCount }, (_, index) => ({ value: index + 1, label: String(index + 1) }))} /></div></section>
            </div>
            <div className="flex justify-end border-t border-border/70 bg-muted/30 px-5 py-4 sm:px-8"><Button type="submit" variant="gradient" disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save profile</Button></div>
          </form>

          <section className="overflow-hidden rounded-2xl bg-card shadow-[var(--surface-shadow)]">
            <div className="px-5 py-6 sm:px-8"><div className="flex items-start gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><BadgeCheck className="h-5 w-5" /></span><div><h2 className="text-xl font-bold tracking-[-.02em]">Verified email</h2><p className="mt-1 break-all text-sm font-semibold">{profile.email}</p><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">A replacement becomes your sign-in email only after you confirm the six-digit code sent to it.</p></div></div></div>
            {!verificationSent ? <form onSubmit={requestEmail} className="grid gap-4 border-t border-border/70 px-5 py-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:px-8"><Field label="New email address" id="new-email"><Input id="new-email" type="email" autoComplete="email" value={pendingEmail} onChange={(event) => setPendingEmail(event.target.value)} placeholder="name@example.com" required /></Field><Button type="submit" variant="outline" disabled={emailBusy}>{emailBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailCheck className="mr-2 h-4 w-4" />}Send verification code</Button></form> : <form onSubmit={confirmEmail} className="grid gap-4 border-t border-border/70 bg-cyan-50/50 px-5 py-6 dark:bg-cyan-950/15 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:px-8"><Field label={`Code sent to ${pendingEmail}`} id="email-code"><Input id="email-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" required /></Field><div className="flex gap-2"><Button type="button" variant="ghost" onClick={() => { setVerificationSent(false); setCode(""); }} disabled={emailBusy}>Cancel</Button><Button type="submit" disabled={emailBusy || code.length !== 6}>{emailBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Confirm email</Button></div></form>}
          </section>
        </div>
      </div>}
    </div>
  </main>;
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) { return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>; }
function SelectField({ label, id, value, onChange, options }: { label: string; id: string; value: string | number; onChange: (value: string) => void; options: Array<{ value: string | number; label: string }> }) { return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"><option value="">Not provided</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>; }
