import type { Metadata } from "next";
import { ServiceToolsHub } from "@/components/public/service-tools-hub";
import { EmergencyAlertLoader } from "@/components/emergency-alert-loader";
import { readMemberSession } from "@/lib/member-auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Service Tools | Quality Control Unit",
  description: "QC service reporting, timing, observation, emergency and leadership tools for Streams of Joy International.",
};

export default async function ServiceToolsPage() {
  if (!(await readMemberSession())) redirect("/member/login?next=/service-tools");
  return (
    <>
      <EmergencyAlertLoader />
      <ServiceToolsHub />
    </>
  );
}
