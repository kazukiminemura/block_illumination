'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=__dirname,log=fs.readFileSync(path.join(dir,'full_circuit.log'),'utf8');
assert.match(log,/Total elapsed time:/,'Full circuit simulation is incomplete');
assert.doesNotMatch(log,/Voltage not found|Unknown|Fatal|syntax error|measurement.*fail/i);
const measured={};for(const line of log.split(/\r?\n/)){
  const m=line.match(/^([\w]+):.*?=\s*([-+\d.eE]+)(?:\s|$)/);if(m)measured[m[1].toLowerCase()]=Number(m[2]);
}
assert.ok(Number.isFinite(measured.supply_min),'Supply measurement is missing');
const rows=Array.from({length:16},(_,row)=>{
  const ctl=measured[`row${row}_ctl`],current=measured[`row${row}_current`],count=measured[`row${row}_count`];
  assert.ok(Number.isFinite(ctl)&&Number.isFinite(current)&&Number.isFinite(count),'Missing measurements for row '+row);
  return {row,sample_ms:row+0.5,selected_V:ctl,selectedRows:count,ledRail_A:current,pass:ctl>4.5&&count===1&&current>0.70&&current<0.78};
});
const result={simulator:log.split(/\r?\n/)[0],scope:'Full functional serial-chain model, 16 rows, 3 panels, 1536 color diodes; checkerboard input; assumed analog component models',supplyMin_V:measured.supply_min,rows,pass:measured.supply_min>4.5&&rows.every(r=>r.pass)};
fs.writeFileSync(path.join(dir,'full-results.json'),JSON.stringify(result,null,2)+'\n');
console.table(rows);assert.ok(result.pass,'Full-circuit measurement requirements failed');
console.log('PASS all 16 row selections and full-circuit current samples; supply minimum '+measured.supply_min+' V');
