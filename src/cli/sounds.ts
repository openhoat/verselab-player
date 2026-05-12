import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve, join, relative } from 'path'
import { load as parseYaml } from 'js-yaml'
import {
  loadCatalog,
  searchByName,
  resolveSound,
  type SoundEntry,
  type Section,
} from '../sound-catalog.js'
import { songsHome } from '../core/paths.js'

// ─── Helpers ────────────────────────────────────────────────────────────────

function pad(s: string, len: number) { return s.padEnd(len) }

function formatEntry(e: SoundEntry) {
  return `${pad(e.canonical, 40)} ${pad(e.category, 18)} ${e.section}`
}

/** Infer section hint from filename: drums → DrumKit, others → Tone */
function inferSectionHint(filePath: string): Section | undefined {
  const name = filePath.toLowerCase()
  if (name.includes('drums') || name.includes('drum')) return 'DrumKit'
  return 'Tone'
}

// ─── search ─────────────────────────────────────────────────────────────────

function cmdSearch(query: string) {
  const results = searchByName(query)
  if (results.length === 0) {
    console.log(`No sounds matching "${query}"`)
    return
  }
  console.log(`Found ${results.length} sound(s):\n`)
  console.log(pad('NAME [CODE]', 40) + pad('CATEGORY', 18) + 'SECTION')
  console.log('-'.repeat(75))
  for (const e of results) console.log(formatEntry(e))
}

// ─── list ───────────────────────────────────────────────────────────────────

function cmdList(filters: { section?: string; category?: string; bank?: string }) {
  let entries = loadCatalog()
  if (filters.section) entries = entries.filter(e => e.section === filters.section)
  if (filters.category) entries = entries.filter(e => e.category.toLowerCase() === filters.category!.toLowerCase())
  if (filters.bank) entries = entries.filter(e => e.bank === filters.bank)

  if (entries.length === 0) {
    console.log('No entries matching filters')
    return
  }
  console.log(`Listing ${entries.length} sound(s):\n`)
  console.log(pad('NAME [CODE]', 40) + pad('CATEGORY', 18) + 'SECTION')
  console.log('-'.repeat(75))
  for (const e of entries) console.log(formatEntry(e))
}

// ─── validate ───────────────────────────────────────────────────────────────

interface SoundRef {
  file: string
  sound: string
  category?: string
  sectionHint?: Section
}

function collectSoundRefs(dir: string): SoundRef[] {
  const refs: SoundRef[] = []
  function walk(d: string) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name)
      if (entry.isDirectory()) { walk(full); continue }
      if (!entry.name.endsWith('.yml') && !entry.name.endsWith('.yaml')) continue
      try {
        const doc: any = parseYaml(readFileSync(full, 'utf-8'))
        if (doc?.sound) {
          refs.push({
            file: full,
            sound: String(doc.sound),
            category: doc.category,
            sectionHint: inferSectionHint(full),
          })
        }
      } catch { /* skip unparseable */ }
    }
  }
  walk(dir)
  return refs
}

function cmdValidate(dir: string) {
  const refs = collectSoundRefs(resolve(dir))
  if (refs.length === 0) {
    console.log('No sound fields found')
    return
  }

  let errors = 0
  for (const ref of refs) {
    const result = resolveSound(ref.sound, ref.sectionHint)
    const relPath = relative(process.cwd(), ref.file)

    if ('entry' in result) {
      // Validate category if present
      if (ref.category && ref.category !== result.entry.category) {
        console.log(`⚠ ${relPath}: category "${ref.category}" should be "${result.entry.category}"`)
        errors++
      }
      // Check canonical format
      if (result.format !== 'canonical') {
        console.log(`ℹ ${relPath}: sound "${ref.sound}" → should be "${result.entry.canonical}" (${result.format} format)`)
        errors++
      }
    } else if (result.format === 'ambiguous') {
      console.log(`✗ ${relPath}: sound "${ref.sound}" is ambiguous — ${result.entries.length} matches:`)
      for (const e of result.entries) console.log(`    ${formatEntry(e)}`)
      errors++
    } else {
      console.log(`✗ ${relPath}: sound "${ref.sound}" not found in catalog`)
      errors++
    }
  }

  if (errors === 0) console.log('All sound fields are valid and canonical')
  else console.log(`\n${errors} issue(s) found`)
}

// ─── fix ────────────────────────────────────────────────────────────────────

function cmdFix(dir: string, write: boolean) {
  const refs = collectSoundRefs(resolve(dir))
  if (refs.length === 0) {
    console.log('No sound fields found')
    return
  }

  const changes: { file: string; oldSound: string; newSound: string; oldCategory?: string; newCategory?: string }[] = []

  for (const ref of refs) {
    const result = resolveSound(ref.sound, ref.sectionHint)
    let entry: SoundEntry | null = null

    if ('entry' in result) {
      entry = result.entry
    } else if (result.format === 'ambiguous' && result.entries.length > 0) {
      // Interactive resolution
      console.log(`\nAmbiguous sound "${ref.sound}" in ${relative(process.cwd(), ref.file)}:`)
      for (let i = 0; i < result.entries.length; i++) {
        console.log(`  ${i + 1}. ${formatEntry(result.entries[i])}`)
      }
      const choice = parseInt(prompt(`Choose [1-${result.entries.length}]: `) || '1', 10) - 1
      entry = result.entries[Math.max(0, Math.min(choice, result.entries.length - 1))]
    } else if (result.format === 'not_found') {
      console.log(`✗ Skipping "${ref.sound}" in ${relative(process.cwd(), ref.file)} — not found in catalog`)
      continue
    }

    if (!entry) continue

    const newSound = entry.canonical
    const newCategory = entry.category
    if (newSound !== ref.sound || ref.category !== newCategory) {
      changes.push({ file: ref.file, oldSound: ref.sound, newSound, oldCategory: ref.category, newCategory })
    }
  }

  if (changes.length === 0) {
    console.log('All sound fields are already canonical')
    return
  }

  console.log(`\nProposed changes:`)
  for (const c of changes) {
    const relPath = relative(process.cwd(), c.file)
    let msg = `  ${relPath}: "${c.oldSound}" → "${c.newSound}"`
    if (c.oldCategory && c.oldCategory !== c.newCategory) msg += ` (category: "${c.oldCategory}" → "${c.newCategory}")`
    console.log(msg)
  }

  if (!write) {
    console.log(`\nDry run — ${changes.length} change(s). Use --write to apply.`)
    return
  }

  // Apply changes — group by file
  const byFile = new Map<string, typeof changes>()
  for (const c of changes) {
    if (!byFile.has(c.file)) byFile.set(c.file, [])
    byFile.get(c.file)!.push(c)
  }

  for (const [file, fileChanges] of byFile) {
    let content = readFileSync(file, 'utf-8')
    for (const c of fileChanges) {
      content = content.replace(
        /^(\s*sound:\s*)(['"]?).+?\2\s*$/m,
        `$1${c.newSound}`
      )
      if (c.oldCategory && c.oldCategory !== c.newCategory) {
        content = content.replace(
          /^(\s*category:\s*)(['"]?).+?\2\s*$/m,
          `$1${c.newCategory!}`
        )
      }
    }
    writeFileSync(file, content, 'utf-8')
  }

  console.log(`\nApplied ${changes.length} change(s) to ${byFile.size} file(s)`)
}

// ─── Main ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const command = args[0]

function parseListArgs(args: string[]) {
  const filters: { section?: string; category?: string; bank?: string } = {}
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--section' && args[i + 1]) filters.section = args[++i]
    else if (args[i] === '--category' && args[i + 1]) filters.category = args[++i]
    else if (args[i] === '--bank' && args[i + 1]) filters.bank = args[++i]
  }
  return filters
}

switch (command) {
  case 'search':
    if (!args[1]) { console.error('Usage: sounds search <query>'); process.exit(1) }
    cmdSearch(args.slice(1).join(' '))
    break
  case 'list':
    cmdList(parseListArgs(args))
    break
  case 'validate':
    cmdValidate(args[1] || songsHome())
    break
  case 'fix': {
    const writeIdx = args.indexOf('--write')
    const write = writeIdx !== -1
    const dir = (writeIdx === 1 ? args[2] : args[1]) || songsHome()
    cmdFix(dir, write)
    break
  }
  default:
    console.log(`Usage: sounds <command> [options]
Commands:
  search <query>         Search sounds by name
  list [--section S] [--category C] [--bank B]  List/filter sounds
  validate [dir]         Validate YAML sound fields against catalog
  fix [dir] [--write]    Normalize sound fields to canonical format
                         (dry-run by default, use --write to apply)
`)
    break
}