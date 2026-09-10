const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const exportsObject = {};
const code = ts.transpileModule(fs.readFileSync('lib/headcount-google-doc.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(code, {
  exports: exportsObject,
  require: (name) => name === 'server-only' ? {} : name === '@/lib/env' ? { getGoogleEnv: () => ({}) } : require(name),
  console,
});

const counts = [[3995, 799], [4297, 1086], [3436, 1026], [2284, 535]];
const services = counts.map(([adults, children], index) => ({
  service: `${index + 1}${index === 0 ? 'st' : index === 1 ? 'nd' : index === 2 ? 'rd' : 'th'} Service`,
  headcount: { grandTotal: adults + children, byDepartment: [{ department: 'Main Church – FrontRow 1', adults, children }] },
}));
const actual = exportsObject.buildHeadcountDocumentText('2026-09-06', services, { summaryOnly: true });
const expected = `QUALITY CONTROL SOJA Attendance for Sunday, September 6, 2026

Main Auditorium, Children’s, Youth Churches, Overflow and Outside

1st Service
Adults: 3,995
Children: 799

Total: 4,794
2% Margin: 96
Adjusted Total: 4,890

2nd Service
Adults: 4,297
Children: 1,086

Total: 5,383
2% Margin: 108
Adjusted Total: 5,491

3rd Service
Adults: 3,436
Children: 1,026

Total: 4,462
2% Margin: 89
Adjusted Total: 4,551

4th Service
Adults: 2,284
Children: 535

Total: 2,819
2% Margin: 56
Adjusted Total: 2,875

Grand Total

Original Total: 17,458
2% Margin of Error: 349
Adjusted Grand Total: 17,807 ✅
`;
assert.equal(actual, expected);
console.log(JSON.stringify({ ok: true, exactFormat: true, serviceMath: true, grandTotalMath: true }));
