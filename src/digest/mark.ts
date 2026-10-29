import type { DigestRow } from './types.js';

// Plan morning-digest § 2a: a job is marked when it retried 3 or more times or its last run failed.
export function isMarked(row: DigestRow): boolean {
  return row.retries >= 3 || row.lastStatus === 'fail';
}
