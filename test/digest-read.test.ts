import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

// runs/ is read-only: other nights go in a temp dir.
function tempRuns(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}

describe('readNight', () => {
  it('reads runs/2026-10-28.jsonl into 5 jobs and 1 bad line', () => {
    const night = readNight('runs', '2026-10-28');
    expect(night).not.toBeNull();
    const { rows, badLines } = night!;
    expect(badLines).toBe(1);
    expect(rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);

    const byJob = Object.fromEntries(rows.map((r) => [r.job, r]));
    expect(byJob['fixtures/refresh']).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: null });
    expect(byJob['notes/backup']).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(byJob['digest/render']!.owner).toBeNull();
  });

  it('keeps times as written, offset included', () => {
    const lane = readNight('runs', '2026-10-28')!.rows.find((r) => r.job === 'lane/sync')!;
    expect(lane.firstAt).toBe('2026-10-28T23:00:06+01:00');
    expect(lane.lastAt).toBe('2026-10-29T05:00:04+01:00');
    expect(lane).toMatchObject({ runs: 8, retries: 1 });
  });

  it('returns null for a night with no file', () => {
    expect(readNight('runs', '1999-01-01')).toBeNull();
    expect(readNight('runs', '../package')).toBeNull();
  });

  it('gives no rows for an empty file', () => {
    const dir = tempRuns({ '2026-10-30.jsonl': '' });
    expect(readNight(dir, '2026-10-30')).toEqual({ rows: [], badLines: 0 });
  });

  it('counts a bad line instead of throwing', () => {
    const dir = tempRuns({
      '2026-10-30.jsonl': [
        '{"at":"2026-10-30T01:00:00+01:00","job":"a","status":"ok","owner":"rook"}',
        'not json',
        '{"at":"2026-10-30T02:00:00+01:00","job":"a","status":"done","owner":"rook"}',
        '',
      ].join('\n'),
    });
    const night = readNight(dir, '2026-10-30')!;
    expect(night.badLines).toBe(2);
    expect(night.rows).toEqual([
      {
        job: 'a',
        owner: 'rook',
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-30T01:00:00+01:00',
        lastAt: '2026-10-30T01:00:00+01:00',
      },
    ]);
  });
});
