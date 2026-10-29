import { readEntries } from './read.js';
import type { RunStatus } from './types.js';

// Runs (log lines) by status for one night, for the board. badLines as in `Night`.
export type NightCounts = Record<RunStatus, number> & { badLines: number };

export function nightCounts(runsDir: string, night: string): NightCounts {
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0, badLines: 0 };
  const read = readEntries(runsDir, night);
  if (!read) return counts;
  for (const entry of read.entries) counts[entry.status]++;
  counts.badLines = read.badLines;
  return counts;
}
