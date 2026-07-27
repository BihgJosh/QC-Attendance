import type { Metadata } from "next";
import { ServiceToolsHub } from "@/components/public/service-tools-hub";
import { EmergencyAlertLoader } from "@/components/emergency-alert-loader";

export const metadata: Metadata = {
  title: "Service Tools | Quality Control Unit",
  description: "QC service reporting, timing, observation, emergency and leadership tools for Streams of Joy International.",
};

export default function ServiceToolsPage() {
  return (
    <>
      <EmergencyAlertLoader />
      <ServiceToolsHub />
    </>
  );
}
