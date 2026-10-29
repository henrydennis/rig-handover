import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, ReadNight, RunStatus } from './types.js';

type Entry = { at: string; job: string; status: RunStatus; owner: string | null; error: string | null };

const STATUSES: readonly string[] = ['ok', 'retry', 'fail'] satisfies RunStatus[];

// Only runs/<YYYY-MM-DD>.jsonl is a night; anything else (a typo, a path) has no file.
const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

function isStatus(s: unknown): s is RunStatus {
  return typeof s === 'string' && STATUSES.includes(s);
}

// One line of the log, or null when it isn't valid JSON or isn't a valid entry.
function parseLine(line: string): Entry | null {
  let v: unknown;
  try {
    v = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.at !== 'string' || Number.isNaN(Date.parse(o.at))) return null;
  if (typeof o.job !== 'string' || o.job === '') return null;
  if (!isStatus(o.status)) return null;
  if (typeof o.owner !== 'string' && o.owner !== null) return null;
  if (o.error !== undefined && typeof o.error !== 'string') return null;
  return { at: o.at, job: o.job, status: o.status, owner: o.owner, error: o.error ?? null };
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!NIGHT.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }

  const byJob = new Map<string, DigestRow>();
  let badLines = 0;
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const entry = parseLine(line);
    if (!entry) {
      badLines++;
      continue;
    }
    const row = byJob.get(entry.job);
    // File order is the order of record: the latest line sets owner, status, error and time.
    byJob.set(entry.job, {
      job: entry.job,
      owner: entry.owner,
      runs: (row?.runs ?? 0) + 1,
      retries: (row?.retries ?? 0) + (entry.status === 'retry' ? 1 : 0),
      lastStatus: entry.status,
      lastError: entry.error,
      firstAt: row?.firstAt ?? entry.at,
      lastAt: entry.at,
    });
  }

  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { rows, badLines } satisfies Night;
};
