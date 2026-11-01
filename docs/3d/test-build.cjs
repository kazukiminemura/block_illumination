'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'block-3d-check-'));
try {
  const dir = path.join(root, 'docs/3d');
  fs.mkdirSync(dir, {recursive: true});
  fs.mkdirSync(path.join(root, 'hardware'));
  for (const name of ['build.cjs', 'index.html']) fs.copyFileSync(path.join(__dirname, name), path.join(dir, name));
  fs.copyFileSync(path.join(__dirname, '../../hardware/connections.csv'), path.join(root, 'hardware/connections.csv'));
  const file = path.join(dir, 'index.html');
  const original = fs.readFileSync(file, 'utf8');
  const embedded = /<script id="connections" type="application\/json">[\s\S]*?<\/script>/;
  const block = original.match(embedded)[0];
  const run = (...args) => spawnSync(process.execPath, [path.join(dir, 'build.cjs'), ...args], {encoding: 'utf8'});
  assert.equal(run('--check').status, 0);
  for (const replacement of ['', block + block]) {
    fs.writeFileSync(file, original.replace(embedded, replacement));
    for (const args of [[], ['--check']]) {
      const before = fs.readFileSync(file, 'utf8');
      const result = run(...args);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /exactly one embedded connections script/);
      assert.equal(fs.readFileSync(file, 'utf8'), before, 'Failed build must not overwrite HTML');
    }
  }
  fs.writeFileSync(file, original.replace(embedded, '<script id="connections" type="application/json">[]</script>'));
  assert.notEqual(run('--check').status, 0, 'Stale data must fail check');
  assert.equal(run().status, 0, 'Build must refresh stale data');
  assert.equal(fs.readFileSync(file, 'utf8'), original);
  assert.equal(run('--check').status, 0);
  console.log('PASS: missing, duplicate and stale embedded netlists');
} finally {
  fs.rmSync(root, {recursive: true, force: true});
}
