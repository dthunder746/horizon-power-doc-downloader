// Pure scraper transforms: filesystem-safe naming for Windows targets.
// No Playwright, no network. All logic here is unit-tested via tests/transforms.test.mjs.

// Characters illegal in a Windows path component.
const ILLEGAL = /[\\/:*?"<>|]/g;

/**
 * Make a raw scraped title safe to use as a single Windows path component
 * (one folder or file name, not a full path).
 */
export function sanitizeName(name) {
  return String(name)
    .replace(ILLEGAL, '_')
    .replace(/[. ]+$/, ''); // Windows forbids trailing dots and spaces
}

/**
 * Shorten a filename so its length is at most maxLen, preserving the extension.
 * The caller sets maxLen from its remaining path budget (folder path + separators
 * against the 260-char MAX_PATH limit).
 */
export function truncateFilename(name, maxLen) {
  name = String(name);
  if (name.length <= maxLen) return name;

  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot) : ''; // dot>0 so a dotfile isn't all-extension
  const stemBudget = maxLen - ext.length;
  if (stemBudget <= 0) return name.slice(0, maxLen); // extension alone overflows: hard cut

  return name.slice(0, stemBudget) + ext;
}

/**
 * Disambiguate repeated filenames within one folder by appending " (2)", " (3)",
 * ... before the extension. Order is preserved. Matching is case-insensitive
 * because Windows filesystems are.
 */
export function dedupeNames(names) {
  const seen = new Set();
  return names.map((raw) => {
    const name = String(raw);
    if (!seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      return name;
    }
    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    let n = 2;
    let candidate;
    do {
      candidate = `${stem} (${n})${ext}`;
      n++;
    } while (seen.has(candidate.toLowerCase()));
    seen.add(candidate.toLowerCase());
    return candidate;
  });
}

// Hosts whose files we ship. The scraped page links out to external references
// (standards bodies, other WA gov sites) and back to its own HTML pages; those
// are not Horizon Power documents and are excluded. See ADR / PRD scope.
const HP_DOMAIN = 'horizonpower.com.au';
// A URL that names a downloadable file: its path ends in a short extension.
// Folder-style URLs ending in "/" (which 403 for a non-browser client) have no
// extension and are excluded.
const FILE_EXTENSION = /\.[a-z0-9]{1,5}$/i;

/**
 * True when a scraped URL points at an actual Horizon Power document: a file
 * (path ends in an extension) hosted on horizonpower.com.au under /globalassets/.
 * Everything else (external links, HP HTML pages, "#" anchors, folder-style URLs)
 * is excluded. Never throws; malformed input returns false.
 */
export function isHorizonPowerDocument(url) {
  let parsed;
  try {
    parsed = new URL(String(url));
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  const onHpDomain = host === HP_DOMAIN || host.endsWith(`.${HP_DOMAIN}`);
  if (!onHpDomain) return false;
  if (!parsed.pathname.toLowerCase().includes('/globalassets/')) return false;
  return FILE_EXTENSION.test(parsed.pathname);
}

/**
 * True when a URL points at the scraped page itself (the source page), ignoring
 * any "#" fragment, query string, and trailing slash. Used to drop the page's
 * self-links and in-page anchors, which are noise rather than references.
 * Never throws; malformed input returns false.
 */
export function isSourcePageLink(url, sourceUrl) {
  let a, b;
  try {
    a = new URL(String(url));
    b = new URL(String(sourceUrl));
  } catch {
    return false;
  }
  const page = (u) => u.hostname.toLowerCase() + u.pathname.replace(/\/+$/, '').toLowerCase();
  return page(a) === page(b);
}

/**
 * Classify every scraped entry and return a copy of the raw object with a `type`
 * on each surviving document:
 *   - Horizon Power files (isHorizonPowerDocument) -> type 'document' (downloaded).
 *   - The page's own self-links and in-page anchors -> dropped entirely.
 *   - Everything else (external references, browser-only HP folder URLs) ->
 *     type 'shortcut' (saved as a Windows .url by the downloader).
 * Tables left with no entries, and tabs left with no tables, are dropped so the
 * manifest never yields empty folders. The input object is not mutated.
 */
export function classifyDocuments(raw) {
  const tabs = raw.tabs
    .map((tab) => {
      const tables = tab.tables
        .map((table) => ({
          ...table,
          documents: table.documents
            .map((doc) => {
              if (isHorizonPowerDocument(doc.url)) return { ...doc, type: 'document' };
              if (isSourcePageLink(doc.url, raw.sourceUrl)) return null; // self-referential
              return { ...doc, type: 'shortcut' };
            })
            .filter(Boolean),
        }))
        .filter((table) => table.documents.length > 0);
      return { ...tab, tables };
    })
    .filter((tab) => tab.tables.length > 0);
  return { ...raw, tabs };
}

/**
 * Folder name for a scraped table. Some tables have no detectable heading
 * (the title selector is an unsolved recon item); those fall back to
 * "Uncategorised" rather than producing an empty or unnamed folder.
 */
export function tableFolderName(title) {
  const trimmed = String(title ?? '').trim();
  if (trimmed === '') return 'Uncategorised';
  return sanitizeName(trimmed);
}
