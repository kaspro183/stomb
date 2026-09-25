# STOMB Launchpad — real project, real build

This is now a proper small project instead of one hand-loaded HTML file. The
mint code (`bitcoinjs-lib` + `runelib`) is bundled correctly by Vite, which
fixes the `writeUint8 is not a function` error you hit before — that came
from loading those libraries via a CDN with no build step. Verified by an
automated test before this was handed off: coin selection, PSBT
construction and Runestone encoding were built, round-tripped through the
same libraries' own decoder, and confirmed to reconstruct the exact mint
(rune 968575:856, pointer 1) with no errors.

**Still test with the smallest possible mint (1,000 STOMB) yourself before
telling anyone else about the site.** This has been tested by code, not by
an actual wallet signing an actual transaction — that first real mint is
still on you.

## Deploying on Netlify via GitHub (recommended)

1. Push this whole folder to your `stomb` GitHub repo (replacing the old
   single `index.html`).
2. In Netlify, go to your site → **Project configuration** → **Build & deploy**
   → **Link repository**, and connect the `stomb` repo.
3. Set:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
4. Save. Netlify will run the build itself and deploy `dist/` automatically
   — and do the same on every future push.

## Deploying by drag-and-drop (quick, no auto-updates)

A pre-built `dist/` folder is included in the zip you were given. Drag that
`dist` folder directly onto Netlify's "Netlify Drop" zone, same as before.
You'll need to rebuild and re-drop it manually for any future change.

## Making changes yourself

```
npm install
npm run dev      # local preview at http://localhost:5173
npm run build    # rebuilds dist/ for deployment
```

The mint logic lives in `main.js`. The look of the page is in `style.css`
and `index.html`.
