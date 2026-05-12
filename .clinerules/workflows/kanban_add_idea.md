# Workflow: Add Idea to Kanban Backlog

## Objective

This workflow allows interactive addition of feature ideas to the "Backlog" section of the `KANBAN.md` file.

## Format rules

See `specs/rules/task_format.md` for detailed format rules.

Summary:
- `- [ ]` -> idea to do
- Idea format: `- [ ] **[CATEGORY]** Description (Priority)`
- Priority: `P1`, `P2`, `P3`
- Category icons: `[SECURITY]`, `[TEST]`, `[PERFORMANCE]`, `[ARCHITECTURE]`, `[UX]`, `[DEVOPS]`, `[DEPENDENCIES]`, `[CONFIG]`

## Execution instructions

### 1. Read KANBAN.md

Use the `read_file` tool to read the content of the `KANBAN.md` file at the project root.

### 2. Ask user for idea description

Use the `ask_followup_question` tool to request the description of the idea to add.

**Question format:**
```
What idea would you like to add to the backlog?
```

### 3. Ask user for priority

**Question format:**
```
What is the priority of this idea?
- P1: High Priority (critical, security, blocking issues)
- P2: Medium Priority (important improvements)
- P3: Low Priority (nice to have, enhancements)
```

### 4. Ask user for category

**Question format:**
```
What category does this idea belong to?
- [SECURITY]: Security improvements
- [TEST]: Testing improvements
- [PERFORMANCE]: Performance optimizations
- [ARCHITECTURE]: Code architecture improvements
- [UX]: User experience improvements
- [DEVOPS]: DevOps improvements
- [DEPENDENCIES]: Dependency updates
- [CONFIG]: Configuration improvements
```

### 5. Add idea to Backlog

Use `replace_in_file` to add the idea to the appropriate priority subsection within "## Backlog".

#### Priority sections

The KANBAN.md Backlog has three subsections:
- `<!-- High Priority -->`
- `<!-- Medium Priority -->`
- `<!-- Low Priority -->`

Add the idea after the appropriate priority comment.

### 6. Confirm addition

Inform the user that the idea has been successfully added to the backlog.

## Important rules

- Always ask the user for the description, priority, and category
- Use the exact description provided by the user without modification
- New ideas should be added at the appropriate priority section
