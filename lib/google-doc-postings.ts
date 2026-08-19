import "server-only";

import { google, type docs_v1 } from "googleapis";
import { getGoogleEnv } from "@/lib/env";
import { normalizeHomepageContent, parsePostingMember, type Posting, type PostingMember, type ServiceDay } from "@/lib/homepage-content";

type ParsedTable = { context: string; cells: string[][] };

const DAY_PATTERN = /\b(sunday|thursday)\b/i;
const SERVICE_PATTERN = /\b(?:service|shift)\b|\b\d+(?:st|nd|rd|th)\b/i;

function elementText(elements: docs_v1.Schema$StructuralElement[] | undefined): string {
  return (elements || []).map((element) => {
    if (element.paragraph) return (element.paragraph.elements || []).map((part) => part.textRun?.content || "").join("");
    if (element.table) return (element.table.tableRows || []).flatMap((row) => row.tableCells || []).map((cell) => elementText(cell.content)).join("\n");
    if (element.tableOfContents) return elementText(element.tableOfContents.content);
    return "";
  }).join("").replace(/\u000b/g, "\n");
}

function tableCells(table: docs_v1.Schema$Table): string[][] {
  return (table.tableRows || []).map((row) => (row.tableCells || []).map((cell) => elementText(cell.content).trim()));
}

function collectTables(elements: docs_v1.Schema$StructuralElement[] | undefined): ParsedTable[] {
  const tables: ParsedTable[] = [];
  let context = "";
  for (const element of elements || []) {
    if (element.paragraph) {
      const text = elementText([element]).trim();
      if (text) context = text.slice(0, 160);
    }
    if (element.table) {
      tables.push({ context, cells: tableCells(element.table) });
      for (const row of element.table.tableRows || []) {
        for (const cell of row.tableCells || []) tables.push(...collectTables(cell.content));
      }
    }
    if (element.tableOfContents) tables.push(...collectTables(element.tableOfContents.content));
  }
  return tables;
}

function documentElements(document: docs_v1.Schema$Document): docs_v1.Schema$StructuralElement[][] {
  const groups: docs_v1.Schema$StructuralElement[][] = [];
  if (document.body?.content?.length) groups.push(document.body.content);
  const visitTabs = (tabs: docs_v1.Schema$Tab[] | undefined) => {
    for (const tab of tabs || []) {
      if (tab.documentTab?.body?.content?.length) groups.push(tab.documentTab.body.content);
      visitTabs(tab.childTabs);
    }
  };
  visitTabs(document.tabs);
  return groups;
}

function clean(value: string) {
  return value.replace(/[\t\r]+/g, " ").replace(/[ ]{2,}/g, " ").trim();
}

function splitMembers(value: string): PostingMember[] {
  return value
    .split(/\n+|\s*[;•●▪]\s*/)
    .map((name) => clean(name).replace(/^[-–—]\s*/, ""))
    .filter((name) => Boolean(name) && !/^(?:-|—|n\/?a|none|tbc|awaiting assignment)$/i.test(name))
    .map(parsePostingMember)
    .filter((member): member is PostingMember => Boolean(member))
    .slice(0, 20);
}

function slug(value: string) {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "section";
}

function inferDay(...values: string[]): ServiceDay | null {
  const match = values.join(" ").match(DAY_PATTERN)?.[1]?.toLowerCase();
  return match === "thursday" ? "Thursday" : match === "sunday" ? "Sunday" : null;
}

function parseTable(table: ParsedTable, tableIndex: number, requestedDay: ServiceDay): Posting | null {
  let rows = table.cells
    .map((row) => row.map(clean))
    .filter((row) => row.some(Boolean));
  if (rows.length < 2) return null;

  let name = clean(table.context);
  const firstNonEmpty = rows[0].filter(Boolean);
  if (firstNonEmpty.length === 1 && rows.length >= 3) {
    name = firstNonEmpty[0];
    rows = rows.slice(1);
  }

  const day = inferDay(name, ...rows.flat()) || requestedDay;
  if (day !== requestedDay) return null;

  const headerIndex = rows.findIndex((row) => row.length >= 2 && row.slice(1).some(Boolean) && (SERVICE_PATTERN.test(row[0]) || row.slice(1).some((cell) => /team|position|entrance|exit|observer|timer|role|assignment/i.test(cell))));
  if (headerIndex < 0 || headerIndex >= rows.length - 1) return null;

  const header = rows[headerIndex];
  const columns = header.slice(1).map((column, index) => column || `Position ${index + 1}`).slice(0, 8);
  if (!columns.length) return null;

  const dataRows = rows.slice(headerIndex + 1).filter((row) => clean(row[0]) && row.slice(1).some((cell) => splitMembers(cell).length));
  if (!dataRows.length) return null;

  name = name
    .replace(DAY_PATTERN, "")
    .replace(/\b(?:posting|postings|assignment|assignments|roster|schedule)\b/gi, "")
    .replace(/^[\s:–—-]+|[\s:–—-]+$/g, "") || `Imported section ${tableIndex + 1}`;
  const id = `${day.toLowerCase()}-${slug(name)}-${tableIndex + 1}`;

  return {
    id,
    day,
    name: name.slice(0, 100),
    role: "Imported from the approved Google Doc",
    columns,
    rows: dataRows.slice(0, 12).map((row, rowIndex) => ({
      id: `${id}-row-${rowIndex + 1}`,
      label: row[0].slice(0, 60),
      assignments: columns.map((_, columnIndex) => splitMembers(row[columnIndex + 1] || "")),
    })),
  };
}

export function parseGoogleDocPostings(document: docs_v1.Schema$Document, requestedDay: ServiceDay) {
  const tables = documentElements(document).flatMap(collectTables);
  const candidates = tables.map((table, index) => parseTable(table, index, requestedDay)).filter((posting): posting is Posting => Boolean(posting));
  const postings = normalizeHomepageContent({ version: 5, postings: candidates }).postings.filter((posting) => posting.day === requestedDay);
  return {
    postings,
    tableCount: tables.length,
    warnings: tables.length > candidates.length ? [`${tables.length - candidates.length} table${tables.length - candidates.length === 1 ? " was" : "s were"} skipped because they did not match the postings layout.`] : [],
  };
}

export async function fetchGoogleDocPostings(day: ServiceDay) {
  const env = getGoogleEnv();
  const auth = new google.auth.JWT({
    email: env.serviceAccountEmail,
    key: env.privateKey,
    scopes: ["https://www.googleapis.com/auth/documents.readonly"],
  });
  const docs = google.docs({ version: "v1", auth });
  const response = await docs.documents.get({ documentId: env.postingsDocumentId, includeTabsContent: true });
  const parsed = parseGoogleDocPostings(response.data, day);
  return { ...parsed, title: response.data.title || "Google Doc", documentId: env.postingsDocumentId };
}
