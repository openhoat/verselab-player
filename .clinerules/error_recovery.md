# Error Recovery

## Objective

This rule defines workflows for recovering from errors during task execution.

## Error Scenarios and Recovery

### 1. Validation Failures

#### Biome Linting Errors

**Recovery**:
```bash
# Auto-fix what's possible
npm run qa:fix

# Re-run validation
npm run validate

# Fix remaining issues manually
```

#### TypeScript Errors

**Recovery**:
1. Read error messages carefully
2. Fix type mismatches
3. Add missing type declarations
4. Run `npm run validate` again

#### Test Failures

**Recovery**:
```bash
# Run tests with details
npm run test

# Fix failing tests
# Re-run validation
npm run validate
```

### 2. Commit Failures

#### Pre-commit Hook Failure

**Symptom**: Git commit fails due to pre-commit hooks

**Recovery Steps**:
1. Check the error output from the hook
2. Fix linting or formatting issues: `npm run qa:fix`
3. Re-stage the files: `git add <files>`
4. Retry the commit

#### Commitlint Validation Failure

**Symptom**: Commit message doesn't follow conventional commits format

**Recovery Steps**:
1. Rewrite the commit message following the format: `<type>(<scope>): <subject>`
2. Valid types: feat, fix, docs, style, refactor, perf, test, chore, revert, deps, ci
3. Retry the commit with the corrected message

### 3. Git Issues

#### Merge Conflicts During Rebase

**Recovery Steps**:
1. List conflicted files: `git status`
2. Edit each conflicted file
3. Stage resolved files: `git add <file>`
4. Continue rebase: `git rebase --continue`
5. Abort if needed: `git rebase --abort`

#### Merge Conflicts During Pull

**Recovery Steps**:
1. Resolve conflicts in each file
2. Stage: `git add <file>`
3. Commit: `git commit`
4. Continue with push

### 4. Dependency Issues

#### npm install Failures

**Recovery Steps**:
1. Clear npm cache: `npm cache clean --force`
2. Remove node_modules: `rm -rf node_modules`
3. Reinstall: `npm install`

#### Version Conflicts

**Recovery Steps**:
1. Check `package.json` for version mismatches
2. Update dependencies: `npm update`
3. Run `npm run validate` to check everything works

## Quick Recovery Commands

| Scenario | Command |
|----------|---------|
| Fix linting | `npm run qa:fix` |
| Re-validate | `npm run validate` |
| Git status | `git status` |
| Abort rebase | `git rebase --abort` |
| Continue rebase | `git rebase --continue` |

## Prevention Tips

1. **Always validate before committing**: Run `npm run validate` before committing
2. **Commit often**: Small, focused commits are easier to recover from
3. **Pull before push**: Always pull remote changes before pushing
4. **Use conventional commits**: Follow the commitlint rules to avoid commit message errors