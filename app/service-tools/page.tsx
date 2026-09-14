import type { Metadata } from "next";
import { ServiceToolsHub } from "@/components/public/service-tools-hub";
import { EmergencyAlertLoader } from "@/components/emergency-alert-loader";
import { readMemberSession } from "@/lib/member-auth";
import { redirect } from "next/navigation";
import { getMemberProfile, resolveUserAccess } from "@/lib/member-store";
import { canViewEmergencyAlerts } from "@/lib/member-permissions";
import { canReviewMemberDefault, canSubmitMemberDefault } from "@/lib/member-default-permissions";

export const metadata: Metadata = {
  title: "Service Tools | Quality Control Unit",
  description: "QC service reporting, timing, observation, emergency and leadership tools for Streams of Joy International.",
};

export default async function ServiceToolsPage() {
  const session = await readMemberSession();
  if (!session) redirect("/member/login?next=/service-tools");
  const access = await resolveUserAccess(session.email);
  const profile = await getMemberProfile(session.token).catch(() => null);
  const memberIdentity = {
    name: profile ? [profile.firstName, profile.middleName, profile.lastName].filter(Boolean).join(" ") : session.email,
    email: session.email,
    phone: profile?.phone || "",
    avatarUrl: profile?.avatarUrl || null,
  };
  const canViewServiceManager = ["service_manager", "operations", "admin", "super_admin"].includes(access.role);
  const canManageServiceReports = ["service_manager", "admin", "super_admin"].includes(access.role);
  const canViewReportActivity = ["admin", "super_admin"].includes(access.role);
  const canSubmitMemberDefaults = canSubmitMemberDefault(access.role);
  const canReviewMemberDefaults = canReviewMemberDefault(access.role);
  return (
    <>
      {canViewEmergencyAlerts(access.role) && <EmergencyAlertLoader />}
      <ServiceToolsHub canViewServiceManager={canViewServiceManager} canManageServiceReports={canManageServiceReports} canViewReportActivity={canViewReportActivity} canSubmitMemberDefaults={canSubmitMemberDefaults} canReviewMemberDefaults={canReviewMemberDefaults} memberIdentity={memberIdentity} />
    </>
  );
}
