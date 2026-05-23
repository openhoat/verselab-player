import { existsSync, statSync } from 'fs'
import { resolve, join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import { spawn, spawnSync, type ChildProcess } from 'child_process'
import { Worker } from 'worker_threads'
import chalk from 'chalk'
import ora from 'ora'
import { buildSchedule, loadSongMeta, loadSequence, isTrackActive, type SectionDef } from './player.js'
import { resolveSongPath } from './core/paths.js'
import type { DisplayInfo, WorkerOutboundMessage } from './clock-worker.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function showHelp(): void {
  console.log('Usage:')
  console.log('  verselab-record <song-dir> <sequence> <track>')
  console.log()
  console.log('Play a single clip once for MV-1 recording.')
  console.log('Press Record on the MV-1, then press Enter to start.')
  console.log()
  console.log('Arguments:')
  console.log('  song-dir     Path to the song directory')
  console.log('  sequence     Sequence number (e.g. 1)')
  console.log('  track        Track identifier: channel number, name, or prefix (e.g. 5, bass, 5-bass)')
  console.log()
  console.log('Example:')
  console.log('  verselab-record songs/holding-on-to-you 1 5')
  console.log('  verselab-record songs/holding-on-to-you 1 bass')
}

function parseArgs(argv: string[]): { path?: string; seq?: string; track?: string; help: boolean } {
  const result: { path?: string; seq?: string; track?: string; help: boolean } = { help: false }
  let i = 0
  while (i < argv.length) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') { result.help = true; i++; continue }
    if (!result.path) { result.path = arg; i++; continue }
    if (!result.seq) { result.seq = arg; i++; continue }
    if (!result.track) { result.track = arg; i++; continue }
    i++
  }
  return result
}

async function main() {
  const cli = parseArgs(process.argv.slice(2))

  if (cli.help) { showHelp(); process.exit(0) }
  if (!cli.path || !cli.seq || !cli.track) {
    console.error(`${chalk.red('Error:')} song-dir, sequence, and track are all required`)
    console.error('Usage: verselab-record <song-dir> <sequence> <track>')
    process.exit(1)
  }

  const resolved = resolveSongPath(cli.path)
  if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
    console.error(`${chalk.red('Error:')} "${resolved}" is not a directory`)
    process.exit(1)
  }

  const seqDir = join(resolved, 'sequences', cli.seq)
  if (!existsSync(seqDir)) {
    console.error(`${chalk.red('Error:')} sequence "${cli.seq}" not found (${seqDir})`)
    process.exit(1)
  }

  // Load song meta and sequence
  const { title, bpm } = loadSongMeta(resolved)
  const tracks = loadSequence(seqDir)
  const trackState: Record<string, boolean> = { [cli.track]: true }
  const hasExplicitTracks = true
  const sections: SectionDef[] = [{ name: `seq ${cli.seq}`, key: cli.seq, tracks, repeat: 1, source: seqDir }]

  // Show active tracks
  const activeTracks = tracks.filter(t => isTrackActive(t, trackState, hasExplicitTracks))
  if (activeTracks.length === 0) {
    console.error(`${chalk.red('Error:')} no track matches "${cli.track}"`)
    console.error('Available tracks:')
    for (const t of tracks) {
      console.error(`  ch${t.channel}  ${t.name}  (${t.steps} steps)`)
    }
    process.exit(1)
  }

  // Find MIDI output and input ports
  const activeSpinner = ora({ text: 'Connecting to MIDI…', indent: 2 }).start()
  const discoverScript = `const m=require('midi');const o=new m.Output();const r=[];for(let i=0;i<o.getPortCount();i++)r.push(o.getPortName(i));process.stdout.write(JSON.stringify(r));`
  const discovery = spawnSync(process.execPath, ['--eval', discoverScript], {
    cwd: resolve(__dirname, '..'),
    encoding: 'utf-8',
  })
  const portNames: string[] = discovery.stdout ? JSON.parse(discovery.stdout) : []
  let portIndex = portNames.findIndex(n => n.toLowerCase().includes('mv-1'))
  if (portIndex < 0 && portNames.length > 0) portIndex = 0
  const portName = portIndex >= 0 ? portNames[portIndex] : ''
  if (portIndex < 0) {
    activeSpinner.fail('No MIDI output found')
    process.exit(1)
  }

  // Find MIDI input port
  const discoverInputScript = `const m=require('midi');const i=new m.Input();const r=[];for(let j=0;j<i.getPortCount();j++)r.push(i.getPortName(j));process.stdout.write(JSON.stringify(r));`
  const discoveryInput = spawnSync(process.execPath, ['--eval', discoverInputScript], {
    cwd: resolve(__dirname, '..'),
    encoding: 'utf-8',
  })
  const inputPortNames: string[] = discoveryInput.stdout ? JSON.parse(discoveryInput.stdout) : []
  let inputPortIndex = inputPortNames.findIndex(n => n.toLowerCase().includes('mv-1'))

  activeSpinner.succeed(`${chalk.bold(portName)}`)

  console.log()
  console.log(`  ${chalk.cyan('♪')}  ${chalk.bold(title)}  ${chalk.dim('—')}  ${chalk.yellow(String(bpm))} BPM`)
  for (const t of activeTracks) {
    console.log(`  ${chalk.green('●')}  ${chalk.dim(`ch${t.channel}`)}  ${t.name}  ${chalk.dim(`(${t.steps} steps)`)}`)
  }
  console.log()
  console.log(`  ${chalk.red('⏺')}  ${chalk.bold('Record')} — press Record/Play on the MV-1 or Enter on your keyboard to start`)
  console.log()

  // Set up MIDI trigger child process if available (avoid loading midi in main thread)
  let triggerProc: ChildProcess | null = null
  if (inputPortIndex >= 0) {
    const triggerScript = `
      const m = require('midi');
      const i = new m.Input();
      i.ignoreTypes(false, true, true);
      i.on('message', (dT, msg) => {
        if (msg[0] !== 0xF8 && msg[0] !== 0xFE) {
          process.exit(0);
        }
      });
      i.openPort(${inputPortIndex});
      setInterval(() => {}, 1000);
    `
    triggerProc = spawn(process.execPath, ['--eval', triggerScript], {
      cwd: resolve(__dirname, '..'),
    })
  }

  // Wait for Enter or MIDI input
  if (process.stdin.isTTY) process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.setEncoding('utf8')

  await new Promise<void>(r => {
    const onKey = (key: string) => {
      if (key === '\r' || key === '\n') {
        cleanup()
        r()
      }
    }

    function cleanup() {
      process.stdin.removeListener('data', onKey)
      if (triggerProc) {
        triggerProc.kill()
      }
    }

    process.stdin.on('data', onKey)
    if (triggerProc) {
      triggerProc.on('exit', () => {
        cleanup()
        r()
      })
    }
  })

  // Build schedule and play once
  const { schedule, loopMs } = buildSchedule(sections, bpm, trackState, hasExplicitTracks)

  const controlBuffer = new SharedArrayBuffer(4)
  const control = new Int32Array(controlBuffer)
  const worker = new Worker(resolve(__dirname, 'clock-worker-loader.cjs'), {
    workerData: { controlBuffer }
  })

  worker.on('error', err => {
    console.error(chalk.red('Worker error:'), err.message)
    process.exit(1)
  })

  // Display position
  let displayInfo: DisplayInfo | null = null
  let resolveStop: (() => void) | null = null

  worker.on('message', (msg: WorkerOutboundMessage) => {
    if (msg.type === 'display') {
      displayInfo = msg.info
    } else if (msg.type === 'stopped') {
      resolveStop?.()
    } else if (msg.type === 'done') {
      process.stdout.write('\n')
      console.log(`  ${chalk.green('✔')}  Recording complete`)
      process.exit(0)
    }
  })

  const displayInterval = setInterval(() => {
    if (!displayInfo) return
    const { section, step, globalSteps } = displayInfo
    const pos = step + 1
    const bar = Math.round(pos / globalSteps * 30)
    const progress = '█'.repeat(bar) + '░'.repeat(30 - bar)
    process.stdout.write(`\r  ▶  ${section}  |  ${pos}/${globalSteps}  |  ${progress}\x1b[K`)
  }, 80)

  // Start playback (loop: false = play once)
  worker.postMessage({ type: 'start', portIndex, schedule, loopMs, loop: false })

  // Handle ESC to abort
  process.stdin.on('data', (key: string) => {
    if (key === '\x1b' || key === '\x03') {
      clearInterval(displayInterval)
      Atomics.store(control, 0, 2)
      Atomics.notify(control, 0)
      setTimeout(() => {
        process.stdout.write('\n')
        console.log(`  ${chalk.red('■')}  Stopped`)
        process.exit(0)
      }, 500)
    }
  })

  // Wait for playback to finish
  await new Promise<void>(r => { resolveStop = r })

  clearInterval(displayInterval)
  process.stdout.write('\n')
  console.log(`  ${chalk.green('✔')}  Recording complete`)
  process.exit(0)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(err => {
    process.stderr.write('\n')
    console.error(chalk.red('Fatal error:'), err instanceof Error ? err.message : err)
    process.exit(1)
  })
}