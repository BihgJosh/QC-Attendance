import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { PWARegister } from "@/components/pwa-register";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { NotificationPrompt } from "@/components/notification-prompt";

export const metadata: Metadata = {
  title: "Quality Control Unit | Streams of Joy International",
  description: "The home of the Streams of Joy Quality Control Unit — announcements, postings, uniform guidance and attendance.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "QC Unit",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}>
        <div className="hidden" aria-hidden="true" dangerouslySetInnerHTML={{ __html: `<!--
THESIS: My Profile behaves like a digital membership passport, refusing a generic settings-card dashboard.
OWN-WORLD: QC navy, cyan and purple; cool paper surfaces; precise rounded controls; restrained offset depth.
STORY: A member recognizes their identity and role, keeps personal details accurate, and verifies sensitive email changes.
FIRST VIEWPORT: Compact app navigation, identity passport with photo/name/email/role, then a two-column editing workspace with profile details leading.
FORM: Identity-first passport, selected whole-surface structure, seed 016962ff.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->` }} />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {/* Ambient Background */}
          <div className="ambient-bg">
            <div className="ambient-orb ambient-orb-blue animate-float-slow" style={{ width: "500px", height: "500px", top: "-100px", left: "-100px" }} />
            <div className="ambient-orb ambient-orb-purple animate-float-slow-2" style={{ width: "600px", height: "600px", bottom: "-150px", right: "-150px" }} />
            <div className="ambient-orb ambient-orb-royal animate-float-slow-3" style={{ width: "400px", height: "400px", top: "40%", left: "50%" }} />
            <div className="noise-texture" />
          </div>
          {children}
          <Toaster richColors position="top-right" />
          <PWARegister />
          <PWAInstallPrompt />
          <NotificationPrompt />
        </ThemeProvider>
      </body>
    </html>
  );
}
