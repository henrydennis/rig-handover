import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestRow } from '../src/digest/types.js';

type DigestJson = { night: string; badLines: number; rows: DigestRow[] };
type PageRow = { warn: boolean; job: string; text: string };

const JOBS_2026_10_28 = ['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs'];

let runsDir: string;
let app: ReturnType<typeof createApp>;

// runs/ is read-only: the fixture night is copied, the other nights are written, all in a temp dir.
beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
  copyFileSync('runs/2026-10-28.jsonl', join(runsDir, '2026-10-28.jsonl'));
  writeFileSync(join(runsDir, '2026-10-30.jsonl'), '');
  writeFileSync(
    join(runsDir, '2026-10-31.jsonl'),
    '{"at":"2026-10-31T23:00:00+01:00","job":"a/job","status":"ok","owner":null}\nnot json\n',
  );
  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

function decode(html: string): string {
  return html
    .replaceAll('&#39;', "'")
    .replaceAll('&apos;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

// The table's body rows: job from the first cell, whether the row is `<tr class="warn">`.
function pageRows(html: string): PageRow[] {
  const rows: PageRow[] = [];
  for (const m of html.matchAll(/<tr([^>]*)>([\s\S]*?)<\/tr>/g)) {
    const cell = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/.exec(m[2] ?? '');
    const job = decode((cell?.[1] ?? '').replace(/<[^>]*>/g, '')).trim();
    if (!/^[\w.-]+\/[\w.-]+$/.test(job)) continue; // header row, anything that isn't a job
    rows.push({ warn: /class="warn"/.test(m[1] ?? ''), job, text: decode((m[2] ?? '').replace(/<[^>]*>/g, ' ')) });
  }
  return rows;
}

async function page(night: string) {
  const res = await app.request(`/digest/${night}`);
  return { res, html: decode(await res.text()) };
}

async function json(night: string) {
  const res = await app.request(`/api/digest/${night}`);
  return { res, body: (await res.json()) as unknown };
}

describe('GET /digest/:night', () => {
  it('renders 2026-10-28 with its 5 jobs in order', async () => {
    const { res, html } = await page('2026-10-28');
    expect(res.status).toBe(200);
    expect(html).toContain('digest · 2026-10-28');
    expect(pageRows(html).map((r) => r.job)).toEqual(JOBS_2026_10_28);
  });

  it('marks 3 retries and a fail as warn rows', async () => {
    const rows = pageRows((await page('2026-10-28')).html);
    const warn = rows.filter((r) => r.warn).map((r) => r.job);
    expect(warn).toEqual(['fixtures/refresh', 'notes/backup']);
  });

  it('shows a missing owner as —', async () => {
    const rows = pageRows((await page('2026-10-28')).html);
    expect(rows.find((r) => r.job === 'digest/render')!.text).toContain('—');
  });

  it('says nothing ran for an empty night', async () => {
    const { res, html } = await page('2026-10-30');
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
  });

  it('renders a night with a bad line and counts it', async () => {
    const { res, html } = await page('2026-10-31');
    expect(res.status).toBe(200);
    expect(html).toContain('a/job');
    expect(html).toContain("1 line didn't parse");
  });

  it('404s a night with no file', async () => {
    const { res, html } = await page('2026-11-01');
    expect(res.status).toBe(404);
    expect(html).toContain('no run log for 2026-11-01');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns 2026-10-28 as { night, badLines, rows }', async () => {
    const { res, body } = await json('2026-10-28');
    const digest = body as DigestJson;
    expect(res.status).toBe(200);
    expect(digest.night).toBe('2026-10-28');
    expect(digest.badLines).toBe(1);
    expect(digest.rows.map((r) => r.job)).toEqual(JOBS_2026_10_28);
  });

  it('returns no rows for an empty night', async () => {
    const { res, body } = await json('2026-10-30');
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ night: '2026-10-30', badLines: 0, rows: [] });
  });

  it('counts a bad line and keeps a null owner', async () => {
    const { res, body } = await json('2026-10-31');
    const digest = body as DigestJson;
    expect(res.status).toBe(200);
    expect(digest.badLines).toBe(1);
    expect(digest.rows).toHaveLength(1);
    expect(digest.rows[0]).toMatchObject({ job: 'a/job', owner: null });
  });

  it('404s a night with no file', async () => {
    const { res, body } = await json('2026-11-01');
    expect(res.status).toBe(404);
    expect(body).toEqual({ error: 'no run log', night: '2026-11-01' });
  });
});

describe('page and JSON', () => {
  it('list the same jobs in the same order for 2026-10-28 (ADR 0001)', async () => {
    const fromPage = pageRows((await page('2026-10-28')).html).map((r) => r.job);
    const fromJson = ((await json('2026-10-28')).body as DigestJson).rows.map((r) => r.job);
    expect(fromPage.length).toBeGreaterThan(0);
    expect(fromPage).toEqual(fromJson);
  });
});
