'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const d=__dirname,channels=['CPU','GPU','NPU'];
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const normalize=bytes=>bytes.toString('utf8').replace(/\r\n/g,'\n');
const digest=p=>hash(normalize(fs.readFileSync(p)));
const args=process.argv.slice(2);
assert.ok(args.length===0||(args.length===1&&args[0]==='--record-run'),'Usage: node verify-meter.cjs [--record-run]');
const recordRun=args.length===1;
const evidenceFiles=['level_meter.asc','level_meter.cir','levels.cir','meter_models.lib','XD3914.asy','OSX10201_GYR1.asy','expected-nets.json','level_meter.log','levels.log'];
function read(name){
 const file=path.join(d,name+'.log'),log=fs.readFileSync(file,'utf8');
 assert.match(log,/Total elapsed time:/,'Incomplete '+name);
 assert.doesNotMatch(log,/Voltage not found|Unknown|Fatal|syntax error|measurement.*fail/i,'LTspice error '+name);
 const steps=[...log.matchAll(/^\.step\s+([^\r\n]+)/gmi)].map(m=>Object.fromEntries([...m[1].matchAll(/(\w+)=([-+\d.eE]+)/g)].map(a=>[a[1].toLowerCase(),Number(a[2])])));
 const measures={};
 for(const block of log.split(/Measurement:\s*/i).slice(1)){
  measures[block.match(/^\S+/)[0].toLowerCase()]=block.split(/\r?\n/).flatMap(line=>{const m=line.match(/^\s*(\d+)\s+([-+\d.eE]+)/);return m?[Number(m[2])]:[];});
 }
 return {name,log,steps,measures};
}
function value(t,key,i){const v=t.measures[key.toLowerCase()]?.[i];assert.ok(Number.isFinite(v),t.name+' missing '+key+' step '+i);return v;}
const pwm=read('level_meter'),levels=read('levels');
assert.equal(pwm.steps.length,2);assert.equal(levels.steps.length,22);
assert.deepEqual(pwm.steps.map(s=>s.cfval).sort((a,b)=>a-b),[2.2e-6,6.8e-6],'Incomplete PWM sweep');
assert.deepEqual(levels.steps.map(s=>s.level+':'+s.corner).sort(),Array.from({length:11},(_,n)=>[n+':-1',n+':1']).flat().sort(),'Incomplete level/corner sweep');
const results=[];
for(let i=0;i<2;i++)for(const [j,ch]of channels.entries()){
 const count=value(pwm,ch+'_COUNT',i),ripple=value(pwm,ch+'_RIPPLE',i),signal=value(pwm,ch+'_SIG',i),target=([.35,.65,1.08][j])*1.28;
 const reset=value(pwm,ch+'_RESET',i),startup=value(pwm,ch+'_START',i),current=value(pwm,ch+'_I',i),power=value(pwm,ch+'_P',i);
 const pass=count===[3,6,10][j]&&reset===0&&startup===0&&ripple<.006&&Math.abs(signal-target)<.015&&current>.004&&current<.006&&power<.35;
 results.push({test:'PWM / reset',channel:ch,...pwm.steps[i],count,signal_V:signal,ripple_mV:1000*ripple,resetCount:reset,startupCount:startup,led_mA:current*1000,chipPowerEstimate_W:power,pass});
}
for(let i=0;i<22;i++)for(const [j,ch]of channels.entries()){
 const step=levels.steps[i],n=step.level,corner=step.corner;assert.ok(Number.isInteger(n)&&n>=0&&n<=10);assert.ok(corner===-1||corner===1);
 const count=value(levels,ch+'_COUNT',i),current=value(levels,ch+'_I',i),power=value(levels,ch+'_P',i);
 const expected=10*[1.2,1.28,1.34][j]*(1/(3300*(1+corner*.01))+1/(corner<0?8000:17000))*(corner<0?1.3:.7);
 const pass=count===n&&(n===0?current<10e-6:Math.abs(current/expected-1)<.02)&&power<.35;
 results.push({test:'DC levels / stress',channel:ch,...step,count,led_mA:current*1000,chipPowerEstimate_W:power,pass});
}
// Compare actual netlist generated from ASC, including symbol geometry connections.
const expected=JSON.parse(fs.readFileSync(path.join(d,'expected-nets.json'),'utf8'));
let actual,netlistEvidence;
const reportFile=path.join(d,'meter-results.json'),netFile=path.join(d,'level_meter.net');
const netlistDigest=()=>hash(fs.readFileSync(netFile,'latin1').replace(/\r\n/g,'\n'));
function readNetlist(){
 return fs.readFileSync(netFile,'latin1').split(/\r?\n/).map(l=>l.trim()).filter(l=>/^[A-Za-z]/.test(l)).map(l=>l.split(/\s+/));
}
if(recordRun){
 assert.ok(fs.existsSync(netFile),'--record-run requires a fresh LTspice-generated level_meter.net');
 // Timestamps are a freshness guard, not proof that LTspice executed these inputs.
 const fresh=(output,inputs)=>{for(const input of inputs)assert.ok(fs.statSync(path.join(d,output)).mtimeMs>=fs.statSync(path.join(d,input)).mtimeMs,'Stale '+output+'; rerun LTspice after changing '+input);};
 fresh('level_meter.net',['level_meter.asc','XD3914.asy','OSX10201_GYR1.asy','expected-nets.json']);
 fresh('level_meter.log',['level_meter.net','level_meter.cir','meter_models.lib']);
 fresh('levels.log',['levels.cir','meter_models.lib']);
 actual=readNetlist();netlistEvidence='LTspice-generated netlist; explicitly recorded run';
}else{
 const saved=JSON.parse(fs.readFileSync(reportFile,'utf8'));
 for(const n of evidenceFiles){
  const bytes=fs.readFileSync(path.join(d,n)),normalized=normalize(bytes);
  // Legacy reports hashed native line endings. Accept only byte-identical text.
  const candidates=saved.hashFormat==='utf8-lf'?[hash(normalized)]:[hash(bytes),hash(normalized),hash(normalized.replace(/\n/g,'\r\n'))];
  assert.ok(candidates.includes(saved.sha256[n]),'Saved evidence is stale; rerun both LTspice tests and use --record-run: '+n);
 }
 actual=saved.actualNetlist;assert.ok(Array.isArray(actual),'No saved ASC wiring evidence');
 if(fs.existsSync(netFile)){
  assert.ok(saved.netlistSha256,'Legacy snapshot has no full netlist hash; remove the intermediate .net to check the saved snapshot, or rerun LTspice and use --record-run');
  assert.equal(netlistDigest(),saved.netlistSha256,'Netlist differs from saved evidence; rerun LTspice and use --record-run');
 }
 netlistEvidence='Previously validated netlist snapshot; circuit and log text unchanged';
}
assert.equal(actual.length,expected.length,'Unexpected ASC netlist component count');
for(const {name,nodes} of expected){
 const lines=actual.filter(a=>a[0].replace(/[^\x20-\x7e]/g,'')===(name.startsWith('X')?'X'+name:name));assert.equal(lines.length,1,name);
 assert.deepEqual(lines[0].slice(1,nodes.length+1).map(s=>s.toUpperCase()),nodes.map(s=>s.toUpperCase()),'ASC wiring: '+name);
}
const report={hashFormat:'utf8-lf',netlistSha256:recordRun?netlistDigest():undefined,revision:'C',simulator:pwm.log.split(/\r?\n/)[0],scope:'Behavioral XD3914 bar-mode and assumed LED/GPIO models; calibrated references. Not vendor macro-model or hardware sign-off.',checks:results.length,netlistParts:expected.length,netlistEvidence,actualNetlist:actual,supplyMin_V:Math.min(...pwm.steps.map((_,i)=>value(pwm,'SUPPLY_MIN',i))),maxRipple_mV:Math.max(...results.filter(r=>r.ripple_mV!==undefined).map(r=>r.ripple_mV)),maxChipPowerEstimate_W:Math.max(...results.map(r=>r.chipPowerEstimate_W)),results,pass:results.every(r=>r.pass),sha256:Object.fromEntries(evidenceFiles.map(n=>[n,digest(path.join(d,n))]))};
assert.ok(report.supplyMin_V>4.5);
console.log(JSON.stringify({checks:report.checks,netlistParts:report.netlistParts,maxRipple_mV:report.maxRipple_mV,maxChipPowerEstimate_W:report.maxChipPowerEstimate_W,supplyMin_V:report.supplyMin_V,pass:report.pass},null,2));
for(const r of results.filter(r=>!r.pass))console.log(r);
assert.ok(report.pass,'Measurement acceptance failed');
if(recordRun)fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');
