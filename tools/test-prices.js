// tools/test-prices.js — unit test for parsePriceCents.
//
// Extracts the function from cart.js (or server/server.js) and asserts that
// real-world price strings parse to the correct number of cents.
// Run with: node tools/test-prices.js

const fs   = require('fs');
const path = require('path');

function loadParsePriceCents(file) {
    const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    // Find the start of the function definition.
    const start = src.indexOf('function parsePriceCents');
    if (start < 0) throw new Error(`Could not find parsePriceCents in ${file}`);
    // Walk forward, tracking brace depth, to find the matching close brace.
    let depth = 0;
    let i = src.indexOf('{', start);
    for (; i < src.length; i++) {
        const ch = src[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
            depth--;
            if (depth === 0) { i++; break; }
        }
    }
    if (depth !== 0) throw new Error(`Unbalanced braces in parsePriceCents of ${file}`);
    const fnSrc = src.slice(start, i);
    return new Function(`${fnSrc}; return parsePriceCents;`)();
}

const cases = [
    // [input, expected cents]
    ['€ 2,400',  240000],   // the original bug — was 240, should be 240000
    ['€ 950',     95000],
    ['€ 1,800',  180000],
    ['€ 3,200',  320000],
    ['€ 1,100',  110000],
    ['€ 1,400',  140000],
    ['€ 1.99',     199],
    ['€ 1,99',     199],
    ['$1,200.50', 120050],
    ['$1.200,50', 120050],
    ['1200',     120000],
    ['  €  950  ', 95000],
    ['',             0],
    [null,           0],
    ['-€ 2,400', -240000],
];

let pass = 0, fail = 0;
for (const file of ['cart.js', 'server/server.js']) {
    const fn = loadParsePriceCents(file);
    console.log(`\n=== ${file} ===`);
    for (const [input, expected] of cases) {
        let actual;
        try { actual = fn(input); }
        catch (e) { actual = `THROW: ${e.message}`; }
        const ok = actual === expected;
        const tag = ok ? 'OK' : 'XX';
        console.log(`  [${tag}]  ${JSON.stringify(input).padEnd(20)} -> ${actual} ${ok ? '' : `(expected ${expected})`}`);
        if (ok) pass++; else fail++;
    }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
