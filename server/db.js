/**
 * server/db.js — SQLite helpers for stock and orders.
 *
 * Schema (created on first run):
 *   stock(slug TEXT PRIMARY KEY, qty INTEGER NOT NULL)
 *   orders(session_id TEXT PRIMARY KEY, status TEXT, payload TEXT, created_at INTEGER)
 *
 * Seed behaviour: on first run, `seedFromProjects()` walks projects/<slug>/project.json
 * and inserts the `stock` field for each one. If a project.json has no `stock` field,
 * it defaults to 0.
 */

const fs   = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT      = path.resolve(__dirname, '..');
const DB_PATH   = path.join(ROOT, 'data', 'store.db');
const PROJECTS  = path.join(ROOT, 'projects');

let _db = null;

function db() {
    if (_db) return _db;
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.exec(`
        CREATE TABLE IF NOT EXISTS stock (
            slug TEXT PRIMARY KEY,
            qty  INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS orders (
            session_id TEXT PRIMARY KEY,
            status     TEXT NOT NULL,
            payload    TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );
    `);
    return _db;
}

function listProjectFolders() {
    if (!fs.existsSync(PROJECTS)) return [];
    return fs.readdirSync(PROJECTS, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
}

function readProjectMeta(slug) {
    const p = path.join(PROJECTS, slug, 'project.json');
    if (!fs.existsSync(p)) return null;
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function seedFromProjects() {
    const d = db();
    const insert = d.prepare('INSERT OR IGNORE INTO stock (slug, qty) VALUES (?, ?)');
    const update = d.prepare('UPDATE stock SET qty = ? WHERE slug = ?');
    const get    = d.prepare('SELECT qty FROM stock WHERE slug = ?');

    const tx = d.transaction(() => {
        for (const slug of listProjectFolders()) {
            const meta = readProjectMeta(slug);
            if (!meta) continue;
            const stock = Number.isInteger(meta.stock) ? meta.stock : 0;
            const existing = get.get(slug);
            if (!existing) insert.run(slug, stock);
            // Note: we do NOT overwrite existing rows on seed — that would clobber
            // sales-driven decrements. Use /api/admin/restock to change stock.
        }
    });
    tx();
}

function getStock(slug) {
    const row = db().prepare('SELECT qty FROM stock WHERE slug = ?').get(slug);
    return row ? row.qty : 0;
}

function getAllStock() {
    const rows = db().prepare('SELECT slug, qty FROM stock').all();
    const map = {};
    for (const r of rows) map[r.slug] = r.qty;
    return map;
}

function setStock(slug, qty) {
    db().prepare(`
        INSERT INTO stock (slug, qty) VALUES (?, ?)
        ON CONFLICT(slug) DO UPDATE SET qty = excluded.qty
    `).run(slug, qty);
}

function decrementStock(slug, qty) {
    const result = db().prepare(`
        UPDATE stock SET qty = qty - ?
         WHERE slug = ? AND qty >= ?
    `).run(qty, slug, qty);
    return result.changes === 1;
}

function recordOrder(sessionId, status, payload) {
    db().prepare(`
        INSERT INTO orders (session_id, status, payload, created_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
            status = excluded.status,
            payload = excluded.payload
    `).run(sessionId, status, JSON.stringify(payload), Date.now());
}

function getOrder(sessionId) {
    return db().prepare('SELECT * FROM orders WHERE session_id = ?').get(sessionId);
}

module.exports = {
    db,
    seedFromProjects,
    getStock,
    getAllStock,
    setStock,
    decrementStock,
    recordOrder,
    getOrder,
};
