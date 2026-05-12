import { describe, expect, test } from 'vitest'

const CLOCKS_PER_STEP = 6

// Replicate the quantization logic from scan.ts for testing
function clockToStep(clock: number): number {
  return Math.floor(clock / CLOCKS_PER_STEP) + 1
}

function clockDiffToDuration(clockDiff: number): number {
  return Math.max(1, Math.round(clockDiff / CLOCKS_PER_STEP))
}

describe('clock to step conversion', () => {
  test('clock 0 maps to step 1', () => {
    expect(clockToStep(0)).toBe(1)
  })

  test('clocks 1-5 still map to step 1', () => {
    expect(clockToStep(1)).toBe(1)
    expect(clockToStep(5)).toBe(1)
  })

  test('clock 6 maps to step 2', () => {
    expect(clockToStep(6)).toBe(2)
  })

  test('clock 12 maps to step 3', () => {
    expect(clockToStep(12)).toBe(3)
  })
})

describe('duration from clock difference', () => {
  test('6 clocks = 1 step duration', () => {
    expect(clockDiffToDuration(6)).toBe(1)
  })

  test('12 clocks = 2 steps duration', () => {
    expect(clockDiffToDuration(12)).toBe(2)
  })

  test('48 clocks = 8 steps duration', () => {
    expect(clockDiffToDuration(48)).toBe(8)
  })

  test('3 clocks = minimum 1 step duration', () => {
    expect(clockDiffToDuration(3)).toBe(1)
  })

  test('1 clock = minimum 1 step duration', () => {
    expect(clockDiffToDuration(1)).toBe(1)
  })

  test('0 clocks = minimum 1 step duration', () => {
    expect(clockDiffToDuration(0)).toBe(1)
  })

  test('9 clocks rounds to 2 steps', () => {
    expect(clockDiffToDuration(9)).toBe(2)
  })
})

describe('full note capture scenario', () => {
  test('note on at clock 0, off at clock 6 = step 1 dur 1', () => {
    expect(clockToStep(0)).toBe(1)
    expect(clockDiffToDuration(6)).toBe(1)
  })

  test('note on at clock 6, off at clock 48 = step 2 dur 7', () => {
    expect(clockToStep(6)).toBe(2)
    expect(clockDiffToDuration(42)).toBe(7)
  })

  test('whole bar rest: note at clock 96 (step 17) dur 96 clocks (16 steps)', () => {
    expect(clockToStep(96)).toBe(17)
    expect(clockDiffToDuration(96)).toBe(16)
  })
})