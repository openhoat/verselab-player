import { existsSync } from 'fs'
import { resolve, join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function songsHome(): string {
  return process.env.VERSELAB_SONGS_HOME ?? resolve(__dirname, '..', '..', 'songs')
}

export function resolveSongPath(p: string): string {
  if (existsSync(p)) return resolve(p)
  const home = process.env.VERSELAB_SONGS_HOME
  if (home) {
    const candidate = join(home, p)
    if (existsSync(candidate)) return candidate
  }
  return resolve(p)
}
