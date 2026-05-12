# Workflow: Complete Task

Complete task workflow - validate, commit, and update kanban.

## Purpose

- Validate code quality (Biome, TypeScript, tests)
- Commit changes with Conventional Commits format
- Update KANBAN.md to remove completed task
- Regenerate CHANGELOG.md

## Prerequisites

- Code changes ready for review
- All tests should pass

## Execution Steps

### 1. Run validation

```bash
npm run validate
```

If fails, show errors and suggest `npm run qa:fix`.

### 2. Check git status

```bash
git status
```

Verify there are changes to commit.

### 3. Commit changes

Generate commit message from task description:
```bash
git add <files>
git commit -m "<type>(<scope>): <subject>"
```

Branch prefix -> Commit type:
- `feat/` -> `feat:`
- `fix/` -> `fix:`
- `refactor/` -> `refactor:`
- `perf/` -> `perf:`
- `test/` -> `test:`
- `chore/` -> `chore:`
- `docs/` -> `docs:`

### 4. Update KANBAN.md

Remove the completed task from In Progress section.
Completed tasks are tracked in git history and CHANGELOG.md only.

### 5. Regenerate CHANGELOG

```bash
npm run changelog
git add CHANGELOG.md KANBAN.md
git commit -m "chore: update kanban and changelog post-task"
```

### 6. Push to origin

```bash
git push origin <branch-name>
```

### 7. Display completion summary

Show:
- What was committed
- What was updated in KANBAN.md
- Next steps (create PR if needed)

## Important Rules

- **Validate first**: Always run validation
- **Conventional Commits**: Use proper commit format
- **Update KANBAN.md**: Remove completed task
- **Regenerate CHANGELOG**: Always use `npm run changelog`