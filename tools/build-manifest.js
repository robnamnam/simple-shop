#!/usr/bin/env node
/**
 * build-manifest.js
 *
 * Scans ./projects/ for subdirectories, each treated as a single project.
 * For each project folder, expects:
 *   - project.json   (required)   project metadata
 *   - cover.{jpg,png,webp}        (required)   shown in the gallery grid
 *   - images/                     (required)   overlay gallery images
 *       - manifest.json (optional) ordered list of URLs or filenames;
 *                                  if absent, files in images/ are listed
 *                                  alphabetically (local files only).
 *
 * Writes:
 *   ./projects/manifest.json   JSON array of project slugs in display order
 *   ./projects/stock.json      { "<slug>": <stock>, ... } — used by the static
 *                              frontend to render "Sold Out" badges before
 *                              the API call lands.
 *
 * Usage:  node tools/build-manifest.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT          = path.resolve(__dirname, '..');
const PROJECTS_DIR  = path.join(ROOT, 'projects');
const MANIFEST_PATH = path.join(PROJECTS_DIR, 'manifest.json');
const STOCK_PATH    = path.join(PROJECTS_DIR, 'stock.json');
const IMAGE_EXTS    = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

function readJSON(p) {
    try {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {
        return null;
    }
}

function findCoverFile(slug) {
    for (const ext of IMAGE_EXTS) {
        const candidate = path.join(PROJECTS_DIR, slug, 'cover' + ext);
        if (fs.existsSync(candidate)) return 'cover' + ext;
    }
    return null;
}

function listImagesDir(slug) {
    const dir = path.join(PROJECTS_DIR, slug, 'images');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(f => IMAGE_EXTS.includes(path.extname(f).toLowerCase()))
        .sort();
}

function buildImagesManifest(slug) {
    const dir = path.join(PROJECTS_DIR, slug, 'images');
    if (!fs.existsSync(dir)) return;

    const existing = path.join(dir, 'manifest.json');
    if (fs.existsSync(existing)) return; // user-provided, leave it alone

    const files = listImagesDir(slug);
    if (files.length === 0) return;

    const payload = files.map(f => `images/${f}`);
    fs.writeFileSync(
        path.join(dir, 'manifest.json'),
        JSON.stringify(payload, null, 2) + '\n',
        'utf8'
    );
    console.log(`  + images/manifest.json (${files.length} file${files.length === 1 ? '' : 's'})`);
}

function build() {
    if (!fs.existsSync(PROJECTS_DIR)) {
        console.error(`Projects directory not found: ${PROJECTS_DIR}`);
        process.exit(1);
    }

    const folders = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

    const projects = [];
    const warnings = [];
    const stockMap = {};

    for (const slug of folders) {
        const metaPath = path.join(PROJECTS_DIR, slug, 'project.json');
        const meta = readJSON(metaPath);

        if (!meta) {
            warnings.push(`  ! ${slug}: missing or invalid project.json — skipped`);
            continue;
        }

        const cover = findCoverFile(slug);
        if (!cover) {
            warnings.push(`  ! ${slug}: no cover.{jpg,png,webp} found — skipped`);
            continue;
        }

        buildImagesManifest(slug);

        projects.push({
            slug,
            order: typeof meta.order === 'number' ? meta.order : Infinity,
            meta
        });

        stockMap[slug] = Number.isInteger(meta.stock) ? meta.stock : 0;
    }

    projects.sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return a.slug.localeCompare(b.slug);
    });

    const slugs = projects.map(p => p.slug);
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(slugs, null, 2) + '\n', 'utf8');
    fs.writeFileSync(STOCK_PATH,    JSON.stringify(stockMap, null, 2) + '\n', 'utf8');

    console.log(`Indexed ${projects.length} project${projects.length === 1 ? '' : 's'}:`);
    projects.forEach(p => {
        const orderLabel = p.order === Infinity ? '  -' : String(p.order).padStart(3, ' ');
        const stock = stockMap[p.slug];
        console.log(`  ${orderLabel}  ${p.slug}  —  ${p.meta.title}  (stock: ${stock})`);
    });
    if (warnings.length) {
        console.log('\nWarnings:');
        warnings.forEach(w => console.log(w));
    }
    console.log(`\nWrote ${path.relative(ROOT, MANIFEST_PATH)}`);
    console.log(`Wrote ${path.relative(ROOT, STOCK_PATH)}`);
}

build();
