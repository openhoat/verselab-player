import { existsSync, mkdirSync, copyFileSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve, join, relative, dirname, basename } from 'path'
import { fileURLToPath } from 'url'
import chalk from 'chalk'
import { songsHome } from '../core/paths.js'

const __filename = fileURLToPath(import.meta.url)

const SCHEMAS_SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'schemas')
const SCHEMA_DIR = '.schemas'
const SCHEMA_COMMENT = '# yaml-language-server: $schema='

function detectSchema(filePath: string): string | null {
  const parts = filePath.split('/')
  const name = basename(filePath)
  if (name === 'song.yml') return 'song.schema.yml'
  if (parts.includes('sections')) return 'section.schema.yml'
  if (parts.includes('sequences')) {
    if (name === 'chords.yml' || name === 'aliases.yml') return 'chords.schema.yml'
    return 'track.schema.yml'
  }
  return null
}

function injectSchema(filePath: string, schemasDir: string): 'added' | 'already' | 'skipped' {
  const schemaName = detectSchema(filePath)
  if (!schemaName) return 'skipped'

  const rel = relative(dirname(filePath), schemasDir)
  const schemaRef = `${SCHEMA_COMMENT}${rel}/${schemaName}`

  const content = readFileSync(filePath, 'utf-8')
  if (content.startsWith(SCHEMA_COMMENT)) return 'already'

  writeFileSync(filePath, `${schemaRef}\n${content}`)
  return 'added'
}

function walkYaml(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === SCHEMA_DIR) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) results.push(...walkYaml(full))
    else if (entry.name.endsWith('.yml') || entry.name.endsWith('.yaml')) results.push(full)
  }
  return results
}

function main() {
  const home = songsHome()

  if (!existsSync(home)) {
    console.error(chalk.red('✕') + `  Songs directory not found: ${home}`)
    process.exit(1)
  }

  // Copy schemas
  const schemasDir = join(home, SCHEMA_DIR)
  mkdirSync(schemasDir, { recursive: true })
  for (const f of readdirSync(SCHEMAS_SRC).filter(f => f.endsWith('.yml'))) {
    copyFileSync(join(SCHEMAS_SRC, f), join(schemasDir, f))
  }
  console.log(chalk.green('✓') + `  Schemas copied to ${schemasDir}`)

  // Inject comments
  let added = 0, already = 0, skipped = 0
  for (const file of walkYaml(home)) {
    const result = injectSchema(file, schemasDir)
    if (result === 'added') { added++; console.log(chalk.green('  +') + `  ${relative(home, file)}`) }
    else if (result === 'already') already++
    else skipped++
  }

  console.log()
  const parts = []
  if (added) parts.push(chalk.green(`${added} updated`))
  if (already) parts.push(chalk.dim(`${already} already set`))
  if (skipped) parts.push(chalk.dim(`${skipped} skipped`))
  console.log(parts.join('  '))
}

if (process.argv[1] && fileURLToPath(__filename) === resolve(process.argv[1])) {
  try {
    main()
  } catch (err) {
    console.error(chalk.red('Fatal error:'), err instanceof Error ? err.message : err)
    process.exit(1)
  }
}
