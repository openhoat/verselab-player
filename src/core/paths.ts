import { existsSync, readdirSync } from 'fs'
import { resolve, join } from 'path'
import { homedir } from 'os'

function expandTilde(p: string): string {
  return p.startsWith('~/') ? join(homedir(), p.slice(2)) : p
}

export function songsHome(): string {
  const raw = process.env.VERSELAB_SONGS_HOME ?? process.cwd()
  return expandTilde(raw)
}

export function resolveSongPath(p: string): string {
  if (existsSync(p)) return resolve(p)
  const candidate = join(songsHome(), p)
  if (existsSync(candidate)) return candidate
  return resolve(p)
}

export function mv1MidiDir(): string | null {
  const mount = process.env.VERSELAB_MOUNT
  if (mount) return join(expandTilde(mount), 'ROLAND', 'MV', 'MIDI')

  const user = process.env.USER ?? process.env.USERNAME ?? ''
  const parents = [
    join('/run/media', user),
    join('/media', user),
    '/Volumes',
  ]

  for (const parent of parents) {
    if (!existsSync(parent)) continue
    try {
      for (const entry of readdirSync(parent)) {
        const candidate = join(parent, entry, 'ROLAND', 'MV', 'MIDI')
        if (existsSync(candidate)) return candidate
      }
    } catch {}
  }

  return null
}
