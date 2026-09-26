#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),LONG='\\[long\\]';
const profiles=['syntax','quick','full','long','sim','economy','events','systems','tooling'];
const list=(dir,pattern)=>fs.readdirSync(path.join(ROOT,dir)).filter(f=>pattern.test(f)).sort().map(f=>path.posix.join(dir,f));
const allTests=()=>list('tests',/\.test\.cjs$/);
function plan(profile){
  if(!profiles.includes(profile))throw Error('Unknown profile: '+profile);
  const tests=['quick','full','long'].includes(profile)?allTests():profile==='syntax'?[]:[`tests/${profile==='tooling'?'check':profile}.test.cjs`];
  const args=['--test','--test-reporter=tap'];
  if(profile==='long')args.push('--test-name-pattern='+LONG);
  else if(profile!=='full')args.push('--test-skip-pattern='+LONG);
  return {profile,tests,args:[...args,...tests],long:profile==='long'?'only':profile==='full'?'included':'excluded'};
}
function suggest(files){
  if(!files.length)throw Error('List changed files after suggest');
  const groups=new Set();let browser=false,full=false;
  for(let file of files){file=file.replaceAll('\\','/').replace(/^\.\//,'');
    if(/^(AGENTS\.md|README\.md|docs\/.*\.md|\.gitignore)$/.test(file))continue;
    if(/^(tools\/|tests\/check\.test\.cjs$|package\.json$)/.test(file)){groups.add('tooling');continue;}
    if(/^(sim|brain|world|decision-bridge)\.js$/.test(file)){groups.add('quick');full=true;continue;}
    if(['housing.js','report.js','guilds.js','development.js','government.js'].includes(file)){groups.add('quick');full=true;continue;}
    if(/^(finance|property-tax|city-budget|commerce|expansion)\.js$/.test(file)){groups.add('economy');full=true;continue;}
    if(file==='events.js'){groups.add('events');full=true;continue;}
    if(/^(city-systems|learning)\.js$/.test(file)){groups.add('systems');full=true;continue;}
    if(file==='map-art.js'){groups.add('systems');browser=true;full=true;continue;}
    if(/^(app\.js|dashboard\.js|finance-view\.js|report-view\.js|guild-view\.js|development-view\.js|map-painted\.js|index\.html|[^/]+\.css|assets\/)/.test(file)){groups.add('syntax');browser=true;continue;}
    const test=file.match(/^tests\/(sim|economy|events|systems)\.test\.cjs$/);if(test){groups.add(test[1]);full=true;continue;}
    groups.add('full');full=true;
  }
  const selected=groups.has('full')?'full':groups.has('quick')||[...groups].filter(g=>g!=='syntax').length>1?'quick':[...groups].find(g=>g!=='syntax')||[...groups][0]||null;
  return {profile:selected,browser,full};
}
function runNode(args){const env={...process.env};delete env.NODE_TEST_CONTEXT;const r=spawnSync(process.execPath,args,{cwd:ROOT,env,encoding:'utf8',maxBuffer:32*1024*1024,timeout:240000,windowsHide:true});return {status:r.error||r.signal?1:r.status??1,output:(r.stdout||'')+(r.stderr||'')+(r.error?'\n'+r.error.message:'')+(r.signal?'\nSignal: '+r.signal:'')};}
function counts(output){const result={};for(const key of ['tests','pass','fail','cancelled','skipped','todo','duration_ms']){const match=output.match(new RegExp('^# '+key+' ([0-9.]+)\\r?$','m'));if(match)result[key]=Number(match[1]);}return result;}
function syntax(){
  const files=[...list('',/\.(js|cjs)$/),...list('tools',/\.cjs$/),...allTests()];let output='';
  for(const file of files){const r=runNode(['--check',file]);output+=`Syntax: ${file}\n${r.output}`;if(r.status)return {status:r.status,output,files};}
  for(const match of fs.readFileSync(path.join(ROOT,'index.html'),'utf8').matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)){
    const src=match[1];if(/^(https?:|\/\/)/.test(src))continue;
    if(!fs.existsSync(path.join(ROOT,src)))return {status:1,output:output+'Missing page script: '+src+'\n',files};
  }
  return {status:0,output,files};
}
function digest(files){const hash=crypto.createHash('sha256');for(const file of [...new Set(files)].sort())hash.update(file+'\0').update(fs.readFileSync(path.join(ROOT,file)));return hash.digest('hex');}
function main(argv){
  if(!argv.length||argv[0]==='--help'){console.log('Usage: node tools/check.cjs <'+profiles.join('|')+'>\n       node tools/check.cjs suggest <changed files...>\nquick/subject profiles exclude [long]; full includes all. Reports: .reports/checks/');return 0;}
  if(argv[0]==='suggest'){const p=suggest(argv.slice(1));console.log(p.profile?'During work: node tools/check.cjs '+p.profile:'Docs only: no simulation run needed.');if(p.full&&p.profile!=='full')console.log('After model changes: node tools/check.cjs full (once).');if(p.browser)console.log('Also verify the affected UI in /?demo=1 through the browser tool.');return 0;}
  if(argv.length!==1)throw Error('Pass one profile, or use suggest <files...>');
  const p=plan(argv[0]),started=Date.now();console.log(`CHECK ${p.profile} | long scenarios: ${p.long}`);
  const check=syntax();let output=check.output,status=check.status,testCounts={};
  if(!status&&p.tests.length){const r=runNode(p.args);output+='\n'+r.output;status=r.status;testCounts=counts(r.output);if(testCounts.fail||testCounts.cancelled)status=1;if(!status&&(!testCounts.tests||testCounts.pass===0)){status=1;output+='\nNo tests executed; refusing to report success.\n';}}
  const reportDir=path.join(ROOT,'.reports','checks');fs.mkdirSync(reportDir,{recursive:true});const stem=path.join(reportDir,p.profile),seconds=(Date.now()-started)/1000;
  const result={profile:p.profile,ok:status===0,long:p.long,tests:p.tests,counts:testCounts,seconds,checkedAt:new Date().toISOString(),sourceDigest:digest([...check.files,'index.html','package.json',...list('',/\.css$/)]),log:stem+'.log'};
  fs.writeFileSync(stem+'.log',output);fs.writeFileSync(stem+'.json',JSON.stringify(result,null,2)+'\n');
  console.log(`${status?'FAIL':'PASS'} | syntax ${check.status?'failed':check.files.length+' files'}${p.tests.length?' | tests '+(testCounts.pass??0)+' passed, '+(testCounts.fail??0)+' failed':''} | ${seconds.toFixed(1)}s`);
  console.log('Log: '+path.relative(ROOT,stem+'.log').replaceAll('\\','/'));
  if(status){const failures=[...output.matchAll(/^not ok [\s\S]*?^  \.\.\./gm)].map(m=>m[0]);console.error(failures.length?failures.slice(0,3).join('\n').split(/\r?\n/).slice(0,60).join('\n'):output.split(/\r?\n/).slice(-40).join('\n'));}
  return status?1:0;
}
if(require.main===module){try{process.exitCode=main(process.argv.slice(2));}catch(e){console.error('CHECK ERROR: '+e.message);process.exitCode=2;}}
module.exports={plan,suggest,counts,runNode,main};
