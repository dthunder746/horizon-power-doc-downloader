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
