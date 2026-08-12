const fs = require("fs");
const path = require("path");
const {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, ImageRun,
  LevelFormat, PageBreak, PageNumber, Paragraph, Packer, ShadingType, Table,
  TableCell, TableRow, TextRun, WidthType,
} = require("docx");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "artifacts", "documents");
fs.mkdirSync(outDir, { recursive: true });
const output = path.join(outDir, "QC-Attendance-Solution-User-Walkthrough.docx");

const C = { navy: "07152F", purple: "74168D", cyan: "21A7D8", light: "EAF7FB", ink: "172033", gray: "667085", line: "D7E1EA", white: "FFFFFF", green: "16794A", amber: "9A6700", red: "B42318" };
const contentWidth = 9360;
const logoPath = path.join(root, "public", "soja-logo.jpeg");

const run = (text, opts = {}) => new TextRun({ text, font: "Arial", size: 22, color: C.ink, ...opts });
const p = (text, opts = {}) => new Paragraph({ spacing: { after: 140, line: 300 }, children: [run(text, opts)] });
const bullet = (text, level = 0) => new Paragraph({ numbering: { reference: "bullets", level }, spacing: { after: 80, line: 280 }, children: [run(text)] });
const step = (title, body, ref = "steps") => new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { before: 80, after: 120, line: 300 }, children: [run(title + ". ", { bold: true, color: C.navy }), run(body)] });
const heading = (text, level = 1) => new Paragraph({ heading: level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2, children: [run(text, { bold: true, color: level === 1 ? C.navy : C.purple, size: level === 1 ? 32 : 27 })] });
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });
const label = (text) => new Paragraph({ spacing: { before: 80, after: 80 }, children: [run(text.toUpperCase(), { bold: true, size: 18, color: C.cyan, characterSpacing: 80 })] });

function callout(title, body, tone = "blue") {
  const palette = tone === "warn" ? ["FFF6DE", C.amber] : tone === "danger" ? ["FEEDEC", C.red] : [C.light, C.navy];
  return new Table({
    width: { size: contentWidth, type: WidthType.DXA }, columnWidths: [contentWidth],
    rows: [new TableRow({ children: [new TableCell({
      width: { size: contentWidth, type: WidthType.DXA }, shading: { fill: palette[0], type: ShadingType.CLEAR },
      borders: { top: { style: BorderStyle.SINGLE, size: 4, color: palette[1] }, bottom: { style: BorderStyle.SINGLE, size: 4, color: palette[1] }, left: { style: BorderStyle.SINGLE, size: 16, color: palette[1] }, right: { style: BorderStyle.SINGLE, size: 4, color: palette[1] } },
      margins: { top: 180, bottom: 180, left: 220, right: 220 },
      children: [new Paragraph({ spacing: { after: 70 }, children: [run(title, { bold: true, color: palette[1] })] }), p(body)],
    })] })],
  });
}

function screenshot(file, caption, width = 650) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) return [callout("Screenshot unavailable", caption, "warn")];
  const isJpeg = /\.jpe?g$/i.test(full);
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 140, after: 80 }, children: [new ImageRun({ type: isJpeg ? "jpg" : "png", data: fs.readFileSync(full), transformation: { width, height: Math.round(width * 0.58) }, altText: { title: caption, description: caption, name: caption } })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 180 }, children: [run(caption, { italics: true, size: 18, color: C.gray })] }),
  ];
}

function quickTable(rows) {
  const widths = [2600, 6760];
  return new Table({ width: { size: contentWidth, type: WidthType.DXA }, columnWidths: widths, rows: rows.map((r, i) => new TableRow({ children: r.map((value, j) => new TableCell({ width: { size: widths[j], type: WidthType.DXA }, shading: i === 0 ? { fill: C.navy, type: ShadingType.CLEAR } : undefined, borders: { top: { style: BorderStyle.SINGLE, size: 2, color: C.line }, bottom: { style: BorderStyle.SINGLE, size: 2, color: C.line }, left: { style: BorderStyle.SINGLE, size: 2, color: C.line }, right: { style: BorderStyle.SINGLE, size: 2, color: C.line } }, margins: { top: 110, bottom: 110, left: 140, right: 140 }, children: [new Paragraph({ children: [run(value, { bold: i === 0, color: i === 0 ? C.white : C.ink, size: 20 })] })] })) })) });
}

const body = [];
body.push(
  new Paragraph({ spacing: { before: 700, after: 240 }, alignment: AlignmentType.CENTER, children: [new ImageRun({ type: "jpg", data: fs.readFileSync(logoPath), transformation: { width: 105, height: 105 }, altText: { title: "Streams of Joy logo", description: "Quality Control Unit logo", name: "QC logo" } })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 150 }, children: [run("QUALITY CONTROL UNIT", { bold: true, size: 20, color: C.cyan, characterSpacing: 160 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 220 }, children: [run("Attendance & Service Operations Solution", { bold: true, size: 42, color: C.navy })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360 }, children: [run("Step-by-Step User Walkthrough", { size: 30, color: C.purple })] }),
  callout("Who this guide is for", "QC members signing attendance or checking their posting, team members submitting service reports, service managers reviewing a service, and administrators managing attendance and homepage information."),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 520 }, children: [run("Editable Microsoft Word guide • August 2026", { size: 18, color: C.gray })] }),
  pageBreak(),
  heading("1. Start Here"),
  p("The solution is a mobile-friendly QC workspace. After signing in, members can read announcements, confirm postings and uniform instructions, record attendance within the church geofence, and open service-operation tools."),
  label("What you need"),
  bullet("A phone or computer with a current web browser and internet access."),
  bullet("Your email address as listed in the official QC team register."),
  bullet("Your private password, or the temporary team password on your first visit."),
  bullet("Location Services enabled when signing attendance."),
  bullet("The Service Manager or administrator password only if leadership has assigned that responsibility."),
  heading("Quick route map", 2),
  quickTable([["Area", "Purpose"], ["Home", "Announcements, birthdays, postings, uniform brief and navigation."], ["Attendance", "Geofenced member check-in for a selected service."], ["Service Tools", "Post report, timer, observer report, emergency flag and leadership summary."], ["Admin", "Attendance controls, records, exports, content, access and password resets."]]),
  callout("Security reminder", "Never share your private password. Do not include administrator or Service Manager passwords in screenshots, messages or this document.", "warn"),
  pageBreak(),
  heading("2. Sign In as a Member"),
  step("Open the member sign-in page", "Use the solution link supplied by QC leadership. If you are redirected to Member Access, you must sign in before continuing.", "signin"),
  step("Enter your registered email", "Use the same email address recorded in the official QC team register.", "signin"),
  step("Enter your password", "Returning members use their private password. On your first visit, use the temporary team password provided by QC leadership.", "signin"),
  step("Select Sign in", "Wait for the solution to verify your account. If the details are correct, you will continue to the requested page.", "signin"),
  ...screenshot("artifacts/member-auth/login-mobile.png", "Member sign-in screen on a mobile device", 300),
  heading("First visit: create a private password", 2),
  step("Enter a new password", "Use at least 8 characters, with uppercase and lowercase letters and at least one number.", "password"),
  step("Confirm it", "Type the same password again.", "password"),
  step("Save private password", "After saving, you are signed in and can use the solution.", "password"),
  callout("If sign-in fails", "Check the email spelling and password. If the account is still locked or the temporary password no longer works, ask an administrator to reset your member password.", "warn"),
  pageBreak(),
  heading("3. Use the Home and Briefing Areas"),
  step("Read announcements", "On Home, review the current unit announcements and any birthday notice."),
  step("Check your posting", "Open Postings, choose the correct Service day, find your assigned location, then confirm the service row and role under your name."),
  step("Check the uniform brief", "Scroll to Uniform and confirm every listed item and any additional note before leaving for service."),
  step("Change the appearance if needed", "Use the theme control in the top navigation to switch between light and dark appearance."),
  step("Sign out on a shared device", "Use Sign out in the navigation when you finish. This protects your account."),
  callout("Posting confirmation", "Published postings are the working brief, but team leads confirm assignments during the pre-service briefing."),
  heading("Install the solution on your phone (optional)", 2),
  p("When the install prompt appears, choose Install App. The solution will be added to the home screen and can open like an app. Browser wording may vary on iPhone and Android."),
  ...screenshot("artifacts/pwa/install-prompt-mobile.png", "Install prompt for quick access from a phone", 300),
  pageBreak(),
  heading("4. Sign Attendance"),
  step("Open Attendance", "Select Sign attendance on Home or Attendance in the navigation."),
  step("Select the service", "Choose the service you are attending from the Service list."),
  step("Confirm your name", "The solution normally loads the member name linked to your signed-in account. If a name selector is shown, choose the correct registered name."),
  step("Allow location access", "When the browser asks, select Allow. Keep Location Services/GPS turned on."),
  step("Submit the check-in", "Select the attendance button and remain on the page while the solution obtains and verifies your location."),
  step("Confirm success", "A green Attendance Confirmed message means the record has been saved."),
  callout("Important", "You must be within the configured church attendance radius. Attendance may also be closed outside the permitted check-in window.", "warn"),
  heading("If you see “Service Already Recorded”", 2),
  p("A member/device can record a service only once. Do not repeatedly retry. If a genuine correction is required, ask an authorised administrator to use the override shown on the page. The administrator must enter the admin password personally."),
  heading("Common attendance messages", 2),
  quickTable([["Message", "What to do"], ["Location access denied", "Open browser/site settings, allow location, switch on GPS and retry."], ["Outside attendance area", "Move to the approved church location and retry. Do not falsify location."], ["Attendance is closed", "Confirm the service window with QC leadership."], ["Name not found", "Ask leadership to verify your entry in the official register."], ["Service already recorded", "No action is needed unless the record is genuinely incorrect."]]),
  pageBreak(),
  heading("5. Use QC Service Tools"),
  p("Open Service Tools from Home or the navigation. Choose the tool assigned to your role. Complete the form carefully, review it, and submit once."),
  quickTable([["Tool", "Use it for"], ["Service Post", "Headcount, standards ratings, incidents, strengths, improvements and recommendations for one assigned post."], ["Service Timer", "Actual service times and early/late/on-time status for each program segment."], ["Observer Report", "Cross-unit observations, recommendations, conclusion and commendations."], ["Emergency Flag", "An urgent issue requiring immediate visibility."], ["Service Manager", "Restricted compiled service summary and report generation."]]),
  heading("Service Post walkthrough", 2),
  step("Open Service Post", "Select Open live form on the Service Post card."),
  step("Identify the service", "Enter the date, service, observer/reporter and assigned area."),
  step("Enter headcount", "Record adults and children accurately; use the observed figures for the assigned area."),
  step("Complete ratings and observations", "Rate preparedness, neatness, orderliness, conduct, guideline compliance and coordination, then describe what went well and what should improve."),
  step("Record incidents where applicable", "Add leadership incidents or children/teens observations only when relevant."),
  step("Review and submit", "Check names, numbers and wording before submitting the post report."),
  heading("Service Timer walkthrough", 2),
  step("Open Service Timer", "Select Open live form on the Timer card."),
  step("Enter service details", "Provide the date, service number and timer name."),
  step("Record start and end", "Enter actual service start and end times."),
  step("Complete each segment", "Mark it On Time, Early or Late. For a variance, enter the correct minutes and seconds."),
  step("Add an extra segment if needed", "Use the optional segment for an unscheduled moment."),
  step("Add the closing observation and submit", "Summarise the service timeline, review all entries and submit."),
  pageBreak(),
  heading("6. Observer and Emergency Workflows"),
  heading("Observer Report", 2),
  step("Open Observer Report", "Select Open live form on the Observer card."),
  step("Enter the service and observer details", "Select the correct date and service and enter the observer’s name."),
  step("Write the general observation", "Summarise the overall atmosphere and whole-service view."),
  step("Select every unit visited", "Only choose units that were actually observed."),
  step("Write a separate observation for each unit", "Use factual, specific language. Identify what happened, its impact and any evidence."),
  step("Add recommendations, conclusion and commendations", "Make corrective actions clear and recognise strong performance."),
  step("Review and submit", "Confirm that each selected unit has a useful observation."),
  heading("Emergency Flag", 2),
  callout("Use only for urgent incidents", "Emergency Flag is designed for issues that need immediate visibility. Routine observations belong in the Post or Observer report.", "danger"),
  step("Open Emergency Flag", "Select Report now on the Emergency card."),
  step("Enter your name", "Use the name leadership can identify quickly."),
  step("Give the exact location", "For example, state the entrance, aisle, gallery, children’s area or post—not only “church.”"),
  step("Describe what is happening", "Keep it concise and factual. Include the immediate risk and help already requested."),
  step("Submit immediately", "After submission, follow the unit’s emergency/escalation procedure and remain available for follow-up."),
  pageBreak(),
  heading("7. Service Manager (Leadership)"),
  step("Open Service Tools", "Select Open service summary on the Service Manager card."),
  step("Unlock the dashboard", "Enter the restricted Service Manager password supplied by leadership, then select Unlock."),
  step("Review all services", "Use the overview to compare worshippers, incidents, emergency flags and report coverage."),
  step("Open one service", "Select View report for the required service."),
  step("Review the compiled sections", "Check worshipper headcount, post ratings, timer results, observer notes, emergency flags and incidents."),
  step("Generate the report", "Select Generate report. When generation completes, use Open service workbook to review the logged document."),
  step("Share when authorised", "Open the email panel, enter an approved recipient address and select Send email."),
  callout("Leadership check", "Generated reports are drafts. Verify names, totals, incidents and recommendations before distributing them."),
  pageBreak(),
  heading("8. Administrator Walkthrough"),
  p("Administrators can sign in using the admin password, or with a member account whose email has been granted admin access."),
  step("Open Admin", "Select Admin from Home, or open the administrator login page."),
  step("Authenticate", "Enter the administrator password and select Sign in, or choose Sign in with member account if your member email has admin permission."),
  step("Control attendance", "Open or close attendance and confirm the active configuration before members begin check-in."),
  step("Review records", "Use search, filters, sorting and pagination to find attendance records and rejected/out-of-bounds attempts."),
  step("Export when needed", "Use the CSV export for approved operational reporting. Store exported files securely."),
  step("Update homepage content", "Edit Announcements, Postings or Uniform. Save each section separately; confirm the success notice before leaving."),
  step("Manage member passwords", "Search the team-access list, choose Reset password, then Confirm reset. The member is signed out and must use the temporary password before creating a new private password."),
  step("Manage admin access", "Add a trusted registered email under Admin access. To remove access, choose Remove and then Confirm removal. Protected primary access cannot be removed from this screen."),
  ...screenshot("artifacts/member-auth/admin-access-desktop.png", "Administrator access-management screen", 650),
  heading("Publishing homepage information", 2),
  bullet("Announcements: edit the label, title and announcement text; add or delete notices; then Save announcements."),
  bullet("Postings: select Sunday or Thursday, edit locations, services, roles and member assignments; then save that day’s postings."),
  bullet("Uniform: upload a JPG, PNG or WebP image smaller than 3 MB if needed, edit the uniform items and note, then Save uniform."),
  callout("Before publishing", "Double-check dates, spelling, posting names and assignments. Each section is saved independently, so an unsaved section will not be published.", "warn"),
  pageBreak(),
  heading("9. Troubleshooting and Good Practice"),
  quickTable([["Situation", "Recommended action"], ["Page does not load", "Check internet access, refresh once, then reopen the supplied solution link."], ["Install prompt is absent", "Continue in the browser; installation is optional. Browser/device support varies."], ["Forgotten member password", "Ask an administrator to reset it. Sign in with the temporary password and create a new private password."], ["Report was submitted with an error", "Notify the relevant team lead/service manager promptly; do not submit duplicates unless instructed."], ["Admin page says access denied", "Confirm that your registered member email has been granted administrator access."], ["Data looks out of date", "Refresh the page. If it persists, report the exact page, service, date and time to the solution administrator."]]),
  heading("Good reporting standard", 2),
  bullet("Be factual: record what was observed, not assumptions about motive."),
  bullet("Be specific: include the location, service, time and affected unit where relevant."),
  bullet("Be concise: make the important point easy for leadership to act on."),
  bullet("Protect privacy: do not share passwords, exported attendance data or sensitive incidents in unauthorised channels."),
  bullet("Avoid duplicates: wait for the confirmation message before resubmitting."),
  heading("Support information", 2),
  p("For access, data corrections or technical problems, contact the QC solution administrator or team lead. Include the page/tool name, service, approximate time and the exact error message. Do not send your password."),
  callout("End-of-task check", "Sign out when using a shared device. Confirm that attendance or report submission shows a success message before closing the browser."),
);

const doc = new Document({
  creator: "Codex", title: "QC Attendance Solution User Walkthrough", subject: "Step-by-step editable user guide",
  styles: { default: { document: { run: { font: "Arial", size: 22, color: C.ink }, paragraph: { spacing: { after: 120, line: 300 } } } }, paragraphStyles: [
    { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Arial", size: 32, bold: true, color: C.navy }, paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 0, keepNext: true } },
    { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Arial", size: 27, bold: true, color: C.purple }, paragraph: { spacing: { before: 220, after: 120 }, outlineLevel: 1, keepNext: true } },
  ] },
  numbering: { config: [
    { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 560, hanging: 280 } } } }, { level: 1, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 980, hanging: 280 } } } }] },
    ...["steps", "signin", "password"].map(reference => ({ reference, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } }, run: { bold: true, color: C.cyan } } }] })),
  ] },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1440, bottom: 1080, left: 1440, header: 520, footer: 520 } } },
    headers: { default: new Header({ children: [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.cyan, space: 4 } }, tabStops: [{ type: "right", position: 9360 }], children: [run("QC Attendance & Service Operations", { bold: true, size: 17, color: C.navy }), run("\tUSER WALKTHROUGH", { bold: true, size: 16, color: C.gray })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run("Quality Control Unit  |  Page ", { size: 17, color: C.gray }), new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 17, color: C.gray })] })] }) },
    children: body,
  }],
});

Packer.toBuffer(doc).then(buffer => { fs.writeFileSync(output, buffer); process.stdout.write(output); });
