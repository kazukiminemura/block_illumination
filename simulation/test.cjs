'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {DisplayModel, pattern} = require('./model.cjs');
let checks=0;
function check(name, fn) { fn(); checks++; console.log('PASS '+name); }
check('startup BLANK masks unknown latches',()=>assert.ok(new DisplayModel().pixels().flat().every(v=>v===0)));
check('1536 individual color LED paths, serial order and one-hot rows',()=> {
  const m=new DisplayModel();
  for(let y=0;y<16;y++) for(let x=0;x<48;x++) for(const color of [1,2]) {
    const f=pattern('off'); f[y][x]=color; m.prepare(f,y);
    assert.deepEqual(m.rows(),[y]); assert.ok(m.pixels().flat().every(v=>v===0));
    m.blank(0); assert.deepEqual(m.pixels(),f);
  }
});
check('seven whole-frame patterns reconstructed by 16-row scanning',()=> {
  for(const name of ['off','red','green','yellow','checker','diagonal','bars']) {
    const f=pattern(name), m=new DisplayModel(), actual=[];
    for(let y=0;y<16;y++) {m.prepare(f,y);m.blank(0);actual.push(m.pixels()[y]);}
    assert.deepEqual(actual,f);
  }
});
check('shift does not change output before latch',()=> {
  const m=new DisplayModel();m.prepare(pattern('red'),3);m.blank(0);const before=m.pixels();
  m.load('r',Array(64).fill(0));assert.deepEqual(m.pixels(),before);
});
check('red and green BLANK independently mask their outputs',()=> {
  const m=new DisplayModel();m.prepare(pattern('yellow'),4);m.br=0;
  assert.ok(m.pixels()[4].every(v=>v===1));m.br=1;m.bg=0;
  assert.ok(m.pixels()[4].every(v=>v===2));
});
check('duplicate TLC LAT corrupts data as expected (diagnostic overwrite)',()=> {
  const m=new DisplayModel();m.prepare(pattern('yellow'),0);m.latch('r');m.blank(0);
  assert.ok(m.pixels()[0].every(v=>v===2));
});
check('injected two-row fault observable',()=> {
  const m=new DisplayModel();m.prepare(pattern('red'),0);m.lr[49]=1;m.blank(0);
  assert.equal(m.rows().length,2); assert.ok(m.pixels()[1].every(v=>v===1));
});
check('reversed chain data changes the displayed image',()=> {
  const m=new DisplayModel();const f=pattern('off');f[2][0]=1;m.prepare(f,2);
  m.load('r',[...f[2].map(v=>v&1),...Array.from({length:16},(_,i)=>Number(i===2))].reverse());
  m.latch('r');m.blank(0);assert.notDeepEqual(m.pixels(),f);
});
check('invalid row and color rejected',()=> {
  assert.throws(()=>new DisplayModel().prepare(pattern('red'),16));
  const f=pattern('off');f[0][0]=4;assert.throws(()=>new DisplayModel().prepare(f,0));
});
// VCD follows real model clock/latch calls; 1 MHz, 1 us pre/post guards, 100 us row settling.
const m=new DisplayModel(), f=pattern('checker');
const names=['DATA_R','SCLK_R','LAT_R','BLANK_R','DATA_G','SCLK_G','LAT_G','BLANK_G','ROW_MASK'];
const ids=names.map((_,i)=>String.fromCharCode(33+i));let t=0;const events=[];
function emit(values){events.push('#'+t);for(const [name,val] of Object.entries(values)) {
  const i=names.indexOf(name);events.push(name==='ROW_MASK'?'b'+val.toString(2).padStart(16,'0')+' '+ids[i]:val+ids[i]);
}}
emit(Object.fromEntries(names.map(n=>[n,n.startsWith('BLANK')?1:0])));
for(let y=0;y<16;y++) {
  m.blank(1);emit({BLANK_R:1,BLANK_G:1});t+=1000;
  const r=[...f[y].map(v=>v&1),...Array.from({length:16},(_,i)=>Number(i===y))];
  const g=f[y].map(v=>(v>>1)&1);
  for(const [bus,bits] of [['r',r],['g',g]]) {
    const b=bus.toUpperCase();
    for(let i=bits.length-1;i>=0;i--){emit({['DATA_'+b]:bits[i]});t+=500;m.clock(bus,bits[i]);emit({['SCLK_'+b]:1});t+=500;emit({['SCLK_'+b]:0});}
  }
  t+=1000;m.latch('r');m.latch('g');emit({LAT_R:1,LAT_G:1,ROW_MASK:parseInt(m.lr.slice(48).reverse().join(''),2)});
  t+=1000;emit({LAT_R:0,LAT_G:0});t+=100000;m.blank(0);emit({BLANK_R:0,BLANK_G:0});t+=785000;
}
m.blank(1);emit({BLANK_R:1,BLANK_G:1});
const header=['$date 2026-10-31 $end','$version block_illumination functional simulation $end','$timescale 1 ns $end','$scope module display $end',...names.map((n,i)=>`$var wire ${n==='ROW_MASK'?16:1} ${ids[i]} ${n} $end`),'$upscope $end','$enddefinitions $end'];
fs.writeFileSync(path.join(__dirname,'scan.vcd'),header.concat(events).join('\n')+'\n');
const report={passed:checks,individualColorPaths:1536,patterns:7,rowPeriod_us:1000,frameRate_Hz:62.5,ledPeak_mA:1.2/3.3*42,maxLedRail_A:96*1.2/3300*42,scope:'Ideal logical model; not SPICE, firmware emulation, timing sign-off or thermal validation'};
fs.writeFileSync(path.join(__dirname,'test-results.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
