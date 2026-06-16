// Quick JSON validator for vercel.json + sanity check the new files.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

let ok = true;
function check(label, fn) {
    try { fn(); console.log(`OK  ${label}`); }
    catch (e) { console.log(`ERR ${label}: ${e.message}`); ok = false; }
}

check('vercel.json is valid JSON', () => {
    JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
});

check('vercel.json has expected fields', () => {
    const v = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
    for (const k of ['buildCommand', 'outputDirectory', 'rewrites']) {
        if (!(k in v)) throw new Error(`missing key: ${k}`);
    }
    if (!Array.isArray(v.rewrites) || v.rewrites.length === 0) {
        throw new Error('rewrites must be a non-empty array');
    }
});

check('package.json has vercel-build script', () => {
    const p = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    if (!p.scripts['vercel-build']) throw new Error('vercel-build script missing');
});

check('package.json has engines.node', () => {
    const p = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    if (!p.engines || !p.engines.node) throw new Error('engines.node missing');
});

check('.nvmrc exists and has a number', () => {
    const v = fs.readFileSync(path.join(root, '.nvmrc'), 'utf8').trim();
    if (!/^\d+/.test(v)) throw new Error(`nvmrc value: ${JSON.stringify(v)}`);
});

check('README.md exists and is non-trivial', () => {
    const r = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
    if (r.length < 1000) throw new Error(`only ${r.length} bytes`);
    for (const h of ['## Quick start', '## Add a new project', '## Deploy to Vercel']) {
        if (!r.includes(h)) throw new Error(`missing section: ${h}`);
    }
});

check('.gitignore excludes generated files', () => {
    const g = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
    for (const needle of ['node_modules/', 'projects/manifest.json', 'projects/stock.json', 'data/', '.env']) {
        if (!g.includes(needle)) throw new Error(`missing entry: ${needle}`);
    }
});

process.exit(ok ? 0 : 1);
