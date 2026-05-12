import { existsSync, mkdirSync, writeFileSync, readdirSync, createWriteStream } from 'fs'
import { resolve, join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import { spawnSync } from 'child_process'
import chalk from 'chalk'
import ora from 'ora'
import { midiToNote } from './core/midi-notes.js'
import { resolveSongPath } from './core/paths.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const CLOCKS_PER_STEP = 6 // 24 PPQN / 4 steps per beat

interface PendingNote {
  note: number
  velocity: number
  clockOn: number
}

interface CapturedNote {
  step: number
  note: string
  vel: number
  dur: number
  sta?: number  // Start Time Adjustment: 0-5 clocks offset within the step
}

function showHelp(): void {
  console.log('Usage:')
  console.log('  verselab-scan <song-dir> <sequence> [--bars <n>] [--bpm <tempo>]')
  console.log()
  console.log('Capture MIDI input from the MV-1 and write YAML track files.')
  console.log('Listens for MIDI Start/Stop/Clock to sync timing.')
  console.log('Also generates song.yml and section files for playback.')
  console.log()
  console.log('Arguments:')
  console.log('  song-dir     Path to the song directory')
  console.log('  sequence     Sequence number (e.g. 1)')
  console.log()
  console.log('Options:')
  console.log('  --bars <n>   Stop after N bars (default: 4)')
  console.log('  --bpm <n>    Tempo for song.yml (default: 120)')
  console.log('  -v, --verbose   Show all incoming MIDI messages')
  console.log()
  console.log('Example:')
  console.log('  verselab-scan songs/holding-on-to-you 1 --bpm 65 --bars 4')
}

function parseArgs(argv: string[]): { path?: string; seq?: string; help: boolean; verbose: boolean; bpm: number; bars: number } {
  const result: { path?: string; seq?: string; help: boolean; verbose: boolean; bpm: number; bars: number } = { help: false, verbose: false, bpm: 120, bars: 4 }
  let i = 0
  while (i < argv.length) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') { result.help = true; i++; continue }
    if (arg === '--verbose' || arg === '-v') { result.verbose = true; i++; continue }
    if (arg === '--bpm') { result.bpm = parseInt(argv[++i], 10) || 120; i++; continue }
    if (arg === '--bars') { result.bars = parseInt(argv[++i], 10) || 4; i++; continue }
    if (!result.path) { result.path = arg; i++; continue }
    if (!result.seq) { result.seq = arg; i++; continue }
    i++
  }
  return result
}

function extendDurations(notes: CapturedNote[], totalSteps: number): CapturedNote[] {
  // If all durations from MIDI Note Off are very short (1 step),
  // the MV-1 likely sends Note Off immediately (envelope handles sustain).
  // Extend each note to the next note on the same channel, or to the end.
  const allShort = notes.every(n => n.dur <= 2)
  if (!allShort) return notes

  const result = notes.map(n => ({ ...n }))
  for (let i = 0; i < result.length; i++) {
    const nextStep = i + 1 < result.length ? result[i + 1].step : totalSteps + 1
    result[i].dur = nextStep - result[i].step
  }
  return result
}

function formatTrackYaml(steps: number, notes: CapturedNote[]): string {
  const lines: string[] = [
    `steps: ${steps}`,
    '',
    'notes:',
  ]
  for (const n of notes) {
    const sta = n.sta ? `, sta: ${n.sta}` : ''
    lines.push(`  - { step: ${n.step}, note: ${n.note}, vel: ${n.vel}, dur: ${n.dur}${sta} }`)
  }
  return lines.join('\n') + '\n'
}

function writeTrackFile(seqDir: string, channel: number, notes: CapturedNote[], totalSteps: number): void {
  const filePath = join(seqDir, `${channel}.yml`)
  writeFileSync(filePath, formatTrackYaml(totalSteps, notes))
}

function writeSongAndSections(songDir: string, seqNum: string, channels: number[], bpm: number): void {
  const sectionsDir = join(songDir, 'sections')
  mkdirSync(sectionsDir, { recursive: true })

  // Write section file
  const sectionFile = join(sectionsDir, `${seqNum}-scanned.yml`)
  writeFileSync(sectionFile, [
    `name: Scanned ${seqNum}`,
    `sequence: ${seqNum}`,
    'repeat: 1',
  ].join('\n') + '\n')

  // Write song.yml if it doesn't exist
  const songFile = join(songDir, 'song.yml')
  if (!existsSync(songFile)) {
    const songDirName = dirname(songDir) ? songDir.split('/').pop()! : 'song'
    const title = songDirName.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    const trackLines = channels.sort((a, b) => a - b)
      .map(ch => `  ${ch}: true`)
      .join('\n')
    writeFileSync(songFile, [
      'meta:',
      `  title: ${title}`,
      `  bpm: ${bpm}`,
      '',
      'arrangement:',
      `  - ${seqNum}-scanned`,
      '',
      'tracks:',
      trackLines,
    ].join('\n') + '\n')
  }
}

async function main() {
  const cli = parseArgs(process.argv.slice(2))

  if (cli.help) { showHelp(); process.exit(0) }
  if (!cli.path || !cli.seq) {
    console.error(`${chalk.red('Error:')} song-dir and sequence are required`)
    console.error('Usage: verselab-scan <song-dir> <sequence>')
    process.exit(1)
  }

  const resolved = resolveSongPath(cli.path)
  mkdirSync(resolved, { recursive: true })

  const seqDir = join(resolved, 'sequences', cli.seq)
  mkdirSync(seqDir, { recursive: true })

  // Check for existing track files
  const existingFiles = readdirSync(seqDir).filter((f: string) => f.endsWith('.yml') && f !== 'chords.yml' && f !== 'aliases.yml')
  if (existingFiles.length > 0) {
    console.error(`${chalk.red('Error:')} sequence directory already has track files:`)
    for (const f of existingFiles) {
      console.error(`  ${f}`)
    }
    console.error('Remove them first or use a different sequence number.')
    process.exit(1)
  }

  // Find MIDI input port
  const spinner = ora({ text: 'Connecting to MIDI…', indent: 2 }).start()
  const discoverScript = `const m=require('midi');const i=new m.Input();const r=[];for(let j=0;j<i.getPortCount();j++)r.push(i.getPortName(j));process.stdout.write(JSON.stringify(r));`
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
    spinner.fail(`MV-1 not found on MIDI. ${hint}`)
    process.exit(1)
  }
  const portName = portNames[portIndex]
  spinner.succeed(`${chalk.bold(portName)}`)

  console.log()
  console.log(`  ${chalk.cyan('♫')}  Scanning into ${chalk.dim(seqDir)}`)
  console.log(`  ${chalk.dim(`bpm: ${cli.bpm} (auto-detected from MIDI Clock)`)}`)
  console.log()
  console.log(`  ${chalk.yellow('▶')}  Press ${chalk.bold('Play')} on the MV-1 to start scanning…`)
  console.log(`  ${chalk.dim(`${cli.bars} bars | ESC to cancel`)}`)
  console.log()

  // Set up raw stdin for ESC
  if (process.stdin.isTTY) process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.setEncoding('utf8')

  // Timing log for analysis
  const timingLog = cli.verbose ? createWriteStream(join(seqDir, 'timing.log')) : null

  // State
  let clockCount = 0
  let clockStartTime = 0
  let detectedBpm = 0
  let recording = false
  let lastDisplayStep = 0
  const channels = new Map<number, CapturedNote[]>()
  const pendingNotes = new Map<string, PendingNote>()
  let activeChannels = new Set<number>()

  // Import midi via require (NAN addon must be loaded via CJS)
  const require = createRequire(import.meta.url)
  const midi = require('midi') as typeof import('midi')
  const input = new midi.Input()
  input.ignoreTypes(true, false, true) // ignore sysex, receive clock, ignore active sensing

  input.on('message', (_deltaTime: number, message: number[]) => {
    const [status, data1, data2] = message
    const cmd = status & 0xf0
    const channel = (status & 0x0f) + 1 // 1-indexed

    if (cli.verbose) {
      const names: Record<number, string> = { 0xfa: 'Start', 0xfc: 'Stop', 0xf8: 'Clock' }
      const name = names[status]
      if (name) {
        process.stdout.write(`  ${chalk.dim(name)}\n`)
      } else if (cmd === 0x90 && data2 > 0) {
        const clk = clockCount
        const step = Math.floor(clk / CLOCKS_PER_STEP) + 1
        const offset = clk % CLOCKS_PER_STEP
        const line = `NoteOn ch${channel} ${midiToNote(data1)} vel${data2}  clk=${clk} step=${step}.${offset}`
        process.stdout.write(`  ${chalk.dim(line)}\n`)
        if (timingLog) timingLog.write(`${line}\n`)
      } else if (cmd === 0x80 || (cmd === 0x90 && data2 === 0)) {
        const dur = (() => {
          const key = `${channel}-${data1}`
          const pending = pendingNotes.get(key)
          if (pending) return Math.max(1, Math.round((clockCount - pending.clockOn) / CLOCKS_PER_STEP))
          return '?'
        })()
        process.stdout.write(`  ${chalk.dim(`NoteOff ch${channel} ${midiToNote(data1)} dur=${dur}`)}\n`)
      } else if (cmd === 0xc0) {
        process.stdout.write(`  ${chalk.dim(`PC ch${channel} ${data1}`)}\n`)
      } else {
        process.stdout.write(`  ${chalk.dim(`[${status.toString(16)} ${data1} ${data2}]`)}\n`)
      }
    }

    if (status === 0xfa) { // MIDI Start
      clockCount = 0
      clockStartTime = 0
      detectedBpm = 0
      recording = true
      channels.clear()
      pendingNotes.clear()
      activeChannels.clear()
      lastDisplayStep = 0
      process.stdout.write(`  ${chalk.green('▶')}  Recording…\n`)
    } else if (status === 0xfc) { // MIDI Stop
      if (!recording) return
      recording = false

      // Flush pending notes with minimal duration
      for (const [key, pending] of pendingNotes) {
        const ch = parseInt(key.split('-')[0])
        if (!channels.has(ch)) channels.set(ch, [])
        const step = Math.floor(pending.clockOn / CLOCKS_PER_STEP) + 1
        const sta = pending.clockOn % CLOCKS_PER_STEP
        channels.get(ch)!.push({
          step,
          note: midiToNote(pending.note),
          vel: pending.velocity,
          dur: 1,
          ...(sta ? { sta } : {}),
        })
      }
      pendingNotes.clear()

      // Write track files
      process.stdout.write('\n')
      const totalSteps = Math.floor(clockCount / CLOCKS_PER_STEP)
      const sortedChannels = [...channels.keys()].sort((a, b) => a - b)
      for (const ch of sortedChannels) {
        const raw = channels.get(ch)!.sort((a, b) => a.step - b.step)
        const notes = extendDurations(raw, totalSteps)
        writeTrackFile(seqDir, ch, notes, totalSteps)
        console.log(`  ${chalk.green('✔')}  ch${ch}  ${notes.length} notes  →  ${ch}.yml`)
      }

      if (channels.size === 0) {
        console.log(`  ${chalk.yellow('⚠')}  No notes captured`)
      } else {
        // Write song.yml and section file
        const bpm = detectedBpm || cli.bpm
        writeSongAndSections(resolved, cli.seq!, [...channels.keys()], bpm)
        console.log(`  ${chalk.green('✔')}  song.yml + section generated  ${chalk.dim(`(${bpm} BPM)`)}`)
      }

      console.log()
      exit('Scan complete', chalk.green)
    } else if (status === 0xf8) { // MIDI Clock
      if (!recording) return
      clockCount++

      // Detect BPM from clock timing (24 clocks = 1 beat)
      const now = performance.now()
      if (clockCount === 1) {
        clockStartTime = now
      } else if (clockCount % 24 === 0) {
        const elapsed = now - clockStartTime
        if (elapsed > 0) {
          detectedBpm = Math.round(60000 * (clockCount / 24) / elapsed)
        }
      }
      const currentStep = Math.floor(clockCount / CLOCKS_PER_STEP) + 1
      const maxSteps = cli.bars * 16
      if (clockCount >= maxSteps * CLOCKS_PER_STEP) {
        // Reached bar limit — finalize as if MIDI Stop
        recording = false
        for (const [key, pending] of pendingNotes) {
          const ch = parseInt(key.split('-')[0])
          if (!channels.has(ch)) channels.set(ch, [])
          const step = Math.floor(pending.clockOn / CLOCKS_PER_STEP) + 1
          const sta = pending.clockOn % CLOCKS_PER_STEP
          channels.get(ch)!.push({
            step,
            note: midiToNote(pending.note),
            vel: pending.velocity,
            dur: 1,
            ...(sta ? { sta } : {}),
          })
        }
        pendingNotes.clear()
        process.stdout.write('\n')
        const totalSteps = maxSteps
        const sortedChannels = [...channels.keys()].sort((a, b) => a - b)
        for (const ch of sortedChannels) {
          const raw = channels.get(ch)!.sort((a, b) => a.step - b.step)
          const notes = extendDurations(raw, totalSteps)
          writeTrackFile(seqDir, ch, notes, totalSteps)
          console.log(`  ${chalk.green('✔')}  ch${ch}  ${notes.length} notes  →  ${ch}.yml`)
        }
        if (channels.size === 0) {
          console.log(`  ${chalk.yellow('⚠')}  No notes captured`)
        } else {
          const bpm = detectedBpm || cli.bpm
          writeSongAndSections(resolved, cli.seq!, [...channels.keys()], bpm)
          console.log(`  ${chalk.green('✔')}  song.yml + section generated  ${chalk.dim(`(${bpm} BPM)`)}`)
        }
        console.log()
        exit('Scan complete', chalk.green)
        return
      }
      if (currentStep !== lastDisplayStep) {
        lastDisplayStep = currentStep
        const bars = Math.ceil(currentStep / 16)
        const barStep = ((currentStep - 1) % 16) + 1
        const bpmStr = detectedBpm > 0 ? `  ${chalk.yellow(`${detectedBpm}`)} BPM` : ''
        const chList = [...activeChannels].sort((a, b) => a - b).map(c => `ch${c}`).join(' ')
        process.stdout.write(`\r  ${bars}:${barStep}/${cli.bars}${bpmStr}  ${chalk.dim(chList || '…')}\x1b[K`)
      }
    } else if (cmd === 0x90 && data2 > 0) { // Note On
      if (!recording) return
      const key = `${channel}-${data1}`
      // If same pitch already held, finalize previous note
      if (pendingNotes.has(key)) {
        const pending = pendingNotes.get(key)!
        pendingNotes.delete(key)
        const step = Math.floor(pending.clockOn / CLOCKS_PER_STEP) + 1
        const sta = pending.clockOn % CLOCKS_PER_STEP
        const dur = Math.max(1, Math.round((clockCount - pending.clockOn) / CLOCKS_PER_STEP))
        if (!channels.has(channel)) channels.set(channel, [])
        channels.get(channel)!.push({
          step,
          note: midiToNote(pending.note),
          vel: pending.velocity,
          dur,
          ...(sta ? { sta } : {}),
        })
      }
      pendingNotes.set(key, { note: data1, velocity: data2, clockOn: clockCount })
      activeChannels.add(channel)
    } else if (cmd === 0x80 || (cmd === 0x90 && data2 === 0)) { // Note Off
      if (!recording) return
      const key = `${channel}-${data1}`
      const pending = pendingNotes.get(key)
      if (pending) {
        pendingNotes.delete(key)
        const step = Math.floor(pending.clockOn / CLOCKS_PER_STEP) + 1
        const sta = pending.clockOn % CLOCKS_PER_STEP
        const dur = Math.max(1, Math.round((clockCount - pending.clockOn) / CLOCKS_PER_STEP))
        if (!channels.has(channel)) channels.set(channel, [])
        channels.get(channel)!.push({
          step,
          note: midiToNote(pending.note),
          vel: pending.velocity,
          dur,
          ...(sta ? { sta } : {}),
        })
      }
    }
  })

  input.openPort(portIndex)

  // Clean exit helper
  const exiting = { value: false }
  const exit = (msg: string, color: typeof chalk.green | typeof chalk.red) => {
    if (exiting.value) return
    exiting.value = true
    if (process.stdin.isTTY) process.stdin.setRawMode(false)
    timingLog?.close()
    process.stdout.write('\n')
    console.log(`  ${color(msg)}`)
    input.closePort()
    process.stdin.destroy()
    setTimeout(() => process.exit(0), 100)
  }

  // Handle ESC or Ctrl+C to cancel
  process.stdin.on('data', (key: string) => {
    if (key === '\x1b' || key === '\x03') {
      exit('Cancelled', chalk.red)
    }
  })
  process.on('SIGINT', () => exit('Cancelled', chalk.red))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.on('uncaughtException', err => {
    if (process.stdin.isTTY) process.stdin.setRawMode(false)
    process.stderr.write('\n')
    console.error(chalk.red('Fatal error:'), err instanceof Error ? err.message : err)
    process.exit(1)
  })
  main().catch(err => {
    if (process.stdin.isTTY) process.stdin.setRawMode(false)
    process.stderr.write('\n')
    console.error(chalk.red('Fatal error:'), err instanceof Error ? err.message : err)
    process.exit(1)
  })
}