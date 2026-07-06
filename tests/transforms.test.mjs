// Tests for the pure scraper transforms (no Playwright, no network).
// Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizeName,
  truncateFilename,
  dedupeNames,
  tableFolderName,
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
