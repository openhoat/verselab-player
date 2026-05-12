import { readFileSync } from 'fs'
import { resolve } from 'path'

export type Section = 'Tone' | 'DrumKit' | 'DrumInst'

export interface SoundEntry {
  section: Section
  bank: string
  no: number
  name: string
  category: string
  code: string
  canonical: string
}

const CSV_PATH = resolve(import.meta.dirname, '..', 'docs', 'mv1-sounds.csv')

let _catalog: SoundEntry[] | null = null

export function loadCatalog(): SoundEntry[] {
  if (_catalog) return _catalog

  const raw = readFileSync(CSV_PATH, 'utf-8')
  const entries: SoundEntry[] = []

  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const parts = trimmed.split(',')
    if (parts.length !== 5) continue
    if (parts[0] === 'section') continue

    const [section, bank, noStr, name, category] = parts
    const no = parseInt(noStr, 10)
    if (isNaN(no)) continue

    const code = `${bank}-${no}`
    const canonical = `${name} [${code}]`

    entries.push({ section: section as Section, bank, no, name, category, code, canonical })
  }

  _catalog = entries
  return entries
}

export function findByCode(code: string, section?: Section): SoundEntry | undefined {
  const catalog = loadCatalog()
  const matches = catalog.filter(e => e.code === code)
  if (matches.length === 0) return undefined
  if (matches.length === 1) return matches[0]
  if (section) return matches.find(e => e.section === section)
  // Banks A-C overlap between Tone and DrumKit/DrumInst — prefer DrumKit for drum sounds
  // Caller should provide section hint for disambiguation
  return matches[0]
}

export function searchByName(pattern: string): SoundEntry[] {
  const lower = pattern.toLowerCase()
  return loadCatalog().filter(e => e.name.toLowerCase().includes(lower))
}

export function searchByCategory(category: string): SoundEntry[] {
  const lower = category.toLowerCase()
  return loadCatalog().filter(e => e.category.toLowerCase() === lower)
}

export function findByCanonical(canonical: string): SoundEntry | undefined {
  return loadCatalog().find(e => e.canonical === canonical)
}

export function resolveAmbiguous(name: string): SoundEntry[] {
  return loadCatalog().filter(e => e.name === name)
}

/** Section hint derived from track context. Drum tracks → DrumKit, others → Tone. */
export type SectionHint = Section | undefined

/** Try to parse any of the 3 sound field formats into a catalog entry.
 *  Formats: "Name [B-NO]", "B-NO Name", "Name (B,NO)", or plain name.
 *  sectionHint helps disambiguate codes that exist in multiple sections (banks A-C). */
export function resolveSound(sound: string, sectionHint?: SectionHint): { entry: SoundEntry; format: string } | { entries: SoundEntry[]; format: string } {

  // Format: "Name [B-NO]"
  const bracketMatch = sound.match(/^(.+?)\s*\[([A-Z]-\d+)\]$/)
  if (bracketMatch) {
    const entry = findByCode(bracketMatch[2], sectionHint)
    if (entry) return { entry, format: 'canonical' }
  }

  // Format: "B-NO Name"
  const prefixMatch = sound.match(/^([A-Z]-\d+)\s+(.+)$/)
  if (prefixMatch) {
    const entry = findByCode(prefixMatch[1], sectionHint)
    if (entry) return { entry, format: 'prefix' }
  }

  // Format: "Name (B,NO)"
  const parenMatch = sound.match(/^(.+?)\s*\(([A-Z]),(\d+)\)$/)
  if (parenMatch) {
    const code = `${parenMatch[2]}-${parenMatch[3]}`
    const entry = findByCode(code, sectionHint)
    if (entry) return { entry, format: 'parenthetical' }
  }

  // Plain name — may be ambiguous
  const exact = resolveAmbiguous(sound)
  if (exact.length === 1) return { entry: exact[0], format: 'plain' }
  if (exact.length > 1) {
    // Try to narrow by section hint
    if (sectionHint) {
      const filtered = exact.filter(e => e.section === sectionHint)
      if (filtered.length === 1) return { entry: filtered[0], format: 'plain' }
    }
    return { entries: exact, format: 'ambiguous' }
  }

  // Fallback: case-insensitive search
  const fuzzy = loadCatalog().filter(e => e.name.toLowerCase() === sound.toLowerCase())
  if (fuzzy.length === 1) return { entry: fuzzy[0], format: 'plain' }
  if (fuzzy.length > 1) return { entries: fuzzy, format: 'ambiguous' }

  return { entries: [], format: 'not_found' }
}