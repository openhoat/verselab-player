import { readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

export interface KeyBindings {
  mute: string[]
  muteAll: string
  solo: string[]
}

const PRESETS: Record<string, KeyBindings> = {
  azerty: {
    mute: ['&', 'é', '"', "'", '(', '-', 'è'],
    muteAll: 'à',
    solo: ['1', '2', '3', '4', '5', '6', '7'],
  },
  qwerty: {
    mute: ['1', '2', '3', '4', '5', '6', '7'],
    muteAll: '0',
    solo: ['!', '@', '#', '$', '%', '^', '&'],
  },
}

function expandTilde(p: string): string {
  return p.startsWith('~/') ? join(homedir(), p.slice(2)) : p
}

function loadFromFile(path: string): KeyBindings | null {
  try {
    const json = JSON.parse(readFileSync(expandTilde(path), 'utf-8'))
    if (Array.isArray(json.mute) && typeof json.muteAll === 'string' && Array.isArray(json.solo)) {
      return json as KeyBindings
    }
  } catch {}
  return null
}

export function loadKeybindings(): KeyBindings {
  const file = process.env.VERSELAB_KEYBINDINGS
  if (file) {
    const loaded = loadFromFile(file)
    if (loaded) return loaded
  }
  const preset = (process.env.VERSELAB_KEYBOARD ?? 'azerty').toLowerCase()
  return PRESETS[preset] ?? PRESETS.azerty
}

export function buildMuteMap(kb: KeyBindings): Record<string, number> {
  const map: Record<string, number> = {}
  kb.mute.forEach((k, i) => { map[k] = i + 1 })
  map[kb.muteAll] = 0
  return map
}

export function buildSoloMap(kb: KeyBindings): Record<string, number> {
  const map: Record<string, number> = {}
  kb.solo.forEach((k, i) => { map[k] = i + 1 })
  return map
}
