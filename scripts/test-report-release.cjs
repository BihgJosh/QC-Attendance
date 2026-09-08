const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, require: (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name === 'server-only') return {};
    return require(name);
  }, console, process, Request, Response, URL, setTimeout, clearTimeout }, { filename: file });
  return exports;
}

async function main() {
  let session = { email: 'manager@example.invalid', token: 'test' };
  let role = 'service_manager';
  let sourceFails = false;
  let generated = 0;
  const calls = [];
  const route = load('app/api/service-manager/route.ts', {
    '@/lib/final-report-layout': load('lib/final-report-layout.ts', {}),
    '@/lib/brevo-email': { EmailConfigurationError: class extends Error {}, sendBrevoEmail: () => { throw Error('No email expected'); } },
    '@/lib/service-report-workbook': { appendGeneratedDocumentLog: async (p) => { calls.push(p); return { recordId: 'test', workbookUrl: 'https://example.invalid' }; } },
    '@/lib/final-report-sheet': { syncFinalReportForDate: async () => { generated++; return { url: 'https://example.invalid/final', title: 'Test' }; } },
    '@/lib/validation': { isIsoCalendarDate: (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) },
    '@/lib/headcount-google-doc': { updateHeadcountGoogleDocument: async () => { generated++; return { url: 'https://example.invalid/headcount' }; } },
    '@/lib/emergency-flag-sheet': {},
    '@/lib/service-report-store': { callServiceReportGateway: async (op) => {
      if (sourceFails) throw Error('Simulated source outage');
      return { ok: true, data: { headcount: { grandTotal: 10, byDepartment: [{ department: 'Main', adults: 10, children: 0 }] } } };
    } },
    '@/lib/member-auth': { readMemberSession: async () => session },
    '@/lib/member-store': { resolveUserAccess: async () => ({ role, assignments: [] }) },
    '@/lib/report-identities': { attachDashboardIdentities: async (_, data) => data },
    '@/lib/service-report-services': { STANDARD_SERVICE_REPORTS: ['1st Service'], isValidServiceReportName: (s) => s === '1st Service' },
  });
  const request = (action) => route.POST(new Request('https://example.invalid/api/service-manager', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, date: '2026-08-23', service: '1st Service' }) }));
  for (const action of ['checkPassword', 'getDashboard', 'generateReport', 'generateHeadcount']) {
    assert.equal((await request(action)).status, 200, `Permanent manager without assignments: ${action}`);
  }
  assert.equal(calls.at(-1).documentType, 'headcount');
  const before = generated;
  sourceFails = true;
  assert.equal((await request('generateHeadcount')).status, 502);
  assert.equal(generated, before, 'Source failure must not overwrite the existing document');
  sourceFails = false;
  for (const deniedRole of ['general_user', 'hod']) {
    role = deniedRole;
    for (const action of ['getDashboard', 'generateReport', 'generateHeadcount']) assert.equal((await request(action)).status, 403);
  }
  session = null;
  assert.equal((await request('getDashboard')).status, 401);
  const logs = [];
  const workbook = load('lib/service-report-workbook.ts', {
    '@/lib/env': {},
    '@/lib/service-report-store': { callServiceReportGateway: async (op, p) => { logs.push({ op, ...p }); return { row: { id: 'test' } }; } },
  });
  const input = { date: '2026-08-23', service: '1st Service', url: 'https://example.invalid', requestId: 'one' };
  await workbook.appendGeneratedDocumentLog(input);
  await workbook.appendGeneratedDocumentLog(input);
  await workbook.appendGeneratedDocumentLog({ ...input, documentType: 'headcount' });
  await workbook.appendGeneratedDocumentLog({ ...input, requestId: 'two' });
  const keys = logs.filter(x => x.op === 'document.insert').map(x => x.source_fingerprint);
  assert.equal(keys[0], keys[1], 'Retries use the same key');
  assert.notEqual(keys[0], keys[2], 'Headcount and final report must not collide');
  assert.notEqual(keys[0], keys[3], 'Fresh generation must have an audit event');
  console.log(JSON.stringify({ ok: true, managerWithoutAssignments: true, unauthorizedRolesDenied: true, partialHeadcountBlocked: true, documentAuditKeys: true, emailsSent: 0 }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
