import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join, relative, basename, extname } from 'path'
import { load as parseYaml } from 'js-yaml'
import { resolveSound, type Section } from './sound-catalog.js'
import { isValidNoteValue, GM_DRUM_NOTES } from './core/midi-notes.js'

// ─── Types ──────────────────────────────────────────────────────────────────

export type Severity = 'error' | 'warning' | 'style'

export interface LintIssue {
  file: string
  line?: number
  severity: Severity
  message: string
}

const GM_DRUMS = new Set(Object.keys(GM_DRUM_NOTES))

// Meta fields to skip when identifying drum instrument patterns.
// Modern format uses 'track', legacy uses 'channel'. Both include sound/category/steps.
const ALL_META = new Set([
  'track', 'channel', 'sound', 'category', 'steps', 'transpose', 'notes', 'clip', 'sta', 'velocity_maps', 'velocity_map',
])

// ─── Helpers ─────────────────────────────────────────────────────────────────

function issue(file: string, severity: Severity, message: string, line?: number): LintIssue {
  return { file, severity, message, line }
}

function rel(file: string): string {
  return relative(process.cwd(), file)
}

function isDir(path: string): boolean {
  try { return statSync(path).isDirectory() } catch { return false }
}

function isYaml(name: string): boolean {
  return name.endsWith('.yml') || name.endsWith('.yaml')
}

function isChordFile(name: string): boolean {
  return name === 'chords.yml' || name === 'aliases.yml'
}

function inferSectionHint(file: string): Section | undefined {
  const name = file.toLowerCase()
  if (name.includes('drums') || name.includes('drum')) return 'DrumKit'
  return 'Tone'
}

// ─── Lint song.yml ───────────────────────────────────────────────────────────

export function lintSong(songDir: string): LintIssue[] {
  const issues: LintIssue[] = []
  const songFile = join(songDir, 'song.yml')
  const songFileRel = rel(songFile)

  if (!existsSync(songFile)) {
    issues.push(issue(songFileRel, 'error', 'song.yml not found'))
    return issues
  }

  let doc: any
  try {
    doc = parseYaml(readFileSync(songFile, 'utf-8'))
  } catch (e: any) {
    issues.push(issue(songFileRel, 'error', `YAML parse error: ${e.message}`))
    return issues
  }

  // Meta
  if (!doc.meta) {
    issues.push(issue(songFileRel, 'error', 'missing "meta" section'))
  } else {
    if (!doc.meta.title || doc.meta.title.trim() === '') {
      issues.push(issue(songFileRel, 'error', 'meta.title is missing or empty'))
    }
    if (doc.meta.bpm === undefined) {
      issues.push(issue(songFileRel, 'error', 'meta.bpm is missing'))
    } else if (typeof doc.meta.bpm !== 'number' || doc.meta.bpm < 40 || doc.meta.bpm > 300) {
      issues.push(issue(songFileRel, 'error', `meta.bpm must be 40-300, got ${doc.meta.bpm}`))
    }
  }

  // Sections: prefer sections/ directory, fall back to inline
  const sectionsDir = join(songDir, 'sections')
  const seqDir = join(songDir, 'sequences')
  let sectionKeys: string[] = []
  const sectionIndex = new Map<string, string>()  // ref → canonical key
  const sectionNumbers = new Map<number, string>()  // section number → key (for uniqueness)
  const sectionNames = new Map<string, string>()    // name (after dash) → key (for uniqueness)

  if (isDir(sectionsDir)) {
    // Validate section files
    const sectionFiles = readdirSync(sectionsDir).filter(f => isYaml(f)).sort()
    for (const f of sectionFiles) {
      const key = basename(f, extname(f))
      sectionKeys.push(key)
      sectionIndex.set(key, key)
      const dashIdx = key.indexOf('-')
      if (dashIdx > 0) {
        const num = key.slice(0, dashIdx)
        const name = key.slice(dashIdx + 1)
        sectionIndex.set(num, key)
        sectionIndex.set(name, key)
        // Check number uniqueness
        const existingKey = sectionNumbers.get(parseInt(num, 10))
        if (existingKey) {
          issues.push(issue(rel(join(sectionsDir, f)), 'error', `duplicate section number ${num} (also in ${existingKey})`))
        }
        sectionNumbers.set(parseInt(num, 10), key)
        // Check name uniqueness
        const existingName = sectionNames.get(name)
        if (existingName) {
          issues.push(issue(rel(join(sectionsDir, f)), 'error', `duplicate section name "${name}" (also in ${existingName})`))
        }
        sectionNames.set(name, key)
      }
      const filePath = join(sectionsDir, f)
      issues.push(...lintSectionFile(filePath))
    }
  } else if (doc.sections && typeof doc.sections === 'object') {
    // Legacy: inline sections in song.yml
    sectionKeys = Object.keys(doc.sections)
    if (sectionKeys.length === 0) {
      issues.push(issue(songFileRel, 'warning', 'sections is empty'))
    }

    for (const [key, val] of Object.entries(doc.sections as Record<string, any>)) {
      const secPath = `${songFileRel} → sections.${key}`
      if (!val.sequence) {
        issues.push(issue(secPath, 'error', `section "${key}" missing "sequence" field`))
      } else {
        const seqPath = join(seqDir, String(val.sequence))
        if (!isDir(seqPath)) {
          issues.push(issue(secPath, 'error', `sequence "${val.sequence}" not found (no directory sequences/${val.sequence}/)`))
        }
      }
      if (val.section !== undefined) {
        if (typeof val.section !== 'number' || val.section < 1 || val.section > 16) {
          issues.push(issue(secPath, 'error', `section must be 1-16, got ${val.section}`))
        }
      }
      if (val.repeat !== undefined) {
        if (typeof val.repeat !== 'number' || val.repeat < 1) {
          issues.push(issue(secPath, 'error', `repeat must be ≥ 1, got ${val.repeat}`))
        }
      }
    }
  } else {
    issues.push(issue(songFileRel, 'error', 'no sections/ directory and no inline sections'))
  }

  // Arrangement
  if (!doc.arrangement || !Array.isArray(doc.arrangement) || doc.arrangement.length === 0) {
    issues.push(issue(songFileRel, 'error', 'arrangement must be a non-empty array'))
  } else {
    for (const ref of doc.arrangement) {
      const refStr = String(ref)
      // Resolve by full key, number, or name (after dash)
      const found = isDir(sectionsDir)
        ? sectionIndex.has(refStr)
        : refStr in (doc.sections ?? {})
      if (!found) {
        issues.push(issue(songFileRel, 'error', `arrangement references undefined section "${ref}"`))
      }
    }
  }

  // Tracks
  if (doc.tracks && typeof doc.tracks === 'object') {
    for (const [name, enabled] of Object.entries(doc.tracks as Record<string, any>)) {
      if (typeof enabled !== 'boolean') {
        issues.push(issue(songFileRel, 'warning', `tracks.${name} should be boolean, got ${typeof enabled}`))
      }
    }
  }

  return issues
}

// ─── Lint a section file ───────────────────────────────────────────────────

function lintSectionFile(filePath: string): LintIssue[] {
  const issues: LintIssue[] = []
  const fileRel = rel(filePath)

  let doc: any
  try {
    doc = parseYaml(readFileSync(filePath, 'utf-8'))
  } catch (e: any) {
    issues.push(issue(fileRel, 'error', `YAML parse error: ${e.message}`))
    return issues
  }

  if (typeof doc !== 'object' || doc === null) {
    issues.push(issue(fileRel, 'error', 'section file must be a YAML mapping'))
    return issues
  }

  // Sequence
  if (doc.sequence === undefined) {
    issues.push(issue(fileRel, 'error', 'missing "sequence" field'))
  } else if (typeof doc.sequence !== 'number' && typeof doc.sequence !== 'string') {
    issues.push(issue(fileRel, 'error', `sequence must be a number or string, got ${typeof doc.sequence}`))
  }

  // Section number
  if (doc.section !== undefined) {
    if (typeof doc.section !== 'number' || doc.section < 1 || doc.section > 16) {
      issues.push(issue(fileRel, 'error', `section must be 1-16, got ${doc.section}`))
    }
  }

  // Repeat
  if (doc.repeat !== undefined) {
    if (typeof doc.repeat !== 'number' || doc.repeat < 1) {
      issues.push(issue(fileRel, 'error', `repeat must be ≥ 1, got ${doc.repeat}`))
    }
  }

  // Name
  if (doc.name !== undefined && typeof doc.name !== 'string') {
    issues.push(issue(fileRel, 'error', `name must be a string, got ${typeof doc.name}`))
  }

  return issues
}

// ─── Lint a sequence directory ────────────────────────────────────────────────

export function lintSequence(seqDir: string): LintIssue[] {
  const issues: LintIssue[] = []
  const seqDirRel = rel(seqDir)

  if (!isDir(seqDir)) {
    issues.push(issue(seqDirRel, 'error', 'sequence directory not found'))
    return issues
  }

  const files = readdirSync(seqDir).filter(f => isYaml(f) && !isChordFile(f))
  if (files.length === 0) {
    issues.push(issue(seqDirRel, 'warning', 'sequence directory has no track files'))
    return issues
  }

  // Load chords
  let chords: Record<string, any> = {}
  let chordsFile = ''
  const chordsPath = join(seqDir, 'chords.yml')
  const aliasesPath = join(seqDir, 'aliases.yml')
  if (existsSync(chordsPath)) {
    chordsFile = chordsPath
    try {
      chords = (parseYaml(readFileSync(chordsPath, 'utf-8')) ?? {}) as Record<string, any>
      issues.push(...lintChords(chordsPath, chords))
    } catch (e: any) {
      issues.push(issue(rel(chordsPath), 'error', `YAML parse error: ${e.message}`))
    }
  } else if (existsSync(aliasesPath)) {
    chordsFile = aliasesPath
    try {
      chords = (parseYaml(readFileSync(aliasesPath, 'utf-8')) ?? {}) as Record<string, any>
      issues.push(...lintChords(aliasesPath, chords))
    } catch (e: any) {
      issues.push(issue(rel(aliasesPath), 'error', `YAML parse error: ${e.message}`))
    }
  }

  // Collect all chord references from track files
  const referencedChords = new Set<string>()

  // Lint each track file
  for (const f of files) {
    const filePath = join(seqDir, f)
    const trackIssues = lintTrack(filePath, chords, referencedChords)
    issues.push(...trackIssues)
  }

  // Check for orphan chords (defined but never referenced)
  for (const chordName of Object.keys(chords)) {
    if (!referencedChords.has(chordName)) {
      issues.push(issue(rel(chordsFile), 'style', `chord "${chordName}" is defined but never referenced in any track`))
    }
  }

  return issues
}

// ─── Lint chords.yml / aliases.yml ───────────────────────────────────────────

function lintChords(filePath: string, chords: Record<string, any>): LintIssue[] {
  const issues: LintIssue[] = []
  const fileRel = rel(filePath)

  for (const [name, notes] of Object.entries(chords)) {
    if (!Array.isArray(notes)) {
      issues.push(issue(fileRel, 'error', `chord "${name}" must be an array, got ${typeof notes}`))
      continue
    }
    if (notes.length === 0) {
      issues.push(issue(fileRel, 'warning', `chord "${name}" is empty`))
      continue
    }
    for (const note of notes) {
      if (!isValidNoteValue(note)) {
        issues.push(issue(fileRel, 'error', `chord "${name}" has invalid note "${note}"`))
      }
    }
  }

  return issues
}

// ─── Lint a single track file ────────────────────────────────────────────────

export function lintTrack(filePath: string, chords?: Record<string, any>, referencedChords?: Set<string>): LintIssue[] {
  const issues: LintIssue[] = []
  const fileRel = rel(filePath)
  let doc: any
  try {
    doc = parseYaml(readFileSync(filePath, 'utf-8'))
  } catch (e: any) {
    issues.push(issue(fileRel, 'error', `YAML parse error: ${e.message}`))
    return issues
  }

  if (typeof doc !== 'object' || doc === null) {
    issues.push(issue(fileRel, 'error', 'track file must be a YAML mapping'))
    return issues
  }

  const isDrumTrack = !Array.isArray(doc.notes)
  const fileName = basename(filePath, extname(filePath))
  const filePrefix = fileName.match(/^(\d+)-/)

  // Track number
  if (doc.track === undefined) {
    if (filePrefix) {
      // Derive track from filename prefix (e.g. "4-drums" → track 4)
      const prefixNum = parseInt(filePrefix[1], 10)
      if (prefixNum < 1 || prefixNum > 16) {
        issues.push(issue(fileRel, 'error', `filename prefix track number must be 1-16, got ${prefixNum}`))
      }
    } else {
      issues.push(issue(fileRel, 'warning', 'missing "track" field (add it or use filename prefix like "4-drums.yml")'))
    }
  } else if (typeof doc.track !== 'number' || doc.track < 1 || doc.track > 16) {
    issues.push(issue(fileRel, 'error', `track must be 1-16, got ${doc.track}`))
  }

  // Clip number
  if (doc.clip !== undefined) {
    if (typeof doc.clip !== 'number' || doc.clip < 1 || doc.clip > 16) {
      issues.push(issue(fileRel, 'error', `clip must be 1-16, got ${doc.clip}`))
    }
  }

  // Steps
  if (doc.steps !== undefined) {
    if (typeof doc.steps !== 'number' || doc.steps < 1 || doc.steps > 128) {
      issues.push(issue(fileRel, 'error', `steps must be 1-128, got ${doc.steps}`))
    }
  }

  // Sound / category (style check)
  if (doc.sound !== undefined) {
    const result = resolveSound(String(doc.sound), inferSectionHint(filePath))
    if ('entry' in result) {
      if (result.format !== 'canonical') {
        issues.push(issue(fileRel, 'style', `sound "${doc.sound}" should be "${result.entry.canonical}"`))
      }
      if (doc.category && doc.category !== result.entry.category) {
        issues.push(issue(fileRel, 'style', `category "${doc.category}" should be "${result.entry.category}" (matching sound)`))
      }
    } else if (result.format === 'ambiguous') {
      issues.push(issue(fileRel, 'warning', `sound "${doc.sound}" is ambiguous — ${result.entries.length} matches in catalog`))
    } else {
      issues.push(issue(fileRel, 'warning', `sound "${doc.sound}" not found in MV-1 catalog`))
    }
  }

  // Transpose
  if (doc.transpose !== undefined) {
    if (typeof doc.transpose !== 'number' || doc.transpose < -127 || doc.transpose > 127) {
      issues.push(issue(fileRel, 'error', `transpose must be -127 to 127, got ${doc.transpose}`))
    }
  }

  if (isDrumTrack) {
    issues.push(...lintDrumTrack(doc, filePath, fileRel))
  } else {
    issues.push(...lintMelodicTrack(doc, filePath, fileRel, chords, referencedChords))
  }

  return issues
}

// ─── Lint drum track content ─────────────────────────────────────────────────

function lintDrumTrack(doc: any, _filePath: string, fileRel: string): LintIssue[] {
  const issues: LintIssue[] = []

  const patternEntries = Object.entries(doc).filter(([k]) => !ALL_META.has(k))

  if (patternEntries.length === 0) {
    issues.push(issue(fileRel, 'warning', 'drum track has no instrument patterns'))
    return issues
  }

  let patternLen: number | null = null

  for (const [instrument, pattern] of patternEntries) {
    if (typeof pattern !== 'string') {
      issues.push(issue(fileRel, 'error', `instrument "${instrument}" pattern must be a string, got ${typeof pattern}`))
      continue
    }

    // Check instrument name
    if (!GM_DRUMS.has(instrument)) {
      issues.push(issue(fileRel, 'warning', `unknown drum instrument "${instrument}" (known: ${[...GM_DRUMS].sort().join(', ')})`))
    }

    // Check pattern characters
    const stripped = pattern.replace(/[\s|]/g, '')
    if (stripped.length === 0) {
      issues.push(issue(fileRel, 'warning', `instrument "${instrument}" has empty pattern`))
      continue
    }
    if (stripped.length > 128) {
      issues.push(issue(fileRel, 'error', `instrument "${instrument}" pattern has ${stripped.length} steps (max 128)`))
    }

    // Check for invalid characters
    const invalidChars = stripped.split('').filter(c => !'xXgo.-'.includes(c))
    if (invalidChars.length > 0) {
      const unique = [...new Set(invalidChars)]
      issues.push(issue(fileRel, 'error', `instrument "${instrument}" pattern has invalid characters: ${unique.join(', ')}`))
    }

    // Check consistent pattern lengths
    if (patternLen === null) {
      patternLen = stripped.length
    } else if (stripped.length !== patternLen) {
      issues.push(issue(fileRel, 'warning', `instrument "${instrument}" has ${stripped.length} steps, expected ${patternLen}`))
    }

    // Style: all patterns should have the same length (use | as bar markers)
    if (!pattern.includes('|')) {
      issues.push(issue(fileRel, 'style', `instrument "${instrument}" pattern lacks bar markers (|)`))
    }
  }

  return issues
}

// ─── Lint melodic track content ──────────────────────────────────────────────

function lintMelodicTrack(doc: any, _filePath: string, fileRel: string, chords?: Record<string, any>, referencedChords?: Set<string>): LintIssue[] {
  const issues: LintIssue[] = []

  if (!Array.isArray(doc.notes) || doc.notes.length === 0) {
    issues.push(issue(fileRel, 'error', 'melodic track must have a non-empty "notes" array'))
    return issues
  }

  const seenSteps = new Map<number, number>() // step → line index (0-based)

  for (let i = 0; i < doc.notes.length; i++) {
    const n = doc.notes[i]
    const prefix = `notes[${i}]`

    // Step
    if (n.step === undefined) {
      issues.push(issue(fileRel, 'error', `${prefix}: missing "step" field`))
    } else if (typeof n.step !== 'number' || n.step < 1 || n.step > 128) {
      issues.push(issue(fileRel, 'error', `${prefix}: step must be 1-128, got ${n.step}`))
    } else {
      if (seenSteps.has(n.step)) {
        issues.push(issue(fileRel, 'warning', `${prefix}: duplicate step ${n.step} (also at notes[${seenSteps.get(n.step)}])`))
      }
      seenSteps.set(n.step, i)
    }

    // Velocity
    const vel = n.vel ?? n.velocity
    if (vel !== undefined) {
      if (typeof vel !== 'number' || vel < 1 || vel > 127) {
        issues.push(issue(fileRel, 'error', `${prefix}: velocity must be 1-127, got ${vel}`))
      }
    }

    // Duration
    const dur = n.dur ?? n.duration
    if (dur !== undefined) {
      if (typeof dur !== 'number' || dur < 0.1) {
        issues.push(issue(fileRel, 'error', `${prefix}: duration must be ≥ 0.1, got ${dur}`))
      }
    }

    // Note or chord (exactly one required)
    const hasNote = n.note !== undefined
    const hasChord = n.chord !== undefined

    if (!hasNote && !hasChord) {
      issues.push(issue(fileRel, 'error', `${prefix}: must have "note" or "chord"`))
    } else if (hasNote && hasChord) {
      issues.push(issue(fileRel, 'error', `${prefix}: cannot have both "note" and "chord"`))
    } else if (hasNote) {
      if (!isValidNoteValue(n.note)) {
        issues.push(issue(fileRel, 'error', `${prefix}: invalid note "${n.note}"`))
      }
    } else if (hasChord) {
      if (typeof n.chord !== 'string') {
        issues.push(issue(fileRel, 'error', `${prefix}: chord must be a string, got ${typeof n.chord}`))
      } else if (chords) {
        if (!(n.chord in chords)) {
          issues.push(issue(fileRel, 'error', `${prefix}: unknown chord "${n.chord}"`))
        }
        referencedChords?.add(n.chord)
      } else {
        // No chords file — will be caught at sequence level
        issues.push(issue(fileRel, 'warning', `${prefix}: chord "${n.chord}" referenced but no chords.yml found in this sequence`))
        referencedChords?.add(n.chord)
      }
    }
  }

  return issues
}

// ─── Lint a complete song directory ───────────────────────────────────────────

export function lintSongDir(songDir: string): LintIssue[] {
  const issues: LintIssue[] = []

  // Lint song.yml
  issues.push(...lintSong(songDir))

  // Lint section files if sections/ directory exists
  const sectionsDir = join(songDir, 'sections')
  if (isDir(sectionsDir)) {
    for (const f of readdirSync(sectionsDir).filter(f => isYaml(f)).sort()) {
      issues.push(...lintSectionFile(join(sectionsDir, f)))
    }
  }

  // Lint all sequences
  const seqBase = join(songDir, 'sequences')
  if (isDir(seqBase)) {
    const seqDirs = readdirSync(seqBase)
      .filter(d => isDir(join(seqBase, d)))
      .sort((a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b))

    for (const d of seqDirs) {
      issues.push(...lintSequence(join(seqBase, d)))
    }
  } else {
    issues.push(issue(rel(songDir), 'warning', 'no sequences/ directory found'))
  }

  return issues
}