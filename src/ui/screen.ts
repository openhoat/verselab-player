import chalk from 'chalk'
import { term } from './termkit.js'
import {
  renderStepGrid, renderVelocityGraph, renderTrackSeparator,
  renderTrackLabel, renderTransport, renderPosition,
  renderBPM, renderVUMeter, renderTitle, renderConnection,
  renderFrameTop, renderFrameHeaderSep, renderFrameFooterSep, renderFrameBottom,
  renderKeyHints, type TrackDisplayCtx,
} from './render.js'
import type { DisplayInfo } from '../clock-worker.js'
import type { Track } from '../player.js'
import { loadKeybindings, buildMuteMap, buildSoloMap } from '../core/keybindings.js'

interface Layout {
  width: number
  height: number
  leftWidth: number
  rightWidth: number
  headerRow: number
  headerSepRow: number
  trackStartRow: number
  stride: number
  footerSepRow: number
  keyHintRow: number
  bottomRow: number
  rightTransportRow: number
  rightBarRow: number
  rightProgressRow: number
  rightVUStartRow: number
}

// Strip ANSI escape codes for length calculation
const ANSI_RE = /\x1b\[[0-9;]*m/g
function visLen(s: string): number {
  return s.replace(ANSI_RE, '').length
}
function padRight(s: string, width: number): string {
  const vl = visLen(s)
  return vl >= width ? s : s + ' '.repeat(width - vl)
}

const KB = loadKeybindings()
const muteKeys = buildMuteMap(KB)
const soloKeys = buildSoloMap(KB)
const muteKeyForChannel = new Map<number, string>(
  KB.mute.map((k, i) => [i + 1, k] as [number, string])
)

export class PlayerScreen {
  private layout!: Layout
  private tracks!: Track[]
  private control!: Int32Array
  private displayInfo: DisplayInfo | null = null
  private displayInterval: ReturnType<typeof setInterval> | null = null
  private waitBlinker: ReturnType<typeof setInterval> | null = null
  private onExit: (() => void) | null = null
  private workerActive = false
  private beatPulseAt = 0
  private lastBeat = -1
  private trackActivity: number[] = []
  private prevTrackPos: number[] = []
  // Right column dirty tracking
  private prevTransport = ''
  private prevBarStr = ''
  private prevProgress = ''
  private prevBPM = ''
  private prevVU: string[] = []
  private title = ''
  private bpm = 80
  private portName = ''
  private stopHint = ''
  private soloActive = false
  private soloChannel = 0
  private preSoloMutes = 0

  init(tracks: Track[], control: Int32Array) {
    this.tracks = tracks
    this.control = control
    this.trackActivity = new Array(tracks.length).fill(0)
    this.prevTrackPos = new Array(tracks.length).fill(-1)
    this.prevVU = new Array(tracks.length).fill('')
    this.layout = this.computeLayout(tracks.length)

    term.fullscreen()
    term.grabInput({ mouse: false })
    term.hideCursor(true)

    term.on('key', (name: string, _matches: string[], data: { isCharacter: boolean; codepoints: number[] }) => {
      if (name === 'ESCAPE' || name === 'CTRL_C') { this.onExit?.(); return }
      if (!this.workerActive) return
      const ch = data.codepoints?.[0] ? String.fromCodePoint(data.codepoints[0]) : (data.isCharacter ? name : '')
      if (!ch) return
      this.handleMuteSolo(ch)
    })

    term.on('resize', () => this.handleResize())
  }

  setOnExit(cb: () => void) {
    this.onExit = cb
  }

  drawConnection(portName: string, stopHint: string) {
    this.portName = portName
    this.stopHint = stopHint
    this.drawHeader()
  }

  drawTitle(title: string, bpm: number) {
    this.title = title
    this.bpm = bpm
    this.drawHeader()
  }

  drawTracks() {
    this.drawAllTracks()
  }

  startDisplayLoop() {
    this.displayInterval = setInterval(() => {
      if (!this.displayInfo) return
      const info = this.displayInfo

      // Beat pulse
      const currentBeat = Math.floor(info.step / 4)
      if (currentBeat !== this.lastBeat) {
        this.beatPulseAt = Date.now()
        this.lastBeat = currentBeat
      }

      // VU activity
      for (let i = 0; i < this.tracks.length; i++) {
        const track = this.tracks[i]
        const trackPos = info.step % track.steps
        const hasNote = track.events.some(e => e.step === trackPos + 1)
        if (hasNote) {
          this.trackActivity[i] = 1.0
        } else {
          this.trackActivity[i] = Math.max(0, this.trackActivity[i] - 0.3)
        }
      }

      // Redraw step grids (only tracks where playhead moved)
      this.drawStepGrids(info)

      // Redraw right column (only changed parts)
      this.drawRightColumn(info)
    }, 80)
  }

  setDisplayInfo(info: DisplayInfo) {
    this.displayInfo = info
  }

  setWorkerActive(active: boolean) {
    this.workerActive = active
  }

  drawMessage(msg: string) {
    this.writeAt(this.layout.keyHintRow, 2, msg, this.layout.leftWidth - 2)
  }

  clearMessage() {
    this.writeAt(this.layout.keyHintRow, 2, '', this.layout.leftWidth - 2)
  }

  startWaitBlinker() {
    let visible = true
    this.waitBlinker = setInterval(() => {
      visible = !visible
      if (visible) this.writeAt(this.layout.keyHintRow, 2, chalk.dim('  Waiting for MV-1 START…'), this.layout.leftWidth - 2)
      else this.writeAt(this.layout.keyHintRow, 2, '', this.layout.leftWidth - 2)
    }, 500)
  }

  stopWaitBlinker() {
    if (this.waitBlinker) { clearInterval(this.waitBlinker); this.waitBlinker = null }
    this.clearMessage()
  }

  showStopped() {
    this.writeAt(this.layout.keyHintRow, 2, `  ${chalk.red('■')}  Stopped`, this.layout.leftWidth - 2)
  }

  rebuildLayout(trackCount: number) {
    this.layout = this.computeLayout(trackCount)
  }

  setTracks(tracks: Track[]) {
    this.tracks = tracks
    this.trackActivity = new Array(tracks.length).fill(0)
    this.prevTrackPos = new Array(tracks.length).fill(-1)
    this.prevVU = new Array(tracks.length).fill('')
    this.invalidateRightColumn()
  }

  updateTracks(tracks: Track[]) {
    const countChanged = tracks.length !== this.tracks.length
    this.setTracks(tracks)
    if (countChanged) {
      this.rebuildLayout(tracks.length)
      this.drawAll()
    } else {
      this.drawAllTracks()
      this.invalidateRightColumn()
    }
  }

  destroy() {
    if (this.displayInterval) clearInterval(this.displayInterval)
    if (this.waitBlinker) clearInterval(this.waitBlinker)
    term.hideCursor(false)
    term.grabInput(false)
    term.fullscreen(false)
  }

  // ── Private: Layout ──

  private computeLayout(trackCount: number): Layout {
    const w = (term.width && term.width < Infinity) ? term.width : 80
    const h = (term.height && term.height < Infinity) ? term.height : 24

    const leftWidth = Math.max(40, Math.floor(w * 0.65))
    const rightWidth = Math.max(20, w - leftWidth - 3)

    const headerRow = 2
    const headerSepRow = 3
    const trackStartRow = 4

    // Adaptive stride: label + grid + vel + separator, spread to fill height
    const availTrackRows = Math.max(0, h - 6)
    const stride = Math.min(8, Math.max(4, Math.floor(availTrackRows / Math.max(1, trackCount))))
    const footerSepRow = trackStartRow + (trackCount - 1) * stride + 3
    const keyHintRow = footerSepRow + 1
    const bottomRow = keyHintRow + 1

    const rightTransportRow = headerRow
    const rightBarRow = headerSepRow + 1
    const rightProgressRow = rightBarRow + 1
    const rightVUStartRow = Math.max(rightProgressRow + 2, trackStartRow)

    return {
      width: w, height: h,
      leftWidth, rightWidth,
      headerRow, headerSepRow,
      trackStartRow, stride, footerSepRow,
      keyHintRow, bottomRow,
      rightTransportRow, rightBarRow, rightProgressRow, rightVUStartRow,
    }
  }

  // ── Private: Drawing ──

  private drawFullFrame() {
    const { leftWidth, rightWidth } = this.layout
    this.writeAt(1, 1, renderFrameTop(leftWidth, rightWidth))
    this.writeAt(this.layout.headerSepRow, 1, renderFrameHeaderSep(leftWidth, rightWidth))
    this.writeAt(this.layout.footerSepRow, 1, renderFrameFooterSep(leftWidth, rightWidth))
    this.writeAt(this.layout.bottomRow, 1, renderFrameBottom(leftWidth, rightWidth))
  }

  private drawHeader() {
    const { leftWidth, rightWidth, headerRow } = this.layout
    const left = renderConnection(this.portName, this.stopHint)
    const right = renderTitle(this.title, this.bpm)
    this.writeFullRow(headerRow, left, right)
  }

  private trackCtx(track: Track): TrackDisplayCtx {
    return {
      muteKey: muteKeyForChannel.get(track.channel),
      soloActive: this.soloActive,
      soloChannel: this.soloChannel,
      preSoloMutes: this.preSoloMutes,
    }
  }

  private drawAllTracks() {
    const gw = this.layout.leftWidth - 2
    const { stride, trackStartRow } = this.layout
    const di = this.displayInfo ?? this.dummyDisplayInfo()
    for (let i = 0; i < this.tracks.length; i++) {
      const base = trackStartRow + i * stride
      const track = this.tracks[i]
      const ctx = this.trackCtx(track)
      this.writeAt(base, 2, renderTrackLabel(track, this.control, this.displayInfo, gw, ctx), gw)
      this.writeAt(base + 1, 2, renderStepGrid(track, di, gw), gw)
      this.writeAt(base + 2, 2, renderVelocityGraph(track, di, gw), gw)
      if (i < this.tracks.length - 1) {
        this.writeAt(base + 3, 2, renderTrackSeparator(gw), gw)
      }
    }
    this.prevTrackPos = this.tracks.map((t) =>
      this.displayInfo ? this.displayInfo.step % t.steps : -1
    )
  }

  private drawStepGrids(info: DisplayInfo) {
    const gw = this.layout.leftWidth - 2
    const { stride, trackStartRow } = this.layout
    const avail = gw - 2
    const numGroups = Math.max(2, Math.min(8, Math.floor((avail + 1) / 5)))
    const stepsPerPage = numGroups * 4

    for (let i = 0; i < this.tracks.length; i++) {
      const track = this.tracks[i]
      const trackPos = info.step % track.steps
      const prevPos = this.prevTrackPos[i]

      const pageChanged = prevPos >= 0 && Math.floor(trackPos / stepsPerPage) !== Math.floor(prevPos / stepsPerPage)
      const playheadMoved = trackPos !== prevPos

      const base = trackStartRow + i * stride

      if (pageChanged || prevPos < 0) {
        this.writeAt(base, 2, renderTrackLabel(track, this.control, info, gw, this.trackCtx(track)), gw)
        this.writeAt(base + 1, 2, renderStepGrid(track, info, gw), gw)
        this.writeAt(base + 2, 2, renderVelocityGraph(track, info, gw), gw)
      } else if (playheadMoved) {
        this.writeAt(base + 1, 2, renderStepGrid(track, info, gw), gw)
        this.writeAt(base + 2, 2, renderVelocityGraph(track, info, gw), gw)
      }

      this.prevTrackPos[i] = trackPos
    }
  }

  private drawRightColumn(info: DisplayInfo) {
    const { rightWidth, rightTransportRow, rightBarRow, rightProgressRow, rightVUStartRow } = this.layout
    const leftCol = this.layout.leftWidth + 3
    const w = this.layout.rightWidth

    // Transport — only if changed
    const transport = renderTransport(info)
    if (transport !== this.prevTransport) {
      this.writeAt(rightTransportRow, leftCol, transport, w)
      this.prevTransport = transport
    }

    // Bar:beat — only if changed
    const bar = Math.floor(info.totalStep / 16) + 1
    const beat = Math.floor((info.totalStep % 16) / 4) + 1
    const barStr = `  bar ${bar}:${beat} / ${info.totalBars}`
    if (barStr !== this.prevBarStr) {
      this.writeAt(rightBarRow, leftCol, barStr, w)
      this.prevBarStr = barStr
    }

    // Progress — only if changed
    const progress = renderPosition(info, w)
    if (progress !== this.prevProgress) {
      this.writeAt(rightProgressRow, leftCol, progress, w)
      this.prevProgress = progress
    }

    // BPM — only if changed
    const bpmStr = renderBPM(this.bpm, Date.now() - this.beatPulseAt)
    if (bpmStr !== this.prevBPM) {
      const bpmRow = this.layout.headerSepRow + 1
      this.writeAt(bpmRow, leftCol + 2, bpmStr, w - 2)
      this.prevBPM = bpmStr
    }

    // VU meters — only if level changed significantly
    for (let i = 0; i < this.tracks.length; i++) {
      const row = rightVUStartRow + i
      if (row >= this.layout.footerSepRow) break
      const track = this.tracks[i]
      const vu = renderVUMeter(track, this.trackActivity[i], this.control)
      if (vu !== this.prevVU[i]) {
        this.writeAt(row, leftCol, vu, w)
        this.prevVU[i] = vu
      }
    }
  }

  private drawKeyHints() {
    this.writeAt(this.layout.keyHintRow, 2, renderKeyHints(KB), this.layout.leftWidth - 2)
  }

  private drawAll() {
    term.clear()
    this.drawFullFrame()
    this.drawHeader()
    this.drawAllTracks()
    this.drawKeyHints()
    this.invalidateRightColumn()
    if (this.displayInfo) {
      this.drawRightColumn(this.displayInfo)
    }
  }

  private invalidateRightColumn() {
    this.prevTransport = ''
    this.prevBarStr = ''
    this.prevProgress = ''
    this.prevBPM = ''
    this.prevVU = new Array(this.tracks.length).fill('')
  }

  // ── Private: Resize ──

  private handleResize() {
    const w = term.width
    const h = term.height
    if (w === this.layout.width && h === this.layout.height) return
    this.layout = this.computeLayout(this.tracks.length)
    this.prevTrackPos = new Array(this.tracks.length).fill(-1)
    this.invalidateRightColumn()
    this.drawAll()
  }

  // ── Private: Terminal output (flicker-free) ──

  private writeAt(row: number, col: number, text: string, width?: number) {
    const padded = width !== undefined ? padRight(text, width) : text
    term.moveTo(col, row)(padded)
  }

  private writeFullRow(row: number, left: string, right: string) {
    const { leftWidth, rightWidth } = this.layout
    const leftContent = padRight(left.slice(0, leftWidth), leftWidth)
    const rightContent = padRight(right.slice(0, rightWidth), rightWidth)
    term.moveTo(1, row)(chalk.dim('│') + leftContent + chalk.dim('│') + rightContent + chalk.dim('│'))
  }

  // ── Private: Mute/Solo ──

  private handleMuteSolo(ch: string) {
    const muteCh = muteKeys[ch]
    const soloCh = soloKeys[ch]

    if (muteCh === 0) {
      this.soloActive = false
      const anyOn = this.tracks.some(t => (Atomics.load(this.control, 1) & (1 << t.channel)) === 0)
      const allMask = this.tracks.reduce((m, t) => m | (1 << t.channel), 0)
      Atomics.store(this.control, 1, anyOn ? allMask : 0)
      this.drawAllTracks()
      this.invalidateRightColumn()
    } else if (muteCh) {
      this.soloActive = false
      const wasMuted = (Atomics.load(this.control, 1) & (1 << muteCh)) !== 0
      const mask = 1 << muteCh
      const cur = Atomics.load(this.control, 1)
      Atomics.store(this.control, 1, wasMuted ? cur & ~mask : cur | mask)
      this.drawAllTracks()
      this.invalidateRightColumn()
    } else if (soloCh) {
      if (this.soloActive && this.soloChannel === soloCh) {
        // Second press on same channel: restore pre-solo state
        this.soloActive = false
        Atomics.store(this.control, 1, this.preSoloMutes)
      } else {
        const track = this.tracks.find(t => t.channel === soloCh)
        if (!track) return
        this.preSoloMutes = Atomics.load(this.control, 1)
        this.soloActive = true
        this.soloChannel = soloCh
        const allMask = this.tracks.reduce((m, t) => m | (1 << t.channel), 0)
        Atomics.store(this.control, 1, allMask & ~(1 << soloCh))
      }
      this.drawAllTracks()
      this.invalidateRightColumn()
    }
  }

  private dummyDisplayInfo(): DisplayInfo {
    return { section: '', rep: 1, totalReps: 1, step: 0, globalSteps: 16, totalStep: 0, totalBars: 1 }
  }
}