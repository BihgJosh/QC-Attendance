import type { Metadata } from "next";
import { ServiceToolsHub } from "@/components/public/service-tools-hub";
import { EmergencyAlertLoader } from "@/components/emergency-alert-loader";
import { readMemberSession } from "@/lib/member-auth";
import { redirect } from "next/navigation";
import { resolveUserAccess } from "@/lib/member-store";

export const metadata: Metadata = {
  title: "Service Tools | Quality Control Unit",
  description: "QC service reporting, timing, observation, emergency and leadership tools for Streams of Joy International.",
};

export default async function ServiceToolsPage() {
  const session = await readMemberSession();
  if (!session) redirect("/member/login?next=/service-tools");
  const access = await resolveUserAccess(session.email);
  const canViewServiceManager = ["service_manager", "hod", "admin", "super_admin"].includes(access.role);
  const canViewReportActivity = ["admin", "super_admin"].includes(access.role);
  return (
    <>
      <EmergencyAlertLoader />
      <ServiceToolsHub canViewServiceManager={canViewServiceManager} canViewReportActivity={canViewReportActivity} />
    </>
  );
}
