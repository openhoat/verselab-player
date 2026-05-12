# Quality Check

## Objective

This rule ensures that each code modification respects the quality standards defined by Biome.

## When to execute this check

After each code modification (creation, editing, deletion of files), systematically run the quality check before moving to the next task.

## Verification process

### 1. Run the `validate` script

```bash
npm run validate
```

### 2. Analyze the result

- **If check passes** (no errors): Continue with the next task
- **If check fails** (errors detected): Proceed to step 3

### 3. Fix errors

Run the `qa:fix` script to automatically fix errors:

```bash
npm run qa:fix
```

### 4. Re-verify

Re-run `npm run validate` to confirm all errors are fixed.

## Exceptions

If the `qa:fix` script fails to fix all errors automatically:

1. Identify remaining errors
2. Fix them manually
3. Re-run `npm run validate` to confirm the fix

## Important rules

- **Never move to a next task** without successfully running `npm run validate`