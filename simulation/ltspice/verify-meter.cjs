'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const d=__dirname,channels=['CPU','GPU','NPU'];
const digest=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
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
if(fs.existsSync(path.join(d,'level_meter.net'))){
 actual=fs.readFileSync(path.join(d,'level_meter.net'),'latin1').split(/\r?\n/).filter(l=>/^[A-Z]/.test(l)).map(l=>l.split(/\s+/));
 netlistEvidence='LTspice-generated netlist';
}else{
 const saved=JSON.parse(fs.readFileSync(path.join(d,'meter-results.json'),'utf8'));
 for(const n of evidenceFiles)assert.equal(digest(path.join(d,n)),saved.sha256[n],'Saved evidence is stale; rerun both LTspice tests: '+n);
 actual=saved.actualNetlist;assert.ok(Array.isArray(actual),'No saved ASC wiring evidence');
 netlistEvidence='Previously validated netlist snapshot; circuit and log hashes unchanged';
}
for(const {name,nodes} of expected){
 const lines=actual.filter(a=>a[0].replace(/[^\x20-\x7e]/g,'')===(name.startsWith('X')?'X'+name:name));assert.equal(lines.length,1,name);
 assert.deepEqual(lines[0].slice(1,nodes.length+1).map(s=>s.toUpperCase()),nodes.map(s=>s.toUpperCase()),'ASC wiring: '+name);
}
const report={revision:'C',simulator:pwm.log.split(/\r?\n/)[0],scope:'Behavioral XD3914 bar-mode and assumed LED/GPIO models; calibrated references. Not vendor macro-model or hardware sign-off.',checks:results.length,netlistParts:expected.length,netlistEvidence,actualNetlist:actual,supplyMin_V:Math.min(...pwm.steps.map((_,i)=>value(pwm,'SUPPLY_MIN',i))),maxRipple_mV:Math.max(...results.filter(r=>r.ripple_mV!==undefined).map(r=>r.ripple_mV)),maxChipPowerEstimate_W:Math.max(...results.map(r=>r.chipPowerEstimate_W)),results,pass:results.every(r=>r.pass),sha256:Object.fromEntries(evidenceFiles.map(n=>[n,digest(path.join(d,n))]))};
assert.ok(report.supplyMin_V>4.5);
fs.writeFileSync(path.join(d,'meter-results.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({checks:report.checks,netlistParts:report.netlistParts,maxRipple_mV:report.maxRipple_mV,maxChipPowerEstimate_W:report.maxChipPowerEstimate_W,supplyMin_V:report.supplyMin_V,pass:report.pass},null,2));
for(const r of results.filter(r=>!r.pass))console.log(r);
assert.ok(report.pass,'Measurement acceptance failed');
