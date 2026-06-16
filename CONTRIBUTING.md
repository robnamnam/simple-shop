# Contributing

This portfolio is folder-driven: a project is just a folder. No code changes are
required to add, remove, or reorder projects.

## Adding a new project

1. **Create the folder** under `projects/` using a lowercase, hyphenated slug
   (e.g. `projects/quiet-harbour/`). Inside it, create an `images/` subfolder.

2. **Drop a cover image** into the project root. Accepted names: `cover.jpg`,
   `cover.png`, or `cover.webp`. This is the image shown in the gallery grid.

3. **Create `project.json`** in the project root with the project's metadata:

   ```json
   {
     "title": "Quiet Harbour",
     "category": "Oil on Linen",
     "description": "Short prose description of the work.",
     "year": "2025",
     "medium": "Oil on Linen",
     "dimensions": "100 × 80 cm",
     "edition": "Unique",
     "price": "€ 1,800",
     "status": "available",
     "order": 7,
     "stock": 1
   }
   ```

   - `status` must be one of `available`, `sold`, or `enquire`.
   - `order` controls the position in the gallery — items are sorted ascending by
     `order`, then alphabetically by folder name. Use a unique value higher than
     the current maximum if you want the new project to appear last.
   - `stock` is the number of copies available. `1` for a unique piece, the edition
     size for limited editions. The server uses this to enforce inventory at
     checkout time.

4. **Add overlay images** to `images/`. Then create `images/manifest.json` as a
   JSON array of strings, in display order:

   ```json
   [
     "images/01.jpg",
     "images/02.jpg",
     "https://example.com/detail-shot.jpg"
   ]
   ```

   Entries can be either a relative path inside the project (e.g. `images/01.jpg`)
   or an absolute URL.

5. **Rebuild the manifest**:

   ```sh
   npm run build
   ```

   The script writes `projects/manifest.json` (the slug list) and
   `projects/stock.json` (the stock map). You should see your project listed
   in the script's output.

6. **Reload `index.html`** in the browser. The new project appears in the grid,
   and clicking it opens the overlay with your description, metadata, and images.

## Running the site

For the static site alone, open `index.html` directly in a browser.

For the **cart and Stripe checkout** to work, run the local server:

```sh
npm install        # first time only
cp .env.example .env
# edit .env to add your STRIPE_SECRET_KEY (and STRIPE_WEBHOOK_SECRET if you have one)
npm start
```

Then visit `http://localhost:3000` instead of opening `index.html` directly.

## Removing a project

Delete the project's folder, then run `npm run build` again.

## Reordering

Edit the `order` field in each affected `project.json`, then run `npm run build`.
Lower numbers appear first; ties are broken alphabetically by folder name.

## Restocking

The server's `stock` table is seeded from `project.json` on first run. To change
the live stock count after launch (e.g. after a return), call the admin endpoint:

```sh
curl -X POST http://localhost:3000/api/admin/restock \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"slug":"tidal-memory","stock":2}'
```

## Schema reference

The full schema and a worked example live in [`AGENTS.md`](./AGENTS.md).
