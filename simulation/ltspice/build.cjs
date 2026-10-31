'use strict';
const fs=require('node:fs'),path=require('node:path');
const dir=__dirname;
// Same component records generate both the CIR and the editable ASC.
const c=[];
function add(symbol,name,nodes,value,x,y,extra=''){c.push({symbol,name,nodes,value,x,y,extra});}
add('voltage','VDD',['VIN','0'],'5',64,128);
add('res','RWIRE',['VIN','V5'],'0.1',256,128);
add('cap','CBULK',['V5','0'],'1000u Rser=0.05',448,144);
add('voltage','VULNLOW',['ULN_LOW','0'],'0.8',64,368);
add('voltage','VROW0',['CTL0','0'],'PWL(0 5 999.99u 5 1m 0)',64,624);
add('voltage','VROW1',['CTL1','0'],'PWL(0 0 1m 0 1.00001m 5)',64,864);
add('voltage','VBLANK',['BLANK','0'],'PWL(0 5 124.99u 5 125u 0 999.99u 0 1m 5 {1m+TGUARD} 5 {1m+TGUARD+10n} 0)',64,1120);
for(let y=0;y<2;y++){
  const top=480+y*420;
  add('sw','SULN'+y,['ULN'+y,'ULN_LOW','CTL'+y,'0'],'ULN_EQ',352,top);
  add('res','RG'+y,['ULN'+y,'GATE'+y],'100',576,top);
  add('res','RGS'+y,['V5','GATE'+y],'10k',800,top-160);
  add('cap','CG'+y,['GATE'+y,'V5'],'{CGATE}',800,top+144);
  add('pmos','MROW'+y,['DRAIN'+y,'GATE'+y,'V5'],'PMOS_ASSUMED',1056,top);
  add('voltage','VSENSE'+y,['DRAIN'+y,'ANODE'+y],'0',1296,top);
  add('res','RBLEED'+y,['ANODE'+y,'0'],'1Meg',1520,top+144);
  add('diode','D'+y+'R',['ANODE'+y,'KR'],'LED_RED',1520,top,'48');
  add('diode','D'+y+'G',['ANODE'+y,'KG'],'LED_GREEN',1776,top,'48');
}
add('bi','BRED',['KR','0'],'I=if(V(BLANK)<2.5,48*ILED*limit(V(KR)/0.4,0,1),0)',2112,480);
add('bi','BGREEN',['KG','0'],'I=if(V(BLANK)<2.5,48*ILED*limit(V(KG)/0.4,0,1),0)',2112,900);
const directives=[
 '.param ILED=1.2*42/3300',
 '.step param TGUARD list 10u 100u',
 '.step param CGATE list 1n 4n',
 '* Explicit assumption models, NOT vendor AO3401A / ULN / TLC macro models.',
 '.model PMOS_ASSUMED VDMOS(pchan Vto=-1 Kp=20 Rd=0.025 Rs=0.025 Cgs=1n Cgdmax=300p Cgdmin=50p Cjo=100p Is=1n)',
 '.model ULN_EQ SW(Ron=20 Roff=1G Vt=2.5 Vh=-0.1)',
 '.model LED_RED D(Is=1e-18 N=2 Rs=2 Cjo=10p)',
 '.model LED_GREEN D(Is=1e-23 N=2 Rs=3 Cjo=10p)',
 '.tran 0 1.6m 0 100n',
 '.options plotwinsize=0',
 '.save V(V5) V(DRAIN0) V(GATE0) V(GATE1) V(ANODE0) V(ANODE1) V(BLANK) V(CTL0) V(CTL1) I(VSENSE0) I(VSENSE1) I(D0R) I(D0G) I(D1R) I(D1G) I(VDD) V(KR) V(KG)',
 '.meas tran LED_PEAK MAX (I(VSENSE0)+I(VSENSE1)) FROM 400u TO 800u',
 '.meas tran LED_STEADY AVG (I(VSENSE0)+I(VSENSE1)) FROM 400u TO 800u',
 '.meas tran BLANK_LEAK MAX (I(D0R)+I(D0G)+I(D1R)+I(D1G)) FROM 1.0001m TO {1m+TGUARD-0.1u}',
 '.meas tran GHOST_OLD MAX (I(D0R)+I(D0G)) FROM {1m+TGUARD+2u} TO 1.4m',
 '.meas tran NEW_ROW AVG I(VSENSE1) FROM 1.4m TO 1.5m',
 '.meas tran RAIL_MIN MIN V(V5) FROM 125u TO 1.5m',
 '.meas tran PMOS0_DROP AVG V(V5,DRAIN0) FROM 400u TO 800u',
 '.meas tran PMOS0_POWER AVG (V(V5,DRAIN0)*I(VSENSE0)) FROM 400u TO 800u',
 '.meas tran GHOST_CHARGE INTEG (I(D0R)+I(D0G)) FROM {1m+TGUARD+2u} TO 1.4m',
 '.meas tran SINK_RED_POWER AVG (V(KR)*(I(D0R)+I(D1R))) FROM 400u TO 800u',
];
const net=['Adjacent-row electrical test, 48 columns/color, behavioral TLC output',...c.map(o=>`${o.name} ${o.nodes.join(' ')} ${o.value}${o.extra?' '+o.extra:''}`),...directives,'.end'];
fs.writeFileSync(path.join(dir,'row_handoff.cir'),net.join('\n')+'\n','ascii');
const offsets={voltage:[[0,16],[0,96]],res:[[16,16],[16,96]],cap:[[16,0],[16,64]],sw:[[0,16],[0,96],[-48,80],[-48,32]],pmos:[[48,0],[0,80],[48,96]],diode:[[16,0],[16,64]],bi:[[0,0],[0,80]]};
const asc=['Version 4.1','SHEET 1 3000 2050'];
asc.push('TEXT 32 24 Left 3 ;BLOCK ILLUMINATION - LTspice electrical test Rev A',
 'TEXT 32 72 Left 2 ;Two adjacent rows; each diode represents 48 matched columns. Named flags connect all terminals.',
 'TEXT 32 104 Left 2 ;PMOS/ULN/LED/TLC are ASSUMPTION MODELS. Digital row commands are prescribed stimuli, not IC emulation.',
 'TEXT 32 1376 Left 2 ;10k gate pull-up; ULN equivalent pulls to 0.8V. Sweep extra gate C=1n/4n and BLANK guard=10u/100u.',
 'TEXT 32 1408 Left 2 ;Probe ANODE0/1, GATE0/1, BLANK and I(VSENSE0/1). GHOST_OLD measures old-row light after BLANK releases.');
for(const o of c){
  // Short stubs plus explicit net flags avoid long crossing wires.
  offsets[o.symbol].forEach(([dx,dy],i)=>{const x=o.x+dx,y=o.y+dy,yy=y+(i===0?-32:32);asc.push(`WIRE ${x} ${y} ${x} ${yy}`,`FLAG ${x} ${yy} ${o.nodes[i]}`);});
}
for(const o of c){asc.push(`SYMBOL ${o.symbol} ${o.x} ${o.y} R0`,`SYMATTR InstName ${o.name}`,`SYMATTR Value ${o.value}`);if(o.extra)asc.push(`SYMATTR SpiceLine ${o.extra}`);}
// Long directives live off to the right to keep the circuit readable.
directives.filter(s=>!s.startsWith('*')).forEach((s,i)=>asc.push(`TEXT 32 ${1480+i*32} Left 2 !${s}`));
fs.writeFileSync(path.join(dir,'row_handoff.asc'),asc.join('\r\n')+'\r\n','ascii');
console.log('Generated editable row_handoff.asc and matching row_handoff.cir');
