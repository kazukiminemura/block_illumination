'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const log=fs.readFileSync(path.join(__dirname,'startup.log'),'utf8');
assert.match(log,/Total elapsed time:/);assert.doesNotMatch(log,/Fatal|Unknown|syntax error|measurement.*fail/i);
const m={};for(const block of log.split(/Measurement:\s*/i).slice(1)){m[block.match(/^\S+/)[0].toLowerCase()]=block.split(/\r?\n/).flatMap(l=>{const a=l.match(/^\s*\d+\s+([-+\d.eE]+)/);return a?[Number(a[1])]:[];});}
for(const k of ['blank_r_end','blank_g_end','oe_end'])assert.equal(m[k]?.length,5);
const cases=['Pico absent','Reset, blank inputs high','Enabled, blank high','Enabled, blank low','Reset after active display'];
const results=cases.map((name,i)=>({name,blankR_V:m.blank_r_end[i],blankG_V:m.blank_g_end[i],oe_V:m.oe_end[i],pass:i===3?m.blank_r_end[i]<0.5&&m.blank_g_end[i]<0.5:m.blank_r_end[i]>4.5&&m.blank_g_end[i]>4.5}));
const report={scope:'Steady 5 V functional buffer model; 900 us samples; power ramps, arbitrary GPIO faults and transistor corners excluded',results,pass:results.every(r=>r.pass)};
fs.writeFileSync(path.join(__dirname,'startup-results.json'),JSON.stringify(report,null,2)+'\n');console.table(results);assert.ok(report.pass);
