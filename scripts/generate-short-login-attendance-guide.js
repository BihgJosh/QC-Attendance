const fs = require("fs");
const path = require("path");
const {
  AlignmentType, BorderStyle, Document, Footer, Header, ImageRun, PageBreak,
  PageNumber, Paragraph, Packer, ShadingType, Table, TableCell, TableRow,
  TextRun, WidthType,
} = require("docx");

const root = path.resolve(__dirname, "..");
const inputDir = path.join(root, "artifacts", "walkthrough-short");
const outDir = path.join(root, "artifacts", "documents");
fs.mkdirSync(outDir, { recursive: true });
const output = path.join(outDir, "QC-Login-and-Attendance-Picture-Guide.docx");

const C = { navy: "09172F", purple: "8D20B5", cyan: "36A9E1", pale: "EFF9FD", ink: "182033", gray: "667085", white: "FFFFFF", green: "137A4C", amber: "9A6700", line: "D6E1EA" };
const contentWidth = 9360;
const text = (value, options = {}) => new TextRun({ text: value, font: "Arial", size: 22, color: C.ink, ...options });
const para = (value, options = {}) => new Paragraph({ spacing: { after: 120, line: 290 }, ...options, children: [text(value)] });
const title = (value) => new Paragraph({ spacing: { after: 100 }, children: [text(value, { bold: true, size: 34, color: C.navy })] });
const sub = (value) => new Paragraph({ spacing: { after: 180 }, children: [text(value, { size: 20, color: C.gray })] });
const cellBorders = { top: { style: BorderStyle.SINGLE, size: 2, color: C.line }, bottom: { style: BorderStyle.SINGLE, size: 2, color: C.line }, left: { style: BorderStyle.SINGLE, size: 2, color: C.line }, right: { style: BorderStyle.SINGLE, size: 2, color: C.line } };

function callout(number, heading, body, tone = "blue") {
  const color = tone === "green" ? C.green : tone === "warn" ? C.amber : C.purple;
  return new Table({
    width: { size: 4700, type: WidthType.DXA }, columnWidths: [650, 4050],
    rows: [new TableRow({ children: [
      new TableCell({ width: { size: 650, type: WidthType.DXA }, shading: { fill: color, type: ShadingType.CLEAR }, borders: cellBorders, margins: { top: 160, bottom: 160, left: 80, right: 80 }, verticalAlign: "center", children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [text(String(number), { bold: true, size: 28, color: C.white })] })] }),
      new TableCell({ width: { size: 4050, type: WidthType.DXA }, shading: { fill: "F8FAFC", type: ShadingType.CLEAR }, borders: cellBorders, margins: { top: 130, bottom: 130, left: 160, right: 160 }, children: [new Paragraph({ spacing: { after: 45 }, children: [text(heading, { bold: true, size: 21, color })] }), new Paragraph({ children: [text(body, { size: 19, color: C.gray })] })] }),
    ] })],
  });
}

function screenshotCell(file, alt) {
  return new TableCell({ width: { size: 4100, type: WidthType.DXA }, borders: cellBorders, shading: { fill: "F4F7FB", type: ShadingType.CLEAR }, margins: { top: 100, bottom: 100, left: 100, right: 100 }, verticalAlign: "center", children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: "png", data: fs.readFileSync(path.join(inputDir, file)), transformation: { width: 225, height: 488 }, altText: { title: alt, description: alt, name: alt } })] })] });
}

function guidePage(number, heading, subtitle, image, callouts, note) {
  const right = [];
  callouts.forEach((item, index) => {
    right.push(callout(...item));
    if (index < callouts.length - 1) right.push(new Paragraph({ spacing: { after: 100 } }));
  });
  right.push(new Paragraph({ spacing: { before: 120, after: 40 }, children: [text("IMPORTANT", { bold: true, size: 17, color: C.amber, characterSpacing: 100 })] }));
  right.push(new Paragraph({ shading: { fill: "FFF7E6", type: ShadingType.CLEAR }, border: { left: { style: BorderStyle.SINGLE, size: 14, color: C.amber, space: 6 } }, spacing: { after: 0 }, indent: { left: 120, right: 80 }, children: [text(note, { size: 19, color: C.ink })] }));
  return [
    new Paragraph({ spacing: { after: 80 }, children: [text(`STEP ${number}`, { bold: true, size: 18, color: C.cyan, characterSpacing: 120 })] }),
    title(heading), sub(subtitle),
    new Table({ width: { size: contentWidth, type: WidthType.DXA }, columnWidths: [4300, 5060], rows: [new TableRow({ children: [screenshotCell(image, heading), new TableCell({ width: { size: 5060, type: WidthType.DXA }, borders: cellBorders, margins: { top: 140, bottom: 140, left: 180, right: 180 }, children: right })] })] }),
  ];
}

const children = [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100, after: 70 }, children: [text("QC MEMBER QUICK GUIDE", { bold: true, size: 18, color: C.cyan, characterSpacing: 140 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [text("Login & Sign Attendance", { bold: true, size: 38, color: C.navy })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 260 }, children: [text("Follow the numbered boxes beside each screenshot.", { size: 21, color: C.gray })] }),
  ...guidePage("1", "Log in", "Use the email registered with QC and your private password.", "login.png", [
    [1, "Click Team email", "Enter your registered team email."],
    [2, "Click Password", "Enter your private password."],
    [3, "Click Sign in", "Wait for the homepage to open.", "green"],
  ], "First visit? Use the temporary password supplied by QC leadership, then create your private password."),
  new Paragraph({ children: [new PageBreak()] }),
  ...guidePage("2", "Sign attendance", "Only sign when you are physically at church and ready to serve.", "attendance.png", [
    [1, "Click Service", "Choose the correct service."],
    [2, "Check Member Name", "Confirm that your linked name is correct."],
    [3, "Click Sign Attendance", "Allow location access when your phone asks.", "green"],
  ], "Keep GPS/Location Services on. Wait for “Attendance Confirmed” before closing the page."),
  new Paragraph({ spacing: { before: 160, after: 60 }, alignment: AlignmentType.CENTER, children: [text("If attendance is closed, your name is wrong, or location fails, contact your QC team lead.", { bold: true, size: 19, color: C.navy })] }),
];

const doc = new Document({
  creator: "Codex", title: "QC Login and Attendance Picture Guide",
  styles: { default: { document: { run: { font: "Arial", size: 22, color: C.ink } } } },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 708, footer: 708 } } },
    headers: { default: new Header({ children: [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.cyan, space: 3 } }, children: [text("QUALITY CONTROL UNIT • STREAMS OF JOY", { bold: true, size: 15, color: C.navy })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [text("Quick Guide  |  Page ", { size: 16, color: C.gray }), new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: C.gray })] })] }) },
    children,
  }],
});

Packer.toBuffer(doc).then((buffer) => { fs.writeFileSync(output, buffer); process.stdout.write(output); });
