import assert from "node:assert/strict";
import { buildFinalReportRows, FINAL_REPORT_COLUMN_COUNT, FINAL_REPORT_CONTENT_END_COLUMN, FINAL_REPORT_CONTENT_START_COLUMN } from "../lib/final-report-layout.ts";

const services = ["1st Service", "2nd Service", "3rd Service", "4th Service", "Thursday Service", "Other - Special Thanksgiving"];
const posts = services.map((service, index) => ({
  service,
  area: index === 0 ? "Children's Church" : `Area ${index + 1}`,
  adults_headcount: 100 + index,
  children_headcount: 10 + index,
  what_went_well: `Positive observation for ${service}`,
  areas_for_improvement: index === 1 ? "None" : `Attention point for ${service}`,
  recommendations: `Recommendation for ${service}`,
  incident_flag: index === 2 ? "Yes" : "No",
  incident_description: index === 2 ? "A documented incident" : "",
  mighty_arrows: index === 0 ? { topicTaught: "Stand Strong", safetyFlag: "No" } : {},
}));

const report = buildFinalReportRows({
  date: "2026-08-22",
  posts,
  timers: [{
    service: "1st Service",
    service_start: "07:00",
    service_end: "09:00",
    general_observation: "Service ended smoothly",
    segments: { praise_and_worship: { status: "Overshot", planned_minutes: 20, actual_minutes: 25, variance: "5 min" } },
  }],
  observers: [{
    service: "1st Service",
    reporting_location: "Main Auditorium",
    general_observations: "Auditorium remained orderly",
    unit_reports: { protocol: "Protocol coordinated movement" },
    recommendations: "Maintain active supervision",
    conclusion: "Service was well coordinated",
  }],
  emergencies: [
    { service: "4th Service", location: "Main Entrance", description: "Medical response required", status: "Resolved", reported_by: "QC Lead" },
    { service: "Other - Emergency Vigil", location: "Car Park", description: "Lighting failure", status: "Active", reported_by: "Observer" },
    { service: "", location: "Vendor Area", description: "Unassigned safety flag", status: "Active", reported_by: "QC" },
  ],
}, "2026-08-22T15:20:00+01:00");

const text = report.rows.flat().map(String).filter(Boolean).join("\n");
for (const service of services) assert.match(text, new RegExp(service.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
assert.equal(report.rows[0][1], "STREAMS OF JOY");
assert.equal(report.rows[1][1], "QUALITY ASSURANCE");
assert.equal(report.rows[2][1], "22/08/2026");
assert.equal(report.rows[3][1], "ALL SERVICES SUMMARY REPORT");
assert.match(text, /FIRST SERVICE\nService Overview\nReporting approach:/);
assert.doesNotMatch(text, /TOTAL WORSHIPPERS|SERVICES REPORTED/);
assert.match(text, /OTHER - EMERGENCY VIGIL/);
assert.match(text, /UNASSIGNED EMERGENCY FLAGS/);
assert.match(text, /Praise And Worship: Overshot • Planned 20 • Actual 25 • Variance 5 min/);
assert.match(text, /Topic Taught: Stand Strong/);
assert.match(text, /Protocol — OBSERVATION/);
assert.match(text, /Medical response required/);
assert.doesNotMatch(text, /AREAS REQUIRING ATTENTION\nNone/i);
assert.doesNotMatch(text, /\{\s*"/);
assert.ok(report.rows.every((row) => row.length === FINAL_REPORT_COLUMN_COUNT));
assert.ok(report.merges.every((merge) => merge.startRow >= 0 && merge.endRow <= report.rows.length && merge.startColumn === FINAL_REPORT_CONTENT_START_COLUMN && merge.endColumn === FINAL_REPORT_CONTENT_END_COLUMN));

const partial = buildFinalReportRows({ date: "YYYY-MM-DD" }, "2026-08-22T15:20:00+01:00");
assert.equal(partial.rows[0][1], "STREAMS OF JOY");
assert.equal(partial.rows[2][1], "REPORT DATE");
assert.equal(partial.rows[3][1], "ALL SERVICES SUMMARY REPORT");
assert.ok(partial.rows.every((row) => row.length === FINAL_REPORT_COLUMN_COUNT));

const fourServices = buildFinalReportRows({ date: "2026-08-16", posts: posts.slice(0, 4) }, "2026-08-16T16:00:00+01:00");
assert.equal(fourServices.rows[3][1], "ALL FOUR SERVICES SUMMARY REPORT");

console.log(JSON.stringify({ ok: true, wordDocumentHierarchy: true, namedServicesDocumented: 7, unassignedEmergencySection: true, rows: report.rows.length }));
