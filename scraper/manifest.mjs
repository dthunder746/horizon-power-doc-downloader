// buildManifest: compose the pure transforms into the manifest.json shape that
// the downloader .cmd consumes (see poc/manifest.json). No Playwright, no network.
import { sanitizeName, tableFolderName, dedupeNames, truncateFilename } from './transforms.mjs';

// Windows MAX_PATH and the fixed download-root folder the .cmd creates under the
// user's base directory. The base directory itself is unknown at build time
// (it is %~dp0 when the .cmd runs), so we reserve a conservative length for it.
const MAX_PATH = 260;
const DOWNLOAD_ROOT = 'Horizon Power Documents';
const DEFAULT_PATH_RESERVE = 80;

// Extension (including the dot) from a document URL, e.g. ".pdf". Empty if none.
function extensionFromUrl(url) {
  const path = String(url).split(/[?#]/)[0]; // drop query/fragment
  const base = path.slice(path.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot) : '';
}

/**
 * Turn a raw scrape object (nested tabs -> tables -> documents) into the
 * manifest.json structure. generatedAt is injectable so callers/tests control
 * the timestamp.
 */
export function buildManifest(
  raw,
  { generatedAt = new Date().toISOString(), pathReserve = DEFAULT_PATH_RESERVE } = {},
) {
  let documentCount = 0;

  const tabs = raw.tabs.map((tab) => {
    const tabFolder = sanitizeName(tab.name);

    return {
      name: tab.name,
      folder: tabFolder,
      tables: tab.tables.map((table) => {
        const tableFolder = tableFolderName(table.title);

        // Per-file budget: MAX_PATH minus the reserved base dir and the fixed
        // folder chain (root\tab\table\), each folder plus its separator.
        const budget =
          MAX_PATH -
          pathReserve -
          (DOWNLOAD_ROOT.length + 1) -
          (tabFolder.length + 1) -
          (tableFolder.length + 1);

        // Truncate each name to the budget first, then dedupe. Truncating after
        // dedupe could chop a " (2)" suffix and re-collide (silent overwrite);
        // this order only risks a few chars of slack against the reserve.
        const baseNames = table.documents.map((doc) =>
          truncateFilename(sanitizeName(doc.title) + extensionFromUrl(doc.url), budget),
        );
        const filenames = dedupeNames(baseNames);

        // name is the human display heading; folder is its filesystem-safe form.
        // Both share the "Uncategorised" fallback when no heading was detected.
        const displayName = String(table.title ?? '').trim() || 'Uncategorised';

        return {
          name: displayName,
          folder: tableFolder,
          documents: table.documents.map((doc, i) => {
            documentCount++;
            return {
              title: doc.title,
              filename: filenames[i],
              url: doc.url,
              size_label: doc.sizeLabel,
            };
          }),
        };
      }),
    };
  });

  return {
    generated_at: generatedAt,
    source_url: raw.sourceUrl,
    document_count: documentCount,
    tabs,
  };
}
