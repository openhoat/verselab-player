import { describe, expect, test } from 'vitest'
import { buildSchedule, type SectionDef, type Track } from '../../src/player.js'

function makeTrack(channel: number, steps: number, clip: number = 1): Track {
  return {
    name: `ch${channel}`,
    channel,
    clip,
    steps,
    events: [{ step: 1, note: 60, velocity: 100 }],
  }
}

describe('buildSchedule clip changes', () => {
  test('sends clip change on each active track channel at section transitions', () => {
    const sections: SectionDef[] = [
      { name: 'verse', key: '1', tracks: [makeTrack(4, 16, 1), makeTrack(5, 16, 1)], repeat: 1 },
      { name: 'bridge', key: '2', tracks: [makeTrack(4, 16, 2), makeTrack(5, 16, 2)], repeat: 1 },
    ]

    const { schedule } = buildSchedule(sections, 92, {}, false)

    // Filter for Program Change events (0xC0-0xCF range)
    const pcEvents = schedule.filter(e => e.message && e.message[0] >= 0xC0 && e.message[0] <= 0xCF)

    // Section 1 start: PC on ch4 (0xC3) with value 0, ch5 (0xC4) with value 0
    // Section 2 start: PC on ch4 (0xC3) with value 1, ch5 (0xC4) with value 1
    expect(pcEvents.length).toBe(4)

    // Section 1: channel 4 → PC 0 (clip 1), channel 5 → PC 0 (clip 1)
    const section1Pcs = pcEvents.filter(e => e.message![1] === 0)
    expect(section1Pcs.length).toBe(2)
    expect(section1Pcs.some(e => e.message![0] === 0xC3)).toBe(true)  // ch4
    expect(section1Pcs.some(e => e.message![0] === 0xC4)).toBe(true)  // ch5

    // Section 2: channel 4 → PC 1 (clip 2), channel 5 → PC 1 (clip 2)
    const section2Pcs = pcEvents.filter(e => e.message![1] === 1)
    expect(section2Pcs.length).toBe(2)
    expect(section2Pcs.some(e => e.message![0] === 0xC3)).toBe(true)
    expect(section2Pcs.some(e => e.message![0] === 0xC4)).toBe(true)
  })

  test('respects track mute state — only sends PC on active tracks', () => {
    const sections: SectionDef[] = [
      { name: 'verse', key: '1', tracks: [makeTrack(4, 16, 1), makeTrack(5, 16, 1)], repeat: 1 },
    ]

    // Mute channel 5, keep channel 4 active
    const { schedule } = buildSchedule(sections, 120, { '4': true, '5': false }, true)

    const pcEvents = schedule.filter(e => e.message && e.message[0] >= 0xC0 && e.message[0] <= 0xCF)

    // Only channel 4 should get a PC
    expect(pcEvents.length).toBe(1)
    expect(pcEvents[0].message![0]).toBe(0xC3)  // ch4
  })

  test('uses explicit clip number for PC values', () => {
    // Simulates different clip assignments per track
    const sections: SectionDef[] = [
      { name: 'Intro', key: 'intro', tracks: [makeTrack(4, 16, 3), makeTrack(5, 16, 3)], repeat: 2 },
      { name: 'Verse', key: 'verse', tracks: [makeTrack(4, 16, 1), makeTrack(5, 16, 2)], repeat: 4 },
      { name: 'Chorus', key: 'chorus', tracks: [makeTrack(4, 16, 5), makeTrack(5, 16, 5)], repeat: 4 },
    ]

    const { schedule } = buildSchedule(sections, 65, {}, false)
    const pcEvents = schedule.filter(e => e.message && e.message[0] >= 0xC0 && e.message[0] <= 0xCF)

    // 3 section transitions × 2 tracks = 6 PC events
    expect(pcEvents.length).toBe(6)

    // Intro → PC 2 (clip 3) on both channels
    const introPcs = pcEvents.filter(e => e.message![1] === 2)
    expect(introPcs.length).toBe(2)

    // Verse → ch4 gets PC 0 (clip 1), ch5 gets PC 1 (clip 2)
    const versePcsCh4 = pcEvents.filter(e => e.message![0] === 0xC3 && e.message![1] === 0)
    const versePcsCh5 = pcEvents.filter(e => e.message![0] === 0xC4 && e.message![1] === 1)
    expect(versePcsCh4.length).toBe(1)
    expect(versePcsCh5.length).toBe(1)

    // Chorus → PC 4 (clip 5) on both channels
    const chorusPcs = pcEvents.filter(e => e.message![1] === 4)
    expect(chorusPcs.length).toBe(2)
  })

  test('sends only one clip change per channel even with repeats', () => {
    const sections: SectionDef[] = [
      { name: 'verse', key: '1', tracks: [makeTrack(4, 16, 1)], repeat: 3 },
    ]

    const { schedule } = buildSchedule(sections, 120, {}, false)
    const pcEvents = schedule.filter(e => e.message && e.message[0] >= 0xC0 && e.message[0] <= 0xCF)

    // Only 1 clip change per track at the start, not per repeat
    expect(pcEvents.length).toBe(1)
  })

  test('sends clip change at each transition even when returning to same clip', () => {
    const sections: SectionDef[] = [
      { name: 'verse', key: '1', tracks: [makeTrack(4, 16, 1)], repeat: 1 },
      { name: 'bridge', key: '2', tracks: [makeTrack(4, 16, 2)], repeat: 1 },
      { name: 'verse', key: '1', tracks: [makeTrack(4, 16, 1)], repeat: 1 },
    ]

    const { schedule } = buildSchedule(sections, 120, {}, false)
    const pcEvents = schedule.filter(e => e.message && e.message[0] >= 0xC0 && e.message[0] <= 0xCF)

    // Initial + bridge transition + verse return = 3 PCs
    // (Returning to clip 1 from clip 2 still needs a PC)
    expect(pcEvents.length).toBe(3)
    expect(pcEvents[0].message![1]).toBe(0)  // verse → clip 1
    expect(pcEvents[1].message![1]).toBe(1)  // bridge → clip 2
    expect(pcEvents[2].message![1]).toBe(0)  // verse again → clip 1
  })

  test('deduplicates PCs when same clip is already active', () => {
    // Two sections with the same clip on the same track
    const sections: SectionDef[] = [
      { name: 'verse', key: '1', tracks: [makeTrack(4, 16, 2)], repeat: 1 },
      { name: 'bridge', key: '2', tracks: [makeTrack(4, 16, 2)], repeat: 1 },
    ]

    const { schedule } = buildSchedule(sections, 120, {}, false)
    const pcEvents = schedule.filter(e => e.message && e.message[0] >= 0xC0 && e.message[0] <= 0xCF)

    // Only the initial PC — no PC for bridge since clip hasn't changed
    expect(pcEvents.length).toBe(1)
    expect(pcEvents[0].message![1]).toBe(1)  // clip 2 → PC 1
  })

  test('schedule still includes MIDI Start and Clock events', () => {
    const sections: SectionDef[] = [
      { name: 'verse', key: '1', tracks: [makeTrack(4, 16)], repeat: 1 },
    ]

    const { schedule } = buildSchedule(sections, 120, {}, false, true)

    const startEvents = schedule.filter(e => e.message && e.message[0] === 0xFA)
    expect(startEvents.length).toBe(1)
    expect(startEvents[0].firstLoopOnly).toBe(true)

    const clockEvents = schedule.filter(e => e.message && e.message[0] === 0xF8)
    expect(clockEvents.length).toBeGreaterThan(0)
  })

  test('sends initial clip change before MIDI Start with preroll, then one bar before section transitions', () => {
    const sections: SectionDef[] = [
      { name: 'verse', key: '1', tracks: [makeTrack(4, 16, 1)], repeat: 1 },
      { name: 'bridge', key: '2', tracks: [makeTrack(4, 16, 2)], repeat: 1 },
    ]

    const bpm = 120
    const stepMs = 60000 / (bpm * 4)  // 125ms per step
    const prerollMs = 4 * stepMs      // PREROLL_STEPS = 4

    const { schedule } = buildSchedule(sections, bpm, {}, false, true)
    const pcEvents = schedule.filter(e => e.message && e.message[0] >= 0xC0 && e.message[0] <= 0xCF)

    // First section: PC at timeMs=-prerollMs (before playback starts), before MIDI Start
    expect(pcEvents[0].timeMs).toBe(-prerollMs)

    // Verify PC comes before Start in the event list (stable sort preserves order)
    const startIdx = schedule.findIndex(e => e.message && e.message[0] === 0xFA)
    const firstPcIdx = schedule.findIndex(e => e.message && e.message[0] >= 0xC0 && e.message[0] <= 0xCF)
    expect(firstPcIdx).toBeLessThan(startIdx)

    // MIDI Start should be at timeMs=0 (playback start)
    expect(schedule[startIdx].timeMs).toBe(0)

    // Second section: PC sent 16 steps (1 bar) before the section boundary
    const section2StartTime = 16 * stepMs
    const advanceMs = 16 * stepMs  // SECTION_ADVANCE_STEPS = 16
    expect(pcEvents[1].timeMs).toBe(section2StartTime - advanceMs)
  })

  test('default behavior omits MIDI Start and Clock events', () => {
    const sections: SectionDef[] = [
      { name: 'verse', key: '1', tracks: [makeTrack(4, 16)], repeat: 1 },
    ]

    // Default sendClock=false: no Start/Clock events
    const { schedule } = buildSchedule(sections, 120, {}, false)

    const startEvents = schedule.filter(e => e.message && e.message[0] === 0xFA)
    expect(startEvents.length).toBe(0)

    const clockEvents = schedule.filter(e => e.message && e.message[0] === 0xF8)
    expect(clockEvents.length).toBe(0)

    // But note events should still be present
    const noteEvents = schedule.filter(e => e.message && (e.message[0] & 0xf0) === 0x90)
    expect(noteEvents.length).toBeGreaterThan(0)
  })
})