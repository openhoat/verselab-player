# Workflow: Start Task

Start a Kanban task by selecting an idea from the backlog and updating KANBAN.md.

## Purpose

- Select task from KANBAN.md backlog
- Update KANBAN.md to move task to In Progress
- Create a git branch for the task
- Prepare for feature implementation

## Prerequisites

- Must be in the project root directory
- KANBAN.md must exist at project root
- Backlog must have at least one idea

## Execution Steps

### 1. Read KANBAN.md

Parse ideas from "## Backlog" section.

### 2. Display backlog ideas

Show numbered list of ideas with format:
```
#1 [ARCHITECTURE] Description (P2)
#2 [UX] Description (P3)
```

Ask user to select an idea number.

### 3. Update KANBAN.md

Move idea from Backlog to In Progress:
- Remove line from Backlog
- Add task to In Progress with appropriate tag (FEAT/FIX/etc.)
- Format: `- [ ] **[TAG]** Description`

Use `replace_in_file` to update.

### 4. Create branch

```bash
git checkout -b <branch-name>
```

Branch name format: `<type>/<short-description>`
- Category -> branch prefix (feat/, fix/, refactor/, test/, chore/)
- Description -> kebab-case name

### 5. Inform user

Display success message with:
- The task that was moved to In Progress
- The branch that was created
- Next steps for implementation

## Important Rules

- **KANBAN.md updates**: Update KANBAN.md locally and commit with the branch
- **One task per branch**: Each branch = one task
- **Conventional branch names**: Use proper prefix (feat/, fix/, etc.)