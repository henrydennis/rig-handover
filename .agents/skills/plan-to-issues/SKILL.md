---
name: plan-to-issues
description: Split this repo's plan.md into GitHub issues with gh, one per unit of work, after a human has reviewed the split. Use when a plan is ready and has no issues yet.
---

# plan-to-issues

Turns `plan.md` into GitHub issues that workers can pick up cold. Easiest with `gh`, authenticated,
in a shell this agent can run.

## Steps

1. Read `plan.md`, `AGENTS.md` and `docs/adr/`.
2. Draft the split as a table: title · plan section · scope · done when · blocked by.
   One issue per unit of work.
3. **Stop and show the table to the human.** Publish nothing until they approve it.
4. Ask the human what every issue here must carry (fields, labels, wording), unless it is
   already written down in this session or in the repo. It is: see [What every issue
   carries](#what-every-issue-carries). If the human changes it, change that section too.
5. Create each issue in dependency order, so blocked-by can cite real numbers:

   ```sh
   gh issue create --title "<title>" --body-file <tmp.md>
   ```

6. Record every issue URL from gh's output (not from memory) and reply with the list.

Closing one, with the closing comment from AGENTS.md:

```sh
gh issue close <n> -c "<closing comment>"
```

## What every issue carries

Decided by Henry Dennis, 29 October 2026, for the morning-digest plan.

```md
Source: plan.md § <n>

## Scope

<what to build, from that section; the rules from docs/ that apply>

## Done when

<the plan's "Done when", word for word>

## Blocked by

<#n, or —; say when only part of #n is needed, e.g. "#1 (only its types commit)">

## Suggested worker

<strongest model for logic, a cheaper one for views and tests (AGENTS.md), and why>
```

- The first line is always `Source: plan.md § <n>`, and every issue is labelled
  `plan:<plan name>` (e.g. `plan:morning-digest`; create the label if it's missing). That's how
  the reviewer sorts them.
- A "Done when" that waits on someone else (a reviewer looking, a reply) holds when they have done
  it, not when you sent it. Keep that issue open and say what it waits on.

## No `gh`

Steps 1–4 hold either way. GitHub reachable another way (a connector, the REST API, the web UI):
the same issues, made that way. GitHub issues out of reach altogether: write them as files in
`docs/issues/`, format in ADR 0004, then commit and push.

## Don'ts

- Don't paste the whole plan into one issue, and don't keep issues only in chat.
- Don't invent sections the plan doesn't have. If the plan is unclear, ask.
