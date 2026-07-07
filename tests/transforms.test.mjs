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
  isSourcePageLink,
  classifyDocuments,
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

test('isSourcePageLink matches the scraped page itself, ignoring fragment and trailing slash', () => {
  const src = 'https://www.horizonpower.com.au/contractors-installers/manuals-standards/';
  assert.ok(isSourcePageLink('https://www.horizonpower.com.au/contractors-installers/manuals-standards/', src));
  assert.ok(isSourcePageLink('https://www.horizonpower.com.au/contractors-installers/manuals-standards/#metering', src));
  assert.ok(isSourcePageLink('https://www.horizonpower.com.au/contractors-installers/manuals-standards', src));
  // A different page or an actual document is not a self-link.
  assert.equal(isSourcePageLink('https://www.horizonpower.com.au/globalassets/x.pdf', src), false);
  assert.equal(isSourcePageLink('https://www.intertekinform.com/en-au/', src), false);
});

test('isSourcePageLink returns false for malformed input rather than throwing', () => {
  assert.equal(isSourcePageLink(null, 'https://x/'), false);
  assert.equal(isSourcePageLink('https://x/', undefined), false);
});

test('classifyDocuments tags HP files as documents, other refs as shortcuts, and drops self-links', () => {
  const raw = {
    sourceUrl: 'https://www.horizonpower.com.au/contractors-installers/manuals-standards/',
    tabs: [
      {
        name: 'Manuals',
        tables: [
          {
            title: 'Interim Instructions',
            documents: [
              { title: 'hp file', url: 'https://www.horizonpower.com.au/globalassets/a.pdf', sizeLabel: '' },
              { title: 'browser only', url: 'https://www.horizonpower.com.au/globalassets/b/', sizeLabel: '' },
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
              { title: 'external', url: 'https://www.intertekinform.com/en-au/', sizeLabel: '' },
              { title: 'self link', url: 'https://www.horizonpower.com.au/contractors-installers/manuals-standards/', sizeLabel: '' },
              { title: 'anchor', url: 'https://www.horizonpower.com.au/contractors-installers/manuals-standards/#metering', sizeLabel: '' },
            ],
          },
        ],
      },
    ],
  };

  const out = classifyDocuments(raw);

  // Manuals: the HP file is a document; the folder-style HP URL becomes a shortcut.
  assert.deepEqual(
    out.tabs[0].tables[0].documents.map((d) => [d.title, d.type]),
    [['hp file', 'document'], ['browser only', 'shortcut']],
  );
  // Industry resources: only the external link survives, as a shortcut; the two
  // self-referential entries are dropped entirely.
  assert.deepEqual(
    out.tabs[1].tables[0].documents.map((d) => [d.title, d.type]),
    [['external', 'shortcut']],
  );
  // Input is not mutated.
  assert.equal(raw.tabs[1].tables[0].documents.length, 3);
});

test('classifyDocuments drops tables and tabs left empty after removing self-links', () => {
  const raw = {
    sourceUrl: 'https://src/page/',
    tabs: [
      {
        name: 'Only self-links',
        tables: [
          {
            title: 'T',
            documents: [{ title: 's', url: 'https://src/page/#x', sizeLabel: '' }],
          },
        ],
      },
    ],
  };
  const out = classifyDocuments(raw);
  assert.equal(out.tabs.length, 0);
});
