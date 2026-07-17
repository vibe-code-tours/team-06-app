---
description: Triage one or more GitHub issues — root-cause analysis, priority, and mapping onto the project's wave/plan structure. Usage: /triage-issue <issue-number> [<issue-number> ...] or /triage-issue --all-open
---

You are running the issue triage workflow for this repo. Do not write or push any
fix as part of this command — triage output only.

## Steps

1. Resolve the target issue(s):
   - If given number(s): use them directly.
   - If given `--all-open`: run `gh issue list --state open --limit 50 --json number,title,labels,createdAt`
     and triage each one that doesn't already have a `triaged` label.

2. For each issue, delegate to the `issue-triage` subagent (`.claude/agents/issue-triage.md`)
   with the issue number. Let it read the issue, check `gh issue view <n> --comments`,
   and produce the structured triage block defined in that subagent's output format.

3. After each subagent result comes back:
   - If `Escalate to: security-auditor` — note it, do not attempt the security
     analysis yourself in this command.
   - If `Escalate to: supabase-schema-architect` — same, just note it.
   - If `ROOT_CAUSE: insufficient evidence` — draft a short comment (do not post yet)
     asking the reporter for the specific missing repro info, and hold the ticket
     as `needs-info` instead of assigning it a plan file.

4. Collect all triage blocks into a single markdown summary, grouped by priority
   (P0 first). For each P0/P1 item, explicitly call out whether it sits on the
   critical path given the max-2-to-3-parallel-developer pipeline reality — i.e.
   whether fixing it blocks a currently in-progress wave.

5. Present the summary to me and stop. Ask which of the following I want next,
   do not do any of them automatically:
   - Apply the suggested labels via `gh issue edit <n> --add-label ...`
   - Create tickets for new (non-duplicate, non-question) items in the existing
     ticket format (Board Title / Plan file / Depends on / Scope / Tasks checklist /
     Acceptance criteria / Labels)
   - Post the "needs more info" comment drafts to the relevant issues
   - Hand off specific issues to `security-auditor` or `supabase-schema-architect`

## Notes

- Never post issue comments or apply labels without explicit confirmation in step 5 —
  triage is read-only until approved.
- If `gh` isn't authenticated or the repo remote isn't configured, say so plainly
  and stop rather than guessing at issue content.
- Bug fixes discovered during triage that clearly belong inside an existing feature
  plan should be noted as "fold into <plan file>" per this project's existing
  convention of folding bug fixes into relevant feature plans rather than tracking
  them separately.
