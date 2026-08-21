export const STANDARD_SERVICE_REPORTS = ["1st Service", "2nd Service", "3rd Service", "4th Service", "Thursday Service"] as const;
export const SPECIAL_SERVICE_REPORT_OPTION = "Other Service";
export const SPECIAL_SERVICE_REPORT_PREFIX = "Other — ";

export function namedServiceReport(selectedService: string, specialServiceName: string) {
  if (selectedService !== SPECIAL_SERVICE_REPORT_OPTION) return selectedService.trim().replace(/\s+/g, " ");
  return `${SPECIAL_SERVICE_REPORT_PREFIX}${specialServiceName.trim().replace(/\s+/g, " ")}`;
}

export function isValidServiceReportName(service: string) {
  if (STANDARD_SERVICE_REPORTS.includes(service as (typeof STANDARD_SERVICE_REPORTS)[number])) return true;
  if (!service.startsWith(SPECIAL_SERVICE_REPORT_PREFIX)) return false;
  const name = service.slice(SPECIAL_SERVICE_REPORT_PREFIX.length).trim();
  return name.length >= 2 && name.length <= 80 && !/[\u0000-\u001f\u007f]/.test(name);
}
