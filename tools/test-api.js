// Quick smoke test for the API. Run with: node tools/test-api.js
const http = require('http');

function req(method, path, body) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;
        const opts = {
            method,
            hostname: 'localhost',
            port: 3000,
            path,
            headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
        };
        const r = http.request(opts, (res) => {
            let chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
        });
        r.on('error', reject);
        if (data) r.write(data);
        r.end();
    });
}

(async () => {
    console.log('--- GET /api/stock ---');
    let r = await req('GET', '/api/stock');
    console.log(r.status, r.body);

    console.log('\n--- GET /api/projects (count) ---');
    r = await req('GET', '/api/projects');
    const obj = JSON.parse(r.body);
    console.log(r.status, 'projects:', obj.projects.length, '— first slug:', obj.projects[0].slug, 'stock:', obj.projects[0].stock);

    console.log('\n--- POST /api/checkout (empty cart) ---');
    r = await req('POST', '/api/checkout', { items: [] });
    console.log(r.status, r.body);

    console.log('\n--- POST /api/checkout (no Stripe key) ---');
    r = await req('POST', '/api/checkout', { items: [{ slug: 'tidal-memory', qty: 1 }] });
    console.log(r.status, r.body);

    console.log('\n--- POST /api/checkout (sold-out item) ---');
    r = await req('POST', '/api/checkout', { items: [{ slug: 'fragmented-light', qty: 1 }] });
    console.log(r.status, r.body);

    console.log('\n--- POST /api/checkout (overstock) ---');
    r = await req('POST', '/api/checkout', { items: [{ slug: 'urban-silence', qty: 99 }] });
    console.log(r.status, r.body);
})();
