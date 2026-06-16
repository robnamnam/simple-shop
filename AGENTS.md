# AGENTS.md — Rule File for the Portfolio Site

This file governs how **I** (the AI coding agent) add a project to this portfolio.
Read it in full before responding to any "add a project" request.

The site is **folder-driven**: a new project is just a new folder under `projects/`,
plus a manifest rebuild. There is no registration step in `script.js` or `index.html`.

---

## 0. Trigger

When the user says anything in the spirit of:
- "add a project"
- "new artwork: <title>"
- "publish <title>"
- "create a project folder for …"

…follow this file **from top to bottom, in order**, without skipping steps.

---

## 1. Collect the required information (one shot)

At the start of an "add a project" request, ask for the missing required fields in a
**single** `ask_followup_question` call. Do not drip-feed questions one at a time.

**Required (must be provided by the user):**
- `title` (e.g. "Tidal Memory")
- `status` — one of: `available`, `sold`, `enquire` (default `available` if user is unsure)
- `stock` — integer (default: `1` for unique pieces, or the number of editions for an open edition)
- At least one cover image (local path, or a remote URL)

**Optional but normally expected — ask for them too in the same message:**
- `category`, `description`, `year`, `medium`, `dimensions`, `edition`, `price`
- `order` — only ask if the user has a specific position in mind; otherwise auto-compute (see §4)
- Overlay gallery images (local paths and/or remote URLs, in display order)

If the user is vague, propose sensible defaults based on the existing 6 projects and confirm
before writing files.

---

## 2. Derive the slug

- Default: lowercase the title, replace whitespace with `-`, strip anything that is not
  `[a-z0-9-]`. Example: `"Tidal Memory"` → `tidal-memory`.
- If the user supplies a slug verbatim, use it verbatim.
- The slug must be unique within `projects/`. If it collides, append `-2`, `-3`, …

---

## 3. Create the folder structure

Always create **all three** of the following, even if `images/` will end up empty:

```
projects/<slug>/
├── project.json
├── cover.jpg          (or cover.png / cover.webp — pick whatever the user provided)
└── images/            (directory; can be empty for a cover-only project)
```

Use `mkdir` (or `execute_command` with `mkdir`) — do not assume PowerShell.

---

## 4. Compute `order`

Read all existing `project.json` files in `projects/`. Find the maximum numeric
`order` value. Set the new project's `order` to `max + 1` (or `1` if none exist).

If the user explicitly specified a position (e.g. "put it second"), respect that and
**renumber the other projects** as needed to keep `order` values contiguous starting at 1.

---

## 5. Write `project.json`

The schema (all fields are strings unless noted):

| field         | type    | required | example                              |
|---------------|---------|----------|--------------------------------------|
| `title`       | string  | yes      | `"Tidal Memory"`                     |
| `category`    | string  | no       | `"Oil on Canvas"`                    |
| `description` | string  | no       | `"A meditation on the cyclical…"`    |
| `year`        | string  | no       | `"2025"`                             |
| `medium`      | string  | no       | `"Oil on Canvas"`                    |
| `dimensions`  | string  | no       | `"120 × 90 cm"`                      |
| `edition`     | string  | no       | `"Unique"`                           |
| `price`       | string  | no       | `"€ 2,400"`                          |
| `status`      | enum    | yes      | `"available"` \| `"sold"` \| `"enquire"` |
| `order`       | integer | yes      | `7`                                  |
| `stock`       | integer | yes      | `1` (or `5` for an edition of 5)     |

- Write the file with `write_to_file` using a 2-space indent and a trailing newline.
- Use empty strings `""` for missing optional fields (not `null`).
- Do not include `cover` or `images` here — those are derived from the filesystem.

---

## 6. Handle the cover image

The cover **must be a real file in the project root** (per the project's spec).
The accepted names are `cover.jpg`, `cover.png`, `cover.webp` (case-insensitive).

- **Local source** (user gave a path on disk): copy it to `projects/<slug>/cover.<ext>`.
- **Remote source** (user gave a URL): download it with `curl -L -o` to
  `projects/<slug>/cover.<ext>`. Pick the extension from the URL if obvious;
  otherwise default to `.jpg`.
- **Multiple candidates**: if the user offers a choice, use the first one they listed.

---

## 7. Handle the overlay images

The overlay gallery uses `projects/<slug>/images/manifest.json` — a JSON array of
strings, in display order. Each entry is either:
- an absolute URL (`https://…`), or
- a relative path inside the project (`images/<filename>`).

**Always create / overwrite `images/manifest.json` explicitly** when the user provides
overlay images. Do not rely on the build tool's auto-generation in this case.

Per image:
- **Local source**: copy into `projects/<slug>/images/`. Use the original filename.
  If a file with that name already exists in `images/`, prefix the new file with
  `01-`, `02-`, … to avoid collision. The manifest entry must be the **final**
  filename as it lives in `images/`.
- **Remote source**: do **not** download it (keeps the repo small). The manifest
  entry is the URL itself.

Order: preserve the order the user gave. If the user gave no overlay images, leave
`images/` empty and write a manifest containing an empty array `[]`.

---

## 8. Rebuild the manifest

Always finish with:

```sh
node tools/build-manifest.js
```

This writes both `projects/manifest.json` (slug order) and `projects/stock.json`
(stock map for the static frontend). Verify the new slug appears in `projects/manifest.json`.
If it does not:
1. Re-read the tool's output for warnings (missing `project.json`, missing cover, etc.).
2. Fix the underlying problem.
3. Re-run the tool.
4. Repeat until the slug is present.

---

## 9. Smoke-check (in the agent's head)

Before reporting success, mentally walk through:
- Does the new project appear in the gallery at the position implied by `order`?
  (Items are sorted ascending by `order`, then alphabetically by slug.)
- Does clicking its tile open the project overlay with the correct title, description,
  and cover?
- Does the overlay gallery show the images in the order from `images/manifest.json`?
- Does the price / status badge render correctly given the `status` field?
- Is the quantity stepper maxed at the declared `stock`?

The user is expected to verify in the browser. State this in the completion message.

---

## 10. Hard rules — never do these

- ❌ Do **not** edit `script.js` or `index.html` to register a new project.
- ❌ Do **not** edit `projects/manifest.json` or `projects/stock.json` by hand. They are regenerated.
- ❌ Do **not** put non-cover images in the project root. Everything else goes in `images/`.
- ❌ Do **not** invent metadata. If a field is missing, ask or write `""` — never guess.
- ❌ Do **not** download overlay images by default. They go in the manifest as URLs.
- ❌ Do **not** skip `node tools/build-manifest.js` at the end. It is the source of truth.
- ❌ Do **not** invent a `stock` value. Always ask the user for it (or derive from edition
  info, confirming with the user).

---

## 11. The server, the cart, and the checkout

The site has a small Node/Express + SQLite backend (`server/`) for cart and checkout.
When you add a new project:
- The server is not required to be running for the new project to appear in the gallery
  (the static fallback in `script.js` will load it from `projects/manifest.json`).
- The server **is** required for live stock, the cart, and the Stripe checkout.
  The user starts it with `npm start` (which runs `node server/server.js`).
- On first run, the server seeds its `stock` table from each `project.json`'s `stock`
  field. Existing rows in the table are **not** overwritten by re-seeding, so sales-driven
  stock changes are preserved. To change the declared stock after launch, call
  `POST /api/admin/restock` with `{ slug, stock }` and the `X-Admin-Token` header.
- Do **not** add any new endpoint to `server/server.js` for "adding a project". The
  folder-driven system is the only registration mechanism.

---

## 12. Example (terse)

User: "Add a project called 'Quiet Harbour' — oil on linen, 100x80, €1800, available,
edition of 7, cover is https://example.com/qh.jpg, plus 2 detail shots at
https://example.com/qh1.jpg and https://example.com/qh2.jpg."

1. Slug: `quiet-harbour`. Verify uniqueness against `projects/`.
2. Read existing orders → max is 6 → new `order` is 7.
3. `stock: 7` (matches edition size).
4. `mkdir projects/quiet-harbour/images`.
5. `curl -L -o projects/quiet-harbour/cover.jpg https://example.com/qh.jpg`.
6. Write `projects/quiet-harbour/project.json` with the metadata.
7. Write `projects/quiet-harbour/images/manifest.json`:
   ```json
   [
     "https://example.com/qh1.jpg",
     "https://example.com/qh2.jpg"
   ]
   ```
8. `node tools/build-manifest.js` → confirm `"quiet-harbour"` is in `projects/manifest.json`
   and `stock.quiet-harbour: 7` in `projects/stock.json`.
9. Report success, ask the user to refresh `index.html`.
