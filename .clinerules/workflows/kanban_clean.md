# Workflow: Kanban Cleanup

## Objective

This workflow allows manual cleanup of obsolete entries in the `KANBAN.md` file. It identifies entries eligible for cleanup and requests confirmation before deletion.

## Format rules

See `specs/rules/task_format.md` for detailed format rules.

Summary:
- `- [ ]` -> task to do
- `- [x]` -> checked task (completed)

## Execution instructions

### 1. Read KANBAN.md

Use the `read_file` tool to read the content of the `KANBAN.md` file at the project root.

### 2. Analyze entries eligible for cleanup

Identify entries in the "## In Progress" section that can be cleaned up:

#### In Progress inactive for > 30 days

- Tasks that have been in progress for more than 30 days
- Abandoned tasks (identifiable by comment or context)

### 3. Present eligible entries to user

Display the list of entries eligible for cleanup. Ask the user:
- Which entries they want to delete
- If they prefer to move them back to Backlog

### 4. Delete or move selected entries

For each selected entry:

#### 4a. Delete isolated task

Use `replace_in_file` to delete the task line.

#### 4b. Move back to Backlog

Use `replace_in_file` to remove from In Progress and add to Backlog with appropriate priority.

### 5. Execution report

Inform the user:
- Of deleted or moved entries
- Of modified sections in KANBAN.md

## Important rules

- This workflow is **manual**: it must be explicitly requested by the user
- **Always request confirmation** before deleting entries
- Never delete entries without explicit user validation
