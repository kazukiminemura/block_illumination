'use strict';
const fs=require('node:fs'),path=require('node:path');
const out=__dirname;
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
let s=`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1360" viewBox="0 0 1800 1360">
<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#227582"/></marker></defs>
<style>text{font-family:'Yu Gothic','Meiryo','Segoe UI',sans-serif;fill:#193947;font-size:23px}.title{font-size:40px;font-weight:700}.sub{font-size:24px;fill:#57717c}.h{font-size:27px;font-weight:700}.small{font-size:20px}.tiny{font-size:18px;fill:#57717c}.wire{stroke:#227582;stroke-width:3;fill:none;marker-end:url(#arrow)}.dashed{stroke-dasharray:8 6}.card{fill:#fff;stroke:#ccdae0;stroke-width:2}</style>
<rect width="1800" height="1360" fill="#f3f7f8"/>`;
const text=(x,y,t,c='')=>{s+=`<text x="${x}" y="${y}" class="${c}">${esc(t)}</text>`;};
const rect=(x,y,w,h,fill='#fff',stroke='#ccdae0',r=16)=>{s+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;};
const wire=(d,dashed=false)=>{s+=`<path d="${d}" class="wire${dashed?' dashed':''}"/>`;};
text(64,76,'CPU・GPU・NPU 使用率メーター','title');
text(64,119,'Pico 2 H ＋ XD3914 ＋ OSX10201-GYR1 ｜ Rev C 概要','sub');
rect(1410,44,326,55,'#e6f0ed','#b4d1c7',27);text(1434,80,'Rev C・近似モデル検証済み','small');

rect(64,165,490,205);text(90,210,'① PC：数値を取得する','h');
text(90,254,'CPU / GPU / NPU の使用率');
text(90,294,'取得プログラム → USBで送信');
text(90,334,'PC側の取得・送信は今後実装','small');
wire('M 554 264 H 683');text(568,241,'USB','small');
rect(690,165,510,205,'#e7f3ee','#99bfae');text(716,210,'② Raspberry Pi Pico 2 H','h');
text(716,254,'受信した数値をPWMの比率へ変換');
text(716,294,'GP0 / GP2 / GP4 を独立に出力');
text(716,334,'USB給電・GPIO信号は3.3V系','small');
rect(1265,165,471,205,'#eaf2f8','#afc7d8');text(1291,210,'PWMとは？','h');
text(1291,254,'高速なON / OFF信号');
text(1291,294,'ONの時間割合で値を表す');
text(1291,334,'次のRC回路で滑らかな電圧にする','small');

text(64,424,'③ 数値を「電圧」に変え、10段階のバー表示へ','h');
text(64,462,'各行は同じ回路を1セットずつ使用します。矢印は信号・制御の流れです。','small');
// Three independent channels. PWM pins and filter/component values are deliberately unassigned.
for(const [i,name] of ['CPU','GPU','NPU'].entries()){
 const y=500+i*168;
 rect(64,y,1672,148,'#fff','#d5e0e4');
 rect(82,y+18,170,112,['#e4f0f1','#e9edf8','#f0eafa'][i],'none');
 text(111,y+60,name,'h');text(104,y+98,'専用PWM','small');
 wire(`M 252 ${y+74} H 340`);
 rect(347,y+18,360,112,'#f6f9fb','#c8d8df');text(369,y+54,'RC平滑回路','h');
 text(369,y+85,'4.7kΩ ＋ 4.7µF','small');text(369,y+112,'PWM → アナログ電圧','small');
 wire(`M 707 ${y+74} H 824`);text(726,y+52,'電圧','small');
 rect(831,y+18,355,112,'#eaf4ef','#b7d2c3');text(855,y+54,'XD3914','h');
 text(855,y+85,'入力電圧を10段階で判定','small');text(855,y+112,'点灯本数とLED電流を制御','small');
 wire(`M 1186 ${y+74} H 1303`);text(1201,y+52,'点灯制御','small');
 text(1324,y+44,'OSX10201-GYR1','h');
 for(let j=0;j<10;j++){const colors=['#63a86a','#e4ba43','#d96955'];rect(1324+j*34,y+63,26,35,colors[j<5?0:j<8?1:2],'none',3);}
 text(1324,y+126,'黄緑5 ＋ 黄3 ＋ 赤2','small');
}
// A labeled signal bus avoids suggesting that one PWM output is shared.
wire('M 945 370 V 397 H 50 V 574 H 81',true);
wire('M 50 574 V 742 H 81',true);wire('M 50 742 V 910 H 81',true);

rect(64,1033,1672,118,'#fff5e3','#e0c797');
text(90,1073,'④ 電源とGND（共通の基準）','h');
text(90,1113,'Pico：USB給電 ／ XD3914・LED：外部安定化5V ／ 全回路のGNDを共通にする');
text(90,1140,'LEDの＋側へ電源を供給し、−側をXD3914が駆動。外部5VをUSBのVBUSへ直結しない。','small');
rect(64,1178,1672,136,'#eaf0f3','#c5d4dc');
text(90,1218,'試作時に確認すること','h');
text(90,1253,'各ICの基準電圧を校正 ／ 実機の電流・発熱・明るさ ／ USB通信','small');
text(90,1288,'部品数：Pico 2 H ×1、XD3914 ×3、バーLED ×3。端子配線図ではなく、構成を理解するための図です。','small');
text(64,1343,'2026-11-01 ｜ LTspiceは動作近似モデル。実機検証とPC側使用率取得は未実施です。','tiny');
s+='</svg>';
fs.writeFileSync(path.join(out,'overview.svg'),s);
console.log('Built docs/overview.svg');
