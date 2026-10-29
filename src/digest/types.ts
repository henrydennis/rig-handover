// Plan morning-digest § 1. The shape every part of the digest (page, JSON, board link) builds on.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One job's night. Times are as written in the log, offset included; never converted to UTC.
// Missing data stays null here; views render it as `—`.
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number; // lines for this job
  retries: number; // lines with status `retry`
  lastStatus: RunStatus; // from the job's latest line, by file order
  lastError: string | null; // from the job's latest line; null when it has none
  firstAt: string;
  lastAt: string;
};

// A night that has a file. Rows sorted by job; badLines counts lines that didn't parse.
export type Night = {
  rows: DigestRow[];
  badLines: number;
};

// null: no file for that night (the page 404s). An empty file is a Night with no rows.
export type ReadNight = (runsDir: string, night: string) => Night | null;
