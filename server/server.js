/**
 * server/server.js — small Express + SQLite + Stripe backend.
 *
 * Responsibilities:
 *   - serve the static site from the project root
 *   - expose a small JSON API for projects, stock, and checkout
 *   - on Stripe checkout.session.completed, decrement stock atomically
 *
 * Run:  npm start
 * Env:  STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (optional but recommended),
 *       ADMIN_TOKEN (for /api/admin/restock), PORT (default 3000)
 */

require('dotenv').config();

const fs     = require('fs');
const path   = require('path');
const express = require('express');

const db    = require('./db');
const stripeMod = require('./stripe');

const ROOT     = path.resolve(__dirname, '..');
const PROJECTS = path.join(ROOT, 'projects');
const PORT     = Number(process.env.PORT) || 3000;

// ----- helpers -----

function readJSON(p) {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return null; }
}

function listProjectsFromDisk() {
    if (!fs.existsSync(PROJECTS)) return [];
    return fs.readdirSync(PROJECTS, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
}

function projectPayload(slug) {
    const meta = readJSON(path.join(PROJECTS, slug, 'project.json'));
    if (!meta) return null;
    // Try to find the cover.
    for (const ext of ['jpg', 'png', 'webp']) {
        const p = path.join(PROJECTS, slug, `cover.${ext}`);
        if (fs.existsSync(p)) {
            meta.cover = `projects/${slug}/cover.${ext}`;
            break;
        }
    }
    meta.slug = slug;
    meta.stock = db.getStock(slug); // override project.json stock with live DB value
    return meta;
}

/**
 * Parse a price string like "€ 2,400", "€ 950", "€ 1.99", "$1,200.50",
 * "$1.200,50" into integer cents.
 *
 * Heuristic: if a separator has exactly 1 or 2 digits after it, it's the
 * decimal separator; otherwise it's a thousands separator and the number
 * is a whole amount. If both . and , are present, the rightmost one is
 * the decimal separator.
 */
function parsePriceCents(priceStr) {
    if (priceStr == null) return 0;
    let s = String(priceStr).trim();
    const neg = s.startsWith('-');
    s = s.replace(/^-/, '').replace(/[^\d.,]/g, '');
    if (!s) return 0;

    const lastDot = s.lastIndexOf('.');
    const lastCom = s.lastIndexOf(',');
    const hasDot = lastDot !== -1;
    const hasCom = lastCom !== -1;

    let decIdx = -1;
    if (hasDot && hasCom) {
        decIdx = Math.max(lastDot, lastCom);
    } else if (hasDot && !hasCom) {
        const tail = s.length - lastDot - 1;
        const dotCount = (s.match(/\./g) || []).length;
        if ((tail === 1 || tail === 2) && dotCount === 1) decIdx = lastDot;
    } else if (!hasDot && hasCom) {
        const tail = s.length - lastCom - 1;
        const comCount = (s.match(/,/g) || []).length;
        if ((tail === 1 || tail === 2) && comCount === 1) decIdx = lastCom;
    }

    let intPart, fracPart = '';
    if (decIdx === -1) {
        intPart = s;
    } else {
        intPart  = s.slice(0, decIdx);
        fracPart = s.slice(decIdx + 1);
    }
    intPart  = intPart.replace(/[.,]/g, '');
    fracPart = fracPart.replace(/[.,]/g, '').slice(0, 2).padEnd(2, '0');

    const cents = ((parseInt(intPart, 10) || 0) * 100) + (parseInt(fracPart, 10) || 0);
    return neg ? -cents : cents;
}

// ----- app -----

const app = express();

app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
});

// Stripe webhook needs the raw body. Register BEFORE express.json().
app.post('/api/stripe-webhook',
    express.raw({ type: 'application/json' }),
    (req, res) => {
        const sig = req.headers['stripe-signature'];
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        let event;

        try {
            if (secret) {
                const stripe = stripeMod.getStripe();
                event = stripe.webhooks.constructEvent(req.body, sig, secret);
            } else {
                // No secret configured — accept the event as-is (dev only).
                event = JSON.parse(req.body.toString('utf8'));
                console.warn('STRIPE_WEBHOOK_SECRET not set — accepting webhook without signature verification.');
            }
        } catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        try {
            if (event.type === 'checkout.session.completed') {
                const session = event.data.object;
                const items = JSON.parse(session.metadata?.items || '[]');
                if (!items.length) {
                    console.warn(`Session ${session.id} has no items in metadata.`);
                } else {
                    const allOk = items.every(it => db.decrementStock(it.slug, it.qty));
                    db.recordOrder(session.id, allOk ? 'paid' : 'partial', { items });
                    if (!allOk) {
                        console.error(`Stock decrement failed for session ${session.id} — check overselling.`);
                    } else {
                        console.log(`Stock decremented for session ${session.id}:`, items);
                    }
                }
            } else if (event.type === 'checkout.session.expired') {
                const session = event.data.object;
                db.recordOrder(session.id, 'expired', {});
            }
            res.json({ received: true });
        } catch (err) {
            console.error('Webhook handler error:', err);
            res.status(500).send('Internal error');
        }
    }
);

// JSON for everything else.
app.use(express.json({ limit: '256kb' }));

// ----- API -----

app.get('/api/projects', (req, res) => {
    const slugs = JSON.parse(
        fs.readFileSync(path.join(PROJECTS, 'manifest.json'), 'utf8')
    );
    const projects = slugs
        .map(projectPayload)
        .filter(Boolean);
    res.json({ projects });
});

app.get('/api/projects/:slug', (req, res) => {
    const p = projectPayload(req.params.slug);
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json(p);
});

app.get('/api/projects/:slug/stock', (req, res) => {
    res.json({ slug: req.params.slug, stock: db.getStock(req.params.slug) });
});

app.get('/api/stock', (req, res) => {
    res.json(db.getAllStock());
});

// --- Checkout ---

app.post('/api/checkout', async (req, res) => {
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return res.status(400).json({ error: 'Cart is empty' });

    // Re-fetch live project data so prices/stock cannot be tampered with on the client.
    const lineItems = [];
    for (const it of items) {
        const slug = it.slug;
        const qty  = Math.max(1, parseInt(it.qty, 10) || 1);
        const proj = projectPayload(slug);
        if (!proj) return res.status(400).json({ error: `Unknown project: ${slug}` });
        if (proj.status === 'sold' || proj.status === 'enquire') {
            return res.status(400).json({ error: `${proj.title} is not available for purchase` });
        }
        if (db.getStock(slug) < qty) {
            return res.status(409).json({ error: `Not enough stock for ${proj.title}` });
        }
        const priceCents = parsePriceCents(proj.price);
        if (priceCents <= 0) {
            return res.status(400).json({ error: `Invalid price for ${proj.title}` });
        }
        const base = `${req.protocol}://${req.get('host')}`;
        const image = proj.cover && proj.cover.startsWith('http')
            ? proj.cover
            : (proj.cover ? `${base}/${proj.cover}` : undefined);
        lineItems.push({
            slug,
            qty,
            title: proj.title,
            description: [proj.medium, proj.dimensions, proj.year].filter(Boolean).join(' · '),
            priceCents,
            image,
        });
    }

    if (!stripeMod.isConfigured()) {
        return res.status(503).json({
            error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in .env to enable checkout.',
        });
    }

    const base = `${req.protocol}://${req.get('host')}`;
    try {
        const session = await stripeMod.createCheckoutSession({
            items: lineItems,
            successUrl: `${base}/index.html?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl:  `${base}/index.html?checkout=cancel`,
        });
        db.recordOrder(session.id, 'created', { items: lineItems });
        res.json({ url: session.url, sessionId: session.id });
    } catch (err) {
        console.error('Checkout error:', err);
        res.status(500).json({ error: 'Could not create checkout session' });
    }
});

// --- Admin (restock) ---

app.post('/api/admin/restock', (req, res) => {
    const token = process.env.ADMIN_TOKEN;
    if (!token) return res.status(403).json({ error: 'Admin endpoint disabled (no ADMIN_TOKEN set)' });
    if (req.headers['x-admin-token'] !== token) return res.status(401).json({ error: 'Unauthorized' });
    const { slug, stock } = req.body || {};
    if (!slug || !Number.isInteger(stock)) return res.status(400).json({ error: 'slug and integer stock required' });
    db.setStock(slug, stock);
    res.json({ slug, stock: db.getStock(slug) });
});

app.get('/api/admin/orders', (req, res) => {
    const token = process.env.ADMIN_TOKEN;
    if (!token) return res.status(403).json({ error: 'Admin endpoint disabled (no ADMIN_TOKEN set)' });
    if (req.headers['x-admin-token'] !== token) return res.status(401).json({ error: 'Unauthorized' });
    res.json(stripeMod.isConfigured() ? 'ok' : 'stripe-not-configured');
});

// ----- static files -----

app.use(express.static(ROOT, { extensions: ['html'] }));

// ----- boot -----

db.seedFromProjects();

app.listen(PORT, () => {
    console.log(`Portfolio server listening on http://localhost:${PORT}`);
    console.log(`Stripe: ${stripeMod.isConfigured() ? 'configured' : 'NOT configured (set STRIPE_SECRET_KEY)'}`);
});
