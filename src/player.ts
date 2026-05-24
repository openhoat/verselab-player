import { existsSync, readFileSync, readdirSync, statSync, watch, type FSWatcher } from 'fs'
import { resolve, join, extname, basename, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync, spawn, spawnSync, type ChildProcess } from 'child_process'
import { Worker } from 'worker_threads'
import { load as parseYaml } from 'js-yaml'
import chalk from 'chalk'
import { noteToMidi, isValidNoteName, GM_DRUM_NOTES as GM_DRUMS } from './core/midi-notes.js'
import { DRUM_CATEGORIES, resolveGmProgram } from './core/gm-map.js'
import type { DisplayInfo, ScheduledEvent, WorkerOutboundMessage } from './clock-worker.ts'
import { PlayerScreen } from './ui/screen.js'
import { resolveSongPath } from './core/paths.js'
import { printSongList } from './cli/list-songs.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)


const DEFAULT_DRUM_VEL: Record<string, number> = {
  kick: 100, bass_drum: 100,
  snare: 90, rimshot: 80, rim: 80, clap: 90,
  hihat: 70, hi_hat: 70, closed_hihat: 70, hh: 70,
  open_hihat: 65, open_hh: 65,
  low_tom: 85, mid_tom: 85, high_tom: 85,
  crash: 90, ride: 75,
}

export interface NoteEvent {
  step: number
  note: number
  velocity: number
  duration?: number
  sta?: number  // Start Time Adjustment: 0-5 clocks offset within the step
}

export interface Track {
  name: string
  channel: number
  clip: number  // MV-1 clip number (1-16), sent as Program Change (0-indexed)
  steps: number
  events: NoteEvent[]
  isDrum?: boolean     // true for pattern-format drum tracks
  sound?: string       // MV-1 sound name (e.g. "Fat808BS1 Long")
  category?: string    // MV-1 sound category (e.g. "Synth Bass", "Drum Kit")
  gmProgram?: number   // explicit GM program override (from gm_program: in YAML)
}

export interface SectionDef {
  name: string
  key: string
  section?: number    // MV-1 section number (1-16)
  sequence?: number
  tracks: Track[]
  repeat: number
  source?: string
}

const GRID_VEL: Record<string, number> = { X: 0, x: 0, '.': -50, g: -20, o: -40 }


/** Parse a custom value: number, "80(2)" string (vel + optional sta), or {vel, sta} object */
function parseVelocityEntry(value: unknown): { vel: number; sta: number } {
  if (typeof value === 'number') return { vel: value, sta: 0 }
  if (typeof value === 'string') {
    const m = value.match(/^(\d+)(?:\((\d+)\))?$/)
    if (m) return { vel: parseInt(m[1], 10), sta: m[2] ? parseInt(m[2], 10) : 0 }
  }
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, number>
    return { vel: obj.vel ?? 100, sta: obj.sta ?? 0 }
  }
  return { vel: 100, sta: 0 }
}

/**
 * Parse the roll: format for melodic tracks.
 * Items: array of single-key maps [{NOTE: PATTERN}, ...]
 * Pattern chars (excluding | and spaces): . = rest, = = sustain, else = custom key
 * custom values: number, "80(2)" (vel + sta), or {vel, sta}
 */
function parseRoll(
  items: Record<string, string>[],
  velocityMap: Record<string, unknown>,
  transpose: number,
  aliases: Aliases = {},
): NoteEvent[] {
  const events: NoteEvent[] = []
  for (const item of items) {
    const entries = Object.entries(item)
    if (entries.length !== 1) continue
    const [key, pattern] = entries[0]
    const midiNotes: number[] = isValidNoteName(key)
      ? [Math.min(127, Math.max(0, noteToMidi(key) + transpose))]
      : (aliases[key] ?? []).map(n => Math.min(127, Math.max(0, noteToMidi(n) + transpose)))
    if (midiNotes.length === 0) throw new Error(`Unknown chord alias in roll: "${key}"`)
    const chars = pattern.replace(/[\s|]/g, '').split('')
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i]
      if (c === '.' || c === '=') continue
      if (!(c in velocityMap)) continue
      const entry = parseVelocityEntry(velocityMap[c])
      if (entry.vel === 0) continue
      let dur = 1
      while (i + dur < chars.length && chars[i + dur] === '=') dur++
      for (const midi of midiNotes) {
        events.push({
          step: i + 1,
          note: midi,
          velocity: entry.vel,
          duration: dur,
          ...(entry.sta ? { sta: entry.sta } : {}),
        })
      }
    }
  }
  return events
}

function parsePattern(str: string, instrument: string, velocityMaps?: Record<string, Record<string, number>>): NoteEvent[] {
  const chars = str.replace(/[\s|]/g, '').split('')
  if (chars.length < 1 || chars.length > 128) {
    throw new Error(`Pattern for "${instrument}" must be 1–128 steps, got ${chars.length}`)
  }
  const note = GM_DRUMS[instrument]
  if (note === undefined) {
    throw new Error(`Unknown drum instrument: "${instrument}". Known: ${Object.keys(GM_DRUMS).join(', ')}`)
  }
  
  const instVelMap = velocityMaps?.[instrument]
  const defaultVelMap = velocityMaps?.['default'] as Record<string, number> | undefined
  const globalVelMap = (!velocityMaps) ? undefined :
    (Object.values(velocityMaps).every(v => typeof v === 'number') ? velocityMaps as unknown as Record<string, number> : undefined)

  return chars
    .map((c, idx) => {
      let vel: number | undefined

      if (instVelMap && c in instVelMap) {
        vel = instVelMap[c]
      } else if (defaultVelMap && c in defaultVelMap) {
        vel = defaultVelMap[c]
      } else if (globalVelMap && c in globalVelMap) {
        vel = globalVelMap[c]
      } else if (GRID_VEL[c] !== undefined) {
        const baseVel = DEFAULT_DRUM_VEL[instrument] ?? 100
        vel = Math.max(1, Math.min(127, baseVel + GRID_VEL[c]))
      } else if (c !== '-') {
        // Unknown character but not a rest - treat as hit with default velocity
        vel = DEFAULT_DRUM_VEL[instrument] ?? 100
      } else {
        return null  // '-' is the rest character
      }
      
      if (vel === 0) return null
      return { step: idx + 1, note, velocity: vel }
    })
    .filter((e): e is NoteEvent => e !== null)
}

const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
const lcm = (a: number, b: number): number => (a / gcd(a, b)) * b

declare global { interface Math { lcm(...ns: number[]): number } }
Math.lcm = (...ns: number[]) => ns.reduce(lcm, 1)

type Aliases = Record<string, (string | number)[]>

const DEFAULT_CLIP = 1

function parseTracks(raw: Record<string, unknown>, aliases: Aliases): Track[] {
  const RESERVED = new Set(['meta', 'aliases'])
  return Object.entries(raw)
    .filter(([key]) => !RESERVED.has(key))
    .map(([name, section]) => {
      const s = section as Record<string, unknown>
      const channel = s.channel as number
      const clip = (s.clip as number | undefined) ?? DEFAULT_CLIP
      const stepsOverride = s.steps as number | undefined

      const sound = s.sound as string | undefined
      const category = s.category as string | undefined
      const gmProgram = s.gm_program as number | undefined

      if (Array.isArray(s.notes)) {
        const transpose = (s.transpose as number | undefined) ?? 0
        const events: NoteEvent[] = s.notes.flatMap((n: Record<string, unknown>) => {
          const step = n.step as number
          const velocity = (n.vel ?? n.velocity ?? 100) as number
          const duration = (n.dur ?? n.duration) as number | undefined
          const sta = n.sta as number | undefined
          if (n.chord !== undefined) {
            const chordName = n.chord as string
            const notes = aliases[chordName]
            if (!notes) throw new Error(`Unknown chord alias: "${chordName}"`)
            return notes.map(note => ({ step, note: Math.min(127, Math.max(0, noteToMidi(note) + transpose)), velocity, duration, sta }))
          }
          return [{ step, note: Math.min(127, Math.max(0, noteToMidi(n.note as string | number) + transpose)), velocity, duration, sta }]
        })
        const steps = stepsOverride ?? Math.max(...events.map(e => e.step))
        const isDrum = category !== undefined && DRUM_CATEGORIES.has(category)
        return { name, channel, clip, steps, events, isDrum, sound, category, gmProgram }
      }

      const DRUM_META = new Set(['channel', 'sound', 'category', 'steps', 'gm_program', 'velocity_maps', 'custom'])
      const velocityMaps = (s.velocity_maps as Record<string, Record<string, number>> | undefined)
      const patternEntries = Object.entries(s).filter(([k]) => !DRUM_META.has(k))
      const events: NoteEvent[] = patternEntries
        .flatMap(([instrument, pattern]) => parsePattern(pattern as string, instrument, velocityMaps))
      const maxPatternLen = Math.max(...patternEntries.map(([, p]) => (p as string).replace(/[\s|]/g, '').length))
      const steps = stepsOverride ?? maxPatternLen
      return { name, channel, clip, steps, events, isDrum: true, sound, category, gmProgram }
    })
}

function loadAliases(dir: string): Aliases {
  // Walk up from dir (up to 3 levels), merge — deeper overrides shallower
  const levels: Aliases[] = []
  let current = dir
  for (let i = 0; i < 3; i++) {
    const chordsFile = join(current, 'chords.yml')
    const aliasesFile = join(current, 'aliases.yml')
    if (existsSync(chordsFile)) {
      levels.unshift((parseYaml(readFileSync(chordsFile, 'utf-8')) ?? {}) as Aliases)
    } else if (existsSync(aliasesFile)) {
      levels.unshift((parseYaml(readFileSync(aliasesFile, 'utf-8')) ?? {}) as Aliases)
    }
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  return Object.assign({}, ...levels)
}

/** Extract leading number from a filename like "4-drums" → 4, "5" → 5, or "drums" → undefined */
function filenamePrefix(filename: string): number | undefined {
  const m = filename.match(/^(\d+)/)
  return m ? parseInt(m[1], 10) : undefined
}

function loadTrackFile(filePath: string, trackName: string, aliases: Aliases, defaultClip?: number): Track {
  const raw = parseYaml(readFileSync(filePath, 'utf-8')) as Record<string, unknown>
  const channel = (raw.track as number | undefined) ?? filenamePrefix(trackName) ?? 4
  const clip = (raw.clip as number | undefined) ?? defaultClip ?? DEFAULT_CLIP
  const stepsOverride = raw.steps as number | undefined
  const sound = raw.sound as string | undefined
  const category = raw.category as string | undefined
  const gmProgram = raw.gm_program as number | undefined

  if (Array.isArray(raw.notes)) {
    const transpose = (raw.transpose as number | undefined) ?? 0
    const events: NoteEvent[] = (raw.notes as Record<string, unknown>[]).flatMap(n => {
      const step = n.step as number
      const velocity = (n.vel ?? n.velocity ?? 100) as number
      const duration = (n.dur ?? n.duration) as number | undefined
      const sta = n.sta as number | undefined
      if (n.chord !== undefined) {
        const chordName = n.chord as string
        const notes = aliases[chordName]
        if (!notes) throw new Error(`Unknown chord alias: "${chordName}"`)
        return notes.map(note => ({ step, note: Math.min(127, Math.max(0, noteToMidi(note) + transpose)), velocity, duration, sta }))
      }
      return [{ step, note: Math.min(127, Math.max(0, noteToMidi(n.note as string | number) + transpose)), velocity, duration, sta }]
    })
    const steps = stepsOverride ?? Math.max(...events.map(e => e.step))
    const isDrum = category !== undefined && DRUM_CATEGORIES.has(category)
    return { name: trackName, channel, clip, steps, events, isDrum, sound, category, gmProgram }
  }

  if (Array.isArray(raw.roll)) {
    const transpose = (raw.transpose as number | undefined) ?? 0
    const velocityMap = (raw.custom as Record<string, unknown> | undefined) ?? {}
    const items = raw.roll as Record<string, string>[]
    const events = parseRoll(items, velocityMap, transpose, aliases)
    const maxPatternLen = items.reduce((max, item) => {
      const [, pattern] = Object.entries(item)[0] ?? ['', '']
      return Math.max(max, pattern.replace(/[\s|]/g, '').length)
    }, 0)
    const steps = stepsOverride ?? maxPatternLen
    const isDrum = category !== undefined && DRUM_CATEGORIES.has(category)
    return { name: trackName, channel, clip, steps, events, isDrum, sound, category, gmProgram }
  }

  const TRACK_META = new Set(['track', 'sound', 'category', 'steps', 'transpose', 'notes', 'roll', 'clip', 'gm_program', 'velocity_maps', 'custom'])
  const velocityMaps = (raw.velocity_maps as Record<string, Record<string, number>> | undefined)
  const patternEntries = Object.entries(raw).filter(([k]) => !TRACK_META.has(k))
  const events: NoteEvent[] = patternEntries
    .flatMap(([instrument, pattern]) => parsePattern(pattern as string, instrument, velocityMaps))
  const maxPatternLen = Math.max(...patternEntries.map(([, p]) => (p as string).replace(/[\s|]/g, '').length))
  const steps = stepsOverride ?? maxPatternLen
  return { name: trackName, channel, clip, steps, events, isDrum: true, sound, category, gmProgram }
}

function loadSequenceDir(seqDir: string, aliases: Aliases, defaultClip?: number): Track[] {
  return readdirSync(seqDir)
    .filter(f => f.endsWith('.yml') && f !== 'aliases.yml' && f !== 'chords.yml')
    .sort()
    .map(f => {
      const trackName = basename(f, '.yml')
      return loadTrackFile(join(seqDir, f), trackName, aliases, defaultClip)
    })
}

export function loadSequence(seqPath: string): Track[] {
  let isDir = false
  try { isDir = statSync(seqPath).isDirectory() } catch {}
  if (isDir) {
    const aliases = loadAliases(seqPath)
    // Derive default clip from sequence directory name (e.g. sequences/2/ → clip 2)
    const seqNum = parseInt(basename(seqPath), 10)
    const defaultClip = isNaN(seqNum) ? undefined : seqNum
    return loadSequenceDir(seqPath, aliases, defaultClip)
  }
  const file = extname(seqPath) === '' ? `${seqPath}.yml` : seqPath
  const raw = parseYaml(readFileSync(file, 'utf-8')) as Record<string, unknown>
  const aliases = (raw.aliases ?? {}) as Aliases
  return parseTracks(raw, aliases)
}

function findAlsaSeqPort(pattern: string): string | null {
  try {
    const out = execSync('aseqdump -l 2>/dev/null', { encoding: 'utf-8' })
    for (const line of out.split('\n')) {
      if (line.toLowerCase().includes(pattern.toLowerCase())) {
        const m = line.match(/^\s*(\d+:\d+)/)
        if (m) return m[1]
      }
    }
  } catch {}
  return null
}

function showHelp(): void {
  console.log('Usage:')
  console.log('  verselab-play <song-dir>                            # play full song (watch enabled)')
  console.log('  verselab-play <song-dir> -S, --section <n|name>     # play one section')
  console.log('  verselab-play <song-dir> -s, --seq <n>               # play one sequence')
  console.log('  verselab-play <sequence-file>                        # play one sequence file')
  console.log()
  console.log('Options:')
  console.log('  -h, --help             Show this help message')
  console.log('  -w, --wait             Wait for MV-1 START before playing; STOP pauses and re-arms')
  console.log('  --clock                Send MIDI Start/Clock (sync MV-1 sequencer)')
  console.log('  --clock-port <name>    Send MIDI clock to additional port (repeatable, e.g. --clock-port rc-505)')
  console.log('  --preroll [bars]       Clock preroll before playback (default: 2 bars)')
  console.log('  -p, --port <name>      MIDI output port name pattern (default: mv-1, fallback: first port)')
  console.log('  -t, --track <spec>     Only play track matching channel, name, or prefix')
  console.log('  --no-watch             Disable file watching / hot-reload')
  console.log('  -s, --seq <n>          Play sequence number <n>')
  console.log('  -S, --section <spec>   Play section by number or name')
  console.log()
  console.log('Toggle tracks live by editing song.yml:')
  console.log('  tracks:')
  console.log('    kit: true')
  console.log('    bass: false')
}

function parseArgs(argv: string[]): { path?: string; wait: boolean; clock: boolean; clockPorts: string[]; prerollBars: number; watch: boolean; port?: string; track?: string; seq?: string; section?: string; help: boolean } {
  const result: { path?: string; wait: boolean; clock: boolean; clockPorts: string[]; prerollBars: number; watch: boolean; port?: string; track?: string; seq?: string; section?: string; help: boolean } = { wait: false, clock: false, clockPorts: [], prerollBars: 0, watch: true, help: false }
  let i = 0
  while (i < argv.length) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') { result.help = true; i++; continue }
    if (arg === '--wait' || arg === '-w') { result.wait = true; i++; continue }
    if (arg === '--clock') { result.clock = true; i++; continue }
    if (arg === '--clock-port' && i + 1 < argv.length) { result.clockPorts.push(argv[++i]); i++; continue }
    if (arg === '--preroll') {
      const next = argv[i + 1]
      if (next && /^\d+$/.test(next)) { result.prerollBars = parseInt(next, 10); i += 2 }
      else { result.prerollBars = 2; i++ }
      continue
    }
    if (arg === '--no-watch') { result.watch = false; i++; continue }
    if ((arg === '--port' || arg === '-p') && i + 1 < argv.length) { result.port = argv[++i]; i++; continue }
    if ((arg === '--seq' || arg === '-s') && i + 1 < argv.length) { result.seq = argv[++i]; i++; continue }
    if ((arg === '--section' || arg === '-S') && i + 1 < argv.length) { result.section = argv[++i]; i++; continue }
    if ((arg === '--track' || arg === '-t') && i + 1 < argv.length) { result.track = argv[++i]; i++; continue }
    if (!result.path) { result.path = arg }
    i++
  }
  return result
}

export function loadSongMeta(songDir: string): { songFile: string; raw: Record<string, unknown>; title: string; bpm: number; tracks: Record<string, boolean>; hasExplicitTracks: boolean } {
  const songFile = join(songDir, 'song.yml')
  const raw = parseYaml(readFileSync(songFile, 'utf-8')) as Record<string, unknown>
  const meta = raw.meta as { title: string; bpm: number }
  const hasExplicitTracks = raw.tracks !== undefined
  const tracks = (raw.tracks as Record<string, boolean> | undefined) ?? {}
  return { songFile, raw, title: meta.title, bpm: meta.bpm, tracks, hasExplicitTracks }
}

interface SectionDefs {
  sectionDefs: Record<string, any>
  fromFiles: boolean
  /** Lookup index: maps reference keys (filename, number, name) to the canonical section key */
  index: Map<string, string>
}

function loadSectionDefs(songDir: string, raw: Record<string, unknown>): SectionDefs {
  const sectionsDir = join(songDir, 'sections')
  if (existsSync(sectionsDir) && statSync(sectionsDir).isDirectory()) {
    const sectionDefs: Record<string, any> = {}
    const index = new Map<string, string>()
    for (const f of readdirSync(sectionsDir).filter(f => f.endsWith('.yml')).sort()) {
      const key = basename(f, '.yml')
      const def = parseYaml(readFileSync(join(sectionsDir, f), 'utf-8')) as Record<string, unknown>
      // Derive section number from filename prefix (e.g. "1-intro" → section: 1)
      if (def.section === undefined) {
        const prefix = filenamePrefix(key)
        if (prefix !== undefined) def.section = prefix
      }
      sectionDefs[key] = def
      // Build lookup index: full key, number prefix, name suffix (after dash)
      index.set(key, key)
      const dashIdx = key.indexOf('-')
      if (dashIdx > 0) {
        index.set(key.slice(0, dashIdx), key)  // number: "1"
        index.set(key.slice(dashIdx + 1), key)  // name: "intro"
      }
      // Also index by display name
      if (typeof def.name === 'string') index.set(def.name, key)
    }
    return { sectionDefs, fromFiles: true, index }
  }
  const sectionDefs = raw.sections as Record<string, any>
  if (!sectionDefs) throw new Error(`No sections/ directory and no inline sections`)
  const index = new Map<string, string>()
  for (const key of Object.keys(sectionDefs)) {
    index.set(key, key)
    if (typeof sectionDefs[key].name === 'string') index.set(sectionDefs[key].name, key)
  }
  return { sectionDefs, fromFiles: false, index }
}

function resolveSectionKey(ref: string, index: Map<string, string>): string | undefined {
  return index.get(ref) ?? index.get(String(ref))
}

function buildSections(
  sectionDefs: Record<string, any>,
  arrangement: string[],
  songDir: string,
  index: Map<string, string>,
  sectionOverride?: string
): SectionDef[] {
  if (sectionOverride) {
    const key = resolveSectionKey(sectionOverride, index)
    if (!key) throw new Error(`Section "${sectionOverride}" not found`)
    arrangement = [key]
  }

  return arrangement.map(ref => {
    const key = resolveSectionKey(ref, index)
    if (!key) throw new Error(`Section "${ref}" not found`)
    const def = sectionDefs[key]
    if (!def) throw new Error(`Section "${key}" not defined`)
    const displayName = def.name ?? `S${key}`
    const sequenceNum = typeof def.sequence === 'number' ? def.sequence : parseInt(String(def.sequence), 10) || undefined
    const sectionNum = def.section as number | undefined
    const source = typeof def.sequence === 'number'
      ? join(songDir, 'sequences', String(def.sequence))
      : join(songDir, def.sequence)
    const tracks = loadSequence(source)
    return { name: displayName, key, section: sectionNum, sequence: sequenceNum, tracks, repeat: sectionOverride ? 1 : (def.repeat ?? 1), source }
  })
}

export function isTrackActive(track: Track, trackState: Record<string, boolean>, hasExplicitTracks: boolean): boolean {
  const byChannel = trackState[String(track.channel)]
  if (byChannel !== undefined) return byChannel
  const byName = trackState[track.name] ?? trackState[track.name.replace(/^\d+-/, '')]
  if (byName !== undefined) return byName
  return !hasExplicitTracks
}

const CLOCKS_PER_STEP = 6
const PREROLL_STEPS = 4       // startup delay: initial PCs → MIDI Start
const SECTION_ADVANCE_STEPS = 16  // section-change PCs sent this many steps early (1 bar)

export function buildSchedule(
  sections: SectionDef[],
  bpm: number,
  trackState: Record<string, boolean>,
  hasExplicitTracks: boolean,
  sendClock = false,
  gmMode = false
): { schedule: ScheduledEvent[], loopMs: number, sectionStarts: { name: string, step: number }[] } {
  const stepMs = 60000 / (bpm * 4)
  const clockMs = stepMs / CLOCKS_PER_STEP
  const prerollMs = PREROLL_STEPS * stepMs

  const playbackSteps: { section: SectionDef; step: number; rep: number; globalSteps: number }[] = []
  for (const section of sections) {
    // When tracks are explicitly selected, only count active tracks for cycle length.
    // This ensures a single-track recording plays exactly that track's length.
    const activeTracks = section.tracks.filter(t => isTrackActive(t, trackState, hasExplicitTracks))
    const globalSteps = activeTracks.length > 0
      ? Math.lcm(...activeTracks.map(t => t.steps))
      : Math.lcm(...section.tracks.map(t => t.steps))
    for (let rep = 1; rep <= section.repeat; rep++) {
      for (let step = 1; step <= globalSteps; step++) {
        playbackSteps.push({ section, step, rep, globalSteps })
      }
    }
  }

  const totalSteps = playbackSteps.length
  const loopMs = totalSteps * stepMs
  const totalBars = Math.round(totalSteps / 16)
  const events: ScheduledEvent[] = []

  const trackCh = (track: Track) =>
    gmMode && track.isDrum ? 9 : track.channel - 1
  const trackPc = (track: Track): number | null => {
    if (gmMode && track.isDrum) return null
    if (gmMode) return track.gmProgram ?? resolveGmProgram(track.sound, track.category)
    return track.clip - 1
  }

  // Track which PCs have been sent per effective channel, to avoid duplicates.
  let prevClips = new Map<number, number>()  // effective channel → last PC sent

  // Initial program change before playback starts (preroll period, first loop only).
  const firstSection = sections[0]
  for (const track of firstSection.tracks) {
    const ch = trackCh(track)
    const pc = trackPc(track)
    if (pc === null) continue
    events.push({ timeMs: -prerollMs, message: [0xC0 | ch, pc], firstLoopOnly: true })
    prevClips.set(ch, pc)
  }

  if (sendClock) {
    // MIDI Start at time 0 (first loop only — on restart the MV-1 keeps playing)
    events.push({ timeMs: 0, message: [0xFA], firstLoopOnly: true })

    // Preroll clocks (before playback starts) — firstLoopOnly
    const prerollClocks = PREROLL_STEPS * CLOCKS_PER_STEP
    for (let c = 0; c < prerollClocks; c++) {
      events.push({ timeMs: -prerollMs + c * clockMs, message: [0xF8], firstLoopOnly: true })
    }

    // Playback clocks (continuous stream, repeats each loop)
    const playbackClocks = totalSteps * CLOCKS_PER_STEP
    for (let c = 0; c < playbackClocks; c++) {
      events.push({ timeMs: c * clockMs, message: [0xF8] })
    }
  }

  for (let si = 0; si < totalSteps; si++) {
    const { section, step, rep, globalSteps } = playbackSteps[si]
    const t = si * stepMs

    // Detect section transitions and send clip changes.
    // PCs are sent SECTION_ADVANCE_STEPS early (1 bar) so the MV-1 registers
    // the clip switch before the new section's first note.
    const sectionChanged = si === 0
      ? false
      : playbackSteps[si - 1].section !== section

    const sectionRepStart = sectionChanged || (rep === 1 && step === 1 && si > 0)

    if (sectionRepStart) {
      const advanceMs = SECTION_ADVANCE_STEPS * stepMs
      const pcTime = Math.max(0, t - advanceMs)
      for (const track of section.tracks) {
        const ch = trackCh(track)
        const pc = trackPc(track)
        if (pc === null) continue
        if (prevClips.get(ch) !== pc) {
          events.push({ timeMs: pcTime, message: [0xC0 | ch, pc] })
          prevClips.set(ch, pc)
        }
      }
    }

    let nextSection: string | undefined
    for (let j = si + 1; j < totalSteps; j++) {
      if (playbackSteps[j].section !== section) { nextSection = playbackSteps[j].section.name; break }
    }

    events.push({
      timeMs: t,
      display: { section: section.name, rep, totalReps: section.repeat, step: step - 1, globalSteps, totalStep: si, totalBars, nextSection }
    })

    for (const track of section.tracks) {
      const pos = ((step - 1) % track.steps) + 1
      const ch = trackCh(track)
      for (const evt of track.events) {
        if (evt.step !== pos) continue
        const staOffset = ((evt.sta ?? 0) / CLOCKS_PER_STEP) * stepMs
        const mc = track.channel
        events.push({ timeMs: t + staOffset, message: [0x90 | ch, evt.note, evt.velocity], muteChannel: mc })
        events.push({ timeMs: t + staOffset + (evt.duration ?? 1) * stepMs * 0.9, message: [0x80 | ch, evt.note, 0], muteChannel: mc })
      }
    }
  }

  // seqEnd markers: allow the worker to break at sequence-repeat boundaries, not just section end
  {
    let stepOffset = 0
    for (let si = 0; si < sections.length; si++) {
      const section = sections[si]
      const activeTracks = section.tracks.filter(t => isTrackActive(t, trackState, hasExplicitTracks))
      const globalSteps = activeTracks.length > 0
        ? Math.lcm(...activeTracks.map(t => t.steps))
        : Math.lcm(...section.tracks.map(t => t.steps))
      for (let rep = 1; rep <= section.repeat; rep++) {
        stepOffset += globalSteps
        const isLast = si === sections.length - 1 && rep === section.repeat
        if (!isLast) {
          // Place just before the next rep/section's events so note-offs are already dispatched
          events.push({ timeMs: stepOffset * stepMs - 0.001, seqEnd: true })
        }
      }
    }
  }

  events.sort((a, b) => a.timeMs - b.timeMs)

  // Compute section start indices for seek navigation
  const sectionStarts: { name: string, step: number }[] = []
  for (let i = 0; i < playbackSteps.length; i++) {
    const ps = playbackSteps[i]
    if (i === 0 || ps.section !== playbackSteps[i - 1].section || (ps.rep === 1 && ps.step === 1)) {
      sectionStarts.push({ name: ps.section.name, step: i })
    }
  }

  return { schedule: events, loopMs, sectionStarts }
}

async function main() {
  const cli = parseArgs(process.argv.slice(2))

  if (cli.help) { showHelp(); process.exit(0) }
  if (!cli.path) { printSongList(); process.exit(0) }

  const resolved = resolveSongPath(cli.path)
  const resolvedFile = extname(resolved) === '' ? `${resolved}.yml` : resolved
  let isDir: boolean
  try {
    isDir = statSync(resolved).isDirectory()
  } catch {
    isDir = statSync(resolvedFile).isDirectory()
  }

  let title: string
  let bpm: number
  let trackState: Record<string, boolean>
  let hasExplicitTracks: boolean
  let sections: SectionDef[]

  if (isDir && cli.seq) {
    const { title: t, bpm: b, tracks: tr, hasExplicitTracks: h } = loadSongMeta(resolved)
    title = t; bpm = b; trackState = tr; hasExplicitTracks = h
    const source = join(resolved, 'sequences', cli.seq)
    const tracks = loadSequence(source)
    sections = [{ name: `seq ${cli.seq}`, key: cli.seq, tracks, repeat: 1, source }]
  } else if (isDir) {
    const { raw, title: t, bpm: b, tracks: tr, hasExplicitTracks: h } = loadSongMeta(resolved)
    title = t; bpm = b; trackState = tr; hasExplicitTracks = h

    const { sectionDefs, index } = loadSectionDefs(resolved, raw)
    const arrangement = (raw.arrangement as (string | number)[]).map(String)
    sections = buildSections(sectionDefs, arrangement, resolved, index, cli.section)
  } else {
    const file = extname(resolved) === '' ? resolved + '.yml' : resolved
    const raw = parseYaml(readFileSync(file, 'utf-8')) as Record<string, unknown>
    const meta = raw.meta as { title?: string } | undefined
    title = meta?.title ?? cli.path
    trackState = {}
    hasExplicitTracks = false
    const parentSong = join(resolve(file, '..'), 'song.yml')
    const parentIndex = join(resolve(file, '..'), 'index.yml')
    try {
      const parentFile = existsSync(parentSong) ? parentSong : parentIndex
      const parentRaw = parseYaml(readFileSync(parentFile, 'utf-8')) as Record<string, unknown>
      bpm = (parentRaw.meta as { bpm?: number } | undefined)?.bpm ?? 120
    } catch {
      bpm = 120
    }
    const aliases = (raw.aliases ?? {}) as Aliases
    const tracks = parseTracks(raw, aliases)
    sections = [{ name: cli.path, key: '1', tracks, repeat: 1, source: file }]
  }

  let songFile: string | undefined
  if (isDir) {
    songFile = existsSync(join(resolved, 'song.yml'))
      ? join(resolved, 'song.yml')
      : join(resolved, 'index.yml')
  }

  // --track filter: only activate the specified track
  if (cli.track) {
    trackState = { [cli.track]: true }
    hasExplicitTracks = true
  }

  // Find MIDI output port — run in a child process so midi.node (NAN addon) is never
  // loaded in the main thread, which would block the worker thread from loading it later.
  console.log('  Connecting to MIDI…')
  const discoverScript = `const m=require('midi');const o=new m.Output();const r=[];for(let i=0;i<o.getPortCount();i++)r.push(o.getPortName(i));process.stdout.write(JSON.stringify(r));`
  const discovery = spawnSync(process.execPath, ['--eval', discoverScript], {
    cwd: resolve(__dirname, '..'),
    encoding: 'utf-8',
  })
  const portNames: string[] = discovery.stdout ? JSON.parse(discovery.stdout) : []
  const pattern = cli.port ?? 'mv-1'
  let portIndex = portNames.findIndex(n => n.toLowerCase().includes(pattern.toLowerCase()))
  if (portIndex < 0) {
    if (cli.port !== undefined) {
      const hint = portNames.length > 0 ? `Available ports: ${portNames.join(', ')}` : 'No MIDI ports detected'
      console.error(chalk.red('✕') + `  Port "${cli.port}" not found. ${hint}`)
      process.exit(1)
    }
    if (portNames.length === 0) {
      console.error(chalk.red('✕') + '  No MIDI ports detected — is a MIDI device connected?')
      process.exit(1)
    }
    portIndex = portNames.findIndex(n => !n.toLowerCase().includes('midi through'))
    if (portIndex < 0) portIndex = 0
    console.log(chalk.yellow('⚠') + `  MV-1 not found, using: ${portNames[portIndex]}`)
  }
  const portName = portNames[portIndex]
  const gmMode = !portName.toLowerCase().includes('mv-1')

  // Resolve additional clock ports
  const clockPortIndices: number[] = []
  for (const pattern of cli.clockPorts) {
    const idx = portNames.findIndex((n, i) => i !== portIndex && n.toLowerCase().includes(pattern.toLowerCase()))
    if (idx < 0) {
      console.error(chalk.red('✕') + `  Clock port "${pattern}" not found. Available: ${portNames.filter((_, i) => i !== portIndex).join(', ') || 'none'}`)
      process.exit(1)
    }
    if (!clockPortIndices.includes(idx)) {
      clockPortIndices.push(idx)
      console.log(chalk.green('✔') + `  Clock → ${portNames[idx]}`)
    }
  }

  const alsaPort = cli.wait ? findAlsaSeqPort('mv-1') : null
  const effectiveWait = cli.wait && !!alsaPort
  const isSongMode = isDir && !cli.seq && !cli.section
  const shouldLoop = !isSongMode
  const stopHint = effectiveWait
    ? 'MV-1 START/STOP to play/pause  —  ESC to exit'
    : 'ESC to stop  —  ◀▶ bars  ▲▼ sections'

  // Create shared control buffer: [0]=signal [1]=muteMask [2]=seekDelta [3]=seqBoundarySteps
  const controlBuffer = new SharedArrayBuffer(16)
  const control = new Int32Array(controlBuffer)

  // Initialize screen
  const tracks = sections[0].tracks
  const screen = new PlayerScreen()

  // Apply initial mute state from song.yml (tracks marked false start muted)
  const initialMuteMask = tracks.reduce((mask, t) =>
    isTrackActive(t, trackState, hasExplicitTracks) ? mask : mask | (1 << t.channel), 0)
  Atomics.store(control, 1, initialMuteMask)

  screen.init(tracks, control)
  screen.drawConnection(portName, stopHint)
  screen.drawTitle(title, bpm)
  screen.drawTracks()

  const computeAdjacentSections = (delta: number, fromKey?: string): SectionDef[] | null => {
    if (!isDir) return null
    try {
      const baseKey = fromKey ?? sections[0].key
      if (cli.seq) {
        const seqNum = parseInt(baseKey, 10) + delta
        if (isNaN(seqNum)) return null
        const nextSource = join(resolved, 'sequences', String(seqNum))
        try { statSync(nextSource) } catch { return null }
        const tracks = loadSequence(nextSource)
        return [{ name: `seq ${seqNum}`, key: String(seqNum), tracks, repeat: 1, source: nextSource }]
      }
      const { raw } = loadSongMeta(resolved)
      const { sectionDefs, index } = loadSectionDefs(resolved, raw)
      const sortedKeys = Object.keys(sectionDefs).sort()
      const currentIdx = sortedKeys.indexOf(baseKey)
      if (currentIdx < 0) return null
      const nextKey = sortedKeys[currentIdx + delta]
      if (!nextKey) return null
      return buildSections(sectionDefs, [nextKey], resolved, index)
    } catch { return null }
  }

  screen.onSectionSeek = (delta: number) => {
    if (shouldLoop) {
      // Loop mode: scroll through sections; commit whichever is pending at cycle end
      if (reloadPending) return
      const fromKey = pendingSectionNav ? pendingSectionNav[0].key : sections[0].key
      const next = computeAdjacentSections(delta, fromKey)
      if (!next) return
      pendingSectionNav = next
      screen.drawMessage(`  ${chalk.cyan('→')}  ${next[0].name}`)
      if (workerActive) {
        Atomics.store(control, 0, 3)
        Atomics.notify(control, 0)
      }
    } else {
      // Song mode: immediate seek within flat arrangement
      if (!displayInfo || sectionStarts.length === 0) return
      const currentStep = displayInfo.totalStep
      let targetIdx = sectionStarts.findIndex(s => s.step > currentStep) - 1
      if (targetIdx < 0) targetIdx = sectionStarts.length - 1
      const nextIdx = Math.max(0, Math.min(sectionStarts.length - 1, targetIdx + delta))
      const seekDelta = sectionStarts[nextIdx].step - currentStep
      if (seekDelta !== 0) {
        Atomics.add(control, 2, seekDelta)
        Atomics.notify(control, 0)
      }
    }
  }

  if (cli.wait && !alsaPort) {
    screen.drawMessage(`  ${chalk.yellow('⚠')}  No MIDI input — starting automatically`)
  }

  // Create clock worker
  const worker = new Worker(resolve(__dirname, 'clock-worker-loader.cjs'), {
    workerData: { controlBuffer }
  })
  worker.on('error', err => {
    console.error(chalk.red('Worker error:'), err.message)
    process.exit(1)
  })

  // Display state
  let currentSectionName = sections[0].name
  let sectionStarts: { name: string, step: number }[] = []
  let displayInfo: DisplayInfo | null = null
  let workerActive = false
  let reloading = false
  let reloadPending = false
  let pendingSectionNav: SectionDef[] | null = null
  let exiting = false
  let startTrigger: (() => void) | null = null
  let alsaProc: ChildProcess | null = null

  // Worker stopped/done handler (resolved by the current play cycle's Promise)
  let resolveStop: (() => void) | null = null

  worker.on('message', (msg: WorkerOutboundMessage) => {
    if (msg.type === 'preroll') {
      screen.drawMessage(`  ${chalk.cyan('⏱')}  Preroll ${msg.bar}:${msg.beat} / ${msg.totalBars}`)
    } else if (msg.type === 'preroll-done') {
      screen.clearMessage()
    } else if (msg.type === 'display') {
      displayInfo = msg.info
      screen.setDisplayInfo(msg.info)
      if (msg.info.section !== currentSectionName) {
        currentSectionName = msg.info.section
        const section = sections.find(s => s.name === msg.info.section)
        if (section) screen.updateTracks(section.tracks)
      }
    } else if (msg.type === 'stopped') {
      workerActive = false
      screen.setWorkerActive(false)
      if (!reloading) resolveStop?.()
      reloading = false
    } else if (msg.type === 'restarting') {
      // Worker reached cycle end and is restarting with new schedule
      if (pendingSectionNav !== null) {
        const next = pendingSectionNav
        pendingSectionNav = null
        sections = next
        const navMuteMask = sections[0].tracks.reduce((mask, t) =>
          isTrackActive(t, trackState, hasExplicitTracks) ? mask : mask | (1 << t.channel), 0)
        Atomics.store(control, 1, navMuteMask)
        const { schedule, loopMs, sectionStarts: newSectionStarts } = buildSchedule(sections, bpm, trackState, hasExplicitTracks, cli.clock || cli.clockPorts.length > 0, gmMode)
        sectionStarts = newSectionStarts
        reloading = true
        worker.postMessage({ type: 'reload', schedule, loopMs, loop: shouldLoop && !effectiveWait, noClock: !cli.clock || effectiveWait, stepMs: 60000 / (bpm * 4) })
        screen.clearMessage()
        currentSectionName = ''
      } else if (reloadPending) {
        reloadPending = false
        try {
          // Full reload: re-read song.yml
          if (songFile && existsSync(songFile)) {
            const raw = parseYaml(readFileSync(songFile, 'utf-8')) as Record<string, unknown>
            const meta = raw.meta as { bpm?: number } | undefined
            if (meta?.bpm) bpm = meta.bpm
            hasExplicitTracks = raw.tracks !== undefined
            trackState = (raw.tracks as Record<string, boolean> | undefined) ?? {}
          }
          // Re-read section definitions/sequences — stay on the currently playing section
          if (isDir) {
            if (cli.seq) {
              // In seq mode, keep the section the user navigated to (not the initial cli.seq)
              const currentKey = sections[0].key
              const source = join(resolved, 'sequences', currentKey)
              const tracks = loadSequence(source)
              sections = [{ name: sections[0].name, key: currentKey, tracks, repeat: sections[0].repeat, source }]
            } else {
              const { raw } = loadSongMeta(resolved)
              const { sectionDefs, index } = loadSectionDefs(resolved, raw)
              if (shouldLoop) {
                // In section-filter mode, stay on the currently playing section
                sections = buildSections(sectionDefs, [sections[0].key], resolved, index)
              } else {
                // In full-song mode, rebuild the whole arrangement
                const arrangement = (raw.arrangement as (string | number)[]).map(String)
                sections = buildSections(sectionDefs, arrangement, resolved, index, cli.section)
              }
            }
          }
        } catch (err) {
          screen.drawMessage(`  ${chalk.red('✕')}  Reload failed: ${err instanceof Error ? err.message : String(err)}`)
        }
        // Reset mute state from freshly loaded trackState
        const reloadMuteMask = sections[0].tracks.reduce((mask, t) =>
          isTrackActive(t, trackState, hasExplicitTracks) ? mask : mask | (1 << t.channel), 0)
        Atomics.store(control, 1, reloadMuteMask)
        const { schedule, loopMs, sectionStarts: newSectionStarts } = buildSchedule(sections, bpm, trackState, hasExplicitTracks, cli.clock || cli.clockPorts.length > 0, gmMode)
        sectionStarts = newSectionStarts
        reloading = true
        worker.postMessage({ type: 'reload', schedule, loopMs, loop: shouldLoop && !effectiveWait, noClock: !cli.clock || effectiveWait, stepMs: 60000 / (bpm * 4) })
        screen.clearMessage()
        currentSectionName = ''
      } else {
        screen.clearMessage()
        currentSectionName = ''
        reloading = false
      }
    } else if (msg.type === 'done') {
      // Worker has sent allNotesOff and closed port — safe to exit
      workerActive = false
      screen.setWorkerActive(false)
      screen.destroy()
      setTimeout(() => process.exit(0), 50)
    }
  })

  screen.startDisplayLoop()

  // File watching — reload everything on any change in the song directory
  let reloadTimer: ReturnType<typeof setTimeout> | null = null
  const triggerReload = () => {
    if (exiting) return
    screen.drawMessage(`  ${chalk.yellow('↻')}  Change detected, restarting at cycle end…`)
    reloadPending = true
    if (workerActive) {
      Atomics.store(control, 0, 3)
      Atomics.notify(control, 0)
    }
  }

  const watchers: FSWatcher[] = []
  if (cli.watch && isDir) {
    // Recursively collect all directories in the song directory (excluding hidden folders)
    const collectDirs = (dir: string): string[] => {
      const dirs: string[] = [dir]
      try {
        for (const f of readdirSync(dir)) {
          if (f.startsWith('.')) continue
          const full = join(dir, f)
          if (statSync(full).isDirectory()) {
            dirs.push(...collectDirs(full))
          }
        }
      } catch {}
      return dirs
    }
    for (const d of collectDirs(resolved)) {
      try {
        watchers.push(watch(d, (eventType, filename) => {
          if (!filename || filename.endsWith('.yml') || filename.endsWith('.yaml')) {
            if (reloadTimer) clearTimeout(reloadTimer)
            reloadTimer = setTimeout(triggerReload, 100)
          }
        }))
      } catch {}
    }
  }

  const exit = () => {
    if (exiting) return
    exiting = true
    watchers.forEach(w => w.close())
    startTrigger?.()
    alsaProc?.kill()
    if (workerActive) {
      // Signal worker to allNotesOff + send 'done' back
      Atomics.store(control, 0, 2)
      Atomics.notify(control, 0)
      // Fallback: if worker doesn't respond in 500ms, force exit
      setTimeout(() => { screen.destroy(); setTimeout(() => process.exit(0), 50) }, 500)
    } else {
      worker.terminate()
      screen.destroy()
      setTimeout(() => process.exit(0), 50)
    }
  }

  screen.setOnExit(exit)

  const stop = () => {
    if (!effectiveWait) { exit(); return }
    if (!workerActive) return
    Atomics.store(control, 0, 1)
    Atomics.notify(control, 0)
  }

  if (alsaPort) {
    alsaProc = spawn('aseqdump', ['-p', alsaPort])
    alsaProc.stdout?.setEncoding('utf-8')
    alsaProc.stdout?.on('data', (chunk: string) => {
      for (const line of chunk.split('\n')) {
        if (/\bStart\b/.test(line)) { startTrigger?.(); startTrigger = null }
        if (/\bStop\b/.test(line)) stop()
      }
    })
  }

  const waitForStart = (): Promise<void> =>
    new Promise(r => { startTrigger = r })

  while (!exiting) {
    if (effectiveWait) {
      screen.startWaitBlinker()
      await waitForStart()
      screen.stopWaitBlinker()
      if (exiting) break
    }

    if (pendingSectionNav !== null) {
      sections = pendingSectionNav
      pendingSectionNav = null
    }
    const { schedule, loopMs, sectionStarts: newSectionStarts } = buildSchedule(sections, bpm, trackState, hasExplicitTracks, cli.clock || cli.clockPorts.length > 0, gmMode)
    sectionStarts = newSectionStarts
    workerActive = true
    screen.setWorkerActive(true)
    reloading = false

    await new Promise<void>(r => {
      resolveStop = r
      worker.postMessage({ type: 'start', portIndex, clockPortIndices, prerollBars: cli.prerollBars, schedule, loopMs, loop: shouldLoop && !effectiveWait, noClock: !cli.clock || effectiveWait, stepMs: 60000 / (bpm * 4) })
    })

    if (!effectiveWait) break
  }

  if (!exiting) {
    screen.showStopped()
    setTimeout(() => exit(), 1500)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.on('uncaughtException', err => {
    process.stderr.write('\n')
    console.error(chalk.red('Fatal error:'), err instanceof Error ? err.message : err)
    process.exit(1)
  })
  main().catch(err => {
    process.stderr.write('\n')
    console.error(chalk.red('Fatal error:'), err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
