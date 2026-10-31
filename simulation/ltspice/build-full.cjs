'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=__dirname;
const rows=fs.readFileSync(path.join(dir,'../connections.csv'),'utf8').trim().split(/\r?\n/).slice(1).map(s=>s.split(','));
const refs=new Map();for(const [ref,pin,value,net] of rows){if(!refs.has(ref))refs.set(ref,[]);refs.get(ref).push({pin,value,net:net==='GND'?'0':net});}
const symbols={};
function symbol(name,pins,left,right,model){
  const h=Math.max(left.length,right.length)*32+64,w=384;
  const loc=new Map();left.forEach((p,i)=>loc.set(p,[0,48+i*32,'LEFT']));right.forEach((p,i)=>loc.set(p,[w+64,48+i*32,'RIGHT']));
  let s=['Version 4','SymbolType CELL',`RECTANGLE Normal 32 0 ${w+32} ${h}`,`WINDOW 0 48 -32 Left 2`,`WINDOW 3 48 ${h+24} Left 2`,'SYMATTR Prefix X',`SYMATTR Value ${model}`];
  pins.forEach((p,i)=>{const [x,y,side]=loc.get(p.id);s.push(`LINE Normal ${x} ${y} ${side==='LEFT'?32:w+32} ${y}`,`PIN ${x} ${y} ${side} 8`,`PINATTR PinName ${p.id}:${p.label}`,`PINATTR SpiceOrder ${i+1}`);});
  fs.writeFileSync(path.join(dir,name+'.asy'),s.join('\r\n')+'\r\n','ascii');symbols[name]={pins,loc,w:w+64,h};
}
const range=(n,start=0)=>Array.from({length:n},(_,i)=>i+start);
const named=(ids,names)=>ids.map((id,i)=>({id:String(id),label:names[i]}));
const tlcnames=['GND','SIN','SCLK','LAT',...range(16).map(i=>'OUT'+i),'BLANK','SOUT','IREF','VCC'];
symbol('TLC5928_FUNC',named(range(24,1),tlcnames),['1','2','3','4','21','23','24'],[...range(16,5).map(String),'22'],'TLC5928_FUNC');
const hcnames=['QB','QC','QD','QE','QF','QG','QH','GND','QH_SER','N_SRCLR','SRCLK','RCLK','N_OE','SER','QA','VCC'];
symbol('HC595_FUNC',named(range(16,1),hcnames),['14','11','12','10','13','16','8'],['15','1','2','3','4','5','6','7','9'],'HC595_FUNC');
const bufnames=['1OE_N','1A','1Y','2OE_N','2A','2Y','GND','3Y','3A','3OE_N','4Y','4A','4OE_N','VCC'];
symbol('AHCT125_FUNC',named(range(14,1),bufnames),['2','1','5','4','9','10','12','13','14','7'],['3','6','8','11'],'AHCT125_FUNC');
symbol('ULN2803_FUNC',named(range(18,1),[...range(8).map(i=>'IN'+i),'GND','COM',...range(8).map(i=>'OUT'+(7-i))]),[...range(8,1).map(String),'9','10'],range(8).map(i=>String(18-i)),'ULN2803_FUNC');
const ledpins=[...range(16).map(i=>'A'+i),...range(16).map(i=>'R'+i),...range(16).map(i=>'G'+i)];
symbol('MATRIX16X16_RG',ledpins.map(id=>({id,label:id+'*'})),ledpins.slice(0,16),ledpins.slice(16),'MATRIX16X16_RG');
const gp=[...range(8,2).map(i=>'GP'+i),'3V3_OUT','GND'];
symbol('PICO_STIM',gp.map(id=>({id,label:id})),['3V3_OUT','GND'],gp.slice(0,8),'PICO_STIM');

// Generate GPIO voltage stimuli from the already checked serial simulation waveform.
const vcd=fs.readFileSync(path.join(dir,'../scan.vcd'),'utf8').split(/\r?\n/),idNames={},waves={};let t=0;
for(const line of vcd){
  const decl=line.match(/^\$var wire 1 (\S+) (\S+) /);if(decl){idNames[decl[1]]=decl[2];waves[decl[2]]=[];}
  if(line.startsWith('#'))t=Number(line.slice(1))*1e-9;
  const value=line.match(/^([01])(\S)$/);if(value&&idNames[value[2]]){
    const w=waves[idNames[value[2]]],v=Number(value[1])*3.3;
    if(!w.length)w.push([t,v]);else if(w[w.length-1][1]!==v){const prev=w[w.length-1];if(t>prev[0]+1e-9)w.push([t-1e-9,prev[1]]);w.push([t,v]);}
  }
}
for(const [name,points]of Object.entries(waves))fs.writeFileSync(path.join(dir,'gpio_'+name+'.pwl'),points.map(([time,v])=>`${time.toExponential(12)} ${v}`).join('\n')+'\n','ascii');

const lib=['* Functional approximation models, not vendor macro models. See FULL_CIRCUIT.md.',
 '.model PMOS_FULL VDMOS(pchan Vto=-1 Kp=20 Rd=0.025 Rs=0.025 Cgs=1n Cgdmax=300p Cgdmin=50p Cjo=100p Is=1n)',
 '.model ULN_FULL_SW SW(Ron=20 Roff=1G Vt=2.5 Vh=-0.1)',
 '.model RED_FULL D(Is=1e-18 N=2 Rs=2 Cjo=10p)',
 '.model GREEN_FULL D(Is=1e-23 N=2 Rs=3 Cjo=10p)'];
function sub(name,pins,lines){lib.push('.subckt '+name+' '+pins.join(' '),...lines,'.ends '+name);}
const gpSigs=['DATA_R','SCLK_R','LAT_R','BLANK_R','DATA_G','SCLK_G','LAT_G','BLANK_G'];
sub('PICO_STIM',gp,[...gpSigs.map((s,i)=>`VGP${i+2} GP${i+2} GND PWL FILE="gpio_${s}.pwl"`),'V3V3 3V3_OUT GND 3.3']);
const pn=n=>range(n,1).map(i=>'P'+i);
sub('AHCT125_FUNC',pn(14),[[2,3,1],[5,6,4],[9,8,10],[12,11,13]].flatMap(([a,y,oe],i)=>[
 `B${i} Y${i} P7 V=if(V(P${a},P7)>2, V(P14,P7), 0)`,
 `S${i} Y${i} P${y} P7 P${oe} BUF_SW`,
 ]).concat('.model BUF_SW SW(Ron=10 Roff=1G Vt=-2.5 Vh=-0.01)'));
// DFLOP pin order from the installed Digital/dflop.asy: D,unused,CLK,PRE,CLR,_Q,Q,common.
function flops(n,sin,clk,lat,clr,gnd){return range(n).flatMap(i=>[
 `AS${i} ${i?'SH'+(i-1):sin} ${gnd} ${clk} ${gnd} ${clr} ${gnd} SH${i} ${gnd} DFLOP Vhigh=5 Vlow=0 Ref=2.5 Td=2n Trise=2n Tfall=2n`,
 `AL${i} SH${i} ${gnd} ${lat} ${gnd} ${gnd} ${gnd} L${i} ${gnd} DFLOP Vhigh=5 Vlow=0 Ref=2.5 Td=2n Trise=2n Tfall=2n`,
 ]);}
sub('TLC5928_FUNC',pn(24),[
 ...flops(16,'P2','P3','P4','P1','P1'),
 'ESOUT P22 P1 SH15 P1 1','VREF P23 P1 1.2',
 ...range(16).map(i=>`BOUT${i} P${i+5} P1 I=if(V(P21,P1)>2.5,0,if(V(L${i},P1)>2.5,-42*I(VREF)*limit(V(P${i+5},P1)/0.4,0,1),0))`),
]);
sub('HC595_FUNC',pn(16),[
 'BCLR CLR P8 V=if(V(P10,P8)<2.5,5,0)',...flops(8,'P14','P11','P12','CLR','P8'),
 'ESOUT P9 P8 SH7 P8 1',...range(8).map((i)=>`BOUT${i} P${[15,1,2,3,4,5,6,7][i]} P8 V=if(V(P13,P8)<2.5,V(L${i},P8),0)`),
]);
sub('ULN2803_FUNC',pn(18),['VLOW LOW P9 0.8',...range(8).map(i=>`S${i} P${18-i} LOW P${i+1} P9 ULN_FULL_SW`)]);
sub('MATRIX16X16_RG',ledpins,range(16).flatMap(y=>range(16).flatMap(x=>[
 `DR_${y}_${x} A${y} R${x} RED_FULL`,`DG_${y}_${x} A${y} G${x} GREEN_FULL`,
])));
fs.writeFileSync(path.join(dir,'full_models.lib'),lib.join('\n')+'\n','ascii');

const c=[],numPins=ref=>refs.get(ref).slice().sort((a,b)=>Number(a.pin)-Number(b.pin));
function add(symbol,name,nodes,value,x,y,extra=''){c.push({symbol,name,nodes,value,x,y,extra});}
for(const [ref,entries]of refs){
  const map=new Map(entries.map(e=>[e.pin,e.net]));
  function chip(sym,x,y){const spec=symbols[sym];const nodes=spec.pins.map(p=>{assert.ok(map.has(p.id),`${ref}.${p.id} missing`);return map.get(p.id);});add(sym,'X'+ref,nodes,sym,x,y);}
  if(ref==='PICO'){chip('PICO_STIM',64,256);continue;}
  if(/^BUF[12]$/.test(ref)){chip('AHCT125_FUNC',64,ref==='BUF1'?864:1472);continue;}
  if(/^[RG][123]$/.test(ref)){chip('TLC5928_FUNC',1024+(Number(ref[1])-1)*1216,ref[0]==='R'?256:1216);continue;}
  if(/^ROW[12]$/.test(ref)){chip('HC595_FUNC',1024+(Number(ref[3])-1)*1216,3808);continue;}
  if(/^ULN[12]$/.test(ref)){chip('ULN2803_FUNC',1024+(Number(ref[3])-1)*1216,4384);continue;}
  if(/^LED[123]$/.test(ref)){chip('MATRIX16X16_RG',1024+(Number(ref[3])-1)*1216,2368);continue;}
  if(/^Q\d+$/.test(ref)){
    const i=Number(ref.slice(1)),x=64+(i%8)*608,y=5056+(i/8|0)*640;
    add('pmos','M'+ref,[map.get('D'),map.get('G'),'5V_LED'],'PMOS_FULL',x+256,y);
    // Additional capacitance matches the conservative 4 nF handoff test.
    add('cap','CG_EXTRA'+i,[map.get('G'),map.get('S')],'4n',x+448,y+176);continue;
  }
  if(ref==='J_PWR'){add('voltage','VDD',['V_IN','0'],'5',64,128);add('res','RFEED',['V_IN','5V'],'0.1',320,128);add('voltage','VLED_SENSE',['5V','5V_LED'],'0',800,128);continue;}
  if(ref.startsWith('C_')){const i=['BUF1','BUF2','R1','R2','R3','G1','G2','G3','ROW1','ROW2'].indexOf(ref.slice(2));add('cap',ref,numPins(ref).map(e=>e.net),'100n',64+i*448,6688);continue;}
  if(ref==='Cbulk'){add('cap',ref,numPins(ref).map(e=>e.net),'1000u Rser=0.05',576,128);continue;}
  if(/^RG\d+$/.test(ref)||/^RGS\d+$/.test(ref)){
    const i=Number(ref.match(/\d+$/)[0]),x=64+(i%8)*608,y=5056+(i/8|0)*640;
    add('res',ref,numPins(ref).map(e=>e.net),ref.startsWith('RGS')?'10k':'100',x+(ref.startsWith('RGS')?256:0),y+256);continue;
  }
  if(ref.startsWith('RI_')){const z=ref.slice(3),x=1024+(Number(z[1])-1)*1216,y=z[0]==='R'?960:1920;add('res',ref,numPins(ref).map(e=>e.net),'3.3k',x+64,y);continue;}
  if(/^RP\d$/.test(ref)){const i=Number(ref.slice(2));add('res',ref,numPins(ref).map(e=>e.net),'10k',64+(i%4)*224,2144+(i/4|0)*256);continue;}
  if(ref.startsWith('R_BLANK')){add('res',ref,numPins(ref).map(e=>e.net),'10k',64,ref.endsWith('_R')?2880:3200);continue;}
  throw new Error('Unmapped component '+ref);
}
const directives=['.include full_models.lib','.tran 0 16.2m 0 500n','.options plotwinsize=0',
 '.save V(5V) V(BLANK_R) V(LAT_R) V(SCLK_R) V(DATA_R) '+range(16).map(i=>`V(ROW_CTL_${i})`).join(' ')+' V(A_ROW_0) V(A_ROW_1) V(GATE_0) V(GATE_1) I(VDD) I(VLED_SENSE)',
 '.meas tran SUPPLY_MIN MIN V(5V) FROM 500u TO 15.8m',
 ...range(16).map(y=>`.meas tran ROW${y}_CTL FIND V(ROW_CTL_${y}) AT=${y+0.5}m`),
 ...range(16).map(y=>`.meas tran ROW${y}_CURRENT FIND I(VLED_SENSE) AT=${y+0.5}m`),
 ...range(16).map(y=>`.meas tran ROW${y}_COUNT FIND (${range(16).map(i=>`if(V(ROW_CTL_${i})>2.5,1,0)`).join('+')}) AT=${y+0.5}m`),
];
fs.writeFileSync(path.join(dir,'full_circuit.cir'),['Full 3-panel LED circuit, functional serial models and assumed analog models',...c.map(o=>`${o.name} ${o.nodes.join(' ')} ${o.value}${o.extra?' '+o.extra:''}`),...directives,'.end'].join('\n')+'\n','ascii');
const offsets={voltage:[[0,16],[0,96]],res:[[16,16],[16,96]],cap:[[16,0],[16,64]],pmos:[[48,0],[0,80],[48,96]]};
const asc=['Version 4.1','SHEET 1 5400 7900',
 'TEXT 64 -96 Left 4 ;FULL CIRCUIT - 3 x 16x16 RED/GREEN - FUNCTIONAL LTspice MODEL',
 'TEXT 64 -32 Left 2 ;ALL equal net labels are connected. IC pin numbers are physical PW/DIP mapping; LED A/R/G and MOSFET G/S/D are functional terminals.',
 'TEXT 64 16 Left 2 ;MCU/USB replaced by serial stimuli. ICs use APPROXIMATE functional models.',
 'TEXT 1024 160 Left 3 ;RED column sinks R1 / R2 / R3 - 48 channels',
 'TEXT 1024 1120 Left 3 ;GREEN column sinks G1 / G2 / G3 - 48 channels',
 'TEXT 1024 2240 Left 3 ;LED1 / LED2 / LED3 - 1536 individual color diodes inside the matrix subcircuits',
 'TEXT 1024 3680 Left 3 ;16-bit row select: ROW1/ROW2 -> ULN1/ULN2 -> Q0..Q15',
 'TEXT 64 4960 Left 3 ;All sixteen P-MOS row stages (100 ohm gate / 10k pull-up / extra 4n gate capacitance)',
 'TEXT 64 6560 Left 3 ;Local decoupling - 100nF per logic IC',
 'TEXT 64 7040 Left 2 ;Include full_models.lib, all six ASY symbols and eight GPIO PWL files alongside this ASC. Run time: one complete 16-row scan.',
];
for(const o of c){
  const spec=symbols[o.symbol];const pins=spec?spec.pins.map(p=>spec.loc.get(p.id).slice(0,2)):offsets[o.symbol];
  pins.forEach(([dx,dy],i)=>{
    const x=o.x+dx,y=o.y+dy;
    if(spec){const right=dx>0,xx=x+(right?64:-64);asc.push(`WIRE ${x} ${y} ${xx} ${y}`,`FLAG ${xx} ${y} ${o.nodes[i]}`);}
    else{const yy=y+(i===0?-32:32);asc.push(`WIRE ${x} ${y} ${x} ${yy}`,`FLAG ${x} ${yy} ${o.nodes[i]}`);}
  });
}
for(const o of c){asc.push(`SYMBOL ${o.symbol} ${o.x} ${o.y} R0`,`SYMATTR InstName ${o.name}`,`SYMATTR Value ${o.value}`);if(o.extra)asc.push(`SYMATTR SpiceLine ${o.extra}`);}
directives.forEach((d,i)=>asc.push(`TEXT 64 ${7168+i*32} Left 2 !${d}`));
fs.writeFileSync(path.join(dir,'full_circuit.asc'),asc.join('\r\n')+'\r\n','ascii');
// Vector view uses the exact same component records and net names as the ASC.
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
let svg='<svg xmlns="http://www.w3.org/2000/svg" width="5400" height="7200" viewBox="-96 -200 5400 7200"><style>text{font-family:Consolas,Meiryo,monospace;font-size:18px;fill:#153245}.part{fill:#f6fbff;stroke:#244e68;stroke-width:2}.net{fill:none;stroke:#247e93;stroke-width:2}.heading{font-size:28px;font-weight:bold}.label{font-size:16px;fill:#186879}</style><rect x="-96" y="-200" width="5400" height="7200" fill="white"/>';
const txt=(x,y,s,cl='')=>{svg+=`<text x="${x}" y="${y}" class="${cl}">${escape(s)}</text>`;};
for(const line of asc.filter(s=>s.startsWith('TEXT ')&&s.includes(' ;'))){const m=line.match(/^TEXT (-?\d+) (-?\d+) Left \d ;(.*)$/);if(m)txt(Number(m[1]),Number(m[2]),m[3],'heading');}
for(const o of c){const spec=symbols[o.symbol];
  if(spec){svg+=`<rect class="part" x="${o.x+32}" y="${o.y}" width="384" height="${spec.h}" rx="4"/>`;txt(o.x+48,o.y-14,o.name+' / '+o.value);
    spec.pins.forEach((p,i)=>{const [dx,dy]=spec.loc.get(p.id),x=o.x+dx,y=o.y+dy,right=dx>0;
      svg+=`<path class="net" d="M ${x+(right?64:-64)} ${y} H ${x+(right?-32:32)}"/>`;
      txt(right?x-196:x+40,y+6,p.id+':'+p.label,'label');
      txt(right?x+70:x-320,y+6,o.nodes[i],'label');});
  }else{
    // Terminal-labelled standard components; each net is exactly the ASC net.
    svg+=`<rect class="part" x="${o.x-8}" y="${o.y}" width="232" height="112" rx="4"/>`;
    txt(o.x+4,o.y+24,o.name);txt(o.x+4,o.y+48,o.value);
    o.nodes.forEach((net,i)=>txt(o.x+4,o.y+72+i*18,(o.symbol==='pmos'?['D','G','S'][i]:(i+1))+': '+net,'label'));
  }
}
svg+='</svg>';fs.writeFileSync(path.join(dir,'full_circuit.svg'),svg);
assert.equal(c.filter(o=>o.symbol==='TLC5928_FUNC').length,6);
assert.equal(c.filter(o=>o.symbol==='MATRIX16X16_RG').length,3);
assert.equal(c.filter(o=>o.symbol==='pmos').length,16);
assert.equal(lib.filter(s=>/^D[RG]_/.test(s)).length,512);
assert.equal(new Set(c.map(o=>o.name)).size,c.length);
console.log(`Full circuit: ${c.length} top-level parts, 6 TLC, 2 HC595, 2 AHCT125, 2 ULN, 16 PMOS, 3 x 512 LED paths. GPIO stimuli derived from scan.vcd.`);
