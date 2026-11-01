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
console.log('Built connections.csv; '+nets.length+' pin connections');
