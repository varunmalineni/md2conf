import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Fixture manifest and dialect page (ADR 0003 §3). Upstream's golden fixtures are copied
 * verbatim into `tests/source` and `tests/target`; `tests/manifest.json` says what this
 * project owes for each of them, and `docs/dialect.md` carries a row for every permanent
 * difference.
 */

type FixtureStatus = 'match' | 'override' | 'pending';

interface FixtureEntry {
  readonly source: string;
  readonly target: string;
  readonly status: FixtureStatus;
  readonly reason?: string;
}

const testsDir = new URL('./', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', testsDir), 'utf8')) as Record<
  string,
  FixtureEntry
>;

const statuses: readonly FixtureStatus[] = ['match', 'override', 'pending'];

/**
 * Fixture files upstream's own `.gitignore` files leave out of the repository because the
 * test run writes them. Only plain file names are honoured; the glob patterns there cover
 * generated attachments, which no manifest entry names.
 */
function generatedFixtures(folder: 'source' | 'target'): ReadonlySet<string> {
  const ignoreFile = readFileSync(new URL(`${folder}/.gitignore`, testsDir), 'utf8');
  return new Set(
    ignoreFile
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('/'))
      .map((line) => line.slice(1)),
  );
}

function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function goldenFixtures(folder: 'source' | 'target', extension: string): string[] {
  const generated = generatedFixtures(folder);
  return readdirSync(new URL(`${folder}/`, testsDir), {
    recursive: true,
    encoding: 'utf8',
  })
    .filter((name) => name.endsWith(extension))
    .map((name) => name.slice(0, -extension.length))
    .filter((name) => !generated.has(baseName(name)))
    .sort();
}

/** Fixture names named in the `Fixture` column of every table in the dialect page. */
function dialectFixtures(): readonly string[] {
  const lines = readFileSync(new URL('../docs/dialect.md', import.meta.url), 'utf8').split('\n');
  const cells: string[] = [];
  let column: number | undefined;
  for (const line of lines) {
    if (!line.startsWith('|')) {
      column = undefined;
      continue;
    }
    const row = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (row.every((cell) => cell !== '' && /^-+$/.test(cell))) {
      continue;
    }
    column ??= row.indexOf('Fixture');
    const fixture = row[column];
    if (fixture !== undefined) {
      cells.push(fixture);
    }
  }
  return cells;
}

describe('fixture manifest', () => {
  it('lists every upstream golden fixture', () => {
    const generatedTargets = generatedFixtures('target');
    const listed = Object.entries(manifest)
      .filter(([, entry]) => !generatedTargets.has(baseName(entry.target)))
      .map(([name]) => name)
      .sort();
    expect(goldenFixtures('target', '.xml')).toEqual(listed);
  });

  it('points every entry at fixtures that exist', () => {
    const generatedSources = generatedFixtures('source');
    const generatedTargets = generatedFixtures('target');
    const missing: string[] = [];
    for (const [name, entry] of Object.entries(manifest)) {
      if (
        !generatedSources.has(baseName(entry.source)) &&
        !existsSync(new URL(entry.source, testsDir))
      ) {
        missing.push(`${name}: ${entry.source}`);
      }
      if (
        !generatedTargets.has(baseName(entry.target)) &&
        !existsSync(new URL(entry.target, testsDir))
      ) {
        missing.push(`${name}: ${entry.target}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('names the issue a pending fixture waits for', () => {
    const unexplained: string[] = [];
    for (const [name, entry] of Object.entries(manifest)) {
      if (!statuses.includes(entry.status)) {
        unexplained.push(`${name}: unknown status ${entry.status}`);
      }
      if (entry.status === 'pending' && entry.reason === undefined) {
        unexplained.push(`${name}: pending without a reason`);
      }
      if (entry.status !== 'pending' && entry.reason !== undefined) {
        unexplained.push(`${name}: ${entry.status} with a reason`);
      }
    }
    expect(unexplained).toEqual([]);
  });

  it('records a dialect row for every override', () => {
    const recorded = dialectFixtures();
    const undocumented: string[] = [];
    for (const [name, entry] of Object.entries(manifest)) {
      if (entry.status !== 'override') {
        continue;
      }
      if (!recorded.some((cell) => cell.includes(name))) {
        undocumented.push(name);
      }
    }
    expect(undocumented).toEqual([]);
  });
});
