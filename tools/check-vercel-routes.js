// Validates every `source` field in vercel.json by compiling it with
// path-to-regexp — the same library Vercel uses internally to parse
// routing/headers patterns. This catches issues like non-capturing groups
// before Vercel does.

const fs   = require('fs');
const path = require('path');
const { pathToRegexp } = require('path-to-regexp');

const file = path.join(__dirname, '..', 'vercel.json');
const cfg  = JSON.parse(fs.readFileSync(file, 'utf8'));

let ok = true;

function check(label, pattern) {
    try {
        pathToRegexp(pattern);
        console.log(`OK   ${label.padEnd(40)} ${pattern}`);
    } catch (e) {
        console.log(`ERR  ${label.padEnd(40)} ${pattern}  ->  ${e.message}`);
        ok = false;
    }
}

console.log('--- rewrites ---');
for (const r of (cfg.rewrites || [])) check('rewrite', r.source);

console.log('\n--- headers ---');
for (const h of (cfg.headers || [])) check('header', h.source);

process.exit(ok ? 0 : 1);
