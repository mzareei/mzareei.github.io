# Multi-Machine Workflow

This site is developed across two machines (office PC and home PC) using the same
account. **Local files do not sync automatically between machines.** GitHub is the
single source of truth. Follow this routine to keep both machines consistent.

## Golden rule

**Pull before you start. Push before you stop.**

## When you sit down at a machine (start of session)

```bash
git pull
```

Bring the local folder up to date with whatever was pushed from the other machine
*before* making any edits. Skipping this is the main cause of merge conflicts.

## While working

Make and save your changes locally as usual.

## Before you leave a machine (end of session)

```bash
git add -A
git commit -m "Describe what changed"
git push
```

## Re-contextualizing the assistant after switching machines

Even when chat history carries over, the AI should work from the *actual files on the
current machine*, not its memory of the last session. When you switch machines, point
it at the project folder and ask it to re-read the current state before making changes.
Project instructions and memory files carry over, but the live files are the source of
truth.

## If you get a merge conflict

This happens if both machines were edited without pulling first. Git will mark the
conflicting files. Open each one, resolve the conflicting sections (keep the correct
version), then:

```bash
git add -A
git commit
git push
```

Not catastrophic — just friction worth avoiding by always pulling first.

## What does NOT sync automatically

- Local file contents in the workspace folder (each machine has its own copy)
- Uncommitted / unpushed changes
- Anything not committed to Git

## What carries over via your account

- Conversation history
- Project instructions and memory files
