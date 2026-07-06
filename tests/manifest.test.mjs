// Tests for buildManifest: raw scrape object -> manifest.json shape.
// The manifest is the contract the downloader .cmd consumes (see poc/manifest.json).
// Pure, no Playwright, no network. Run: node --test tests/manifest.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildManifest } from '../scraper/manifest.mjs';

// Tracer bullet: one tab, one table, one document threads the whole path --
// raw scrape -> transforms (tab/table folders, title-derived filename) -> the
// manifest.json shape the .cmd reads. generated_at is injected for determinism.
test('buildManifest turns a single-document scrape into the manifest shape', () => {
  const raw = {
    sourceUrl: 'https://www.horizonpower.com.au/contractors-installers/manuals-standards/',
    tabs: [
      {
        name: 'Manuals',
        tables: [
          {
            title: 'Technical Rules',
            documents: [
              {
                title: 'Guidance note',
                url: 'https://www.horizonpower.com.au/globalassets/media/documents/guidance-note.pdf',
                sizeLabel: '0.09 MB',
              },
            ],
          },
        ],
      },
    ],
  };

  const manifest = buildManifest(raw, { generatedAt: '2026-07-06T00:00:00Z' });

  assert.deepEqual(manifest, {
    generated_at: '2026-07-06T00:00:00Z',
    source_url: 'https://www.horizonpower.com.au/contractors-installers/manuals-standards/',
    document_count: 1,
    tabs: [
      {
        name: 'Manuals',
        folder: 'Manuals',
        tables: [
          {
            name: 'Technical Rules',
            folder: 'Technical Rules',
            documents: [
              {
                title: 'Guidance note',
                filename: 'Guidance note.pdf',
                url: 'https://www.horizonpower.com.au/globalassets/media/documents/guidance-note.pdf',
                size_label: '0.09 MB',
              },
            ],
          },
        ],
      },
    ],
  });
});

// Two documents in one table that resolve to the same filename must be
// disambiguated within that folder: the second becomes " (2)". Different
// source URLs, same title -> same base filename -> collision.
test('buildManifest dedupes colliding filenames within a table', () => {
  const raw = {
    sourceUrl: 'https://example.test/',
    tabs: [
      {
        name: 'Manuals',
        tables: [
          {
            title: 'Standards',
            documents: [
              { title: 'Report', url: 'https://example.test/a/report.pdf', sizeLabel: '1 MB' },
              { title: 'Report', url: 'https://example.test/b/report.pdf', sizeLabel: '2 MB' },
            ],
          },
        ],
      },
    ],
  };

  const manifest = buildManifest(raw, { generatedAt: '2026-07-06T00:00:00Z' });
  const docs = manifest.tabs[0].tables[0].documents;

  assert.equal(manifest.document_count, 2);
  assert.deepEqual(
    docs.map((d) => d.filename),
    ['Report.pdf', 'Report (2).pdf'],
  );
  // Dedupe must not disturb the url/title/size mapping.
  assert.equal(docs[1].url, 'https://example.test/b/report.pdf');
  assert.equal(docs[1].title, 'Report');
});

// A table with no detectable heading (unsolved title-selector recon item) must
// not produce a null/empty name or folder: both fall back to "Uncategorised".
test('buildManifest falls back to Uncategorised for a table with no title', () => {
  const raw = {
    sourceUrl: 'https://example.test/',
    tabs: [
      {
        name: 'Manuals',
        tables: [
          {
            title: null,
            documents: [
              { title: 'Doc', url: 'https://example.test/doc.pdf', sizeLabel: '1 MB' },
            ],
          },
        ],
      },
    ],
  };

  const table = buildManifest(raw, { generatedAt: '2026-07-06T00:00:00Z' }).tabs[0].tables[0];

  assert.equal(table.name, 'Uncategorised');
  assert.equal(table.folder, 'Uncategorised');
});

// A title long enough to blow the Windows 260-char path budget must be
// truncated (extension preserved) so the full download path fits. pathReserve
// stands in for the unknown base install dir; injected so the test pins the math.
test('buildManifest truncates a filename that would overflow the path budget', () => {
  const longTitle = 'A'.repeat(300);
  const raw = {
    sourceUrl: 'https://example.test/',
    tabs: [
      {
        name: 'Manuals',
        tables: [
          {
            title: 'Standards',
            documents: [
              { title: longTitle, url: 'https://example.test/x.pdf', sizeLabel: '1 MB' },
            ],
          },
        ],
      },
    ],
  };

  const pathReserve = 80;
  const doc = buildManifest(raw, { generatedAt: '2026-07-06T00:00:00Z', pathReserve })
    .tabs[0].tables[0].documents[0];

  // Reconstruct the path the .cmd builds: base\Horizon Power Documents\tab\table\file
  const fullPathLen =
    pathReserve +
    'Horizon Power Documents\\'.length +
    'Manuals\\'.length +
    'Standards\\'.length +
    doc.filename.length;

  assert.ok(fullPathLen <= 260, `full path length ${fullPathLen} must be <= 260`);
  assert.ok(doc.filename.endsWith('.pdf'), `extension preserved: got "${doc.filename}"`);
  assert.ok(doc.filename.length < longTitle.length, 'filename was shortened');
});
