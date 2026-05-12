# TypeScript Coding Standards

## Objective

Defines TypeScript coding standards and best practices for the project.

## Rules

### 1. Prefer Arrow Functions

**Always prefer arrow functions over `function` declarations.**

Arrow functions provide:
- Consistent lexical `this` binding
- More concise syntax
- Better integration with modern JavaScript patterns

**Correct:**
```typescript
const greet = (name: string): string => {
  return `Hello, ${name}`
}

const add = (a: number, b: number): number => a + b

// In class methods
class UserService {
  private users: User[] = []

  findUser = (id: string): User | undefined => {
    return this.users.find(user => user.id === id)
  }
}
```

**Incorrect:**
```typescript
function greet(name: string): string {
  return `Hello, ${name}`
}

function add(a: number, b: number): number {
  return a + b
}

// In class methods
class UserService {
  private users: User[] = []

  findUser(id: string): User | undefined {
    return this.users.find(user => user.id === id)
  }
}
```

**Exception:** Constructor functions and named function expressions in specific contexts where traditional functions are required (e.g., generators).

### 2. Avoid `any` Type

**Never use `any` type unless absolutely necessary.**

The `any` type defeats TypeScript's type safety and should be avoided:
- Use specific types instead
- Use `unknown` for truly unknown types
- Use generics for flexible, type-safe code
- Use union types when multiple types are possible

**Correct:**
```typescript
// Use specific types
const processUser = (user: User): void => {
  console.log(user.name)
}

// Use unknown for unknown types
const parseJson = (json: string): unknown => {
  return JSON.parse(json)
}

// Use generics
const identity = <T>(value: T): T => {
  return value
}

// Use union types
type Result = Success | Error
const handleResult = (result: Result): void => {
  // ...
}
```

**Incorrect:**
```typescript
// Don't use any
const processUser = (user: any): void => {
  console.log(user.name)
}

const parseJson = (json: string): any => {
  return JSON.parse(json)
}

const identity = (value: any): any => {
  return value
}
```

**Exception:** When interfacing with legacy JavaScript code or third-party libraries without type definitions, document why `any` is necessary with a comment.

### 3. Avoid Type Assertions (`as`)

**Avoid using `as` type assertions unless absolutely necessary.**

Type assertions bypass TypeScript's type checking and can lead to runtime errors:
- Let TypeScript infer types naturally
- Use type guards instead of assertions
- Use proper typing at the source
- Refactor to avoid the need for assertions

**Correct:**
```typescript
// Let TypeScript infer
const user = getUserFromApi() // Type inferred from function return

// Use type guards
const isString = (value: unknown): value is string => {
  return typeof value === 'string'
}

if (isString(value)) {
  console.log(value.toUpperCase()) // Type narrowed to string
}

// Proper typing at source
interface ApiResponse {
  data: User
}

const response: ApiResponse = await fetch('/api/user').then(r => r.json())
const user = response.data // Type is User
```

**Incorrect:**
```typescript
// Don't use as
const user = getUserFromApi() as User

const value = someValue as string
console.log(value.toUpperCase())

const response = await fetch('/api/user').then(r => r.json()) as ApiResponse
```

**Exception:** When dealing with DOM elements or external APIs where the type cannot be inferred, document the assertion with a comment explaining why it's safe.

## Enforcement

These rules should be:
- Checked during code review
- Enforced by Biome rules when possible
- Applied consistently across all TypeScript files

## Integration

This rule complements:
- **Quality Check Rule**: Validated by `npm run validate`
- **Testing Rule**: Applied to all test files