import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { resolve, join, basename } from 'path'
import { fileURLToPath } from 'url'
import chalk from 'chalk'
import { writeMidi, type MidiEvent, type MidiSetTempoEvent, type MidiEndOfTrackEvent, type MidiProgramChangeEvent, type MidiNoteOnEvent, type MidiNoteOffEvent } from 'midi-file'
import { loadSongMeta, loadSequence, type Track } from '../player.js'
import { resolveSongPath, mv1MidiDir } from '../core/paths.js'

const __filename = fileURLToPath(import.meta.url)

const PPQN = 24           // matches MV-1 internal clock — STA maps 1:1 as tick offsets
const CLOCKS_PER_STEP = 6

function bpmToMicros(bpm: number): number {
  return Math.round(60_000_000 / bpm)
}

function trackToSmf(track: Track, bpm: number): Buffer {
  const ch = track.channel - 1  // MIDI channel 0-indexed

  // Collect note events as { absoluteTick, event }
  type AbsEntry = { tick: number; event: MidiNoteOnEvent | MidiNoteOffEvent }
  const absEvents: AbsEntry[] = []

  for (const evt of track.events) {
    const onTick = (evt.step - 1) * CLOCKS_PER_STEP + (evt.sta ?? 0)
    const offTick = onTick + (evt.duration ?? 1) * CLOCKS_PER_STEP
    absEvents.push({ tick: onTick, event: { deltaTime: 0, type: 'noteOn', channel: ch, noteNumber: evt.note, velocity: evt.velocity } })
    absEvents.push({ tick: offTick, event: { deltaTime: 0, type: 'noteOff', channel: ch, noteNumber: evt.note, velocity: 0 } })
  }

  // Note-offs before note-ons at the same tick (avoids spurious sustain)
  absEvents.sort((a, b) => a.tick - b.tick || (a.event.type === 'noteOff' ? -1 : 1))

  const events: MidiEvent[] = [
    { deltaTime: 0, meta: true, type: 'setTempo', microsecondsPerBeat: bpmToMicros(bpm) } as MidiSetTempoEvent,
    { deltaTime: 0, type: 'programChange', channel: ch, programNumber: Math.max(0, track.clip - 1) } as MidiProgramChangeEvent,
  ]

  let prevTick = 0
  for (const { tick, event } of absEvents) {
    const delta = tick - prevTick
    prevTick = tick
    events.push({ ...event, deltaTime: delta })
  }

  events.push({ deltaTime: 0, meta: true, type: 'endOfTrack' } as MidiEndOfTrackEvent)

  return Buffer.from(writeMidi({ header: { format: 0, numTracks: 1, ticksPerBeat: PPQN }, tracks: [events] }))
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase()
}

function showHelp() {
  console.log('Usage:')
  console.log('  verselab-export <song-dir> <sequence> [--output <dir>]')
  console.log()
  console.log('Export a sequence as SMF (.mid) files (one per track) for MV-1 import.')
  console.log('On the MV-1: CLIP EDIT MENU → IMPORT MIDI.')
  console.log()
  console.log('Arguments:')
  console.log('  song-dir     Path to the song directory')
  console.log('  sequence     Sequence number (e.g. 1)')
  console.log()
  console.log('Options:')
  console.log('  --output <dir>   Override output directory')
  console.log()
  console.log('Environment:')
  console.log('  VERSELAB_MOUNT   MV-1 storage mount point (auto-detected if absent)')
  console.log('                   Output: $VERSELAB_MOUNT/ROLAND/MV/MIDI/')
  console.log()
  console.log('Example:')
  console.log('  verselab-export songs/my-song 1')
  console.log('  verselab-export songs/my-song 1 --output ~/Desktop/midi')
}

function parseArgs(argv: string[]): { path?: string; seq?: string; output?: string; help: boolean } {
  const result: { path?: string; seq?: string; output?: string; help: boolean } = { help: false }
  let i = 0
  while (i < argv.length) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') { result.help = true; i++; continue }
    if (arg === '--output' || arg === '-o') { result.output = argv[++i]; i++; continue }
    if (!result.path) { result.path = arg; i++; continue }
    if (!result.seq) { result.seq = arg; i++; continue }
    i++
  }
  return result
}

function main() {
  const cli = parseArgs(process.argv.slice(2))

  if (cli.help) { showHelp(); process.exit(0) }
  if (!cli.path || !cli.seq) {
    console.error(`${chalk.red('Error:')} song-dir and sequence are required`)
    console.error('Usage: verselab-export <song-dir> <sequence>')
    process.exit(1)
  }

  const resolved = resolveSongPath(cli.path)
  if (!existsSync(resolved)) {
    console.error(`${chalk.red('Error:')} "${resolved}" not found`)
    process.exit(1)
  }

  const seqDir = join(resolved, 'sequences', cli.seq)
  if (!existsSync(seqDir)) {
    console.error(`${chalk.red('Error:')} sequence "${cli.seq}" not found (${seqDir})`)
    process.exit(1)
  }

  let outDir: string
  if (cli.output) {
    outDir = resolve(cli.output)
  } else {
    const detected = mv1MidiDir()
    if (!detected) {
      console.error(`${chalk.red('Error:')} MV-1 storage not detected.`)
      console.error(`  Connect the MV-1 in Storage mode, or set VERSELAB_MOUNT, or use --output <dir>`)
      process.exit(1)
    }
    outDir = detected
  }

  mkdirSync(outDir, { recursive: true })

  const { bpm } = loadSongMeta(resolved)
  const tracks = loadSequence(seqDir)
  const songName = sanitizeName(basename(resolved))

  console.log()
  console.log(`  ${chalk.cyan('♪')}  Exporting seq ${cli.seq} → ${chalk.dim(outDir)}`)
  console.log(`  ${chalk.dim(`bpm: ${bpm}  |  ppqn: ${PPQN}  |  ${tracks.length} track(s)`)}`)
  console.log()

  for (const track of tracks) {
    const filename = `${songName}_${cli.seq}_ch${track.channel}_${sanitizeName(track.name)}.mid`
    const dest = join(outDir, filename)
    const buf = trackToSmf(track, bpm)
    writeFileSync(dest, buf)
    console.log(`  ${chalk.green('✔')}  ch${track.channel}  ${track.name}  →  ${filename}  ${chalk.dim(`(${buf.length}B)`)}`)
  }

  console.log()
}

if (process.argv[1] && fileURLToPath(__filename) === resolve(process.argv[1])) {
  try {
    main()
  } catch (err) {
    console.error(chalk.red('Fatal error:'), err instanceof Error ? err.message : err)
    process.exit(1)
  }
}
