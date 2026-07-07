// Tests for the pure scraper transforms (no Playwright, no network).
// Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizeName,
  truncateFilename,
  dedupeNames,
  tableFolderName,
  isHorizonPowerDocument,
  filterDocuments,
} from '../scraper/transforms.mjs';

test('sanitizeName replaces Windows-illegal characters', () => {
  // \ / : * ? " < > | are all illegal in Windows path components.
  const out = sanitizeName('a/b\\c:d*e?f"g<h>i|j');
  for (const bad of ['\\', '/', ':', '*', '?', '"', '<', '>', '|']) {
    assert.ok(!out.includes(bad), `result should not contain ${bad}: got "${out}"`);
  }
});

test('sanitizeName trims trailing dots and spaces (illegal on Windows)', () => {
  assert.equal(sanitizeName('Technical Rules.'), 'Technical Rules');
  assert.equal(sanitizeName('Standards   '), 'Standards');
  assert.equal(sanitizeName('report. . '), 'report');
});

test('truncateFilename shortens an over-long name but keeps the extension', () => {
  const long = 'A'.repeat(300) + '.pdf';
  const out = truncateFilename(long, 100);
  assert.ok(out.length <= 100, `length should be <= 100, got ${out.length}`);
  assert.ok(out.endsWith('.pdf'), `extension must be preserved: got "${out}"`);
  assert.ok(out.startsWith('AAAA'), 'kept the leading part of the original name');
});

test('dedupeNames disambiguates repeated filenames, keeping the extension', () => {
  assert.deepEqual(
    dedupeNames(['report.pdf', 'report.pdf', 'report.pdf']),
    ['report.pdf', 'report (2).pdf', 'report (3).pdf'],
  );
});

test('dedupeNames leaves distinct names untouched', () => {
  assert.deepEqual(dedupeNames(['a.pdf', 'b.pdf']), ['a.pdf', 'b.pdf']);
});

test('dedupeNames treats case-differing names as collisions (Windows FS)', () => {
  assert.deepEqual(dedupeNames(['Report.pdf', 'report.pdf']), ['Report.pdf', 'report (2).pdf']);
});

test('tableFolderName sanitizes a real title', () => {
  assert.equal(tableFolderName('Metering: Rules/Standards'), 'Metering_ Rules_Standards');
});

test('tableFolderName falls back to Uncategorised when no title is detected', () => {
  for (const empty of [null, undefined, '', '   ', '\n\t']) {
    assert.equal(tableFolderName(empty), 'Uncategorised', `input ${JSON.stringify(empty)}`);
  }
});

test('isHorizonPowerDocument keeps globalassets file URLs on the HP host', () => {
  assert.ok(
    isHorizonPowerDocument(
      'https://www.horizonpower.com.au/globalassets/media/documents/manuals-standards/technical-rules/hpc-9dj.pdf',
    ),
  );
  // Non-PDF but real HP-hosted document types are kept too.
  for (const ext of ['docx', 'xlsx', 'csv']) {
    assert.ok(
      isHorizonPowerDocument(`https://www.horizonpower.com.au/globalassets/x/file.${ext}`),
      `should keep .${ext}`,
    );
  }
});

test('isHorizonPowerDocument drops folder-style globalassets URLs (no file extension)', () => {
  // These 403 for a non-browser client and derive no filename extension.
  assert.equal(
    isHorizonPowerDocument(
      'https://www.horizonpower.com.au/globalassets/media/documents/manuals-standards/interim-instructions/AMS_2023-001/',
    ),
    false,
  );
});

test('isHorizonPowerDocument drops HP HTML pages and anchors outside globalassets', () => {
  assert.equal(
    isHorizonPowerDocument('https://www.horizonpower.com.au/contractors-installers/manuals-standards/'),
    false,
  );
  assert.equal(
    isHorizonPowerDocument(
      'https://www.horizonpower.com.au/contractors-installers/manuals-standards/#metering',
    ),
    false,
  );
});

test('isHorizonPowerDocument drops external hosts even when they end in a file extension', () => {
  assert.equal(
    isHorizonPowerDocument('http://www.docep.wa.gov.au/EnergySafety/PDF/WA_Electrical_Requirements.pdf'),
    false,
  );
  assert.equal(isHorizonPowerDocument('https://www.intertekinform.com/en-au/'), false);
  // A look-alike host must not pass the domain check.
  assert.equal(isHorizonPowerDocument('https://notreallyhorizonpower.com.au/globalassets/x.pdf'), false);
});

test('isHorizonPowerDocument ignores query strings and fragments after the file name', () => {
  assert.ok(isHorizonPowerDocument('https://www.horizonpower.com.au/globalassets/x/file.pdf?v=2'));
  assert.ok(isHorizonPowerDocument('https://www.horizonpower.com.au/globalassets/x/file.pdf#page=3'));
});

test('isHorizonPowerDocument returns false for malformed input rather than throwing', () => {
  for (const bad of [null, undefined, '', 'not a url', 42]) {
    assert.equal(isHorizonPowerDocument(bad), false, `input ${JSON.stringify(bad)}`);
  }
});

test('filterDocuments keeps only HP documents and drops emptied tables and tabs', () => {
  const raw = {
    sourceUrl: 'https://example/',
    tabs: [
      {
        name: 'Manuals',
        tables: [
          {
            title: 'Interim Instructions',
            documents: [
              { title: 'good', url: 'https://www.horizonpower.com.au/globalassets/a.pdf', sizeLabel: '' },
              { title: 'folder', url: 'https://www.horizonpower.com.au/globalassets/b/', sizeLabel: '' },
            ],
          },
        ],
      },
      {
        name: 'Industry resources',
        tables: [
          {
            title: 'Useful resources',
            documents: [
              { title: 'ext', url: 'https://www.intertekinform.com/en-au/', sizeLabel: '' },
            ],
          },
        ],
      },
    ],
  };

  const out = filterDocuments(raw);
  assert.equal(out.tabs.length, 1, 'the all-external tab is dropped entirely');
  assert.equal(out.tabs[0].name, 'Manuals');
  assert.equal(out.tabs[0].tables.length, 1);
  assert.deepEqual(
    out.tabs[0].tables[0].documents.map((d) => d.title),
    ['good'],
  );
  // Input is not mutated.
  assert.equal(raw.tabs[0].tables[0].documents.length, 2);
});
