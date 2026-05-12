import chalk from 'chalk'
import type { DisplayInfo } from '../clock-worker.js'
import type { Track } from '../player.js'

// ── Step grid ──

const STEP_EMPTY = '·'
const STEP_NOTE = '▪'
const STEP_GHOST = '▫'
const STEP_PLAYHEAD = '▸'
const STEP_BEAT_SEP = '│'

export function renderStepGrid(track: Track, displayInfo: DisplayInfo, gridWidth: number): string {
  const trackPos = displayInfo.step % track.steps

  // Compute how many 4-step groups fit: each group = 4 cells + 1 sep (except last)
  // Available width = gridWidth - 2 (borders), each group needs 5 chars (4 cells + sep)
  // Last group doesn't need sep, so: numGroups = floor((avail + 1) / 5)
  const avail = gridWidth - 2
  const numGroups = Math.max(2, Math.min(8, Math.floor((avail + 1) / 5)))
  const stepsPerPage = numGroups * 4

  const page = Math.floor(trackPos / stepsPerPage)
  const pageStart = page * stepsPerPage
  const pageEnd = Math.min(pageStart + stepsPerPage - 1, track.steps - 1)
  const playheadCol = trackPos % stepsPerPage

  // Build map of active steps on this page (1-based step → max velocity)
  const activeSteps = new Map<number, number>()
  for (const evt of track.events) {
    if (evt.step - 1 >= pageStart && evt.step - 1 <= pageEnd) {
      const existing = activeSteps.get(evt.step) ?? 0
      if (evt.velocity > existing) activeSteps.set(evt.step, evt.velocity)
    }
  }

  const cells: string[] = []
  for (let i = 0; i <= pageEnd - pageStart; i++) {
    const step1 = pageStart + i + 1
    const isPlayhead = i === playheadCol
    const vel = activeSteps.get(step1)
    const hasNote = vel !== undefined

    if (isPlayhead && hasNote) {
      cells.push(chalk.bgGreen.black(STEP_PLAYHEAD))
    } else if (isPlayhead) {
      cells.push(chalk.yellow(STEP_PLAYHEAD))
    } else if (hasNote && vel > 40) {
      cells.push(chalk.green(STEP_NOTE))
    } else if (hasNote) {
      cells.push(chalk.dim(STEP_GHOST))
    } else {
      cells.push(chalk.dim(STEP_EMPTY))
    }
  }

  while (cells.length < stepsPerPage) cells.push(' ')

  // Group by 4, join with beat separators
  const groups: string[] = []
  for (let g = 0; g < numGroups; g++) {
    groups.push(cells.slice(g * 4, g * 4 + 4).join(''))
  }

  return `${chalk.dim('│')}${groups.join(chalk.dim(STEP_BEAT_SEP))}${chalk.dim('│')}`
}

export function renderTrackLabel(track: Track, control: Int32Array, displayInfo: DisplayInfo | null, gridWidth: number): string {
  const muted = (Atomics.load(control, 1) & (1 << track.channel)) !== 0
  const dot = muted ? chalk.red('✕') : chalk.green('●')

  const chRaw = `ch${track.channel}`
  const chPad = ' '.repeat(Math.max(0, 4 - chRaw.length))
  const ch = chalk.dim(chRaw) + chPad

  const nameRaw = track.name.length > 10 ? track.name.slice(0, 9) + '…' : track.name
  const namePad = ' '.repeat(Math.max(0, 10 - nameRaw.length))
  const name = (muted ? chalk.dim(nameRaw) : nameRaw) + namePad

  const keyRaw = `[${track.channel}]`
  const keyPad = ' '.repeat(Math.max(0, 4 - keyRaw.length))
  const key = chalk.dim(keyRaw) + keyPad

  const stepsRaw = `${track.steps}st`
  const stepsPad = ' '.repeat(Math.max(0, 5 - stepsRaw.length))
  const steps = stepsPad + chalk.dim(stepsRaw)

  // Compute page info based on gridWidth (same logic as renderStepGrid)
  const avail = gridWidth - 2
  const numGroups = Math.max(2, Math.min(8, Math.floor((avail + 1) / 5)))
  const stepsPerPage = numGroups * 4

  let page = ''
  if (displayInfo) {
    const trackPos = displayInfo.step % track.steps
    const pg = Math.floor(trackPos / stepsPerPage) + 1
    const total = Math.ceil(track.steps / stepsPerPage)
    page = total > 1 ? chalk.dim(` pg ${pg}/${total}`) : ''
  }

  return `  ${dot} ${ch}  ${name} ${key}  ${steps}${page}`
}

// ── Transport / Position ──

export function renderTransport(info: DisplayInfo): string {
  const bar = Math.floor(info.totalStep / 16) + 1
  const beat = Math.floor((info.totalStep % 16) / 4) + 1
  const repStr = info.totalReps > 1 ? chalk.dim(` ×${info.rep}/${info.totalReps}`) : ''
  return `  ${chalk.green('▶')}  ${chalk.bold(info.section)}${repStr}`
}

export function renderPosition(info: DisplayInfo, width: number): string {
  const bar = Math.floor(info.totalStep / 16) + 1
  const beat = Math.floor((info.totalStep % 16) / 4) + 1
  const barStr = `${chalk.yellow(`${bar}:${beat}`)}${chalk.dim(`/${info.totalBars}`)}`

  const BLOCKS = Math.max(8, width - 16)
  const filled = Math.round((info.step / info.globalSteps) * BLOCKS)
  const progress = `${chalk.green('█'.repeat(filled))}${chalk.gray('░'.repeat(BLOCKS - filled))}`

  return `  ${barStr}  ${progress}`
}

// ── BPM with beat pulse ──

export function renderBPM(bpm: number, pulse: boolean): string {
  const bpmStr = `${bpm} BPM`
  if (pulse) return `${chalk.yellow.bold(bpmStr)} ${chalk.yellow('♦')}`
  return chalk.yellow(bpmStr)
}

// ── VU meter ──

const VU_WIDTH = 12

export function renderVUMeter(track: Track, level: number, control: Int32Array): string {
  const muted = (Atomics.load(control, 1) & (1 << track.channel)) !== 0
  const filled = muted ? 0 : Math.round(level * VU_WIDTH)
  const bar = `${'▓'.repeat(filled)}${'░'.repeat(VU_WIDTH - filled)}`
  // Pad name to 10 chars for alignment (same as label name column)
  const nameRaw = track.name.length > 10 ? track.name.slice(0, 9) + '…' : track.name
  const namePad = ' '.repeat(Math.max(0, 10 - nameRaw.length))
  const name = chalk.dim(nameRaw) + namePad
  return `  ${muted ? chalk.dim(bar) : bar}  ${name}`
}

// ── Header ──

export function renderTitle(title: string, bpm: number): string {
  return `  ${chalk.cyan('♪')}  ${chalk.bold(title)}`
}

export function renderConnection(portName: string, stopHint: string): string {
  return `  ${chalk.green('✔')}  ${chalk.bold(portName)}  ${chalk.dim('—')}  ${stopHint}`
}

// ── Box-drawing frames ──

const H = '─'
const V = '│'
const TL = '┌'
const TR = '┐'
const BL = '└'
const BR = '┘'
const LJ = '├'
const RJ = '┤'
const TJ = '┬'
const XJ = '┼'
const BJ = '┴'

export function renderFrameTop(leftW: number, rightW: number): string {
  return `${TL}${H.repeat(leftW)}${TJ}${H.repeat(rightW)}${TR}`
}

export function renderFrameHeaderSep(leftW: number, rightW: number): string {
  return `${LJ}${H.repeat(leftW)}${XJ}${H.repeat(rightW)}${RJ}`
}

export function renderFrameFooterSep(leftW: number, rightW: number): string {
  return `${LJ}${H.repeat(leftW)}${BJ}${H.repeat(rightW)}${RJ}`
}

export function renderFrameBottom(leftW: number, rightW: number): string {
  return `${BL}${H.repeat(leftW)}${BJ}${H.repeat(rightW)}${BR}`
}

// ── Key hints ──

export function renderKeyHints(): string {
  return `  Mute: &é"'(-èà   Solo: 1234567`
}