# Artwork Portfolio

A folder-driven artwork portfolio. Each project is a folder under `projects/` —
no code changes are needed to add, remove, or reorder projects. The site works
as a static page (great for hosting on Vercel, GitHub Pages, or any CDN) and
optionally as a full app with a cart and Stripe checkout (when you run the
local Node/Express server).

![technologies](https://img.shields.io/badge/HTML-CSS_JS-orange) ![node](https://img.shields.io/badge/node-%E2%89%A520-green) ![license](https://img.shields.io/badge/license-MIT-blue)

## Features

- 📁 **Folder-driven** — drop a folder in `projects/`, drop a cover image, and the gallery updates.
- 🖼️ **Square gallery grid** with hover overlay and click-to-open project details.
- 🛒 **Cart** with localStorage persistence, quantity stepper, subtotal, and a checkout button.
- 🌗 **Dark mode** with a sun/moon toggle in the header. Persisted across visits. No flash on load.
- 💳 **Stripe Checkout** (optional, requires Stripe keys) — the server re-fetches prices and stock so the cart cannot be tampered with.
- 📦 **Inventory** — each project has a `stock` field; sold-out items get a badge and can't be added to the cart.
- 🚀 **One-click Vercel deploy** — see below.

## Quick start (local)

The static site works without any server:

```sh
# Just open index.html in a browser, or:
npx serve .
```

For the cart + Stripe checkout to work, run the local server:

```sh
npm install        # first time only
cp .env.example .env
# edit .env to add your STRIPE_SECRET_KEY (and STRIPE_WEBHOOK_SECRET if you have one)
npm start
```

Then visit `http://localhost:3000`.

## Add a new project

1. Create a folder under `projects/` named after the project (e.g. `projects/quiet-harbour/`). Inside it, create an `images/` subfolder.
2. Drop a cover image into the project root: `cover.jpg`, `cover.png`, or `cover.webp`.
3. Create `project.json` next to the cover. See `AGENTS.md` for the full schema. The minimum required fields are `title`, `status`, `order`, and `stock`.
4. (Optional) Drop overlay images into `images/` and create `images/manifest.json` with their order. Entries can be local filenames or URLs.
5. Run `npm run build` to regenerate `projects/manifest.json` and `projects/stock.json`. **This is what the static site reads** — if you skip this step the new project won't appear.

The full schema, a worked example, and a description of the folder structure are in [`AGENTS.md`](./AGENTS.md) and [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Deploy to Vercel (recommended)

This is the fastest way to get a public URL to share with friends.

### Prerequisites

- A GitHub account (free: [github.com](https://github.com)).
- A Vercel account (free: [vercel.com](https://vercel.com)) — sign up with GitHub.

### Step 1 — push to GitHub

If this folder isn't already a git repo:

```sh
git init
git add .
git commit -m "Initial portfolio"
# then on github.com: create a new empty repo, e.g. "portfolio"
git remote add origin https://github.com/<your-username>/portfolio.git
git branch -M main
git push -u origin main
```

(If you already have a git repo, just `git add . && git commit && git push`.)

### Step 2 — import into Vercel

1. Go to [vercel.com/new](https://vercel.com/new).
2. Click **Import** next to your `portfolio` repo.
3. Vercel will read `vercel.json` and figure out the rest automatically. Don't change any settings. Click **Deploy**.
4. After ~30 seconds, you'll get a URL like `https://portfolio-<your-username>.vercel.app`. **That's the link to share.**

### Step 3 — updates

Every time you push to the `main` branch, Vercel will rebuild and redeploy automatically. So the workflow is:

1. Add a new project folder under `projects/`.
2. `npm run build` locally to verify the manifest regenerates.
3. `git add . && git commit -m "Add Quiet Harbour" && git push`
4. Vercel deploys in ~30 seconds. Done.

### What works on Vercel

- ✅ Everything static: hero carousel, gallery, project overlay, cart (localStorage), dark mode.
- ✅ Vercel CDN serves your project covers, images, and JSON fast.

### What does NOT work on Vercel

- ❌ The **Checkout** button. The static site tries to POST to `/api/checkout`, which doesn't exist on Vercel. The button will show an error toast if clicked. The cart UI itself (add, remove, change qty, view subtotal) all works fine.
- ❌ **Live stock decrements** — the static site reads `stock` from `project.json`; it never updates after a (mock) purchase.

If you need checkout, you'll need to deploy the Node server somewhere that supports persistent processes (Render, Railway, Fly.io, or a VPS). Vercel **can** run Node servers too, but that requires serverless functions and is a different setup — see the [Vercel docs on Express](https://vercel.com/guides/using-express-with-vercel) for that path. The current `vercel.json` is configured for the static-only path.

## Project structure

```
.
├── about.html              # About page
├── contact.html            # Contact page
├── index.html              # Gallery + home
├── style.css               # All styles (light + dark)
├── script.js               # Gallery, overlay, theme toggle
├── cart.js                 # Cart drawer + localStorage
├── package.json            # Build + dev scripts
├── vercel.json             # Vercel config (static)
├── .nvmrc                  # Node version pin
├── .env.example            # Template for local Stripe/admin env vars
├── .gitignore
├── AGENTS.md               # Schema + rules for the AI agent adding projects
├── CONTRIBUTING.md         # Human-friendly contribution guide
├── README.md               # This file
├── projects/               # All project data (one folder per project)
│   ├── manifest.json       # AUTO-GENERATED — do not edit
│   ├── stock.json          # AUTO-GENERATED — do not edit
│   ├── tidal-memory/       # Example project folder
│   │   ├── project.json
│   │   ├── cover.jpg
│   │   └── images/
│   │       ├── manifest.json
│   │       └── ...
│   └── ...
├── server/                 # Local-only Node/Express + SQLite + Stripe
│   ├── server.js
│   ├── db.js
│   └── stripe.js
└── tools/                  # Build + test scripts
    ├── build-manifest.js
    ├── test-api.js
    ├── test-prices.js
    └── check-syntax.js
```

## License

MIT.
