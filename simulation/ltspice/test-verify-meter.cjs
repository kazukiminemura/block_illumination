'use strict';
// Verifier regression fixtures only: these tests do not run LTspice.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const source=__dirname,root=fs.mkdtempSync(path.join(os.tmpdir(),'meter-verifier-'));
const hash=text=>crypto.createHash('sha256').update(text.replace(/\r\n/g,'\n')).digest('hex');
let checks=0;
function fixture(){
 const d=fs.mkdtempSync(path.join(root,'case-'));
 const saved=JSON.parse(fs.readFileSync(path.join(source,'meter-results.json'),'utf8'));
 for(const n of [...Object.keys(saved.sha256),'verify-meter.cjs'])fs.copyFileSync(path.join(source,n),path.join(d,n));
 // Explicit synthetic evidence, never a replacement for the historical report.
 saved.hashFormat='utf8-lf';
 for(const n of Object.keys(saved.sha256))saved.sha256[n]=hash(fs.readFileSync(path.join(d,n),'utf8'));
 const netlist=saved.actualNetlist.map(r=>r.join(' ')).join('\n')+'\n';
 saved.netlistSha256=hash(netlist);
 fs.writeFileSync(path.join(d,'meter-results.json'),JSON.stringify(saved));
 fs.writeFileSync(path.join(d,'level_meter.net'),netlist,'latin1');
 const epoch=Date.now()/1000-100;
 for(const n of fs.readdirSync(d))fs.utimesSync(path.join(d,n),epoch,epoch);
 for(const [n,delta]of [['level_meter.net',1],['level_meter.log',2],['levels.log',2]])fs.utimesSync(path.join(d,n),epoch+delta,epoch+delta);
 return d;
}
function run(d,args=[],ok=true,pattern){
 const report=path.join(d,'meter-results.json'),before=fs.readFileSync(report);
 const r=spawnSync(process.execPath,[path.join(d,'verify-meter.cjs'),...args],{encoding:'utf8'});
 assert.equal(r.status===0,ok,r.stdout+r.stderr);
 if(pattern)assert.match(r.stdout+r.stderr,pattern);
 if(!ok||!args.includes('--record-run'))assert.deepEqual(fs.readFileSync(report),before,'Verifier must not overwrite evidence');
 checks++;
}
try{
 let d=fixture();run(d);fs.unlinkSync(path.join(d,'level_meter.net'));run(d);
 d=fixture();fs.appendFileSync(path.join(d,'meter_models.lib'),'\n* changed input\n');run(d,[],false,/Saved evidence is stale/);
 d=fixture();fs.appendFileSync(path.join(d,'level_meter.log'),'\nchanged log\n');run(d,[],false,/Saved evidence is stale/);
 for(const extra of ['RSHORT 5V 0 1m\n','rshort 5V 0 1m\n',' RSHORT 5V 0 1m\n','.param changed=1\n']){
  d=fixture();fs.appendFileSync(path.join(d,'level_meter.net'),extra);run(d,[],false,/Netlist differs/);
 }
 // A successful explicit refresh is allowed only after freshness and acceptance checks.
 d=fixture();run(d,['--record-run']);run(d);
 d=fixture();fs.appendFileSync(path.join(d,'meter_models.lib'),'\n* changed after logs\n');run(d,['--record-run'],false,/Stale level_meter.log/);
 for(const extra of ['RSHORT 5V 0 1m\n','rshort 5V 0 1m\n',' RSHORT 5V 0 1m\n']){
  d=fixture();fs.appendFileSync(path.join(d,'level_meter.net'),extra);
  const future=Date.now()/1000+10;fs.utimesSync(path.join(d,'level_meter.log'),future,future);run(d,['--record-run'],false,/Unexpected ASC netlist component count/);
 }
 d=fixture();const log=path.join(d,'level_meter.log');fs.writeFileSync(log,fs.readFileSync(log,'utf8').replace(/(Measurement: cpu_count[\s\S]*?\n\s*1\s+)3/, '$10'));
 run(d,['--record-run'],false,/Measurement acceptance failed/);
 d=fixture();fs.unlinkSync(path.join(d,'level_meter.net'));run(d,['--record-run'],false,/requires a fresh/);
 // CRLF-only changes preserve text and are safe for normalized snapshots.
 d=fixture();const asc=path.join(d,'level_meter.asc');fs.writeFileSync(asc,fs.readFileSync(asc,'utf8').replace(/\r\n/g,'\n').replace(/\n/g,'\r\n'));run(d);
 d=fixture();const legacyFile=path.join(d,'meter-results.json');const legacy=JSON.parse(fs.readFileSync(legacyFile,'utf8'));delete legacy.netlistSha256;fs.writeFileSync(legacyFile,JSON.stringify(legacy));run(d,[],false,/Legacy snapshot/);fs.unlinkSync(path.join(d,'level_meter.net'));run(d);
 for(const [name,from,to,pattern]of [['levels.log','.step level=1 corner=-1','.step level=0 corner=-1',/Incomplete level\/corner sweep/],['level_meter.log','.step cfval=6.8e-06','.step cfval=2.2e-06',/Incomplete PWM sweep/]]){
  d=fixture();const file=path.join(d,name),text=fs.readFileSync(file,'utf8');assert.ok(text.includes(from));fs.writeFileSync(file,text.replace(from,to));run(d,['--record-run'],false,pattern);
 }
 console.log(`PASS: ${checks} verifier regression scenarios (synthetic fixtures, no LTspice execution)`);
}finally{fs.rmSync(root,{recursive:true,force:true});}
