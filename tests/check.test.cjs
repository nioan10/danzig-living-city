const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {plan,suggest,counts,runNode}=require('../tools/check.cjs');

test('профили не включают старый браузерный сценарий и явно разделяют долгие проверки',()=>{
  const quick=plan('quick'),full=plan('full');assert.deepEqual(quick.tests,full.tests);assert.ok(full.tests.includes('tests/economy.test.cjs'));assert.ok(full.tests.includes('tests/check.test.cjs'));assert.ok(!full.tests.some(f=>f.endsWith('browser-check.cjs')));assert.ok(quick.args.some(a=>a.startsWith('--test-skip-pattern=')));assert.ok(!full.args.some(a=>a.includes('pattern=')));assert.throws(()=>plan('typo'));
});
test('подбор проверок учитывает смешанные изменения и неизвестные файлы',()=>{
  assert.equal(suggest(['README.md']).profile,null);assert.deepEqual(suggest(['finance.js','dashboard.css']),{profile:'economy',browser:true,full:true});assert.equal(suggest(['finance.js','events.js']).profile,'quick');assert.equal(suggest(['new-module.js']).profile,'full');assert.equal(suggest(['tools/check.cjs']).profile,'tooling');assert.throws(()=>suggest([]));
});
test('реально падающий дочерний тест возвращает ошибку и сохраняет диагностику',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'danzig-check-')),file=path.join(dir,'failure.cjs');
  try{fs.writeFileSync(file,"require('node:test')('intentional failure',()=>{throw Error('fixture sentinel');});\n");const r=runNode(['--test','--test-reporter=tap',file]);assert.notEqual(r.status,0,r.output);assert.equal(counts(r.output).fail,1);assert.match(r.output,/fixture sentinel/);}finally{fs.rmSync(file,{force:true});fs.rmdirSync(dir);}
});
test('ошибка команды проверки даёт ненулевой код возврата',()=>{
  const r=runNode(['tools/check.cjs','unknown-profile']);assert.equal(r.status,2);assert.match(r.output,/Unknown profile/);
});
