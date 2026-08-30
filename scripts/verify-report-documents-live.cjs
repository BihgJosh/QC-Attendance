// Explicitly generates the selected date's final report and shared headcount document.
// Does not send mail, approve reports, or change access permissions.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
for (const file of ['.env.local', '.env']) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '').replace(/\\n/g, '\n');
  }
}
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: (name) => name === 'server-only' ? {} : name.startsWith('@/') ? load(`${name.slice(2)}.ts`) : require(name), process, console, fetch, AbortSignal, setTimeout, clearTimeout }, { filename: file });
  return exports;
}
async function main() {
  const date = process.argv[2];
  assert.match(date || '', /^\d{4}-\d{2}-\d{2}$/, 'Supply an explicit report date');
  assert.equal(process.argv[3], '--generate', 'Explicit --generate is required: this updates report documents');
  const { callServiceReportGateway } = load('lib/service-report-store.ts');
  const daily = await callServiceReportGateway('manager.daily-report', { date });
  assert.ok(daily.data.posts.length, 'No headcounts: will not change documents');
  const services = [...new Set(daily.data.posts.map(r => r.service))];
  const dashboards = await Promise.all(services.map(async service => {
    const result = await callServiceReportGateway('manager.dashboard', { date, service });
    assert.ok(result.ok && result.data?.headcount);
    return { service, headcount: result.data.headcount };
  }));
  const final = await load('lib/final-report-sheet.ts').syncFinalReportForDate(date);
  const headcount = await load('lib/headcount-google-doc.ts').updateHeadcountGoogleDocument(date, dashboards, { summaryOnly: true });
  const { appendGeneratedDocumentLog } = load('lib/service-report-workbook.ts');
  await appendGeneratedDocumentLog({ date, service: 'All services', url: final.url, requestId: randomUUID(), actor: 'Release verification' });
  await appendGeneratedDocumentLog({ date, service: 'All services', url: headcount.url, requestId: randomUUID(), actor: 'Release verification', documentType: 'headcount' });
  const { google } = require('googleapis');
  const { getGoogleEnv } = load('lib/env.ts');
  const env = getGoogleEnv();
  const auth = new google.auth.JWT({ email: env.serviceAccountEmail, key: env.privateKey, scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/documents'] });
  const cells = await google.sheets({ version: 'v4', auth }).spreadsheets.values.get({ spreadsheetId: '1eZPJiAX4tCTX8huAAFCRrUSRr5na34VqmzXFCiqjGu0', range: `'${final.title}'!A:J` });
  const savedText = (cells.data.values || []).flat().join('\n');
  assert.ok(savedText.includes('SUMMARY REPORT'));
  for (const post of daily.data.posts) assert.ok(savedText.toLowerCase().includes(String(post.area).toLowerCase()), `Missing area: ${post.area}`);
  const doc = await google.docs({ version: 'v1', auth }).documents.get({ documentId: headcount.id });
  assert.ok(JSON.stringify(doc.data).includes(date), 'Headcount date not found in generated document');
  console.log(JSON.stringify({ ok: true, date, services: services.length, posts: daily.data.posts.length, finalReport: final.url, headcount: headcount.url, savedRows: cells.data.values.length, verifiedAt: new Date().toISOString() }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
