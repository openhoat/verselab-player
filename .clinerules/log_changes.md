# Log Changes

## Objective

Ensures all project changes are tracked in `/CHANGELOG.md`.

## CHANGELOG.md Generation

**IMPORTANT**: `CHANGELOG.md` is **ALWAYS auto-generated** using `npm run changelog`. It is **NEVER edited manually** by the AI assistant.

## When to regenerate

The `CHANGELOG.md` is regenerated **ONLY on the `main` branch** after completing a task.

**Workflow:**
1. **Feature branches**: Do NOT generate or modify `CHANGELOG.md`
2. **After task completion**: On `main`, run `npm run changelog` to regenerate from git history
3. **Commit to main**: Include the regenerated `CHANGELOG.md` in the maintenance commit

## Commands

```bash
# Regenerate CHANGELOG.md from git commit history
npm run changelog

# Commit the updated changelog
git add CHANGELOG.md
git commit -m "chore(release): update changelog"
```

## Format

See `specs/rules/task_format.md` for complete tag/emoji definitions.

The changelog generator automatically creates entries with format:
`**[HH:MM:SS] Emoji [TAG]** Description`

Common tags: `✨ [FEAT]`, `🐛 [FIX]`, `♻️ [REFACTOR]`, `⚡ [PERF]`, `📝 [DOCS]`, `🎨 [STYLE]`, `✅ [TEST]`, `🔧 [CHORE]`

## Important Rules

- **DO NOT manually edit CHANGELOG.md** - always use `npm run changelog`
- **Only regenerate on main branch** after task completion
- **Never generate in feature branches**
- The changelog is derived from git commit messages, so use proper Conventional Commits format
