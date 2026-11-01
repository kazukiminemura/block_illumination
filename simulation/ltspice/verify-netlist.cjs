'use strict';
// Check the actual LTspice ASC netlist against the independently emitted CIR.
// This catches unintended shorts caused by drawing wire/pin overlap.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const d=__dirname;
const expected=fs.readFileSync(path.join(d,'full_circuit.cir'),'utf8').trim().split(/\r?\n/).slice(1).filter(l=>/^[A-Z]/.test(l)).map(l=>l.split(/\s+/));
const actual=fs.readFileSync(path.join(d,'full_circuit.net'),'latin1').split(/\r?\n/).filter(l=>/^[A-Z]/.test(l)).map(l=>l.split(/\s+/));
for(const [name,...tail] of expected){
 const entries=actual.filter(a=>a[0].replace(/[^\x20-\x7e]/g,'')===(name.startsWith('X')?'X'+name:name));
 assert.equal(entries.length,1,'Missing/duplicate instance '+name);
 const n=name.startsWith('X')?tail.length-1:/^[MQ]/.test(name)?3:2;
 assert.deepEqual(entries[0].slice(1,n+1).map(s=>s.toUpperCase()),tail.slice(0,n).map(s=>s.toUpperCase()),'ASC wiring differs from CIR: '+name);
}
console.log(`PASS ${expected.length} ASC component terminal lists match CIR; no unintended net shorts`);
