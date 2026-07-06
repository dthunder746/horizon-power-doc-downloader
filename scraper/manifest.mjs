// buildManifest: compose the pure transforms into the manifest.json shape that
// the downloader .cmd consumes (see poc/manifest.json). No Playwright, no network.
import { sanitizeName, tableFolderName, dedupeNames } from './transforms.mjs';

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
export function buildManifest(raw, { generatedAt = new Date().toISOString() } = {}) {
  let documentCount = 0;

  const tabs = raw.tabs.map((tab) => ({
    name: tab.name,
    folder: sanitizeName(tab.name),
    tables: tab.tables.map((table) => {
      // Derive each document's base filename, then disambiguate collisions
      // within this folder before emitting.
      const baseNames = table.documents.map(
        (doc) => sanitizeName(doc.title) + extensionFromUrl(doc.url),
      );
      const filenames = dedupeNames(baseNames);

      // name is the human display heading; folder is its filesystem-safe form.
      // Both share the "Uncategorised" fallback when no heading was detected.
      const displayName = String(table.title ?? '').trim() || 'Uncategorised';

      return {
        name: displayName,
        folder: tableFolderName(table.title),
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
  }));

  return {
    generated_at: generatedAt,
    source_url: raw.sourceUrl,
    document_count: documentCount,
    tabs,
  };
}
