import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { load as parseYaml } from 'js-yaml'
import chalk from 'chalk'
import { songsHome } from '../core/paths.js'

export function printSongList(): void {
  const home = songsHome()

  if (!existsSync(home)) {
    console.error(chalk.red('✕') + `  Songs directory not found: ${home}`)
    console.error(`Set VERSELAB_SONGS_HOME to point to your songs directory.`)
    process.exit(1)
  }

  const songs = readdirSync(home, { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(join(home, d.name, 'song.yml')))
    .map(d => {
      const songFile = join(home, d.name, 'song.yml')
      try {
        const raw = parseYaml(readFileSync(songFile, 'utf-8')) as Record<string, unknown>
        const meta = raw.meta as { title?: string; bpm?: number } | undefined
        const arrangement = raw.arrangement as unknown[] | undefined
        return {
          dir: d.name,
          title: meta?.title ?? d.name,
          bpm: meta?.bpm,
          sections: arrangement?.length,
        }
      } catch {
        return { dir: d.name, title: d.name, bpm: undefined, sections: undefined }
      }
    })
    .sort((a, b) => a.title.localeCompare(b.title))

  if (songs.length === 0) {
    console.log(`No songs found in ${home}`)
    return
  }

  console.log(chalk.dim(`Songs in ${home}\n`))

  const dirWidth = Math.max(...songs.map(s => s.dir.length), 4)
  const titleWidth = Math.max(...songs.map(s => s.title.length), 5)

  console.log(
    chalk.bold('DIRECTORY'.padEnd(dirWidth + 2)) +
    chalk.bold('TITLE'.padEnd(titleWidth + 2)) +
    chalk.bold('BPM'.padEnd(6)) +
    chalk.bold('SECTIONS')
  )
  console.log(chalk.dim('─'.repeat(dirWidth + titleWidth + 20)))

  for (const s of songs) {
    const dir = chalk.cyan(s.dir.padEnd(dirWidth + 2))
    const title = s.title.padEnd(titleWidth + 2)
    const bpm = s.bpm !== undefined ? String(s.bpm).padEnd(6) : chalk.dim('─'.padEnd(6))
    const sections = s.sections !== undefined ? String(s.sections) : chalk.dim('─')
    console.log(`${dir}${title}${bpm}${sections}`)
  }

  console.log()
  console.log(chalk.dim(`${songs.length} song(s)  —  verselab-play <directory> to play`))
}
