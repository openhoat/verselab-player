#!/usr/bin/env node
import { spawnSync, spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

const discoverScript = `
const m = require('midi')
const input = new m.Input()
const ports = []
for (let i = 0; i < input.getPortCount(); i++) ports.push({ index: i, name: input.getPortName(i) })
process.stdout.write(JSON.stringify(ports))
`

const result = spawnSync(process.execPath, ['-e', discoverScript], { encoding: 'utf-8', cwd: projectRoot })
if (result.stderr) process.stderr.write(result.stderr)

const ports: { index: number; name: string }[] = JSON.parse(result.stdout || '[]')

if (ports.length === 0) {
  console.error('No MIDI input ports found.')
  process.exit(1)
}

console.log('Available MIDI input ports:')
ports.forEach(p => console.log(`  [${p.index}] ${p.name}`))

const portArg = process.argv[2]
let portIndex: number

if (portArg !== undefined) {
  portIndex = parseInt(portArg, 10)
} else if (ports.length === 1) {
  portIndex = 0
} else {
  const mv1 = ports.find(p => /mv|roland/i.test(p.name))
  if (mv1) {
    portIndex = mv1.index
    console.log(`\nAuto-selected: [${portIndex}] ${mv1.name}`)
  } else {
    console.error('\nMultiple ports — specify index: verselab-probe <index>')
    process.exit(1)
  }
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const noteName = (n: number) => `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`

const listenScript = `
const m = require('midi')
const input = new m.Input()
input.openPort(${portIndex})
input.ignoreTypes(false, false, false)
input.on('message', (_dt, msg) => {
  const [status, note, vel] = msg
  if ((status & 0xF0) === 0x90 && vel > 0)
    process.stdout.write(JSON.stringify({ ch: (status & 0x0F) + 1, note, vel }) + '\\n')
})
process.on('SIGINT', () => { input.closePort(); process.exit(0) })
`

console.log(`\nListening on [${portIndex}] ${ports[portIndex].name} — play drum pads (Ctrl+C to quit)\n`)

const proc = spawn(process.execPath, ['-e', listenScript], {
  stdio: ['inherit', 'pipe', 'inherit'],
  cwd: projectRoot,
})

proc.stdout?.on('data', (data: Buffer) => {
  for (const line of data.toString().split('\n').filter(Boolean)) {
    try {
      const { ch, note, vel } = JSON.parse(line)
      console.log(`  ch=${ch}  note=${note} (${noteName(note)})  vel=${vel}`)
    } catch {}
  }
})

proc.on('close', () => process.exit(0))
process.on('SIGINT', () => proc.kill('SIGINT'))
