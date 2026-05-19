import { existsSync, readFileSync, readdirSync, statSync, watch, type FSWatcher } from 'fs'
import { resolve, join, extname, basename, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync, spawn, spawnSync, type ChildProcess } from 'child_process'
import { Worker } from 'worker_threads'
import { load as parseYaml } from 'js-yaml'
import chalk from 'chalk'
import { noteToMidi, GM_DRUM_NOTES as GM_DRUMS } from './core/midi-notes.js'
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

const GRID_VEL: Record<string, number> = { x: 0, X: 0, g: -20, o: -40 }

function parsePattern(str: string, instrument: string): NoteEvent[] {
  const chars = str.replace(/[\s|]/g, '').split('')
  if (chars.length < 1 || chars.length > 128) {
    throw new Error(`Pattern for "${instrument}" must be 1–128 steps, got ${chars.length}`)
  }
  const note = GM_DRUMS[instrument]
  if (note === undefined) {
    throw new Error(`Unknown drum instrument: "${instrument}". Known: ${Object.keys(GM_DRUMS).join(', ')}`)
  }
  const baseVel = DEFAULT_DRUM_VEL[instrument] ?? 100
  return chars
    .map((c, idx) => {
      if (GRID_VEL[c] !== undefined) {
        const vel = Math.max(1, Math.min(127, baseVel + GRID_VEL[c]))
        return { step: idx + 1, note, velocity: vel }
      }
      return null
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
        return { name, channel, clip, steps, events }
      }

      const DRUM_META = new Set(['channel', 'sound', 'category', 'steps'])
      const patternEntries = Object.entries(s).filter(([k]) => !DRUM_META.has(k))
      const events: NoteEvent[] = patternEntries
        .flatMap(([instrument, pattern]) => parsePattern(pattern as string, instrument))
      const maxPatternLen = Math.max(...patternEntries.map(([, p]) => (p as string).replace(/[\s|]/g, '').length))
      const steps = stepsOverride ?? maxPatternLen
      return { name, channel, clip, steps, events }
    })
}

function loadAliases(dir: string): Aliases {
  const chordsFile = join(dir, 'chords.yml')
  const aliasesFile = join(dir, 'aliases.yml')
  if (existsSync(chordsFile)) {
    return (parseYaml(readFileSync(chordsFile, 'utf-8')) ?? {}) as Aliases
  }
  if (existsSync(aliasesFile)) {
    return (parseYaml(readFileSync(aliasesFile, 'utf-8')) ?? {}) as Aliases
  }
  return {}
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
    return { name: trackName, channel, clip, steps, events }
  }

  const TRACK_META = new Set(['track', 'sound', 'category', 'steps', 'transpose', 'notes', 'clip'])
  const patternEntries = Object.entries(raw).filter(([k]) => !TRACK_META.has(k))
  const events: NoteEvent[] = patternEntries
    .flatMap(([instrument, pattern]) => parsePattern(pattern as string, instrument))
  const maxPatternLen = Math.max(...patternEntries.map(([, p]) => (p as string).replace(/[\s|]/g, '').length))
  const steps = stepsOverride ?? maxPatternLen
  return { name: trackName, channel, clip, steps, events }
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
  try {
    if (statSync(seqPath).isDirectory()) {
      const aliases = loadAliases(seqPath)
      // Derive default clip from sequence directory name (e.g. sequences/2/ → clip 2)
      const seqNum = parseInt(basename(seqPath), 10)
      const defaultClip = isNaN(seqNum) ? undefined : seqNum
      return loadSequenceDir(seqPath, aliases, defaultClip)
    }
  } catch {}
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

function parseArgs(argv: string[]): { path?: string; wait: boolean; clock: boolean; watch: boolean; track?: string; seq?: string; section?: string; help: boolean } {
  const result: { path?: string; wait: boolean; clock: boolean; watch: boolean; track?: string; seq?: string; section?: string; help: boolean } = { wait: false, clock: false, watch: true, help: false }
  let i = 0
  while (i < argv.length) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') { result.help = true; i++; continue }
    if (arg === '--wait' || arg === '-w') { result.wait = true; i++; continue }
    if (arg === '--clock') { result.clock = true; i++; continue }
    if (arg === '--no-watch') { result.watch = false; i++; continue }
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
  sendClock = false
): { schedule: ScheduledEvent[], loopMs: number } {
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
  const totalClocks = (totalSteps + PREROLL_STEPS) * CLOCKS_PER_STEP
  const loopMs = totalSteps * stepMs
  const totalBars = Math.round(totalSteps / 16)
  const events: ScheduledEvent[] = []

  // Track which (channel, clip) combos have already been sent, to avoid duplicate PCs
  // when a section repeats (same tracks, same clips).
  let prevClips = new Map<number, number>()  // channel → last clip number sent

  // Initial clip change at timeMs=0 (before playback starts).
  // Sent in the preroll period on the first loop only.
  // On loop restart, the MV-1 already has the right clip selected.
  const firstSection = sections[0]
  for (const track of firstSection.tracks) {
    if (!isTrackActive(track, trackState, hasExplicitTracks)) continue
    const ch = track.channel - 1
    const pcValue = track.clip - 1  // clip is 1-indexed, PC value is 0-indexed
    events.push({ timeMs: -prerollMs, message: [0xC0 | ch, pcValue], firstLoopOnly: true })
    prevClips.set(ch, track.clip)
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
        if (!isTrackActive(track, trackState, hasExplicitTracks)) continue
        const ch = track.channel - 1
        const pcValue = track.clip - 1
        // Only send PC if this channel's clip changed
        if (prevClips.get(ch) !== track.clip) {
          events.push({ timeMs: pcTime, message: [0xC0 | ch, pcValue] })
          prevClips.set(ch, track.clip)
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
      if (!isTrackActive(track, trackState, hasExplicitTracks)) continue
      const pos = ((step - 1) % track.steps) + 1
      for (const evt of track.events) {
        if (evt.step !== pos) continue
        const ch = track.channel - 1  // raw MIDI: 0-indexed
        const staOffset = ((evt.sta ?? 0) / CLOCKS_PER_STEP) * stepMs
        events.push({ timeMs: t + staOffset, message: [0x90 | ch, evt.note, evt.velocity] })
        events.push({ timeMs: t + staOffset + (evt.duration ?? 1) * stepMs * 0.9, message: [0x80 | ch, evt.note, 0] })
      }
    }
  }

  events.sort((a, b) => a.timeMs - b.timeMs)
  return { schedule: events, loopMs }
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
  let portIndex = portNames.findIndex(n => n.toLowerCase().includes('mv-1'))
  if (portIndex < 0) {
    const hint = portNames.length > 0
      ? `Available ports: ${portNames.join(', ')}`
      : 'No MIDI ports detected — is the MV-1 connected and in MIDI mode (not Storage mode)?'
    console.error(chalk.red('✕') + `  MV-1 not found on MIDI. ${hint}`)
    process.exit(1)
  }
  const portName = portNames[portIndex]

  const alsaPort = cli.wait ? findAlsaSeqPort('mv-1') : null
  const effectiveWait = cli.wait && !!alsaPort
  const stopHint = effectiveWait
    ? 'MV-1 START/STOP to play/pause  —  ESC to exit'
    : 'ESC to stop'

  // Create shared control buffer
  const controlBuffer = new SharedArrayBuffer(8)
  const control = new Int32Array(controlBuffer)

  // Initialize screen
  const tracks = sections[0].tracks
  const screen = new PlayerScreen()
  screen.init(tracks, control)
  screen.drawConnection(portName, stopHint)
  screen.drawTitle(title, bpm)
  screen.drawTracks()

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
  let displayInfo: DisplayInfo | null = null
  let workerActive = false
  let reloading = false
  let exiting = false
  let startTrigger: (() => void) | null = null
  let alsaProc: ChildProcess | null = null

  // Worker stopped/done handler (resolved by the current play cycle's Promise)
  let resolveStop: (() => void) | null = null

  worker.on('message', (msg: WorkerOutboundMessage) => {
    if (msg.type === 'display') {
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
      screen.clearMessage()
      currentSectionName = ''
      reloading = false
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
    try {
      // Full reload: re-read song.yml
      if (songFile && existsSync(songFile)) {
        const raw = parseYaml(readFileSync(songFile, 'utf-8')) as Record<string, unknown>
        const meta = raw.meta as { bpm?: number } | undefined
        if (meta?.bpm) bpm = meta.bpm
        hasExplicitTracks = raw.tracks !== undefined
        trackState = (raw.tracks as Record<string, boolean> | undefined) ?? {}
      }
      // Re-read section definitions and sequences
      if (isDir) {
        const { raw } = loadSongMeta(resolved)
        const { sectionDefs, index } = loadSectionDefs(resolved, raw)
        const arrangement = (raw.arrangement as (string | number)[]).map(String)
        sections = buildSections(sectionDefs, arrangement, resolved, index)
      }
    } catch { return }

    screen.drawMessage(`  ${chalk.yellow('↻')}  Change detected, restarting at cycle end…`)

    if (workerActive) {
      const { schedule, loopMs } = buildSchedule(sections, bpm, trackState, hasExplicitTracks, cli.clock && !effectiveWait)
      reloading = true
      worker.postMessage({ type: 'reload', schedule, loopMs, loop: !effectiveWait, noClock: !cli.clock || effectiveWait })
      Atomics.store(control, 0, 3)
      Atomics.notify(control, 0)
    }
  }

  const watchers: FSWatcher[] = []
  if (cli.watch && isDir) {
    // Recursively collect all .yml files in the song directory
    const collectYamlFiles = (dir: string): string[] => {
      const files: string[] = []
      try {
        for (const f of readdirSync(dir)) {
          const full = join(dir, f)
          if (statSync(full).isDirectory()) {
            files.push(...collectYamlFiles(full))
          } else if (f.endsWith('.yml') || f.endsWith('.yaml')) {
            files.push(full)
          }
        }
      } catch {}
      return files
    }
    for (const f of collectYamlFiles(resolved)) {
      watchers.push(watch(f, () => {
        if (reloadTimer) clearTimeout(reloadTimer)
        reloadTimer = setTimeout(triggerReload, 100)
      }))
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

    const { schedule, loopMs } = buildSchedule(sections, bpm, trackState, hasExplicitTracks, cli.clock && !effectiveWait)
    workerActive = true
    screen.setWorkerActive(true)
    reloading = false

    await new Promise<void>(r => {
      resolveStop = r
      worker.postMessage({ type: 'start', portIndex, schedule, loopMs, loop: !effectiveWait, noClock: !cli.clock || effectiveWait })
    })

    if (!effectiveWait) break
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
