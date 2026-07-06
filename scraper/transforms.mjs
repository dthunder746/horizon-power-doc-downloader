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
