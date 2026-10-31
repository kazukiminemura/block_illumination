'use strict';
// Functional model only: no propagation delay, parasitics, analog or thermal model.
class DisplayModel {
  constructor() {
    this.r = Array(64).fill(0); this.g = Array(48).fill(0);
    // Deliberately unknown power-up latches; BLANK must protect startup.
    this.lr = Array(64).fill(1); this.lg = Array(48).fill(1);
    this.br = this.bg = 1;
  }
  clock(bus, bit) { const q = this[bus]; q.pop(); q.unshift(Number(Boolean(bit))); }
  latch(bus) {
    const q = this[bus]; this['l' + bus] = q.slice();
    // TLC5928 LAT replaces its shift register with diagnostic data.
    // ponytail: fixed zero diagnostic data; implement SID only if error readback is needed.
    q.fill(0, 0, 48);
  }
  blank(value) { this.br = this.bg = Number(Boolean(value)); }
  load(bus, bits) { for (let i = bits.length - 1; i >= 0; --i) this.clock(bus, bits[i]); }
  rows() { return this.lr.slice(48).flatMap((v, i) => v ? [i] : []); }
  pixels() {
    const out = Array.from({length:16}, () => Array(48).fill(0));
    for (const y of this.rows()) for (let x=0;x<48;x++)
      out[y][x] = ((!this.br && this.lr[x]) ? 1 : 0) | ((!this.bg && this.lg[x]) ? 2 : 0);
    return out;
  }
  prepare(frame, y) {
    if (!Number.isInteger(y) || y<0 || y>15 || frame.length!==16 ||
        frame.some(row => row.length!==48 || row.some(v => !Number.isInteger(v) || v<0 || v>3)))
      throw new Error('Expected a 16 x 48 frame of color codes 0..3 and row 0..15');
    this.blank(1);
    this.load('r', [...frame[y].map(v=>v&1), ...Array.from({length:16},(_,i)=>Number(i===y))]);
    this.load('g', frame[y].map(v=>(v>>1)&1));
    this.latch('r'); this.latch('g');
    // Caller waits for row-switch settling before blank(0).
  }
}
function pattern(name) {
  return Array.from({length:16}, (_,y)=>Array.from({length:48},(_,x)=> {
    if(name==='off') return 0;
    if(name==='red') return 1;
    if(name==='green') return 2;
    if(name==='yellow') return 3;
    if(name==='checker') return (x+y)%2 ? 1 : 2;
    if(name==='diagonal') return x%16===y ? 3 : 0;
    return y>=12-(x/16|0)*3 ? (x<16?1:x<32?2:3) : 0;
  }));
}
if(typeof module!=='undefined') module.exports = {DisplayModel, pattern};
