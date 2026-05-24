import { parentPort, workerData } from 'worker_threads'
import { performance } from 'perf_hooks'
import midi from 'midi'

export interface DisplayInfo {
  section: string
  rep: number
  totalReps: number
  step: number
  globalSteps: number
  totalStep: number
  totalBars: number
  nextSection?: string
}

export interface ScheduledEvent {
  timeMs: number
  message?: number[]
  muteChannel?: number  // 1-indexed channel for mute check (original track channel, before GM remap)
  firstLoopOnly?: boolean
  display?: DisplayInfo
  seqEnd?: boolean  // marks end of one sequence repeat — used for cycle-boundary section nav
}

const control = new Int32Array((workerData as { controlBuffer: SharedArrayBuffer }).controlBuffer)
const out = new midi.Output()
const clockOuts: InstanceType<typeof midi.Output>[] = []

const send = (msg: number[]) => (out.sendMessage as (m: number[]) => void)(msg)

const CLOCK_MSGS = new Set([0xFA, 0xF8, 0xFC])

function sendClock(msg: number[]) {
  for (const co of clockOuts) {
    try { (co.sendMessage as (m: number[]) => void)(msg) } catch {}
  }
}

let noClockMode = false

function isMuted(channel: number): boolean {
  return (Atomics.load(control, 1) & (1 << channel)) !== 0
}

function allNotesOff() {
  if (!noClockMode) {
    try { send([0xFC]) } catch {}
  }
  sendClock([0xFC])
  for (let ch = 0; ch < 16; ch++) {
    try { send([0xB0 | ch, 120, 0]) } catch {}
    try { send([0xB0 | ch, 123, 0]) } catch {}
  }
}

function runLoop(schedule: ScheduledEvent[], loopMs: number, loop: boolean, stepMs: number, startDelayMs = 0) {
  let loopStart = performance.now() + startDelayMs
  let idx = 0
  let firstLoop = true
  let prevMuted = 0
  let seqEndPending = false  // set when a seqEnd marker fires with ctrl=3 pending

  // Timing diagnostics: measure actual step lateness vs schedule
  const DIAG = process.env.VERSELAB_DIAG === '1'
  let maxLateMs = 0

  while (true) {
    const ctrl = Atomics.load(control, 0)
    if (ctrl === 1 || ctrl === 2) break          // stop / exit — immediate

    // Throttled sleep: wakes early if control value changes (e.g. ESC → 2)
    Atomics.wait(control, 0, ctrl, 0.5)

    // Detect newly muted channels and kill their sounding notes
    const curMuted = Atomics.load(control, 1)
    const fresh = curMuted & ~prevMuted
    if (fresh) {
      for (let ch = 1; ch <= 16; ch++) {
        if (fresh & (1 << ch)) {
          try { send([0xB0 | (ch - 1), 120, 0]) } catch {}
          try { send([0xB0 | (ch - 1), 123, 0]) } catch {}
        }
      }
    }
    prevMuted = curMuted

    // Seek: consume accumulated step delta from main thread
    const seekDelta = Atomics.exchange(control, 2, 0)
    if (seekDelta !== 0) {
      for (let ch = 0; ch < 16; ch++) {
        try { send([0xB0 | ch, 123, 0]) } catch {}
      }
      loopStart -= seekDelta * stepMs
      const seekT = performance.now() - loopStart
      if (seekT < 0) loopStart = performance.now()
      else if (seekT >= loopMs) loopStart = performance.now() - loopMs + stepMs * 4
      const adjT = performance.now() - loopStart
      idx = schedule.findIndex(e => e.timeMs > adjT)
      if (idx < 0) idx = schedule.length
      for (let i = idx - 1; i >= 0; i--) {
        if (schedule[i].display) {
          parentPort!.postMessage({ type: 'display', info: schedule[i].display })
          break
        }
      }
    }

    const now = performance.now()
    const t = now - loopStart

    while (idx < schedule.length) {
      const evt = schedule[idx]
      if (evt.timeMs > t) break
      if (evt.seqEnd) {
        // Sequence boundary marker: if a section nav is pending, stop here (not at section end)
        if (Atomics.load(control, 0) === 3) { seqEndPending = true; break }
        idx++
        continue
      }
      if (evt.message && (!evt.firstLoopOnly || firstLoop)) {
        const cmd = evt.message[0] & 0xf0
        const muteCh = evt.muteChannel ?? ((evt.message[0] & 0x0f) + 1)
        if (cmd === 0x90 && isMuted(muteCh)) { idx++; continue }
        const isClock = CLOCK_MSGS.has(evt.message[0])
        if (isClock) {
          if (!clockPrerollDone || !evt.firstLoopOnly) sendClock(evt.message)
          if (!noClockMode) send(evt.message)
        } else {
          send(evt.message)
        }
      }
      if (DIAG && evt.message) {
        const late = t - evt.timeMs
        if (late > maxLateMs) maxLateMs = late
      }
      if (evt.display) {
        parentPort!.postMessage({ type: 'display', info: evt.display })
      }
      idx++
    }

    if (seqEndPending) break

    if (t >= loopMs) {
      if (DIAG) process.stderr.write(`[diag] loop maxLate=${maxLateMs.toFixed(2)}ms\n`)
      if (!loop) break
      // Reload requested — break at cycle end instead of looping
      if (Atomics.load(control, 0) === 3) break
      loopStart += loopMs  // mathematical advance — no jitter accumulation
      idx = 0
      firstLoop = false
      maxLateMs = 0
    }
  }
}

const CLOCKS_PER_STEP = 6
const STEPS_PER_BAR = 16

let clockPrerollDone = false

function clockPreroll(stepMs: number, bars: number) {
  const clockMs = stepMs / CLOCKS_PER_STEP
  const clocksPerBeat = 4 * CLOCKS_PER_STEP
  const totalClocks = bars * STEPS_PER_BAR * CLOCKS_PER_STEP
  const start = performance.now()
  for (let c = 0; c < totalClocks; c++) {
    if (c % clocksPerBeat === 0) {
      const beatIndex = Math.floor(c / clocksPerBeat)
      const bar = Math.floor(beatIndex / 4) + 1
      const beat = (beatIndex % 4) + 1
      parentPort!.postMessage({ type: 'preroll', bar, beat, totalBars: bars })
    }
    const target = start + c * clockMs
    while (performance.now() < target) { /* spin */ }
    sendClock([0xF8])
  }
  sendClock([0xFA])
  clockPrerollDone = true
  parentPort!.postMessage({ type: 'preroll-done' })
}

function closeClockPorts() {
  // Small delay to let MIDI Stop flush before closing
  const deadline = performance.now() + 50
  while (performance.now() < deadline) { /* spin */ }
  for (const co of clockOuts) { try { co.closePort() } catch {} }
  clockOuts.length = 0
}

function play(schedule: ScheduledEvent[], loopMs: number, loop: boolean, noClock = false, stepMs = 0, startDelayMs = 0) {
  noClockMode = noClock
  if (Atomics.load(control, 0) === 2) {
    out.closePort()
    closeClockPorts()
    parentPort!.postMessage({ type: 'done' })
    return
  }
  Atomics.store(control, 0, 0)
  runLoop(schedule, loopMs, loop, stepMs, startDelayMs)
  allNotesOff()

  const ctrl = Atomics.load(control, 0)
  if (ctrl === 2) {
    out.closePort()
    closeClockPorts()
    parentPort!.postMessage({ type: 'done' })
    return
  }
  if (ctrl === 3) {
    parentPort!.postMessage({ type: 'restarting' })
    Atomics.store(control, 0, 0)
    return
  }
  parentPort!.postMessage({ type: 'stopped' })
}

type WorkerInboundMessage =
  | { type: 'start'; portIndex: number; clockPortIndices?: number[]; prerollBars?: number; schedule: ScheduledEvent[]; loopMs: number; loop?: boolean; noClock?: boolean; stepMs?: number; startDelayMs?: number }
  | { type: 'reload'; schedule: ScheduledEvent[]; loopMs: number; loop?: boolean; noClock?: boolean; stepMs?: number }

export type WorkerOutboundMessage =
  | { type: 'display'; info: DisplayInfo }
  | { type: 'preroll'; bar: number; beat: number; totalBars: number }
  | { type: 'preroll-done' }
  | { type: 'done' }
  | { type: 'restarting' }
  | { type: 'stopped' }

parentPort!.on('message', (msg: WorkerInboundMessage) => {
  if (msg.type === 'start') {
    out.openPort(msg.portIndex)
    for (const idx of msg.clockPortIndices ?? []) {
      const co = new midi.Output()
      co.openPort(idx)
      clockOuts.push(co)
    }
    if (clockOuts.length > 0 && msg.prerollBars && msg.stepMs) {
      clockPreroll(msg.stepMs, msg.prerollBars)
    }
    play(msg.schedule, msg.loopMs, msg.loop ?? true, msg.noClock ?? false, msg.stepMs ?? 0, msg.startDelayMs ?? 0)
  } else if (msg.type === 'reload') {
    // Schedule data arrives here after runLoop yields (ctrl=3 broke the loop)
    play(msg.schedule, msg.loopMs, msg.loop ?? true, msg.noClock ?? false, msg.stepMs ?? 0)
  }
})