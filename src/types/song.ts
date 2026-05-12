/**
 * Interfaces for YAML song structure
 * Optimized for Roland Verselab MV-1 workflow
 */

export interface DrumNote {
  /** Note number (General MIDI standard) */
  note: number
  /** Velocity (0-127) */
  velocity: number
  /** Duration in steps */
  duration: number
}

export interface MelodicNote {
  /** Note name (C3, D#4, etc.) or MIDI number */
  note: string | number
  /** Velocity (0-127) */
  velocity: number
  /** Duration in steps */
  duration: number
}

export interface DrumSequence {
  /** 16-step pattern array */
  pattern: (DrumNote | null)[]
}

export interface MelodicSequence {
  /** 16-step pattern array */
  pattern: (MelodicNote | null)[]
}

export interface DrumTrack {
  type: 'drum'
  /** Instrument name (kick, snare, hihat, etc.) */
  instrument: string
  /** MIDI channel for Verselab drums (usually 0) */
  channel: number
  /** 16-step patterns */
  sequences: DrumSequence[]
  /** Volume adjustment */
  volume?: number
}

export interface MelodicTrack {
  type: 'melodic'
  /** Instrument name (bass, lead, pad, etc.) */
  instrument: string
  /** MIDI channel for Verselab (1-7) */
  channel: number
  /** Musical scale (optional, for algorithmic generation) */
  scale?: string
  /** 16-step patterns */
  sequences: MelodicSequence[]
  /** Volume adjustment */
  volume?: number
}

export type Track = DrumTrack | MelodicTrack

export interface SongSection {
  /** Section name (intro, verse, chorus, etc.) */
  name: string
  /** Number of measures in this section */
  length: number
  /** Tracks for this section */
  tracks: Track[]
  /** Next section (optional, for automatic progression) */
  next?: string
}

export interface Song {
  /** Song metadata */
  metadata: {
    /** Song title */
    title: string
    /** Artist/Author */
    artist?: string
    /** Tempo in BPM */
    bpm: number
    /** Time signature */
    timeSignature: string
    /** Song genre/style */
    genre?: string
  }
  /** Song sections */
  sections: {
    /** Section definitions */
    [sectionName: string]: SongSection
  }
  /** Song structure (order of sections) */
  structure: string[]
  /** Global settings */
  settings?: {
    /** Loop the entire song */
    loop?: boolean
    /** Number of times to loop the structure */
    loopCount?: number
    /** Master volume */
    masterVolume?: number
  }
}

/**
 * Verselab-specific constants
 */
export const VERSELAB_CONSTANTS = {
  /** General MIDI drum notes */
  DRUM_NOTES: {
    KICK: 36,
    SNARE: 38,
    CLOSED_HIHAT: 42,
    OPEN_HIHAT: 46,
    LOW_TOM: 45,
    MID_TOM: 48,
    HIGH_TOM: 50,
    CRASH: 49,
    RIDE: 51,
  },
  /** MIDI channels */
  CHANNELS: {
    DRUMS: 0,     // Track 1
    BASS: 1,      // Track 2
    SYNTH_BASS: 2, // Track 3
    KEYBOARD: 3,  // Track 4
    GUITAR: 4,    // Track 5
    BRASS: 5,     // Track 6
    LEAD: 6,      // Track 7
    POLYSYNTH: 7, // Track 8
  },
  /** Note names to MIDI numbers */
  NOTE_NAMES: {
    'C0': 12, 'C#0': 13, 'D0': 14, 'D#0': 15, 'E0': 16, 'F0': 17, 'F#0': 18, 'G0': 19, 'G#0': 20, 'A0': 21, 'A#0': 22, 'B0': 23,
    'C1': 24, 'C#1': 25, 'D1': 26, 'D#1': 27, 'E1': 28, 'F1': 29, 'F#1': 30, 'G1': 31, 'G#1': 32, 'A1': 33, 'A#1': 34, 'B1': 35,
    'C2': 36, 'C#2': 37, 'D2': 38, 'D#2': 39, 'E2': 40, 'F2': 41, 'F#2': 42, 'G2': 43, 'G#2': 44, 'A2': 45, 'A#2': 46, 'B2': 47,
    'C3': 48, 'C#3': 49, 'D3': 50, 'D#3': 51, 'E3': 52, 'F3': 53, 'F#3': 54, 'G3': 55, 'G#3': 56, 'A3': 57, 'A#3': 58, 'B3': 59,
    'C4': 60, 'C#4': 61, 'D4': 62, 'D#4': 63, 'E4': 64, 'F4': 65, 'F#4': 66, 'G4': 67, 'G#4': 68, 'A4': 69, 'A#4': 70, 'B4': 71,
    'C5': 72, 'C#5': 73, 'D5': 74, 'D#5': 75, 'E5': 76, 'F5': 77, 'F#5': 78, 'G5': 79, 'G#5': 80, 'A5': 81, 'A#5': 82, 'B5': 83,
    'C6': 84, 'C#6': 85, 'D6': 86, 'D#6': 87, 'E6': 88, 'F6': 89, 'F#6': 90, 'G6': 91, 'G#6': 92, 'A6': 93, 'A#6': 94, 'B6': 95,
  } as const,
} as const