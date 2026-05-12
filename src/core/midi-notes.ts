const SEMITONES_MAP: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3,
  E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8,
  Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
}

const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
const NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const NOTE_NAME_RE = /^([A-Ga-g][#b]?)(-?\d+)$/

export { SEMITONES_MAP as SEMITONES }
export { NOTE_NAME_RE }

export function noteToMidi(note: string | number): number {
  if (typeof note === 'number') return note
  const match = note.match(NOTE_NAME_RE)
  if (!match) throw new Error(`Invalid note: "${note}"`)
  const name = `${match[1].charAt(0).toUpperCase()}${match[1].slice(1)}`
  const octave = parseInt(match[2])
  const semitone = SEMITONES_MAP[name]
  if (semitone === undefined) throw new Error(`Unknown note name: "${match[1]}"`)
  return (octave + 1) * 12 + semitone
}

export function midiToNote(midi: number, useFlats = true): string {
  const octave = Math.floor(midi / 12) - 1
  const semitone = midi % 12
  const name = useFlats ? NOTE_NAMES_FLAT[semitone] : NOTE_NAMES_SHARP[semitone]
  return `${name}${octave}`
}

export function isValidNoteName(note: string): boolean {
  const match = note.match(NOTE_NAME_RE)
  if (!match) return false
  const name = `${match[1].charAt(0).toUpperCase()}${match[1].slice(1)}`
  return name in SEMITONES_MAP
}

export function isValidNoteValue(note: string | number): boolean {
  if (typeof note === 'number') return note >= 0 && note <= 127
  if (typeof note === 'string') {
    if (isValidNoteName(note)) return true
    const n = Number(note)
    return !isNaN(n) && n >= 0 && n <= 127
  }
  return false
}