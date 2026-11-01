// Embed the authoritative netlist so index.html also opens over file://.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../hardware/connections.csv'), 'utf8').trim().split(/\r?\n/);
const keys = source.shift().split(',');
const rows = source.map(line => {
  const cells = line.split(',');
  assert.equal(cells.length, keys.length, 'Unexpected CSV structure');
  return Object.fromEntries(keys.map((key, i) => [key, cells[i]]));
});
assert.equal(new Set(rows.map(r => r.reference + ':' + r.physical_pin)).size, rows.length, 'Duplicate pin');
for (const channel of ['CPU', 'GPU', 'NPU']) {
  const outputPins = [1,18,17,16,15,14,13,12,11,10];
  for (let i = 0; i < 10; i++) {
    const cathode = rows.find(r => r.reference === 'LED_' + channel && +r.physical_pin === 20-i);
    const driver = rows.find(r => r.reference === 'U_' + channel && +r.physical_pin === outputPins[i]);
    assert.equal(cathode.net, driver.net, 'LED/driver mismatch');
  }
}
assert(rows.filter(r => r.reference === 'PICO').every(r => r.net !== '5V'), 'External 5V must not reach Pico');
const file = path.join(__dirname, 'index.html');
const html = fs.readFileSync(file, 'utf8');
const next = html.replace(/(<script id="connections" type="application\/json">)[\s\S]*?(<\/script>)/, (_, a, b) => a + JSON.stringify(rows) + b);
const scripts = [...next.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.equal(scripts.length, 1);
new vm.Script(scripts[0][1]);
if (process.argv.includes('--check')) assert.equal(html, next, 'Run node docs/3d/build.cjs to refresh connections');
else fs.writeFileSync(file, next);
console.log(`PASS: ${rows.length} pin connections, 30 LED mappings, Pico supply separation, JavaScript syntax`);
