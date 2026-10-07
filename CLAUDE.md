@AGENTS.md

Claude-specific:
- After each change, also give Jener a short paste-ready message for ChatGPT/Codex (same content as the AI-UPDATES.md entry).
- Use the built-in browser to check the dashboard; use the Codex plugin (`/codex:review`) for second opinions when Jener asks.

## Agent skills

### Issue tracker

Local markdown under `.scratch/<feature>/` (no remote yet; switch to GitHub after the first push). See `[DOCS]/agents/issue-tracker.md`.

### Triage labels

Default five roles: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `[DOCS]/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` at the repo root + `[DOCS]/adr/`. See `[DOCS]/agents/domain.md`.
