"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomSelect } from "@/components/ui/custom-select";
import { toast } from "sonner";
import { formatAbujaTime } from "@/lib/timezone";
import { getDeviceId } from "@/lib/device-id";
import {
  Loader2, MapPin, User, CheckCircle2, Sparkles,
  Satellite, Navigation, AlertCircle, Check, Church, Shield,
} from "lucide-react";

const SERVICES = ["Sunday", "Thursday", "Other"] as const;
type ServiceType = typeof SERVICES[number];

interface AttendanceCardProps {
  isOpen: boolean | null;
  memberName: string;
}

interface GpsPhase {
  label: string;
  icon: typeof Satellite;
}

const GPS_PHASES: GpsPhase[] = [
  { label: "Acquiring GPS signal...", icon: Satellite },
  { label: "Verifying location...", icon: Navigation },
];

export function AttendanceCard({ isOpen, memberName }: AttendanceCardProps) {
  const [name, setName] = useState(memberName);
  const [service, setService] = useState<ServiceType>("Sunday");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successData, setSuccessData] = useState<{ name: string; time: string } | null>(null);
  const [gpsPhase, setGpsPhase] = useState(0);
  const [deviceId] = useState(getDeviceId);

  /* ---------- Admin override state ---------- */
  const [showAdminOverride, setShowAdminOverride] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");

  /* ---------- Autocomplete state ---------- */
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [nameTouched, setNameTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => setName(memberName), [memberName]);

  /* ---------- Inline validation ---------- */
  const nameError = nameTouched && !isNameValid(name) ? "Your member name could not be loaded from Team Data." : null;

  function isNameValid(value: string): boolean {
    return value.trim() === memberName.trim() && memberName.trim().length > 0;
  }

  /* ---------- Fetch whitelist ---------- */
  useEffect(() => {
    const fetchWhitelist = async () => {
      try {
        const res = await fetch("/api/whitelist");
        if (res.ok) {
          const data = await res.json();
          setWhitelist(data.names);
        }
      } catch {
        // silent
      }
    };
    fetchWhitelist();
  }, []);

  /* ---------- Autocomplete filtering ---------- */
  const updateSuggestions = useCallback((value: string) => {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    const inputWords = trimmed.split(/\s+/).filter(Boolean);
    const matches = whitelist.filter((wn) => {
      const ww = wn.split(/\s+/);
      return inputWords.every((w) => ww.includes(w));
    });
    setSuggestions(matches.slice(0, 8));
    setShowDropdown(matches.length > 0 && matches[0] !== trimmed);
    setActiveIndex(-1);
  }, [whitelist]);

  useEffect(() => {
    updateSuggestions(name);
  }, [name, updateSuggestions]);

  /* ---------- Autocomplete keyboard nav ---------- */
  const selectSuggestion = (suggestion: string) => {
    setName(suggestion);
    setShowDropdown(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
      setActiveIndex(-1);
    }
  };

  /* Close dropdown on outside click */
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  /* ---------- Form submission ---------- */
  const getBrowserInfo = () => {
    const userAgent = navigator.userAgent;
    let browser = "Unknown";
    let device = "Desktop";

    if (userAgent.match(/chrome|chromium|crios/i)) browser = "Chrome";
    else if (userAgent.match(/firefox|fxios/i)) browser = "Firefox";
    else if (userAgent.match(/safari/i)) browser = "Safari";
    else if (userAgent.match(/edg/i)) browser = "Edge";

    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
      device = "Mobile";
    } else if (/Mac|Windows|Linux/i.test(userAgent)) {
      device = "Desktop";
    }

    return { browser, device };
  };

  const submitAttendance = async (adminPw?: string) => {
    setShowAdminOverride(false);
    setAdminPassword("");

    setLoading(true);
    setGpsPhase(0);

    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setGpsPhase(1);
        const { latitude, longitude } = position.coords;
        const { browser, device } = getBrowserInfo();

        // Small delay so the user can see phase 2
        await new Promise((r) => setTimeout(r, 400));

        try {
          const body: Record<string, any> = {
            name, service, latitude, longitude, browser, device, deviceId,
          };
          if (adminPw) body.adminPassword = adminPw;

          const res = await fetch("/api/attendance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

          const data = await res.json();

          if (!res.ok) {
            // ── Device already signed — show admin override ──
            if (data.error === "device_already_signed") {
              setShowAdminOverride(true);
              throw new Error(data.message || "This device has already signed in for this service today.");
            }
            throw new Error(data.error || "Failed to sign attendance");
          }

          const now = new Date();
          setSuccessData({
            name: name,
            time: formatAbujaTime(now),
          });
          setSuccess(true);
          toast.success("Attendance signed successfully!");
          setNameTouched(false);
        } catch (error: any) {
          if (!showAdminOverride) {
            toast.error(error.message || "An error occurred.", {
              description: "Please try again or contact an administrator.",
            });
          }
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        toast.error("Location access denied.", {
          description: "Please enable GPS permissions to sign attendance.",
        });
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameTouched(true);

    if (!isOpen) {
      toast.error("Attendance is currently closed.", {
        description: "Please wait for an administrator to open attendance.",
      });
      return;
    }

    if (nameError) {
      toast.error("Name not found in the whitelist.", {
        description: "Check your spelling or try a different combination of your names.",
      });
      return;
    }

    // Check if device already signed today (local check before hitting server)
    await submitAttendance();
  };

  const handleAdminOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitAttendance(adminPassword);
  };

  const CurrentGpsIcon = GPS_PHASES[gpsPhase].icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-md"
    >
      <Card variant="gradient-border" className="shadow-2xl shadow-black/[0.08]">
        <CardHeader>
          <CardTitle className="text-xl font-display flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Sign Attendance
          </CardTitle>
          <CardDescription>Enter your details to confirm your presence.</CardDescription>
        </CardHeader>
        <CardContent>
          {success && successData ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center justify-center py-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
                className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mb-5"
              >
                <CheckCircle2 className="w-12 h-12 text-success" strokeWidth={1.5} />
              </motion.div>
              <h3 className="text-lg font-semibold mb-1">Attendance Confirmed</h3>
              <p className="text-sm text-muted-foreground mb-1">{successData.name}</p>
              <p className="text-xs text-muted-foreground mb-6">Recorded at {successData.time}</p>
              <Button variant="outline" size="sm" onClick={() => { setSuccess(false); setSuccessData(null); }}>
                Sign in for another member
              </Button>
            </motion.div>
          ) : showAdminOverride ? (
            /* ── Admin Override Form ── */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-14 h-14 rounded-2xl bg-warning/10 flex items-center justify-center mb-3">
                  <Shield className="w-7 h-7 text-warning" strokeWidth={1.5} />
                </div>
                <h3 className="text-base font-semibold mb-1">Service Already Recorded</h3>
                <p className="text-xs text-muted-foreground max-w-xs">
                  This device has already signed attendance for this service today. An administrator can override this with their admin password.
                </p>
              </div>

              <form onSubmit={handleAdminOverride} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="adminPassword" className="text-xs uppercase tracking-wide text-muted-foreground">
                    Admin Password
                  </Label>
                  <div className="relative">
                    <Shield className="absolute left-4 top-4 h-4 w-4 text-muted-foreground/50" />
                    <Input
                      id="adminPassword"
                      type="password"
                      placeholder="Enter admin password to override"
                      className="pl-11"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  variant="gradient"
                  className="w-full h-12 text-base font-semibold"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Shield className="mr-2 h-4 w-4" />
                      Admin Override — Sign In
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground"
                  onClick={() => { setShowAdminOverride(false); setAdminPassword(""); }}
                >
                  Cancel
                </Button>
              </form>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Service selector */}
              <div className="space-y-2">
                <Label htmlFor="service" className="text-xs uppercase tracking-wide text-muted-foreground">
                  Service
                </Label>
                <CustomSelect
                  options={[
                    { value: "Sunday", label: "Sunday Service" },
                    { value: "Thursday", label: "Thursday Service" },
                    { value: "Other", label: "Other Service" },
                  ]}
                  value={service}
                  onChange={(v) => setService(v as ServiceType)}
                  placeholder="Select service"
                  icon={<Church className="w-4 h-4" />}
                  disabled={loading || !isOpen}
                />
              </div>

              {/* Name field with autocomplete */}
              <div className="space-y-2 relative">
                <Label htmlFor="name" className="text-xs uppercase tracking-wide text-muted-foreground">
                  Member Name
                </Label>
                <div className="relative">
                  <User className="absolute left-4 top-4 h-4 w-4 text-muted-foreground/50 z-10" />
                  <Input
                    ref={inputRef}
                    id="name"
                    placeholder="Loading your member name…"
                    className={`pl-11 ${nameError ? "border-destructive/50 focus-visible:ring-destructive/40 focus-visible:border-destructive/40" : ""}`}
                    value={name}
                    readOnly
                    required
                    disabled={loading || !isOpen}
                    aria-readonly="true"
                  />
                  {nameTouched && name.trim().length > 0 && !loading && (
                    <div className="absolute right-4 top-4 z-10">
                      {isNameValid(name) ? (
                        <Check className="w-4 h-4 text-success" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-destructive/60" />
                      )}
                    </div>
                  )}
                </div>

                {/* Inline name error */}
                <AnimatePresence>
                  {nameError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: "auto" }}
                      exit={{ opacity: 0, y: -4, height: 0 }}
                      className="text-xs text-destructive/80 flex items-center gap-1.5 pt-0.5"
                    >
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {nameError}
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Autocomplete dropdown */}
                <AnimatePresence>
                  {false && showDropdown && suggestions.length > 0 && (
                    <motion.div
                      ref={dropdownRef}
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute z-50 left-0 right-0 mt-1 rounded-xl border border-border bg-card shadow-xl shadow-black/[0.08] overflow-hidden"
                    >
                      <div className="max-h-48 overflow-y-auto scrollbar-thin py-1">
                        {suggestions.map((suggestion, i) => (
                          <button
                            key={suggestion}
                            type="button"
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors duration-100 flex items-center gap-3 ${
                              i === activeIndex
                                ? "bg-primary/10 text-primary"
                                : "text-foreground hover:bg-primary/5"
                            }`}
                            onMouseDown={(e) => { e.preventDefault(); selectSuggestion(suggestion); }}
                            onMouseEnter={() => setActiveIndex(i)}
                          >
                            <User className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Submit button */}
              <Button
                type="submit"
                variant="gradient"
                className="w-full h-12 text-base font-semibold"
                disabled={loading || !isOpen}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <CurrentGpsIcon className="mr-1 h-4 w-4" />
                    {GPS_PHASES[gpsPhase].label}
                  </>
                ) : (
                  <>
                    <MapPin className="mr-2 h-4 w-4" />
                    Sign Attendance
                  </>
                )}
              </Button>

              {!isOpen && (
                <p className="text-xs text-center text-muted-foreground pt-1">
                  Attendance checking is currently closed by the administrator.
                </p>
              )}
            </form>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
