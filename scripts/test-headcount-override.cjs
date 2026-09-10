const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), console, Request, Response, URL }, { filename: file });
  return exports;
}
async function main() {
  let role = 'general_user'; let saved; let session = { email: 'fixture@example.invalid' };
  const route = load('app/api/service-post/route.ts', {
    '@/lib/member-auth': { readMemberSession: async () => session },
    '@/lib/team-data-store': { getTeamMemberByEmail: async () => ({ name: 'Corrector', email: 'fixture@example.invalid' }) },
    '@/lib/member-store': { resolveUserAccess: async () => ({ role }) },
    '@/lib/service-post-sheet': { appendServicePostReport: async row => { saved = row; } },
    '@/lib/service-report-store': { callServiceReportGateway: async () => ({ areas: ['Main Church – FrontRow 1'] }) },
    '@/lib/validation': { isIsoCalendarDate: value => value === '2099-12-31' },
    '@/lib/service-report-services': { namedServiceReport: value => value, isValidServiceReportName: value => value === '1st Service' },
    '@/lib/service-post-locations': load('lib/service-post-locations.ts'),
    '@/lib/headcount-override': load('lib/headcount-override.ts'),
  });
  const body = { submissionId: '10000000-0000-4000-8000-000000000001', date: '2099-12-31', service: '1st Service', area: 'Main Church - FrontRow 1', adultsHeadcount: 400, childrenHeadcount: 80, assignmentOverride: true, headcountSource: 'Observation', confirmAccurate: true };
  const post = patch => route.POST(new Request('https://example.invalid/api/service-post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, ...patch }) }));
  assert.equal((await post({ overrideActorRole: 'admin' })).status, 403, 'Cannot forge elevated role');
  for (role of ['service_manager','hod','admin','super_admin']) {
    assert.equal((await post({ reportFor: 'Someone else' })).status, 200, role);
    assert.equal(saved.overrideActorRole, role);
    assert.equal(saved.name, 'Corrector');
    assert.equal(saved.headcountSource, 'Observation');
    assert.equal(saved.headcountOnly, true);
    assert.equal(saved.area, 'Main Church – FrontRow 1');
  }
  for (const patch of [{ adultsHeadcount: -1 }, { childrenHeadcount: 1.5 }, { adultsHeadcount: 100001 }, { area: 'invalid' }, { confirmAccurate: false }]) assert.equal((await post(patch)).status, 400);
  assert.equal((await post({ adultsHeadcount: 0, childrenHeadcount: 0 })).status, 200);
  session = null;
  assert.equal((await post({})).status, 401);
  const layout = load('lib/final-report-layout.ts');
  const posts = [{ id: 'replacement', service: '1st Service', area: 'Location', adults_headcount: 400, children_headcount: 80, headcount_only: true, what_went_well: 'Original observation survives' }];
  const output = layout.buildFinalReportRows({ date: '2099-12-31', posts }).rows.flat().join('\n');
  assert.match(output, /480 worshippers/);
  assert.doesNotMatch(output, /override audit|deleted headcount|original reporter|500 adults|30 children/i);
  assert.doesNotMatch(output, /1,010 worshippers/);
  console.log(JSON.stringify({ ok: true, roles: 4, forgedRoleDenied: true, invalidCountsDenied: true, zeroCountsAccepted: true, overriddenDataAbsentFromReport: true }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
