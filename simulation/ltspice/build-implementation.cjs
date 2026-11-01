'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const d=__dirname;
const rows=fs.readFileSync(path.join(d,'../connections.csv'),'utf8').trim().split(/\r?\n/).slice(1).map(s=>s.split(','));
const refs=new Map();
for(const [ref,pin,label,net] of rows){if(!refs.has(ref))refs.set(ref,[]);assert.ok(!refs.get(ref).some(p=>p.pin===pin),`Duplicate ${ref}.${pin}`);refs.get(ref).push({pin,label,net});}
const net=(ref,pin)=>refs.get(ref).find(p=>p.pin===String(pin))?.net;
for(let p=1;p<=3;p++){
  assert.equal(refs.get('LED'+p).length,48);
  for(let i=0;i<16;i++){
    assert.equal(net('LED'+p,16-i),'A_ROW_'+i);
    for(const [color,offset] of [['R',17],['G',33]])assert.equal(net('LED'+p,offset+i),net(color+p,5+i));
  }
}
for(let i=0;i<16;i++){assert.equal(net('Q'+i,1),'GATE_'+i);assert.equal(net('Q'+i,2),'5V');assert.equal(net('Q'+i,3),'A_ROW_'+i);}
for(const ref of ['BUF1','BUF2'])for(const p of [1,4,10,13])assert.equal(net(ref,p),'BUF_OE_N');
for(const ref of ['R1','R2','R3','G1','G2','G3'])assert.equal(refs.get('RI_'+ref)[0].label,'10k');
const picoPins={GP2:4,GP3:5,GP4:6,GP5:7,GP6:9,GP7:10,GP8:11,GP9:12,GP10:14,GND:3,'3V3_OUT':36};
const physical=rows.map(([ref,pin,label,n])=>[ref,ref==='PICO'?picoPins[pin]:pin,label,n]);
assert.ok(physical.every(r=>r[1]!==undefined));
fs.writeFileSync(path.join(d,'assembly-connections.csv'),'reference,physical_pin,function_or_value,net\n'+physical.map(r=>r.join(',')).join('\n')+'\n');
const bom=[
 ['PICO',1,'Raspberry Pi Pico 2 H','USB powered; GP2..GP10; board pin numbers in assembly-connections.csv'],
 ['BUF1 BUF2',2,'SN74AHCT125N','PDIP-14; 5 V; all /OE to BUF_OE_N'],
 ['R1 R2 R3 G1 G2 G3',6,'TLC5928PW','TSSOP-24; use breakout boards for hand wiring'],
 ['ROW1 ROW2',2,'SN74HC595N','PDIP-16'],
 ['ULN1 ULN2',2,'ULN2803A (ST)','DIP-18; gate drive only'],
 ['Q0..Q15',16,'AO3401A','SOT-23; 1=G 2=S 3=D; SOT-23 adapter for hand wiring'],
 ['QEN',1,'2N3904 (onsemi)','TO-92; 1=E 2=B 3=C; no arbitrary substitute pinout'],
 ['LED1 LED2 LED3',3,'LT-5016M1','48 pins; front row1 at top; row anodes16..1; R17..32; G33..48'],
 ['RI_R1..RI_G3',6,'10 kohm 1% 0.125 W','Initial peak LED current 5.04 mA typical'],
 ['RG0..RG15',16,'100 ohm 1% 0.125 W','Series gate resistors'],
 ['RGS0..RGS15',16,'10 kohm 1% 0.125 W','Gate-source pull-ups'],
 ['RP0..RP7 R_BLANK_R/G RY_* ROE',17,'10 kohm 1% 0.125 W','8 GPIO bias + 2 BLANK pull-up + 6 output pull-down + 1 OE pull-up'],
 ['REN',1,'4.7 kohm 1% 0.125 W','GP10 to QEN base'],
 ['REN_PD',1,'100 kohm 1% 0.125 W','QEN base to GND'],
 ['C_BUF* C_R* C_G* C_ROW*',10,'100 nF X7R >=10 V','One adjacent to each logic IC supply'],
 ['Cbulk',1,'1000 uF >=10 V low ESR','Observe polarity; supply entry'],
 ['J_PWR',1,'2-way >=3 A keyed connector','Pin1=5 V / pin2=GND; external regulated 5 V 2 A supply'],
];
fs.writeFileSync(path.join(d,'bom.csv'),'references,quantity,part,notes\n'+bom.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n')+'\n');
// Exercise the exact buffer subcircuit used by the full simulation. Static 5 V,
// not a transistor-level validation of power ramps or arbitrary GPIO faults.
fs.writeFileSync(path.join(d,'startup.cir'),`Rev B buffer enable / USB absent / reset functional test
.param FLOOD=0 CASE=0
.step param CASE list 0 1 2 3 4
.include full_models.lib
VDD VCC 0 5
VEN EN 0 PWL(0 {if(CASE<2,0,3.3)} 500u {if(CASE<2,0,3.3)} 500.01u {if(CASE==4,0,if(CASE<2,0,3.3))})
VIN A 0 {if(CASE==1,3.3,if(CASE==2,3.3,0))}
REN EN BASE 4.7k
RPD BASE 0 100k
QEN OE BASE 0 EN_NPN
ROE VCC OE 10k
XBUF OE A BR OE A BG 0 NC3 0 OE NC4 0 OE VCC AHCT125_FUNC
RBR VCC BR 10k
RBG VCC BG 10k
.tran 0 1m 0 100n
.meas tran BLANK_R_END FIND V(BR) AT=900u
.meas tran BLANK_G_END FIND V(BG) AT=900u
.meas tran OE_END FIND V(OE) AT=900u
.end
`);
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const table=(head,data)=>'<table><thead><tr>'+head.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+data.map(r=>'<tr>'+r.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
let svg='<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1500" viewBox="0 0 1600 1500"><style>text{font-family:Segoe UI,Meiryo,sans-serif;font-size:20px;fill:#17354a}.h{font-size:28px;font-weight:bold}.w{fill:none;stroke:#246684;stroke-width:3}.box{fill:#f3f8fc;stroke:#246684;stroke-width:2}</style><rect width="1600" height="1500" fill="white"/>';
const text=(x,y,s,cl='')=>{svg+=`<text x="${x}" y="${y}" class="${cl}">${esc(s)}</text>`;};
const box=(x,y,w,h,title,lines)=>{svg+=`<rect class="box" x="${x}" y="${y}" width="${w}" height="${h}" rx="5"/>`;text(x+16,y+36,title,'h');lines.forEach((s,i)=>text(x+16,y+72+i*29,s));};
const wire=(x,y,xx,yy)=>{svg+=`<path class="w" d="M${x} ${y} L${xx} ${yy}"/>`;};
text(40,50,'BLOCK ILLUMINATION / Rev B / 2026-11-01','h');
text(40,88,'試作配線図：全端子は assembly-connections.csv / 全体回路は full_circuit.svg');
box(40,125,370,230,'Pico 2 H / USB給電',['GP2..5: 赤 DATA/CLK/LAT/BLANK','GP6..9: 緑 DATA/CLK/LAT/BLANK','GP10: RUN_EN（追加）','3V3_OUT(36): GPIO側抵抗のみ','GND(3): 外部5VのGNDと共通']);
box(485,125,470,230,'BUF1 / BUF2 : AHCT125N',['VCC14=5V / GND7=GND','/OE 1,4,10,13 = BUF_OE_N','A→Y: 2→3, 5→6, 9→8, 12→11','BLANK出力: 10kで5Vへ','他6出力: 10kでGNDへ']);wire(410,240,485,240);
box(1040,125,520,230,'5V外部電源 / 2A容量',['J_PWR.1=5V / .2=GND','Cbulk 1000uF / 各IC100nF','PicoはUSB給電、VBUSと直結しない','1色5.04mA / 最大96列=0.484A','実装時は低電流から段階的に確認']);
box(40,405,1520,175,'QENによる初期消灯（/OEの5VをGPIOへ接続しない）',[
 'GP10 → REN 4.7k → QEN.2(B) ／ QEN.1(E) → GND ／ QEN.3(C) → BUF_OE_N',
 'REN_PD 100k: B→GND ／ ROE 10k: BUF_OE_N→5V ／ 2N3904はonsemi TO-92を指定',
 'RUN_EN=0/未接続 → バッファHi-Z → BLANK=H。開始時はBLANK=Hを設定してからRUN_EN=1。']);
for(const [i,color] of ['R','G'].entries()){
 const y=625+i*180; text(40,y+65,'DATA_'+color);
 for(let p=1;p<=3;p++){const x=195+(p-1)*365;box(x,y,320,140,color+p+' / TLC5928PW',['SIN2 → SOUT22','pin5..20 → LED'+p+' '+color,'IREF23 → 10k → GND']);wire(x-50,y+60,x,y+60);}
 text(1305,y+60,color==='R'?'→ ROW1.SER14':'→ 未接続');
}
box(40,1000,410,190,'16行シフトレジスター',['R3.SOUT22→ROW1.SER14','ROW1.QH’9→ROW2.SER14','SRCLK11=SCLK_R / RCLK12=LAT_R','/CLR10=5V / /OE13=GND']);
box(515,1000,490,190,'行ドライバー ×16',['595.Q → ULN.IN1..8','ULN.OUT18..11 → 100Ω → Q.G1','Q.S2=5V / Q.D3=A_ROW[y]','10k: Q.G1→Q.S2 / AO3401A']);wire(450,1090,515,1090);
box(1070,1000,490,190,'LT-5016M1 ×3',['全3枚の同じ行を共有','上端A0=pin16 / 下端A15=pin1','赤: 左R0=17 → 右R15=32','黄緑: 左G0=33 → 右G15=48']);wire(1005,1090,1070,1090);
text(40,1250,'走査：BLANK H → R64bit/G48bit → LAT各1回 → 100us待機 → BLANK L','h');
text(40,1290,'1MHz / 1行1ms / 16行62.5Hz / 点灯785us / LEDの平均電流 約0.247mA');
text(40,1330,'LED端子図は裏面の配置。左右反転して配線しない。前面の上端Row1をA0として定義。');
text(40,1370,'LTspiceのIC/LED/MOSは仮定モデル。4nF追加ゲート容量は試験負荷で、実装部品には含めない。');
text(40,1410,'判定：試作用。実部品の波形・温度・Vf・輝度と現品ピン向きの確認後に製作確定。');
svg+='</svg>';fs.writeFileSync(path.join(d,'implementation.svg'),svg);
let html='<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>LED表示器 Rev B 試作製作資料</title><style>body{font:16px/1.65 Segoe UI,Meiryo,sans-serif;color:#17354a;max-width:1500px;margin:32px auto;padding:0 24px}h1,h2{line-height:1.3}table{border-collapse:collapse;width:100%;margin:18px 0}th,td{border:1px solid #c6d5df;padding:8px;text-align:left}th{background:#e9f2f8}svg{width:100%;height:auto}.note{background:#fff4d5;padding:16px}.part{break-inside:avoid}a{color:#075d94}@media print{body{margin:0;font-size:10pt}h2{break-before:page}thead{display:table-header-group}tr{break-inside:avoid}}</style>';
html+='<h1>LED表示器 Rev B / 試作配線図・部品表・検証記録</h1><p>入力：既存の3枚式回路と販売元配布資料。出力：実端子番号を持つ全体接続、LTspice回路、試作手順。2026-11-01。</p><p class="note">試作版です。IC等は機能・仮定モデルであり、シミュレーション合格は実部品の動作保証ではありません。現品の向き、供給電圧・電流、旧行電流、発熱を確認して製作確定してください。</p>'+svg;
html+='<h2>変更と設計条件</h2><ul><li>LT-5016M1の実端子を確定。前面Row1→A0、Column1→各パネルの列0。裏面の実装図は左右が反転します。</li><li>AO3401Aを指定。1=G、2=S、3=D。シミュレーションはメーカー提供モデルではありません。</li><li>IREF=10kΩ±1%（旧版3.3kΩから変更）。I=42×1.2/10000=5.04mA typ。1行両色96個で0.48384A、LED平均0.247mA。</li><li>GP10+2N3904でAHCT125を初期無効化。5Vが先に存在しても、Pico未接続ではBLANKがプルアップされる構成。電源立上り途中と全故障モードは未検証。</li><li>列ドライバーは全行にわたり使うため、IC損失を1/16にはできません。1ICの出力段損失は16×5.04mA×(5V−Vf−行電圧降下)×0.785。Vfをゼロとした上限概算は0.317W/IC（VCC動作電流の損失を除く）。実装基板・周囲温度で温度確認が必要。</li><li>ゲート追加4nF、配線0.1Ω、1MΩの安定化抵抗は試験モデルの条件です。実装BOMに含めません。</li></ul>';
html+='<h2>部品表（配線材・変換基板は別途）</h2>'+table(['参照','数量','部品','実装条件'],bom);
html+='<h2>Picoのヘッダー端子（上面基準）</h2>'+table(['機能','Pico信号','物理ピン','接続ネット'],rows.filter(r=>r[0]==='PICO').map(r=>[r[2],r[1],picoPins[r[1]],r[3]]));
html+='<h2>全端子接続表</h2><p>同じネット名は全て接続。NC_は未使用出力であり相互に接続しません。LEDのピン番号はLT5016_pin.pdfの裏面図と照合してください。</p>';
for(const [ref,entries] of refs){html+='<div class="part"><h3>'+esc(ref)+'</h3>'+table(['実端子','信号/値','接続ネット'],entries.map(p=>[ref==='PICO'?picoPins[p.pin]:p.pin,p.label,p.net]))+'</div>';}
html+='<h2>組立と初回通電</h2><ol><li>無通電で電源間の短絡、コンデンサー極性、IC上面の1番ピン、MOSとNPNの型番・ピン順を確認。TSSOP/SOT-23は変換基板を使えます。LEDの4mmピッチは一般的な2.54mmソケットに直接合いません。</li><li>USBを外し、電流制限した5Vでロジックだけを通電。BUF_OE_NとBLANK_R/GがH、全消灯になることを確認。LED負荷なしから開始してください。</li><li>PicoのGPIOは最初にRUN_EN=0、BLANK_R/G=H、DATA/SCLK/LAT=Lへ設定。次にRUN_EN=1とし、赤64bit・緑48bitのゼロを送ってLATを各1回だけ立上げ、全ラッチを初期化。</li><li>BLANKをHに保って単一行・単一点を転送し、LAT後100us待機してBLANKをL。赤・黄緑の各列と行を1つずつ確認し、極性・左右・上下を照合。</li><li>100us待機で前行の電流が残らないことをオシロで確認。旧行電流1mA未満は今回の設計基準。待機時間は実測で調整できる実装にする。</li><li>全点灯は必ず16行を走査した状態で確認。5V端子が4.5V以上、行電流が概ね0.484A以下、IC温度が安定し仕様内であることを確認。電源の全電流にはロジック電流も含まれます。</li><li>停止時はBLANK=H→RUN_EN=0。走査中断・リセット・USB抜去時も確認。ソフト停止時にGP10がHのまま残る故障はハードウェア監視回路を別途設けない限り保証しません。</li></ol>';
html+='<h2>LTspice検証結果</h2><p>数字は同梱ログから抽出。未生成の結果を合格とは表示しません。full_loadは全96列のシンクを強制ONし、行選択は通常のシリアル走査を使う負荷試験です。</p>';
for(const file of ['full-results.json','full-load-results.json','results.json','startup-results.json']){
 const f=path.join(d,file);html+='<h3>'+file+'</h3>';html+=fs.existsSync(f)?'<pre>'+esc(JSON.stringify(JSON.parse(fs.readFileSync(f,'utf8')),null,2))+'</pre>':'<p>未実行</p>';
}
html+='<h2>再現手順と資料</h2><pre>node simulation/build.cjs\nnode simulation/test.cjs\nnode simulation/ltspice/build-full.cjs\nnode simulation/ltspice/build.cjs\nnode simulation/ltspice/build-implementation.cjs\n\nLTspiceで full_circuit.asc / full_load.cir / row_handoff.asc / startup.cir を開いてRun\nnode simulation/ltspice/verify-full.cjs\nnode simulation/ltspice/verify-full.cjs --full-load\nnode simulation/ltspice/verify.cjs\nnode simulation/ltspice/verify-startup.cjs\nnode simulation/ltspice/build-implementation.cjs</pre><p>LTspiceのバッチ実行がログを更新しない環境ではGUIから実行してください。古いログを新規実行結果と扱わないでください。</p><ul>';
for(const u of ['https://akizukidenshi.com/goodsaffix/LT5016_pin.pdf','https://akizukidenshi.com/goodsaffix/LT5003D_LT5016M1.pdf','https://www.ti.com/lit/ds/symlink/tlc5928.pdf','https://www.ti.com/lit/ds/symlink/sn74ahct125.pdf','https://www.ti.com/lit/ds/symlink/sn74hc595.pdf','https://www.st.com/resource/en/datasheet/uln2803a.pdf','https://www.aosmd.com/pdfs/datasheet/AO3401A.pdf','https://www.onsemi.com/pdf/datasheet/2n3903-d.pdf','https://datasheets.raspberrypi.com/pico/pico-2-datasheet.pdf'])html+='<li><a href="'+u+'">'+u+'</a></li>';
html+='</ul></html>';fs.writeFileSync(path.join(d,'implementation.html'),html);
console.log('PASS physical pin uniqueness, all 144 LED pins, all 16 MOS pinouts, default-disabled buffers and IREF values; built assembly documents.');
