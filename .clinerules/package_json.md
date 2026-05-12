# Package.json Formatting

## Objective

This rule ensures that `package.json` keys are always sorted alphabetically, with the `lint-staged` section placed at the end.

## Key Ordering Rules

### Standard Keys Order

Keys in `package.json` should be sorted alphabetically, with these standard npm keys in their conventional order at the top:

1. `name`
2. `version`
3. `description`
4. `keywords`
5. `license`
6. `author`
7. `repository`
8. `type`
9. `scripts`
10. `dependencies`
11. `devDependencies`
12. Other custom keys (sorted alphabetically)
13. `lint-staged` (always at the end)

### Example Structure

```json
{
  "name": "project-name",
  "version": "1.0.0",
  "description": "Project description",
  "keywords": ["keyword1", "keyword2"],
  "license": "MIT",
  "author": "Author Name",
  "repository": {...},
  "type": "module",
  "scripts": {...},
  "dependencies": {...},
  "devDependencies": {...},
  "lint-staged": {...}
}
```

## When to Apply

This rule applies when:
- Creating a new `package.json`
- Modifying `package.json` (adding, removing, or reordering keys)
- Reviewing changes to `package.json`

## Verification

After modifying `package.json`:
1. Ensure keys are sorted alphabetically (standard npm keys first, then custom keys)
2. Verify `lint-staged` section is at the end
3. Run `npm run validate` to confirm valid JSON

## Important Rules

- **Always keep `lint-staged` at the end** of the file
- **Sort custom keys alphabetically** after standard npm keys
- **Maintain consistent formatting** with proper indentation (2 spaces)