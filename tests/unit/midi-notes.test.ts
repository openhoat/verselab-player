import { describe, expect, test } from 'vitest'
import { noteToMidi, midiToNote, isValidNoteName, isValidNoteValue } from '../../src/core/midi-notes.js'

describe('noteToMidi', () => {
  test('converts note names to MIDI numbers', () => {
    expect(noteToMidi('C4')).toBe(60)
    expect(noteToMidi('A4')).toBe(69)
    expect(noteToMidi('C-1')).toBe(0)
    expect(noteToMidi('G9')).toBe(127)
  })

  test('handles sharps and flats', () => {
    expect(noteToMidi('C#4')).toBe(61)
    expect(noteToMidi('Db4')).toBe(61)
    expect(noteToMidi('Eb3')).toBe(51)
    expect(noteToMidi('D#3')).toBe(51)
  })

  test('passes through numeric input', () => {
    expect(noteToMidi(60)).toBe(60)
    expect(noteToMidi(0)).toBe(0)
    expect(noteToMidi(127)).toBe(127)
  })

  test('throws on invalid notes', () => {
    expect(() => noteToMidi('X4')).toThrow()
    expect(() => noteToMidi('')).toThrow()
  })
})

describe('midiToNote', () => {
  test('converts MIDI numbers to note names', () => {
    expect(midiToNote(60)).toBe('C4')
    expect(midiToNote(69)).toBe('A4')
    expect(midiToNote(0)).toBe('C-1')
    expect(midiToNote(127)).toBe('G9')
  })

  test('uses flat names for black keys by default', () => {
    expect(midiToNote(61)).toBe('Db4')
    expect(midiToNote(63)).toBe('Eb4')
    expect(midiToNote(66)).toBe('Gb4')
    expect(midiToNote(68)).toBe('Ab4')
    expect(midiToNote(70)).toBe('Bb4')
  })

  test('uses sharp names when useFlats=false', () => {
    expect(midiToNote(61, false)).toBe('C#4')
    expect(midiToNote(63, false)).toBe('D#4')
    expect(midiToNote(66, false)).toBe('F#4')
  })

  test('round-trips with noteToMidi', () => {
    for (let midi = 0; midi <= 127; midi++) {
      expect(noteToMidi(midiToNote(midi))).toBe(midi)
    }
  })
})

describe('isValidNoteName', () => {
  test('accepts valid note names', () => {
    expect(isValidNoteName('C4')).toBe(true)
    expect(isValidNoteName('Db2')).toBe(true)
    expect(isValidNoteName('C#4')).toBe(true)
    expect(isValidNoteName('Bb3')).toBe(true)
  })

  test('rejects invalid note names', () => {
    expect(isValidNoteName('X4')).toBe(false)
    expect(isValidNoteName('4')).toBe(false)
    expect(isValidNoteName('')).toBe(false)
  })
})

describe('isValidNoteValue', () => {
  test('accepts valid MIDI numbers', () => {
    expect(isValidNoteValue(0)).toBe(true)
    expect(isValidNoteValue(60)).toBe(true)
    expect(isValidNoteValue(127)).toBe(true)
  })

  test('accepts valid note names', () => {
    expect(isValidNoteValue('C4')).toBe(true)
    expect(isValidNoteValue('Db2')).toBe(true)
  })

  test('accepts numeric strings', () => {
    expect(isValidNoteValue('60')).toBe(true)
    expect(isValidNoteValue('0')).toBe(true)
  })

  test('rejects out-of-range numbers', () => {
    expect(isValidNoteValue(-1)).toBe(false)
    expect(isValidNoteValue(128)).toBe(false)
  })
})