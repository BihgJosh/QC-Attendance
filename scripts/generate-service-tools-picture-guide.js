const fs = require("fs");
const path = require("path");
const { AlignmentType, BorderStyle, Document, Footer, Header, ImageRun, PageBreak, PageNumber, Paragraph, Packer, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } = require("docx");

const root = path.resolve(__dirname, "..");
const imgDir = path.join(root, "artifacts", "service-tools-guide");
const outDir = path.join(root, "artifacts", "documents");
fs.mkdirSync(outDir, { recursive: true });
const output = path.join(outDir, "QC-Service-Tools-and-Reports-Picture-Guide.docx");
const C = { navy: "07152F", purple: "7E22A8", cyan: "159AC7", pale: "ECF8FC", ink: "172033", gray: "667085", white: "FFFFFF", green: "147A4B", amber: "9A6700", red: "B42318", line: "D6E1EA" };
const W = 9360;
const r = (text, o={}) => new TextRun({ text, font: "Arial", size: 21, color: C.ink, ...o });
const p = (text, o={}) => new Paragraph({ spacing: { after: 100, line: 280 }, ...o, children: [r(text)] });
const br = () => new Paragraph({ children: [new PageBreak()] });
const borders = { top: { style: BorderStyle.SINGLE, size: 2, color: C.line }, bottom: { style: BorderStyle.SINGLE, size: 2, color: C.line }, left: { style: BorderStyle.SINGLE, size: 2, color: C.line }, right: { style: BorderStyle.SINGLE, size: 2, color: C.line } };

function pageTitle(kicker, title, subtitle) {
  return [
    new Paragraph({ spacing: { after: 60 }, children: [r(kicker.toUpperCase(), { bold: true, size: 17, color: C.cyan, characterSpacing: 100 })] }),
    new Paragraph({ spacing: { after: 60 }, children: [r(title, { bold: true, size: 34, color: C.navy })] }),
    new Paragraph({ spacing: { after: 150 }, children: [r(subtitle, { size: 20, color: C.gray })] }),
  ];
}

function shot(file, alt, height=330) {
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 140 }, children: [new ImageRun({ type: "png", data: fs.readFileSync(path.join(imgDir, file)), transformation: { width: Math.round(height * 1280 / 900), height }, altText: { title: alt, description: alt, name: alt } })] });
}

function card(n, heading, body, tone=C.purple) {
  return new TableCell({ width: { size: 4680, type: WidthType.DXA }, borders, shading: { fill: "F8FAFC", type: ShadingType.CLEAR }, margins: { top: 120, bottom: 120, left: 150, right: 150 }, children: [
    new Paragraph({ spacing: { after: 45 }, children: [r(`${n}  ${heading}`, { bold: true, size: 20, color: tone })] }),
    new Paragraph({ children: [r(body, { size: 18, color: C.gray })] }),
  ] });
}

function steps(items) {
  const rows=[];
  for(let i=0;i<items.length;i+=2) rows.push(new TableRow({ children: [card(i+1, ...items[i]), card(i+2, ...(items[i+1] || ["", ""]))] }));
  return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [4680,4680], rows });
}

function note(label, body, tone="blue") {
  const color=tone==="red"?C.red:tone==="amber"?C.amber:C.cyan;
  return new Paragraph({ spacing: { before: 120, after: 0 }, shading: { fill: tone==="red"?"FEEDEC":tone==="amber"?"FFF7E6":C.pale, type: ShadingType.CLEAR }, border: { left: { style: BorderStyle.SINGLE, size: 16, color, space: 6 } }, indent: { left: 140, right: 100 }, children: [r(`${label}: `,{bold:true,color,size:18}),r(body,{size:18})] });
}

const pages=[];
pages.push(
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 500, after: 80 }, children: [r("QC SERVICE OPERATIONS", { bold: true, size: 18, color: C.cyan, characterSpacing: 150 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [r("Service Tools & Reports", { bold: true, size: 42, color: C.navy })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [r("Picture-led quick guide", { size: 26, color: C.purple })] }),
  new Table({ width:{size:W,type:WidthType.DXA}, columnWidths:[1872,1872,1872,1872,1872], rows:[new TableRow({children:[
    ["1","Service Post"],["2","Timer"],["3","Observer"],["4","Emergency"],["5","Manager"],
  ].map(([n,t])=>new TableCell({width:{size:1872,type:WidthType.DXA},borders,shading:{fill:n==="4"?"FEEDEC":C.pale,type:ShadingType.CLEAR},margins:{top:180,bottom:180,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:50},children:[r(n,{bold:true,size:30,color:n==="4"?C.red:C.purple})]}),new Paragraph({alignment:AlignmentType.CENTER,children:[r(t,{bold:true,size:17,color:C.navy})]})]}))})] }),
  new Paragraph({ spacing:{before:260,after:100}, children:[r("Choose the tool assigned to your role",{bold:true,size:26,color:C.navy})] }),
  p("Open Service Tools, select the correct card, complete the form immediately after the service activity, review it, and submit only once."),
  note("Rule", "Use factual entries, correct service/date, and example-free real data when submitting. Never share manager passwords.", "amber"),
  br(),
);

pages.push(...pageTitle("Report 1", "Service Post Report", "Headcount, standards and incidents for one assigned observation area."), shot("service-post.png","QC Post Report screen"), steps([
  ["Choose service and area", "Select the correct service and your assigned observation area."],
  ["Enter reporter and headcount", "Add your full name, adults and children observed."],
  ["Rate the post", "Complete every required preparedness, neatness, orderliness, conduct, compliance, coordination and overall rating."],
  ["Review and submit", "Add observations/incidents, tick the accuracy confirmation, then click Submit Report.", C.green],
]), note("Function", "Creates the post-level evidence used in the compiled leadership report."), br());

pages.push(...pageTitle("Report 2", "Service Timer", "Track actual timing and every early, late or on-time program segment."), shot("service-timer.png","Service Timer screen"), steps([
  ["Identify the service", "Confirm the date, service and timer name."],
  ["Enter start and end", "Record the actual service start and service end times."],
  ["Mark every segment", "Choose On Time, Overshot or Finished Early; enter minutes and seconds for any variance."],
  ["Submit the timer log", "Add the general observation, review all segments and click Submit Timer Log.", C.green],
]), note("Function", "Produces a segment-by-segment timing record for leadership review."), br());

pages.push(...pageTitle("Report 3", "Observer Report", "One structured report covering every unit visited during the service."), shot("observer-report.png","Observer Report screen"), steps([
  ["Enter service details", "Confirm date, service and observer name."],
  ["Write the general view", "Record the service atmosphere or issue not tied to one unit."],
  ["Select units visited", "Click each unit actually observed; a separate text box opens for each one."],
  ["Conclude and submit", "Add recommendations and commendations, then click Submit Observer Report.", C.green],
]), note("Function", "Combines cross-unit observations into one leadership-ready report."), br());

pages.push(...pageTitle("Urgent Tool", "Emergency Flag", "Immediately alert connected QC users about an urgent incident."), shot("emergency-flag.png","Emergency Flag screen"), steps([
  ["Enter your name", "Use a name responders can identify quickly."],
  ["Give the exact location", "State the entrance, aisle, gallery, class, gate or post."],
  ["Describe the incident", "Keep it short and factual: what is happening and what help is needed."],
  ["Send immediately", "Click Send Emergency Flag, then follow the physical escalation procedure.", C.red],
]), note("Safety", "For a life-threatening incident, alert Medical or Security in person immediately. Do not rely on the app alone.", "red"), br());

pages.push(...pageTitle("Leadership", "Service Manager", "Restricted workspace that combines all submitted reports into one service view."), shot("manager-login.png","Service Manager access screen",260), steps([
  ["Unlock", "Enter the authorised manager password and click Open service summary."],
  ["Choose date and service", "Review the all-services overview, then click View report for one service."],
  ["Read the compiled report", "Check headcount, post ratings, timer status, observer notes, incidents and emergency flags."],
  ["Generate or email", "Click Generate report for the workbook; use Email report only for an approved recipient.", C.green],
]), note("Function", "Turns the Service Post, Timer, Observer and Emergency submissions into a single operational picture."), br());

pages.push(...pageTitle("Final check", "Before You Submit Any Report", "A 20-second accuracy check prevents duplicate or misleading records."),
  new Table({width:{size:W,type:WidthType.DXA},columnWidths:[W],rows:[
    ["Correct date and service","The selected service matches the one you observed."],
    ["Correct identity and area","Reporter name and observation area are accurate."],
    ["Complete required fields","Every required rating, unit note or timing segment is complete."],
    ["Factual wording","Observations describe what happened, where and the operational impact."],
    ["One submission","Wait for the success message; do not submit duplicates unless instructed."],
  ].map(([a,b],i)=>new TableRow({children:[new TableCell({width:{size:W,type:WidthType.DXA},borders,shading:{fill:i%2?"F8FAFC":C.pale,type:ShadingType.CLEAR},margins:{top:150,bottom:150,left:180,right:180},children:[new Paragraph({spacing:{after:40},children:[r(a,{bold:true,size:21,color:C.navy})]}),new Paragraph({children:[r(b,{size:19,color:C.gray})]})]})]}))}),
  note("Support", "If a form fails, capture the exact error message and contact the QC team lead. Do not send passwords or sensitive incident details through an unauthorised channel.", "amber")
);

const doc = new Document({
  creator: "Codex",
  title: "QC Service Tools and Reports Picture Guide",
  styles: { default: { document: { run: { font: "Arial", size: 21, color: C.ink } } } },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 708, footer: 708 } } },
    headers: { default: new Header({ children: [new Paragraph({ children: [r("QUALITY CONTROL UNIT  |  SERVICE TOOLS", { bold: true, size: 15, color: C.navy })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [r("Picture Guide  |  Page ", { size: 16, color: C.gray }), new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: C.gray })] })] }) },
    children: pages,
  }],
});
Packer.toBuffer(doc).then(buf=>{fs.writeFileSync(output,buf);process.stdout.write(output);});
