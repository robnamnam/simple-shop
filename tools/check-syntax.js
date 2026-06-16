// Tools/quick syntax check.
const fs = require('fs');
const path = require('path');
const files = ['script.js', 'cart.js'];
let ok = true;
for (const f of files) {
    const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    try {
        new Function(src);
        console.log(`${f}: OK`);
    } catch (e) {
        console.log(`${f}: ${e.message}`);
        ok = false;
    }
}
process.exit(ok ? 0 : 1);
