'use strict';
// One terminal list generates physical wiring, SVG, ASC and SPICE test circuits.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),sim=path.join(root,'simulation','ltspice');
fs.mkdirSync(sim,{recursive:true});
const channels=['CPU','GPU','NPU'],pins=[1,4,6],gpio=[0,2,4];
const outputs=[1,18,17,16,15,14,13,12,11,10];
const nets=[];
const pin=(ref,p,label,net)=>nets.push([ref,String(p),label,net]);
pin('PICO',3,'GND','GND');pin('J_PWR',1,'external regulated 5V +/-5%','5V');pin('J_PWR',2,'GND','GND');
for(let j=0;j<3;j++){
 const ch=channels[j],u='U_'+ch,l='LED_'+ch;
 pin('PICO',pins[j],'GP'+gpio[j]+' PWM 20kHz','PWM_'+ch);
 pin('RF_'+ch,1,'4.7k 1%','PWM_'+ch);pin('RF_'+ch,2,'4.7k 1%','SIG_'+ch);
 pin('RPD_'+ch,1,'10k','PWM_'+ch);pin('RPD_'+ch,2,'10k','GND');
 pin('CF_'+ch,1,'4.7uF X7R >=10V','SIG_'+ch);pin('CF_'+ch,2,'4.7uF X7R >=10V','GND');
 for(const [p,label,n] of [[2,'GND','GND'],[3,'V+','5V'],[4,'RLO','GND'],[5,'SIG','SIG_'+ch],[6,'RHI','REF_'+ch],[7,'REF_OUT','REF_'+ch],[8,'REF_ADJ','GND'],[9,'MODE_BAR','5V']])pin(u,p,label,n);
 pin('RSET_'+ch,1,'3.3k 1%','REF_'+ch);pin('RSET_'+ch,2,'3.3k 1%','GND');
 for(let i=0;i<10;i++){pin(u,outputs[i],'OUT'+(i+1),'K_'+ch+'_'+(i+1));pin(l,i+1,String.fromCharCode(65+i)+' anode','5V');pin(l,20-i,String.fromCharCode(65+i)+' cathode','K_'+ch+'_'+(i+1));}
 for(const [ref,value] of [['CD_'+ch,'100nF X7R >=10V'],['CB_'+ch,'10uF >=10V']]){pin(ref,1,value,'5V');pin(ref,2,value,'GND');}
}
pin('CBULK',1,'100uF >=10V','5V');pin('CBULK',2,'100uF >=10V','GND');
const seen=new Set();for(const [ref,p]of nets){assert.ok(!seen.has(ref+'.'+p));seen.add(ref+'.'+p);}
for(const ch of channels){assert.equal(nets.filter(r=>r[0]==='U_'+ch).length,18);assert.equal(nets.filter(r=>r[0]==='LED_'+ch).length,20);}
fs.writeFileSync(path.join(__dirname,'connections.csv'),'reference,physical_pin,function_or_value,net\n'+nets.map(r=>r.join(',')).join('\n')+'\n');
const bom=[['PICO',1,'Raspberry Pi Pico 2 H','USB powered; external 5V must not connect to VBUS'],['U_CPU U_GPU U_NPU',3,'XD3914 DIP-18','Bar mode: pin9 to pin3'],['LED_CPU LED_GPU LED_NPU',3,'OSX10201-GYR1','20 pins; anodes1..10; cathodes20..11'],['RF_*',3,'4.7k 1% >=0.125W','PWM low-pass'],['RPD_*',3,'10k >=0.125W','GPIO pull-down during reset'],['RSET_*',3,'3.3k 1% >=0.125W','Pin7 to GND; internal ladder load also sets LED current'],['CF_*',3,'4.7uF X7R >=10V','Effective capacitance 2.2..6.8uF required over voltage/temperature'],['CD_*',3,'100nF X7R >=10V','Close to pin3-pin2'],['CB_*',3,'10uF >=10V','Close to each driver and LED supply; polarity if electrolytic'],['CBULK',1,'100uF >=10V','Supply entry; observe polarity'],['J_PWR',1,'2-pin keyed connector >=1A','Pin1 +5V; pin2 GND'],['PSU',1,'Regulated 5V +/-5% >=0.5A','Powers driver board only; Pico via USB']];
fs.writeFileSync(path.join(__dirname,'bom.csv'),'reference,quantity,part,notes\n'+bom.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n')+'\n');

const range=n=>Array.from({length:n},(_,i)=>i+1);
const lib=[
 '* XD3914 behavioral approximation, NOT a vendor transistor macro-model.',
 '* Bar mode only; no internal startup/oscillation/thermal dynamics are modeled.',
 '.model BARLED D(Is=1e-19 N=2 Rs=3 Cjo=10p)',
 '.model GPIO_SW SW(Ron=30 Roff=1G Vt=0.5 Vh=-0.01)',
 '.subckt XD3914 '+range(18).map(n=>'P'+n).join(' ')+' params: VREFVAL=1.28 RLAD=12k ERR=0 ISCALE=1',
 'BREF P7 P8 V={VREFVAL}*limit(V(P3,P2)/3,0,1)',
 'RLAD P6 P4 {RLAD}',
 'BSUP P3 P2 I=if(V(P3,P2)>2.5,2.4m+4*max(0,-I(BREF)),0)',
 'BBIAS P5 P2 I=100n',
 ...outputs.map((p,i)=>`BOUT${i+1} P${p} P2 I=if(V(P3,P2)>2.5,if(V(P9,P3)>-0.02,if(V(P5,P4)>${(i+1)/10}*V(P6,P4)+ERR,ISCALE*10*max(0,-I(BREF))*limit(V(P${p},P2)/0.4,0,1),1n),0),0)`),
 '.ends XD3914',
 '.subckt OSX10201_GYR1 '+range(20).map(n=>'P'+n).join(' '),
 ...range(10).map(n=>`D${n} P${n} P${21-n} BARLED`),
 '.ends OSX10201_GYR1'];
fs.writeFileSync(path.join(sim,'meter_models.lib'),lib.join('\n')+'\n','ascii');

// Symbol pin IDs are physical package pins; SpiceOrder follows the numeric order.
const symbols={};
function symbol(name,labels,left,right){
 const loc={},h=Math.max(left.length,right.length)*32+64;
 left.forEach((p,i)=>loc[p]=[0,48+i*32,'LEFT']);right.forEach((p,i)=>loc[p]=[512,48+i*32,'RIGHT']);
 const lines=['Version 4','SymbolType CELL',`RECTANGLE Normal 32 0 480 ${h}`,'WINDOW 0 48 -32 Left 2',`WINDOW 3 48 ${h+24} Left 2`,'SYMATTR Prefix X','SYMATTR Value '+name];
 range(labels.length).forEach(p=>{const [x,y,side]=loc[p];lines.push(`LINE Normal ${x} ${y} ${side==='LEFT'?32:480} ${y}`,`PIN ${x} ${y} ${side} 8`,`PINATTR PinName ${p}:${labels[p-1]}`,`PINATTR SpiceOrder ${p}`);});
 fs.writeFileSync(path.join(sim,name+'.asy'),lines.join('\r\n')+'\r\n','ascii');symbols[name]={loc,labels,h};
}
const xdLabels=['OUT1','GND','V+','RLO','SIG','RHI','REF_OUT','REF_ADJ','MODE',...range(9).map(n=>'OUT'+(11-n))];
symbol('XD3914',xdLabels,[2,3,4,5,6,7,8,9],outputs);
symbol('OSX10201_GYR1',[...range(10).map(n=>String.fromCharCode(64+n)+'+'),...range(10).map(n=>String.fromCharCode(75-n)+'-')],range(10),range(10).map(n=>21-n));
const records=[];
function add(name,nodes,value,kind,x,y){records.push({name,nodes,value,kind,x,y});}
const lookup=(ref,p)=>{const a=nets.find(r=>r[0]===ref&&r[1]===String(p));assert.ok(a,ref+'.'+p);return a[3]==='GND'?'0':a[3];};
add('VDD',['VIN','0'],'5','voltage',64,128);add('RFEED',['VIN','5V'],'0.1','res',320,128);add('CBULK',['5V','0'],'100u Rser=0.1','cap',576,144);
for(let j=0;j<3;j++){
 const ch=channels[j],y=640+j*1536,ref='U_'+ch;
 add('VPWM_'+ch,['DRIVE_'+ch,'0'],`PULSE(0 {VGPIO} 100m 20n 20n {DT${j}*50u} 50u)`,'voltage',64,y);
 add('SIO_'+ch,['DRIVE_'+ch,'PWM_'+ch,'EN','0'],'GPIO_SW','sw',320,y);
 add('RPD_'+ch,['PWM_'+ch,'0'],'10k','res',320,y+256);
 add('RF_'+ch,['PWM_'+ch,'SIG_'+ch],'{4700*RFAC}','res',608,y);
 add('CF_'+ch,['SIG_'+ch,'0'],'{CFVAL}','cap',608,y+256);
 add('XU_'+ch,range(18).map(p=>{const net=lookup(ref,p);return outputs.includes(p)?net+'_SINK':net==='5V'&&p===3?'VCC_'+ch:net;}),`XD3914 VREFVAL={VR${j}} RLAD={RLADVAL} ERR={THERR} ISCALE={ISCALE}`,'XD3914',1024,y);
 add('VLOGIC_'+ch,['5V','VCC_'+ch],'0','voltage',64,y+512);
 add('RSET_'+ch,['REF_'+ch,'0'],'{3300*RSETFAC}','res',608,y+512);
 add('CD_'+ch,['5V','0'],'100n','cap',64,y+768);add('CB_'+ch,['5V','0'],'10u Rser=0.1','cap',320,y+768);
 const ledNodes=range(20).map(p=>lookup('LED_'+ch,p));
 add('XLED_'+ch,ledNodes,'OSX10201_GYR1','OSX10201_GYR1',2432,y);
 for(let i=1;i<=10;i++)add('VS_'+ch+'_'+i,['K_'+ch+'_'+i,'K_'+ch+'_'+i+'_SINK'],'0','voltage',1792+(i>5?320:0),y+((i-1)%5)*224);
}
add('VEN',['EN','0'],'PWL(0 1 399.999m 1 400m 0)','voltage',864,128);
const common=['.include meter_models.lib','.param VR0=1.28 VR1=1.28 VR2=1.28 VGPIO=3.3 RFAC=1 CFVAL=4.7u RSETFAC=1 RLADVAL=12k THERR=0 ISCALE=1',
 '.param DT0={(3.5/10)*VR0/VGPIO} DT1={(6.5/10)*VR1/VGPIO} DT2={1.08*VR2/VGPIO}',
 '.options plotwinsize=0',
 '.save V(5V) V(EN) '+channels.map(ch=>`V(SIG_${ch}) V(REF_${ch}) V(VCC_${ch}) I(VLOGIC_${ch})`).join(' ')+' '+channels.flatMap(ch=>range(10).map(i=>`I(VS_${ch}_${i}) V(K_${ch}_${i}_SINK)`)).join(' ')+' I(VDD)',
];
const ct=ch=>channels.includes(ch)?range(10).map(i=>`if(I(VS_${ch}_${i})>1m,1,0)`).join('+'):'';
const normalMeas=channels.flatMap((ch,j)=>[
 `.meas tran ${ch}_SIG AVG V(SIG_${ch}) FROM 330m TO 350m`,
 `.meas tran ${ch}_RIPPLE PP V(SIG_${ch}) FROM 330m TO 350m`,
 `.meas tran ${ch}_COUNT FIND (${ct(ch)}) AT=350m`,
 `.meas tran ${ch}_RESET FIND (${ct(ch)}) AT=750m`,
 `.meas tran ${ch}_I AVG I(VS_${ch}_1) FROM 330m TO 350m`,
 `.meas tran ${ch}_P AVG (${range(10).map(i=>`V(K_${ch}_${i}_SINK)*I(VS_${ch}_${i})`).join('+')}+V(VCC_${ch})*I(VLOGIC_${ch})) FROM 330m TO 350m`,
 `.meas tran ${ch}_START FIND (${ct(ch)}) AT=50m`,
]);
const circuit=(title,parts,dirs)=>[title,...parts.map(o=>`${o.name} ${o.nodes.join(' ')} ${o.value}`),...dirs,'.end'].join('\n')+'\n';
const pwmDirs=[...common,'.step param CFVAL list 2.2u 6.8u','.tran 0 800m 0 2u',...normalMeas,'.meas tran SUPPLY_MIN MIN V(5V) FROM 0 TO 800m'];
fs.writeFileSync(path.join(sim,'level_meter.cir'),circuit('3-channel PWM filter and high-impedance Pico reset test',records,pwmDirs),'ascii');
// All levels, both polarities of comparator error and reference/ladder/current corners.
const levelsParts=records.map(o=>({...o,nodes:[...o.nodes]}));
for(const [j,ch] of channels.entries())levelsParts.find(o=>o.name==='VPWM_'+ch).value=`{if(LEVEL<0.5,0,if(LEVEL>9.5,1.08*VR${j},(LEVEL+0.5)*VR${j}/10))}`;
levelsParts.find(o=>o.name==='VEN').value='1';
levelsParts.find(o=>o.name==='VDD').value='5.25';
const cornerDirs=[...common.filter(line=>!line.startsWith('.param VR0=')),'.step param LEVEL 0 10 1','.step param CORNER list -1 1',
 '.param VR0=1.20 VR1=1.28 VR2=1.34 VGPIO=3.3 RFAC=1 CFVAL=4.7u',
 '.param RSETFAC={1+CORNER*0.01} RLADVAL={if(CORNER<0,8k,17k)} THERR={CORNER*(0.015+0.02*1.34)} ISCALE={if(CORNER<0,1.3,0.7)}',
 '.tran 0 1m 0 100u',
 ...channels.flatMap(ch=>[`.meas tran ${ch}_COUNT FIND (${ct(ch)}) AT=500u`,`.meas tran ${ch}_I FIND I(VS_${ch}_1) AT=500u`,`.meas tran ${ch}_P FIND (${range(10).map(i=>`V(K_${ch}_${i}_SINK)*I(VS_${ch}_${i})`).join('+')}+V(VCC_${ch})*I(VLOGIC_${ch})) AT=500u`]),
 '.meas tran SUPPLY FIND V(5V) AT=500u'];
fs.writeFileSync(path.join(sim,'levels.cir'),circuit('All 11 calibrated bar levels; two deterministic component/error corners',levelsParts,cornerDirs),'ascii');
// ASC uses separated component groups so labels/stubs cannot overlap other groups.
const offsets={voltage:[[0,16],[0,96]],res:[[16,16],[16,96]],cap:[[16,0],[16,64]],sw:[[0,16],[0,96],[-48,80],[-48,32]]};
const asc=['Version 4.1','SHEET 1 3500 7000','TEXT 64 -96 Left 3 ;Pico 2 H / XD3914 x3 / OSX10201-GYR1 x3 - PWM / RESET TEST',
 'TEXT 64 -32 Left 2 ;Same net labels connect. VS_* and VLOGIC_* are zero-volt measurement sources, not hardware parts.',
 'TEXT 64 16 Left 2 ;Behavioral IC and LED models. Bar mode only. Physical pin IDs on custom symbols.'];
for(const o of records){
 const spec=symbols[o.kind],pp=spec?range(spec.labels.length).map(p=>spec.loc[p].slice(0,2)):offsets[o.kind];
 pp.forEach(([dx,dy],i)=>{const x=o.x+dx,y=o.y+dy;
 if(spec){const xx=x+(dx===0?-64:64);asc.push(`WIRE ${x} ${y} ${xx} ${y}`,`FLAG ${xx} ${y} ${o.nodes[i]}`);}
 else{const yy=y+(i===0?-32:32);asc.push(`WIRE ${x} ${y} ${x} ${yy}`,`FLAG ${x} ${yy} ${o.nodes[i]}`);}});
}
for(const o of records)asc.push(`SYMBOL ${o.kind} ${o.x} ${o.y} R0`,`SYMATTR InstName ${o.name}`,`SYMATTR Value ${o.value}`);
pwmDirs.forEach((line,i)=>asc.push(`TEXT 64 ${5408+i*32} Left 2 !${line}`));
fs.writeFileSync(path.join(sim,'level_meter.asc'),asc.join('\r\n')+'\r\n','ascii');
fs.writeFileSync(path.join(sim,'expected-nets.json'),JSON.stringify(records.map(({name,nodes})=>({name,nodes})),null,2)+'\n');

// A physical wiring drawing without simulator-only sources or extra ICs.
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
let svg='<svg xmlns="http://www.w3.org/2000/svg" width="1900" height="2140" viewBox="0 0 1900 2140"><style>text{font-family:Meiryo,Segoe UI,sans-serif;font-size:21px;fill:#193947}.h{font-size:29px;font-weight:bold}.small{font-size:18px}.w{fill:none;stroke:#247887;stroke-width:2}.part{fill:#f2f8fb;stroke:#35667a;stroke-width:2}</style><rect width="1900" height="2140" fill="white"/>';
const text=(x,y,t,c='')=>{svg+=`<text x="${x}" y="${y}" class="${c}">${esc(t)}</text>`;};
const line=(d)=>{svg+=`<path class="w" d="${d}"/>`;};
text(48,56,'Pico 2 H ＋ XD3914 ×3 ＋ OSX10201-GYR1 ×3 / 試作配線図 Rev C','h');
text(48,96,'全チャンネル共通：XD3914 pin2 / pin4 / pin8 → GND、pin3 / pin9 → 外部5V。');
text(48,132,'各LEDのアノード pin1..10 → 外部5V。同名ネットは接続。端子番号は部品上面・PIN1印を基準に照合。','small');
for(let j=0;j<3;j++){
 const ch=channels[j],y=190+j*540;
 text(48,y,ch+' / Pico GP'+gpio[j]+'（物理pin'+pins[j]+'）','h');
 text(48,y+66,'PWM 20kHz');line(`M 210 ${y+60} H 300`);
 svg+=`<rect class="part" x="300" y="${y+42}" width="120" height="36"/>`;text(310,y+29,'RF 4.7kΩ');line(`M 420 ${y+60} H 650`);text(470,y+42,'SIG_'+ch,'small');
 line(`M 244 ${y+60} V ${y+122}`);svg+=`<rect class="part" x="230" y="${y+122}" width="28" height="65"/>`;line(`M 244 ${y+187} V ${y+225} h -15 h 30`);text(48,y+165,'RPD 10kΩ → GND','small');
 line(`M 490 ${y+60} V ${y+125} M 464 ${y+125} H 516 M 464 ${y+138} H 516 M 490 ${y+138} V ${y+225} h -15 h 30`);
 text(352,y+176,'CF 4.7µF → GND','small');
 svg+=`<rect class="part" x="650" y="${y+12}" width="390" height="400" rx="8"/>`;text(678,y+49,'U_'+ch+' / XD3914','h');
 text(674,y+90,'5 SIG ← RC出力','small');text(674,y+126,'6 RHI ─┐','small');text(674,y+157,'7 REF ─┴→ REF_'+ch,'small');
 text(674,y+203,'REF → RSET 3.3kΩ → GND','small');text(674,y+243,'2 GND / 4 RLO / 8 ADJ','small');text(674,y+272,'→ GND','small');
 text(674,y+315,'3 V+ / 9 MODE → 5V','small');text(674,y+355,'CD 100nF ＋ CB 10µF','small');text(674,y+385,'各々5V–GND間、ICの近く','small');
 text(1110,y+35,'LED_'+ch+' / OSX10201-GYR1','h');
 text(1110,y+70,'段     色       XD出力pin → LEDカソードpin','small');
 for(let i=0;i<10;i++){
 const yy=y+105+i*29,color=i<5?'#76a955':i<8?'#e4bf40':'#d66b59';svg+=`<rect x="1110" y="${yy-18}" width="22" height="22" fill="${color}"/>`;
 text(1148,yy,`${i+1} / ${String.fromCharCode(65+i)}    ${i<5?'黄緑':i<8?'黄　':'赤　'}       ${outputs[i]} → ${20-i}`,'small');
 }
 text(48,y+320,'TP_'+ch+'：SIG測定点','small');text(48,y+354,'TP_REF_'+ch+'：pin7基準電圧','small');
 text(48,y+388,'この2点をテスターで校正','small');
}
text(48,1858,'電源：PicoはUSB給電。外部5V ±5%・0.5A以上 → J_PWR.1、GND → J_PWR.2。','h');
text(48,1900,'Pico GND（例：物理pin3）とドライバー基板GNDを接続。外部5VをPicoのVBUSへ直結しない。');
text(48,1940,'入口CBULK 100µF、各ICに100nF＋10µF。GNDは各IC pin2近傍で信号・基準をまとめる。');
text(48,1980,'LED電流の概算：10 × VREF × (1 / RSET ＋ 1 / 内部分圧抵抗) ≈ 4.95mA/段（代表値）。');
text(48,2020,'試作版：端子は資料と照合済み。LTspiceは動作近似モデルであり、実部品・基板の動作保証ではありません。','small');
text(48,2060,'表示定義：0～9%=0段、10～19%=1段、…、90～99%=9段、100%=10段。','small');
text(48,2100,'通常停止はPWM=0。Picoリセット時はRPD経由で放電するため、消灯まで数百msの遅れがあります。','small');
svg+='</svg>';fs.writeFileSync(path.join(__dirname,'schematic.svg'),svg);
console.log(`Built Rev C physical wiring (${nets.length} pins), BOM, schematic, two LTspice tests and ASC (${records.length} parts)`);
