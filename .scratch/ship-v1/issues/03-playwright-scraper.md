# 03 — Playwright scraper (`scraper/scrape.mjs`)

Status: ready-for-agent

The maintainer-side script that reads the Horizon Power page and regenerates `manifest.json`. Integration code, verified by running it, not by unit tests (the pure transforms and `buildManifest` are already unit-tested and green).

## Scope

- Headed real Chrome via Playwright (`channel: 'chrome'`) to pass the Cloudflare JS challenge. Plain `curl`/`WebFetch` on the page get 403. Resolve Playwright from the npx cache (`resolvePlaywright()` pattern); no project dependency added.
- All 4 tabs load in one DOM pass: panels `div.tabs-panel.js-tabs-panel` (one `is-open`, three `is-hidden`). No tab-clicking needed.
- Documents live in `table.link-listing__table` inside `div.link-listing`. Per row (`tr`), take the first `a[href]`. The display title is in the row text, not the anchor (anchor text is empty). The size label is embedded in row text as `[2.29 MB]`.
- Build the nested raw shape `buildManifest` expects: `{ sourceUrl, tabs:[{ name, tables:[{ title, documents:[{ title, url, sizeLabel }] }] }] }`. Feed it through `scraper/manifest.mjs` to write the full `manifest.json`, replacing the 1-doc POC file.
- **Open technical item:** table/collection titles ("Technical Rules") are not standard `<h2>`-`<h5>` headings; a nearest-heading probe returned null. Pin down the correct selector. Agreed fallback: any table with no detectable title becomes folder `Uncategorised` (already handled in `buildManifest`).
- Validate every document URL and produce a dead-link report. Informational: the maintainer reviews it before committing the manifest; it does not block.
- Sanity-check the total document count against the known baseline (~158 across tabs; ~152 PDFs cleanly enumerated previously). A large deviation is a signal that a selector broke.

## Verification

Run the scraper, diff the document counts against the known baseline, spot-check the dead-link report and a sample of titles/filenames/folders in the generated `manifest.json`. Do not claim done without running it.
