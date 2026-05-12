# Workflow: Commit Changes from CHANGELOG.md

## Objective

This workflow automates Git commit creation using entries from `CHANGELOG.md` as the source for commit messages.

## Execution Instructions

### 1. Analyze Git Status

Execute `git status` to identify:
- Modified files (modified: ...)
- New files (untracked files: ...)
- Deleted files (deleted: ...)

### 2. Read CHANGELOG.md

Use `read_file` to read the content of `CHANGELOG.md`.

### 3. Analyze and Extract Change Entries

Identify all change entries in the format:
```
**[HH:MM:SS] Emoji [TAG]** Description
```

Extract for each entry:
- The tag (e.g., [FEAT], [FIX], [REFACTOR], etc.)
- The emoji
- The main description

### 4. Determine Files to Include for Each Entry

For each CHANGELOG entry, analyze details to identify mentioned files:
- Look for file names in descriptions
- Associate modified/untracked files from `git status` with corresponding entries

### 5. Generate Commit Message

For each entry, create a commit message in conventional format:

**Format:**
```
<type>: <description>
```

**Examples:**
```
feat: add user authentication module
fix: resolve connection error in API handler
docs: update README with installation instructions
```

### 6. Execute Commits

For each identified entry:

#### 6.1. Stage Related Files
```bash
git add file1 file2 file3 ...
```

#### 6.2. Create Commit with Generated Message
```bash
git commit -m "type: description"
```

#### 6.3. Verify Commit
Execute `git log -1` to confirm the commit was created correctly.

### 7. Execution Report

Once all commits are created:
- Inform the user of the number of commits created
- Summarize commits with their hash and message
- Confirm there are no uncommitted changes (verify with `git status`)

## Important Rules

- **Always include CHANGELOG.md** in each commit (as it contains the corresponding entry)
- **One commit per CHANGELOG entry**, no grouped commits
- **Preserve order** of entries (from most recent to oldest)
- **Do not modify** the message automatically generated from CHANGELOG
- **Handle errors**: if a commit fails, inform the user and continue with remaining entries

## Edge Cases

### Modified Files Not Documented in CHANGELOG.md

If git status shows modified files that don't correspond to any CHANGELOG entry:
1. Inform the user about these orphan files
2. Ask the user if they want to:
   - Create a CHANGELOG entry for these files
   - Include them in the most relevant existing commit
   - Leave them uncommitted

### Deleted Files

For deleted files mentioned in CHANGELOG:
- Use `git add deleted_file` to stage the deletion
- The commit will automatically include the file deletion