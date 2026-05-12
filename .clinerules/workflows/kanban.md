# Workflow: Kanban

Manage KANBAN.md - read to extract tasks/ideas, update to modify statuses.

## Purpose

Unified workflow to read and update KANBAN.md file.

## Usage

```
kanban read   - Parse and display KANBAN.md summary
kanban update - Modify task statuses, add/remove tasks
```

## Action: read

### Execution

1. Read KANBAN.md file
2. Parse sections: Backlog, In Progress
3. Generate structured summary

### Output Format

```
KANBAN Summary
==============

Backlog (N ideas):
- [CATEGORY] Description (Priority)

In Progress (N tasks):
- [TAG] Description
```

## Action: update

### Operations

**Mark task completed:**
```markdown
Before: - [ ] **[TAG]** Description
After:  - [x] **[TAG]** Description
```

**Move from Backlog to In Progress:**
Remove from Backlog, add to In Progress with proper tag format.

**Add new task:**
Insert in appropriate section with proper formatting.

## Important Rules

- After completing a task, remove it from In Progress
- Completed tasks are tracked in git history and CHANGELOG.md only
- Use `replace_in_file` for all modifications
- KANBAN.md should be committed with each significant change

## Format Reference

See `specs/rules/task_format.md` for complete format definitions.

Common tags: `[FEAT]`, `[FIX]`, `[REFACTOR]`, `[PERF]`, `[DOCS]`, `[STYLE]`, `[TEST]`, `[CHORE]`
