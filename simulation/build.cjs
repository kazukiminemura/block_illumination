'use strict';
const fs=require('node:fs'),path=require('node:path');
const dir=__dirname;
const nets=[];
function pin(ref,p,note,net){nets.push([ref,p,note,net]);}
const sigs=['DATA_R','SCLK_R','LAT_R','BLANK_R','DATA_G','SCLK_G','LAT_G','BLANK_G'];
const ab=[[2,3,1],[5,6,4],[9,8,10],[12,11,13]];
sigs.forEach((s,i)=>{
  pin('PICO','GP'+(i+2),s,s+'_3V3');
  const ref='BUF'+(1+(i/4|0)),[a,y,oe]=ab[i%4];
  pin(ref,a,'A',s+'_3V3');pin(ref,y,'Y',s);pin(ref,oe,'/OE','BUF_OE_N');
  pin('RP'+i,1,'10k',s+'_3V3');pin('RP'+i,2,'10k',s.startsWith('BLANK')?'3V3':'GND');
});
for(const ref of ['BUF1','BUF2']){pin(ref,14,'VCC','5V');pin(ref,7,'GND','GND');}
// Rev B: default-disabled 5 V buffers, including when the USB-powered Pico is absent.
pin('PICO','GP10','RUN_EN','RUN_EN');
pin('REN',1,'4.7k','RUN_EN');pin('REN',2,'4.7k','EN_BASE');
pin('REN_PD',1,'100k','EN_BASE');pin('REN_PD',2,'100k','GND');
pin('ROE',1,'10k','5V');pin('ROE',2,'10k','BUF_OE_N');
pin('QEN',1,'2N3904 emitter','GND');pin('QEN',2,'2N3904 base','EN_BASE');pin('QEN',3,'2N3904 collector','BUF_OE_N');
for(const s of sigs.filter(s=>!s.startsWith('BLANK'))) {pin('RY_'+s,1,'10k',s);pin('RY_'+s,2,'10k','GND');}
for(const color of ['R','G'])for(let p=0;p<3;p++){
  const ref=color+(p+1);
  pin(ref,1,'GND','GND');pin(ref,24,'VCC','5V');pin(ref,2,'SIN',p?color+'_SER_'+p:'DATA_'+color);
  pin(ref,22,'SOUT',p===2?(color==='R'?'ROW_SER':'NC_G_SOUT'):color+'_SER_'+(p+1));
  pin(ref,3,'SCLK','SCLK_'+color);pin(ref,4,'LAT','LAT_'+color);pin(ref,21,'BLANK','BLANK_'+color);
  pin(ref,23,'IREF',ref+'_IREF');pin('RI_'+ref,1,'10k',ref+'_IREF');pin('RI_'+ref,2,'10k','GND');
  for(let x=0;x<16;x++) {pin(ref,x+5,'OUT'+x,`K_${color}_${p*16+x}`);pin('LED'+(p+1),(color==='R'?17:33)+x,color+x,`K_${color}_${p*16+x}`);}
}
const qp=[15,1,2,3,4,5,6,7];
for(let b=0;b<2;b++){
  const ref='ROW'+(b+1),u='ULN'+(b+1);
  pin(ref,14,'SER',b?'ROW_CASCADE':'ROW_SER');pin(ref,9,'QHprime',b?'NC_ROW_SOUT':'ROW_CASCADE');
  pin(ref,11,'SRCLK','SCLK_R');pin(ref,12,'RCLK','LAT_R');pin(ref,10,'/SRCLR','5V');pin(ref,13,'/OE','GND');pin(ref,16,'VCC','5V');pin(ref,8,'GND','GND');
  pin(u,9,'GND','GND');pin(u,10,'COM','5V');
  for(let i=0;i<8;i++){
    const y=b*8+i,q='Q'+y;
    pin(ref,qp[i],'Q'+i,'ROW_CTL_'+y);pin(u,i+1,'IN'+i,'ROW_CTL_'+y);pin(u,18-i,'OUT'+i,'GATE_LOW_'+y);
    pin('RG'+y,1,'100 ohm','GATE_LOW_'+y);pin('RG'+y,2,'100 ohm','GATE_'+y);
    pin(q,1,'AO3401A gate','GATE_'+y);pin(q,2,'AO3401A source','5V');pin(q,3,'AO3401A drain','A_ROW_'+y);
    pin('RGS'+y,1,'10k','5V');pin('RGS'+y,2,'10k','GATE_'+y);
    for(let p=1;p<=3;p++)pin('LED'+p,16-y,'A'+y,'A_ROW_'+y);
  }
}
for(const ref of ['BUF1','BUF2','R1','R2','R3','G1','G2','G3','ROW1','ROW2']){
  pin('C_'+ref,1,'100nF','5V');pin('C_'+ref,2,'100nF','GND');
}
pin('Cbulk',1,'1000uF / >=10V','5V');pin('Cbulk',2,'1000uF / >=10V','GND');
for(const s of ['BLANK_R','BLANK_G']){pin('R_'+s,1,'10k','5V');pin('R_'+s,2,'10k',s);}
pin('J_PWR',1,'regulated 5V input','5V');pin('J_PWR',2,'return','GND');pin('PICO','GND','common ground','GND');
pin('PICO','3V3_OUT','GPIO pull-up supply','3V3');
// LT-5016M1: front top row = pin16, bottom row = pin1; red17..32, green33..48.
fs.writeFileSync(path.join(dir,'connections.csv'),'reference,pin_or_terminal,function_or_value,net\n'+nets.map(row=>row.join(',')).join('\n')+'\n');
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
let svg='<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1420" viewBox="0 0 1600 1420"><style>text{font-family:Segoe UI,Meiryo,sans-serif;fill:#192c40;font-size:18px}.title{font-size:30px;font-weight:bold}.small{font-size:15px}.wire{fill:none;stroke:#2a6582;stroke-width:2} .box{fill:#f5f9fc;stroke:#36647c;stroke-width:2}</style><rect width="1600" height="1420" fill="white"/>';
function text(x,y,s,cls=''){svg+=`<text x="${x}" y="${y}" class="${cls}">${esc(s)}</text>`;}
function box(x,y,w,h,title,lines=[]){svg+=`<rect class="box" x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/>`;text(x+12,y+28,title);lines.forEach((s,i)=>text(x+12,y+54+i*24,s,'small'));}
function wire(points,label='',x=0,y=0){svg+=`<polyline class="wire" points="${points}"/>`;if(label)text(x,y,label,'small');}
text(45,48,'BLOCK ILLUMINATION / SIMULATION SCHEMATIC Rev A','title');
text(45,80,'暫定再設計：信号名ベース回路図 / 青線＝接続、同名ネット＝電気的接続');
text(45,109,'写真からの完全復元ではありません。LED実端子・MOSFET型番・配線順は未確定。','small');
box(45,145,235,185,'Pico 2 / 3.3 V GPIO',['GP2..5: R DATA/CLK/LAT/BLANK','GP6..9: G DATA/CLK/LAT/BLANK','BLANK入力: 10k → 3V3','その他入力: 10k → GND','USBからMCU給電 / 共通GND']);
box(355,145,260,185,'BUF1 / BUF2 AHCT125',['VCC(14)=5V / GND(7)=GND','/OE(1,4,10,13)=GND','A→Y: 2→3,5→6,9→8,12→11','全8信号を3.3V→5V変換','BLANK出力: 各10k → 5V']);
wire('280,220 355,220','8 signals',285,207);
box(710,145,810,185,'電源・リセット条件',['外部安定化5V → 全ドライバVCC / P-MOSソース / LED電源','全GND共通、MCU USBのVBUSとは直結しない','各ロジックICに100nF、LED電源入口に1000uF（暫定値）','起動時BLANK_R=BLANK_G=H → ゼロを64/48bit転送 → LAT各1回','点灯中は行を1本だけ選択。初期値・リセット後のラッチ値は不定。']);
text(45,373,'01 / シリアルチェーンと列カソード（LED3枚＝横48 × 縦16）','title');
for(let row=0;row<2;row++){
  const c=row?'G':'R',y=410+row*190;
  text(45,y+36,'DATA_'+c);
  for(let p=0;p<3;p++){
    const x=200+p*330;box(x,y,260,135,`${c}${p+1} / TLC5928PW`,['SIN(2) → shift[0..15] → SOUT(22)',`OUT0..15 → LED${p+1}.${c}[0..15]`,`SCLK(3) / LAT(4) / BLANK(21)`,'IREF(23) → 3.3k → GND']);
    wire(`${p?x-70:130},${y+35} ${x},${y+35}`,'',0,0);
  }
  wire(`1120,${y+35} 1190,${y+35}`);
  box(1190,y,330,135,row?'G SOUT / 未接続':'ROW1 → ROW2 / 74HC595',row?['読み戻しは本版では未使用','BLANK=Hで全カソードOFF','1bit=ON / 0bit=OFF']:['R3.SOUT → ROW1.SER(14)','ROW1.QH′(9) → ROW2.SER(14)','CLK(11)=SCLK_R / RCLK(12)=LAT_R','Q[0..15] → ULN入力']);
}
text(45,795,'02 / 行アノード駆動の反復回路（y = 0..15）','title');
box(45,830,250,165,'ROW1 / ROW2',['74HC595 各8bit','/OE(13)=GND / /CLR(10)=5V','QA..QH: 15,1,2,3,4,5,6,7','ROW1→行0..7','ROW2→行8..15']);
box(360,830,250,165,'ULN1 / ULN2',['ULN2803A / 反転ゲート駆動','IN(1..8) ← 行Q出力','OUT(18..11) → RG 100Ω','GND(9)=GND / COM(10)=5V','行Q=1 → ゲートをLowへ']);
wire('295,900 360,900','ROW_CTL[y]',297,884);
box(690,830,290,165,'Q[y] / P-MOS',['S → 5V','G ← RG 100Ω ← ULN.OUT','RGS 10k: G–S間','D → A_ROW[y]','型番・実ピン・定格は未確定']);
wire('610,900 690,900','GATE[y]',613,884);
box(1080,830,440,165,'LED1 / LED2 / LED3',['A_ROW[y] → 3枚の同じ行アノード','赤LED: A_ROW[y] → LED → K_R[x]','緑LED: A_ROW[y] → LED → K_G[x]','各カソード → 対応TLC5928.OUT → GND','A/Kは機能端子名。物理端子番号は要照合。']);
wire('980,900 1080,900','A_ROW[y]',982,884);
text(45,1040,'03 / 1行の制御タイミング（仮定：1 MHz、行周期1 ms）','title');
const stages=[['1 µs','BLANK H'],['64 µs','R: 行16+列48'],['48 µs','G: 列48'],['1 µs','setup'],['1 µs','LAT H'],['100 µs','行安定待ち'],['785 µs','BLANK L / 点灯']];
stages.forEach((s,i)=>box(45+i*215,1070,200,80,s[0],[s[1]]));
text(45,1190,'送信順：ROW15..ROW0 → R3.OUT15..0 → R2.OUT15..0 → R1.OUT15..0','small');
text(45,1220,'緑送信順：G3.OUT15..0 → G2.OUT15..0 → G1.OUT15..0。LATは各転送につき1回のみ。','small');
text(45,1250,'16行 / 62.5 Hz。LED実効Duty=785µs/16ms=4.91%。100µs待ちはLTspice仮定モデルで選定。','small');
text(45,1290,'電流仮定：I_LED=1.2×42/3.3kΩ ≈15.27mA。両色48列ON時、行ピーク≈1.47A。','small');
text(45,1320,'ULN2803AはLED行電流を供給しない。大電流はP-MOSが供給。電源・熱・Vf・遅延は本モデルの対象外。','small');
text(45,1370,'対応する全端子接続表: connections.csv / 実行モデル: model.cjs / 波形: scan.vcd','small');
svg+='</svg>';fs.writeFileSync(path.join(dir,'schematic.svg'),svg);
const model=fs.readFileSync(path.join(dir,'model.cjs'),'utf8');
const html=`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LED走査シミュレーション Rev A</title><style>body{font:16px Segoe UI,Meiryo,sans-serif;background:#101c2b;color:#edf5ff;margin:0;padding:30px}main{max-width:1280px;margin:auto}h1{font-size:28px}p{line-height:1.7;color:#bbccdd}button,select{font:inherit;padding:10px;margin:5px;border-radius:6px;border:1px solid #789;background:#243c53;color:white}canvas{width:100%;background:#05090e;border-radius:12px;margin-top:18px}#stats{padding:16px;background:#243c53;line-height:1.8}svg{width:100%;height:auto;margin-top:24px;border-radius:8px}label{display:inline-block;margin:8px}a{color:#9cddff}@media print{body{background:white;color:black}canvas,button,select,.controls{display:none}svg{width:100%}}</style><main><h1>48 × 16 / 2色LED 走査シミュレーション</h1><p>Rev A・写真に基づく暫定再設計。行/列の接続と転送順を検証する理想論理モデルです。電流・発熱・実デバイスの遅延や故障診断は再現しません。</p><div class="controls"><label>パターン <select id="pattern"><option value="bars">CPU / GPU / NPU バー</option><option value="red">全赤</option><option value="green">全緑</option><option value="yellow">赤+緑</option><option value="checker">市松</option><option value="diagonal">対角線</option><option value="off">消灯</option></select></label><label><input type="checkbox" id="integrate" checked>16行の積算表示</label><label><input type="checkbox" id="blank">BLANK強制H</label><label><input type="checkbox" id="fault">2行選択を注入</label><br><button id="play">走査を再生</button><button id="step">1行進める</button><span id="row"></span></div><canvas id="display" width="1200" height="400" aria-label="48列16行のLED走査表示"></canvas><div id="stats"></div><p>再生は観察用の低速表示です。設計値は1行1ms / 62.5Hz。積算表示では16行分を順に実行して合成します。故障注入時の2行点灯は論理的なゴーストの可視化であり、実際の電流分配は計算しません。</p><h2>信号名ベース回路図</h2>${svg}<p>詳細：同梱 README.md / 全端子接続表 connections.csv / 波形 scan.vcd</p></main><script>${model}
const $=id=>document.getElementById(id);let row=0,timer=null;const ctx=$('display').getContext('2d');
function sample(f,y){const m=new DisplayModel();m.prepare(f,y);if($('fault').checked)m.lr[48+(y+1)%16]=1;m.blank($('blank').checked);return m;}
function draw(){const f=pattern($('pattern').value),m=sample(f,row);let out=m.pixels();if($('integrate').checked){out=pattern('off');for(let y=0;y<16;y++){const p=sample(f,y).pixels();for(let yy=0;yy<16;yy++)for(let x=0;x<48;x++)out[yy][x]|=p[yy][x];}}
ctx.clearRect(0,0,1200,400);for(let y=0;y<16;y++)for(let x=0;x<48;x++){ctx.beginPath();ctx.fillStyle=['#142230','#ff4b48','#72ee70','#ffdc60'][out[y][x]];ctx.arc(x*25+12.5,y*25+12.5,8,0,Math.PI*2);ctx.fill();}
$('row').textContent='現在の行: '+row;$('stats').textContent='設計値: 1MHz / R 64bit + G 48bit / 62.5Hz / LEDピーク約15.27mA（仮定） | 行選択: '+m.rows().join(', ')+' | '+(m.rows().length>1?'FAULT: 複数行が選択されています':'行one-hot正常')+' | '+($('blank').checked?'BLANK: 全消灯':'表示有効');}
document.querySelectorAll('input,select').forEach(el=>el.onchange=draw);$('step').onclick=()=>{row=(row+1)%16;draw();};$('play').onclick=()=>{if(timer){clearInterval(timer);timer=null;$('play').textContent='走査を再生';}else{timer=setInterval(()=>{row=(row+1)%16;draw();},160);$('play').textContent='停止';}};draw();</script></html>`;
fs.writeFileSync(path.join(dir,'preview.html'),html);
console.log('Built schematic.svg, connections.csv, preview.html; '+nets.length+' pin connections');
