// Maintainer-side scraper: read the Horizon Power page and regenerate the full
// manifest.json the Downloader consumes. Integration code, verified by RUNNING it
// (not by unit tests). The pure transforms and buildManifest it feeds are already
// unit-tested (tests/transforms.test.mjs, tests/manifest.test.mjs).
//
// Run:  node scraper/scrape.mjs
//
// Requires Playwright with the real Chrome channel available. This project adds
// no Playwright dependency; the module is resolved from the npx cache (populate
// it once with:  npx --yes playwright@latest install chrome ).
//
// The HTML page is behind a Cloudflare JS challenge that 403s plain curl/fetch,
// so we drive headed real Chrome (channel: 'chrome') to solve it. The file assets
// themselves are not Cloudflare-protected.

import { readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildManifest } from './manifest.mjs';
import { classifyDocuments } from './transforms.mjs';

const SOURCE_URL =
  'https://www.horizonpower.com.au/contractors-installers/manuals-standards/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) HorizonPowerDocDownloader';
const BASELINE_DOCS = 152; // known good total of HP documents; large drift = broken selector
const DRIFT_TOLERANCE = 0.15;

// new URL('..', ...) already resolves to the repo root (scraper/'s parent).
const manifestOut = fileURLToPath(new URL('../manifest.json', import.meta.url));

// Resolve Playwright from the npx cache so this repo needs no dependency.
// Tries a direct import first (global/linked install), then scans ~/.npm/_npx.
// Playwright is CJS: under ESM interop its public API (chromium, ...) lives on
// the module's default export, so unwrap that.
async function resolvePlaywright() {
  const unwrap = (mod) => mod.default ?? mod;
  try {
    return unwrap(await import('playwright'));
  } catch {
    /* fall through to npx cache scan */
  }
  const npxCache = join(homedir(), '.npm', '_npx');
  if (existsSync(npxCache)) {
    for (const hash of readdirSync(npxCache)) {
      const candidate = join(npxCache, hash, 'node_modules', 'playwright', 'index.js');
      if (existsSync(candidate)) {
        return unwrap(await import(pathToFileURL(candidate).href));
      }
    }
  }
  throw new Error(
    'Playwright not found. Install it into the npx cache first:\n' +
      '  npx --yes playwright@latest install chrome',
  );
}

// Everything below runs inside the page (browser context), so keep it self-
// contained. Returns the raw nested shape buildManifest expects.
function extractRaw() {
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const SIZE_RE = /\[\s*([\d.]+\s*[KMG]B)\s*\]/i;

  // The 4 tab labels live in the tab control ([role="tab"]) and the 4 content
  // panels load in one DOM pass. They cannot be paired by id (the site gives
  // every panel id="tab-1"), so pair them by DOM order instead.
  const tabLabels = [...document.querySelectorAll('[role="tab"]')].map((t) =>
    norm(t.textContent),
  );
  const panels = [...document.querySelectorAll('div.tabs-panel.js-tabs-panel')];

  const tabs = panels.map((panel, panelIndex) => {
    const name = tabLabels[panelIndex] || `Untitled tab ${panelIndex + 1}`;

    const listings = [...panel.querySelectorAll('div.link-listing')];
    const tables = listings.map((listing) => {
      // Table title is the table's header cell: <thead><th colspan>Title</th>.
      // A table with no header falls back to "Uncategorised" in buildManifest.
      const th = listing.querySelector('table.link-listing__table thead th');
      const title = th ? norm(th.textContent) : null;

      // The thead title row has no link, so the a[href] filter below drops it.
      const rows = [...listing.querySelectorAll('table.link-listing__table tr')];
      const documents = rows
        .map((tr) => {
          const a = tr.querySelector('a[href]');
          if (!a) return null; // header rows have no link
          const rowText = norm(tr.textContent);
          const sizeMatch = rowText.match(SIZE_RE);
          const sizeLabel = sizeMatch ? norm(sizeMatch[1]) : '';
          // Display title lives in the row text (the anchor text is empty).
          // Strip the trailing size label to get a clean title.
          const docTitle = norm(rowText.replace(SIZE_RE, ''));
          return { title: docTitle, url: a.href, sizeLabel };
        })
        .filter(Boolean);

      return { title, documents };
    });

    return { name, tables };
  });

  return { sourceUrl: location.href, tabs };
}

// Best-effort reachability check on every document URL. Informational only:
// the maintainer reviews the dead-link report before committing; it never blocks.
async function checkLinks(raw) {
  // Only validate documents we actually download. Shortcut targets are external
  // reference pages (and browser-only HP URLs); they are never fetched by the
  // downloader, and probing them just adds rate-limited noise to the report.
  const urls = raw.tabs.flatMap((t) =>
    t.tables.flatMap((tbl) =>
      tbl.documents.filter((d) => d.type !== 'shortcut').map((d) => d.url),
    ),
  );
  const dead = [];
  const CONCURRENCY = 8;
  let idx = 0;

  async function worker() {
    while (idx < urls.length) {
      const url = urls[idx++];
      try {
        let res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA } });
        // Some asset servers reject HEAD; retry with a ranged GET.
        if (res.status === 405 || res.status === 403) {
          res = await fetch(url, {
            method: 'GET',
            headers: { 'User-Agent': UA, Range: 'bytes=0-0' },
          });
        }
        if (!res.ok && res.status !== 206) dead.push(`${res.status} ${url}`);
      } catch (err) {
        dead.push(`ERR ${url} (${err.message})`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return dead;
}

async function main() {
  const { chromium } = await resolvePlaywright();

  console.log('Launching headed Chrome to solve the Cloudflare challenge...');
  const browser = await chromium.launch({ channel: 'chrome', headless: false });
  const page = await browser.newPage({ userAgent: UA });

  let rawAll;
  try {
    await page.goto(SOURCE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    // Wait for the tab panels to be present (all four load in one DOM pass).
    await page.waitForSelector('div.tabs-panel.js-tabs-panel', { timeout: 60000 });
    rawAll = await page.evaluate(extractRaw);
  } finally {
    await browser.close();
  }

  // Classify entries: HP files are downloaded documents, external/browser-only
  // references become .url shortcuts, and the page's own self-links are dropped.
  const raw = classifyDocuments(rawAll);
  const countEntries = (r) =>
    r.tabs.reduce((n, t) => n + t.tables.reduce((m, tbl) => m + tbl.documents.length, 0), 0);
  const shortcutCount = raw.tabs.reduce(
    (n, t) =>
      n +
      t.tables.reduce(
        (m, tbl) => m + tbl.documents.filter((d) => d.type === 'shortcut').length,
        0,
      ),
    0,
  );
  const selfLinksDropped = countEntries(rawAll) - countEntries(raw);

  const manifest = buildManifest(raw);

  // Report tables that fell back to Uncategorised (title selector recon).
  const fellBack = [];
  for (const tab of raw.tabs) {
    for (const table of tab.tables) {
      if (!table.title) fellBack.push(`${tab.name}: ${table.documents.length} doc(s)`);
    }
  }

  console.log('');
  console.log(`Tabs found:      ${raw.tabs.map((t) => t.name).join(', ')}`);
  console.log(`Document count:  ${manifest.document_count} (baseline ~${BASELINE_DOCS})`);
  console.log(`Web shortcuts:   ${shortcutCount} (non-HP references saved as .url files)`);
  console.log(`Self-links dropped: ${selfLinksDropped} (links back to the source page itself)`);

  const drift = Math.abs(manifest.document_count - BASELINE_DOCS) / BASELINE_DOCS;
  if (drift > DRIFT_TOLERANCE) {
    console.warn(
      `WARNING: document count deviates ${(drift * 100).toFixed(0)}% from baseline. ` +
        'A selector may have broken; review before committing.',
    );
  }
  if (fellBack.length) {
    console.warn(`Tables with no detected title (folder Uncategorised):`);
    fellBack.forEach((f) => console.warn(`  - ${f}`));
    console.warn('Refine the title selector in extractRaw() if this is unexpected.');
  }

  console.log('');
  console.log('Validating document URLs (dead-link report)...');
  const dead = await checkLinks(raw);
  if (dead.length === 0) {
    console.log('All document URLs reachable.');
  } else {
    console.warn(`${dead.length} unreachable URL(s):`);
    dead.forEach((d) => console.warn(`  ${d}`));
  }

  writeFileSync(manifestOut, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log('');
  console.log(`Wrote ${manifestOut}`);
  console.log('Review the counts and dead-link report above, then commit and push.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
