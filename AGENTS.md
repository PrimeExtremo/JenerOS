# AGENTS.md — rules for any AI working on JenerOS

Applies to Claude, ChatGPT, Codex and any other agent.

## Start here
1. Read [handoff.md](handoff.md) — goal, current state, decisions, next steps.
2. Read the task list for the current phase: [PHASE-1.md](%5BDOCS%5D/PHASE-1.md).
3. Read the newest entries at the bottom of [AI-UPDATES.md](%5BDOCS%5D/AI-UPDATES.md).
4. Issues/tasks live in `.scratch/<feature>/` (local markdown); see `[DOCS]/agents/` for the issue-tracker, triage-label and domain-doc conventions.

## When you finish a change
- Append an entry to the bottom of `[DOCS]/AI-UPDATES.md`:
  date, who (Claude/Codex/ChatGPT), what changed (files), why, what's untested, what the other AI should check.
- Tick boxes in `[DOCS]/PHASE-1.md` only when the "done" check actually passed.
- Update `handoff.md` §3 and §6 if the state or next steps changed.

## Don't
- Don't commit or push unless Jener asks.
- Don't run admin/system-level commands, purchases, sign-ups or installs on Jener's PC. Write the command and explain it; Jener runs it.
- Don't put VM disks, ISOs or large build output on `C:`. Use `S:\[VMs]\...`.
- Don't use the "Arvey" name or AV logo. The brand is JENER / JenerOS / Jener, Inc.
- Don't reopen decisions in `handoff.md` §4 without asking Jener.
- Don't add dependencies to `jenerd` without a reason written in AI-UPDATES.md (stdlib-only so far).

## Conventions
- Paths on Jener's drives use `[BRACKET]` folder names. PowerShell: `-LiteralPath`. Bash: quote paths.
- Shell scripts, systemd units and anything under `[OS]/` use LF line endings (`.gitattributes` enforces it).
- Go: `gofmt`, small packages under `[CORE]/internal/`, errors returned not logged-and-ignored.
- Docs: plain words, short sentences, tables over walls of text. Jener is not a full-time developer.
- Write user-facing text in Jener's brand voice: friendly, direct, no jargon on the dashboard.

## Build / run
| What | Command | Where |
|---|---|---|
| Dashboard preview (sample data) | open `[DASHBOARD]/index.html` via any static server | Windows |
| jenerd locally | `cd [CORE] && go run ./cmd/jenerd` → http://localhost:8080 | Build VM / Linux |
| First-time build setup | `./[OS]/setup-build-vm.sh` | Build VM (`ssh jeneros-build`) |
| Build OS image + VMware disk | `./[OS]/build.sh` | Build VM |
| Boot it | open `S:\[VMs]\[JENEROS]\jeneros.vmx` in VMware Workstation | Windows |
