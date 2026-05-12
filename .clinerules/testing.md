# Testing Rules

## Objective

Defines coding standards for writing tests in the project.

## Test Framework

The project uses **Vitest** as the test runner.

## Test Writing Standards

### Use `test` instead of `it`

**ALWAYS use `test` instead of `it` when defining test cases.**

**Correct:**
```typescript
import { describe, expect, test } from 'vitest'

describe('MyModule', () => {
  test('should work correctly', () => {
    // test code
  })
})
```

**Incorrect:**
```typescript
import { describe, expect, it } from 'vitest'

describe('MyModule', () => {
  it('should work correctly', () => {
    // test code
  })
})
```

### Test File Naming

- Test files must end with `.test.ts`
- Place test files next to the source files they test
- Example: `src/tools/bootstrap.ts` -> `src/tools/bootstrap.test.ts`

### Test Structure

```typescript
// 1. Imports first (test utilities, then source)
import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest'
import { myFunction } from './myModule'

// 2. Mocks (if needed)
const mockFunction = vi.fn()

// 3. describe block
describe('MyModule', () => {
  // 4. Setup/teardown
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // 5. Test cases using `test`
  test('should do something', () => {
    // test code
  })
})
```

### Test Descriptions

- Test descriptions must start with a verb in present tense
- Use clear, descriptive names
- Example: `'should parse kanban file'`, `'should return error for invalid path'`

## Import Order for Test Files

1. Vitest imports (`describe`, `expect`, `test`, etc.)
2. Source file imports
3. Mocks and test utilities

## Usage

This rule applies to:
- All new test files created
- All existing test files (refactor to use `test` instead of `it`)
- Test files in `src/**/*.test.ts`