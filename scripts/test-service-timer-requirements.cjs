const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const segments = [
  ['openingPrayer'], ['praiseWorship'], ['speakingIntoWeek'], ['soloMinistration'], ['declaration'],
  ['testimonyIntroduction'], ['firstTestimony'], ['secondTestimony'], ['thirdTestimony'], ['fourthTestimony'], ['fifthTestimony'],
  ['choirMinistration'], ['pastorMinistration'], ['offeringAnnouncement'],
];
let saved;
const exportsObject = {};
const code = ts.transpileModule(fs.readFileSync('app/api/service-timer/route.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(code, {
  exports: exportsObject,
  require: (name) => ({
    '@/lib/member-auth': { readMemberSession: async () => ({ email: 'timer@example.invalid' }) },
    '@/lib/team-data-store': { getTeamMemberByEmail: async () => ({ name: 'Timer Member' }) },
    '@/lib/service-timer-sheet': { SERVICE_TIMER_SEGMENTS: segments, appendServiceTimerLog: async (value) => { saved = value; } },
    '@/lib/validation': { isClockTime: () => true, isIsoCalendarDate: (value) => value === '2026-09-13' },
    '@/lib/service-report-services': { namedServiceReport: (value) => value, isValidServiceReportName: (value) => value === '1st Service' },
  }[name] || require(name)),
  console, Request, Response,
}, { filename: 'app/api/service-timer/route.ts' });

const required = ['openingPrayer', 'praiseWorship', 'speakingIntoWeek', 'soloMinistration', 'declaration', 'choirMinistration', 'pastorMinistration', 'offeringAnnouncement'];
const baseSegments = Object.fromEntries(segments.map(([id]) => [id, { status: required.includes(id) ? 'On Time' : '', min: '', sec: '' }]));
const base = { submissionId: '10000000-0000-4000-8000-000000000001', date: '2026-09-13', service: '1st Service', segments: baseSegments, extra: { name: '', status: '', min: '', sec: '' }, generalObservation: '' };
const post = (body) => exportsObject.POST(new Request('https://example.invalid/api/service-timer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));

(async () => {
  assert.equal((await post({ ...base, segments: { ...baseSegments, openingPrayer: { status: '', min: '', sec: '' } } })).status, 400);
  assert.equal((await post({ ...base, segments: { ...baseSegments, openingPrayer: { status: 'Overshot', min: 0, sec: 0 } } })).status, 400);
  assert.equal((await post({ ...base, segments: { ...baseSegments, firstTestimony: { status: 'Finished Early', min: 0, sec: 0 } } })).status, 400);
  const validResponse = await post({ ...base, segments: { ...baseSegments, openingPrayer: { status: 'Overshot', min: 0, sec: 15 } } });
  assert.equal(validResponse.status, 200, await validResponse.text());
  assert.equal(saved.segments.openingPrayer.sec, 15);
  assert.equal(saved.segments.firstTestimony.status, '');
  console.log(JSON.stringify({ ok: true, requiredCategories: required.length, testimoniesOptional: true, varianceTimeRequired: true }));
})().catch((error) => { console.error(error); process.exitCode = 1; });
