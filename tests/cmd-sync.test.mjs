// Guard tests over the shipping Downloader .cmd (see .scratch/ship-v1/issues/01).
// Pure file reads, no network, no Windows. Run: node --test tests/cmd-sync.test.mjs
//
// The .cmd embeds a copy of the update-check logic (ADR 0002 forbids dot-sourcing
// src/ at run time) and an HP_VERSION. Both can silently drift from their source
// of truth. These tests fail loudly when they do.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const cmdPath = repoRoot + 'Download-HorizonPower-Docs.cmd';
const srcPath = repoRoot + 'src/Update-Check.ps1';

// Stable markers wrap the embedded/canonical update-check body in both files so
// extraction never depends on line numbers or surrounding code.
const BEGIN = '# >>> BEGIN EMBEDDED UPDATE-CHECK >>>';
const END = '# <<< END EMBEDDED UPDATE-CHECK <<<';

// Body between the markers, exclusive. Throws if a marker is missing so a
// mangled file fails loudly rather than comparing empty against empty.
function extractBody(text, label) {
  const start = text.indexOf(BEGIN);
  const stop = text.indexOf(END);
  assert.ok(start !== -1, `${label}: missing BEGIN marker`);
  assert.ok(stop > start, `${label}: missing or misordered END marker`);
  return text.slice(start + BEGIN.length, stop);
}

// Collapse all whitespace so CRLF-vs-LF and indentation differences between the
// two copies do not register as drift; only the actual code content matters.
function normalize(body) {
  return body.replace(/\s+/g, ' ').trim();
}

test('embedded update-check body matches src/Update-Check.ps1 (no drift)', () => {
  const cmd = readFileSync(cmdPath, 'utf8');
  const src = readFileSync(srcPath, 'utf8');

  const embedded = normalize(extractBody(cmd, 'Download-HorizonPower-Docs.cmd'));
  const canonical = normalize(extractBody(src, 'src/Update-Check.ps1'));

  assert.equal(embedded, canonical);
});

const versionPath = repoRoot + 'version.txt';

test('HP_VERSION in the .cmd equals version.txt (no false update nag)', () => {
  const cmd = readFileSync(cmdPath, 'utf8');
  const match = cmd.match(/set "HP_VERSION=([^"]+)"/);
  assert.ok(match, 'Download-HorizonPower-Docs.cmd: missing set "HP_VERSION=..." line');
  const embeddedVersion = match[1].trim();

  const fileVersion = readFileSync(versionPath, 'utf8').trim();

  assert.equal(embeddedVersion, fileVersion);
});
