// buildManifest: compose the pure transforms into the manifest.json shape that
// the downloader .cmd consumes (see poc/manifest.json). No Playwright, no network.
import { sanitizeName, tableFolderName } from './transforms.mjs';

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
    tables: tab.tables.map((table) => ({
      name: table.title,
      folder: tableFolderName(table.title),
      documents: table.documents.map((doc) => {
        documentCount++;
        return {
          title: doc.title,
          filename: sanitizeName(doc.title) + extensionFromUrl(doc.url),
          url: doc.url,
          size_label: doc.sizeLabel,
        };
      }),
    })),
  }));

  return {
    generated_at: generatedAt,
    source_url: raw.sourceUrl,
    document_count: documentCount,
    tabs,
  };
}
