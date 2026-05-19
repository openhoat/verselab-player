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
}

export interface ScheduledEvent {
  timeMs: number
  message?: number[]
  firstLoopOnly?: boolean
  display?: DisplayInfo
}

const control = new Int32Array((workerData as { controlBuffer: SharedArrayBuffer }).controlBuffer)
const out = new midi.Output()

const send = (msg: number[]) => (out.sendMessage as (m: number[]) => void)(msg)

let noClockMode = false

function isMuted(channel: number): boolean {
  return (Atomics.load(control, 1) & (1 << channel)) !== 0
}

function allNotesOff() {
  if (!noClockMode) {
    try { send([0xFC]) } catch {}
  }
  for (let ch = 0; ch < 16; ch++) {
    try { send([0xB0 | ch, 120, 0]) } catch {}
    try { send([0xB0 | ch, 123, 0]) } catch {}
  }
}

function runLoop(schedule: ScheduledEvent[], loopMs: number, loop: boolean) {
  let loopStart = performance.now()
  let idx = 0
  let firstLoop = true
  let prevMuted = 0

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

    const now = performance.now()
    const t = now - loopStart

    while (idx < schedule.length) {
      const evt = schedule[idx]
      if (evt.timeMs > t) break
      if (evt.message && (!evt.firstLoopOnly || firstLoop)) {
        const cmd = evt.message[0] & 0xf0
        const ch = evt.message[0] & 0x0f
        // Only filter Note On on muted channels — let Note Off through for cleanup
        if (cmd === 0x90 && isMuted(ch + 1)) { idx++; continue }
        send(evt.message)
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

function play(schedule: ScheduledEvent[], loopMs: number, loop: boolean, noClock = false) {
  noClockMode = noClock
  // If exit was requested while we were transitioning, don't start a new loop
  if (Atomics.load(control, 0) === 2) {
    out.closePort()
    parentPort!.postMessage({ type: 'done' })
    return
  }
  Atomics.store(control, 0, 0)
  runLoop(schedule, loopMs, loop)
  allNotesOff()

  const ctrl = Atomics.load(control, 0)
  if (ctrl === 2) {
    out.closePort()
    parentPort!.postMessage({ type: 'done' })
    return
  }
  if (ctrl === 3) {
    // Cycle ended, reload data is queued in message port — yield to event loop
    parentPort!.postMessage({ type: 'restarting' })
    Atomics.store(control, 0, 0)
    return
  }
  parentPort!.postMessage({ type: 'stopped' })
}

type WorkerInboundMessage =
  | { type: 'start'; portIndex: number; schedule: ScheduledEvent[]; loopMs: number; loop?: boolean; noClock?: boolean }
  | { type: 'reload'; schedule: ScheduledEvent[]; loopMs: number; loop?: boolean; noClock?: boolean }

export type WorkerOutboundMessage =
  | { type: 'display'; info: DisplayInfo }
  | { type: 'done' }
  | { type: 'restarting' }
  | { type: 'stopped' }

parentPort!.on('message', (msg: WorkerInboundMessage) => {
  if (msg.type === 'start') {
    out.openPort(msg.portIndex)
    play(msg.schedule, msg.loopMs, msg.loop ?? true, msg.noClock ?? false)
  } else if (msg.type === 'reload') {
    // Schedule data arrives here after runLoop yields (ctrl=3 broke the loop)
    play(msg.schedule, msg.loopMs, msg.loop ?? true, msg.noClock ?? false)
  }
})