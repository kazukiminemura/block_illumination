'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=__dirname;
const log=fs.readFileSync(path.join(dir,'row_handoff.log'),'utf8');
assert.match(log,/Total elapsed time:/i,'LTspice did not finish');
assert.doesNotMatch(log,/Voltage not found|Unknown|Fatal|syntax error|measurement.*fail/i,'LTspice reported an error');
const measurements={};
for(const block of log.split(/Measurement:\s*/i).slice(1)){
  const name=block.match(/^\S+/)[0].toLowerCase();
  measurements[name]=block.split(/\r?\n/).flatMap(line=>{
    const match=line.match(/^\s*(\d+)\s+([-+\d.eE]+)(?:\s|$)/);
    return match?[Number(match[2])]:[];
  });
}
for(const key of ['led_steady','blank_leak','ghost_old','new_row','rail_min','pmos0_power','sink_red_power']){
  assert.equal(measurements[key]?.length,4,'Missing four sweep results for '+key);
  assert.ok(measurements[key].every(Number.isFinite));
}
const steps=[{guard_us:10,extraGate_nF:1},{guard_us:100,extraGate_nF:1},{guard_us:10,extraGate_nF:4},{guard_us:100,extraGate_nF:4}];
const current=96*1.2*42/3300;
const results=steps.map((step,i)=>{
  const r={...step};for(const [name,values] of Object.entries(measurements))r[name]=values[i];
  // Requirements for this assumption model, not manufacturer guaranteed limits.
  r.currentPass=Math.abs(r.led_steady/current-1)<0.02 && Math.abs(r.new_row/current-1)<0.02;
  r.blankPass=r.blank_leak<0.001;
  r.ghostPass=r.ghost_old<0.001;
  r.railPass=r.rail_min>=4.5;
  r.pass=r.currentPass&&r.blankPass&&r.ghostPass&&r.railPass;
  return r;
});
const report={simulator:log.split(/\r?\n/)[0],scope:'Two adjacent rows, 48 identical columns per color; assumed PMOS/ULN/LED and behavioral TLC current sinks; prescribed digital stimuli',thresholds:{currentError:0.02,blankLeak_A:0.001,oldRowGhost_A:0.001,minRail_V:4.5},results};
fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(report,null,2)+'\n');
const keys=Object.keys(results[0]);fs.writeFileSync(path.join(dir,'results.csv'),keys.join(',')+'\n'+results.map(r=>keys.map(k=>r[k]).join(',')).join('\n')+'\n');
console.table(results.map(r=>({guard_us:r.guard_us,extraGate_nF:r.extraGate_nF,current_A:r.led_steady,ghost_mA:r.ghost_old*1000,blank_mA:r.blank_leak*1000,rail_V:r.rail_min,result:r.pass?'PASS':'FAIL'})));
console.log('Measured all 4 cases. Failed design cases remain in results; no measurements are replaced with estimates.');
