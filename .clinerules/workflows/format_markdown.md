# Workflow: Format Markdown

Format markdown files to comply with the project's markdown formatting rules.

## Purpose

- Ensure consistent markdown formatting across all project files
- Align table columns with proper padding
- Remove unnecessary blank lines
- Apply all rules defined in `specs/rules/markdown_formatting.md`

## Prerequisites

- Must be in the project root directory
- Target markdown files must exist

## Execution Steps

### 1. Identify target files

Find all markdown files to format:

```bash
find . -name '*.md' -not -path './node_modules/*' -not -path './.git/*'
```

If the user specifies a file or directory, restrict to that scope.

### 2. Check table formatting

For each file containing markdown tables, verify that pipe characters (`|`) are vertically aligned across all rows.

A table is properly formatted when:
- Each column width matches its longest cell content
- All cells are padded with trailing spaces to match
- The separator row uses dashes matching the column width
- One space of padding exists on each side of cell content

### 3. Fix table alignment

For each misaligned table:
1. Parse all rows (header, separator, data rows)
2. Compute the maximum width for each column
3. Rewrite all rows with consistent padding

**Before:**
```markdown
| Tool | Phase | Description |
|------|-------|-------------|
| `setup_new_project` | 1 | Initialize a new project |
| `run_typescript_build` | 2 | Run TypeScript compiler |
```

**After:**
```markdown
| Tool                   | Phase | Description              |
|------------------------|-------|--------------------------|
| `setup_new_project`    | 1     | Initialize a new project |
| `run_typescript_build` | 2     | Run TypeScript compiler  |
```

### 4. Check blank lines

Verify compliance with blank line rules:
- No consecutive blank lines between sections
- Exactly one blank line after headings
- Exactly one trailing blank line at end of file

### 5. Report changes

Display a summary of:
- Files checked
- Files modified (with details of what changed)
- Files already compliant

## Important Rules

- **Source of truth**: Follow all rules from `specs/rules/markdown_formatting.md`
- **Non-destructive**: Only modify formatting, never change content
- **Scope control**: When a specific file is given, only format that file
