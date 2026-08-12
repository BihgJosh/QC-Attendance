import "server-only";

import { callServiceReportGateway } from "@/lib/service-report-store";
import { syncFinalReportForDate } from "@/lib/final-report-sheet";

export const SERVICE_OBSERVER_UNITS = [
  "Teens Ministries", "Mighty Arrows", "Chabod Ministrels", "Ushering", "Protocol",
  "Traffic Unit (Watch Tower)", "Security", "Media", "Meeters and Greeters",
  "Temple Keepers", "Medical Care", "Streams Emporium", "Streams Enquiry Unit",
  "Instrumental Unit", "Transport Unit", "Other",
] as const;

export const SERVICE_OBSERVER_HEADERS = [
  "Date", "Service", "Observer Name", "General Observations", "Units Reported On",
  "Unit Reports JSON", "Recommendations", "Conclusion", "Who Are You", "Posted Location", "Reporting Location", "Submitted At",
];

export type ServiceObserverReport = {
  submissionId: string;
  date: string;
  service: string;
  observerName: string;
  generalObservations: string;
  unitsReported: string[];
  unitReports: Record<string, string>;
  recommendations: string;
  conclusion: string;
  reporterRole: string;
  postedLocation: string;
  reportingLocation: string;
};

export async function appendServiceObserverReport(report: ServiceObserverReport) {
  const submittedAt = new Date().toISOString();
  const inserted = await callServiceReportGateway<{ created?: boolean }>("observer.insert", {
    id: report.submissionId,
    report_date: report.date,
    service: report.service,
    observer_name: report.observerName,
    reporter_role: report.reporterRole,
    posted_location: report.postedLocation,
    reporting_location: report.reportingLocation,
    general_observations: report.generalObservations,
    units_reported: report.unitsReported,
    unit_reports: report.unitReports,
    recommendations: report.recommendations,
    conclusion: report.conclusion,
    submitted_at: submittedAt,
  });
  if (inserted.created === false) return;
  await syncFinalReportForDate(report.date).catch((error) => console.error("[service-observer] Final daily report refresh failed", error instanceof Error ? error.message : error));
}
