"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, LockKeyhole, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

interface LoginFormProps {
  onLogin?: () => void;
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      toast.success("Welcome back, Administrator");
      if (onLogin) {
        onLogin();
      } else {
        router.push("/admin/dashboard");
        router.refresh();
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex flex-col items-center mb-8"
        >
          <Link href="/" aria-label="Go to homepage" className="relative mb-4 rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4">
            <div className="absolute inset-0 brand-gradient rounded-3xl blur-2xl opacity-30 animate-breathe" />
            <div className="relative w-20 h-20 rounded-3xl glass-card flex items-center justify-center shadow-xl overflow-hidden">
              <Image
                src="/soja-logo.jpeg"
                alt="Streams of Joy International"
                width={68}
                height={68}
                className="rounded-2xl object-cover dark:brightness-[1.15] dark:contrast-[1.1]"
                priority
              />
            </div>
          </Link>
          <p className="text-xs text-muted-foreground/60 uppercase tracking-widest font-medium">
            Streams of Joy International
          </p>
        </motion.div>

        <Card variant="glass" className="shadow-2xl shadow-black/[0.08]">
          <CardHeader>
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground flex items-center mb-2 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Home
            </Link>
            <CardTitle className="text-2xl font-display">Admin Portal</CardTitle>
            <CardDescription>Enter your administrator password to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs uppercase tracking-wide text-muted-foreground">Admin Password</Label>
                <div className="relative">
                  <LockKeyhole className="absolute left-4 top-4 h-4 w-4 text-muted-foreground/50" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-11"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>
              <Button type="submit" variant="gradient" className="w-full h-12" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {loading ? "Authenticating..." : "Access Dashboard"}
              </Button>
            </form>
            <div className="mt-5 border-t border-border/60 pt-5 text-center">
              <p className="text-xs text-muted-foreground">Authorized member administrator?</p>
              <Button asChild variant="outline" className="mt-3 w-full">
                <Link href="/member/login?next=/admin/dashboard">Sign in with member account</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
