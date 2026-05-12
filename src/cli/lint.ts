import { resolve, join } from 'path'
import { existsSync, readdirSync } from 'fs'
import chalk from 'chalk'
import { lintSongDir, lintSequence, lintTrack, type LintIssue, type Severity } from '../linter.js'
import { songsHome } from '../core/paths.js'

// ─── Output formatting ───────────────────────────────────────────────────────

const SEVERITY_FORMAT: Record<Severity, (s: string) => string> = {
  error: chalk.red,
  warning: chalk.yellow,
  style: chalk.blue,
}

const SEVERITY_LABEL: Record<Severity, string> = {
  error: 'error',
  warning: 'warning',
  style: 'style',
}

function formatIssue(issue: LintIssue): string {
  const colorize = SEVERITY_FORMAT[issue.severity]
  const label = colorize(SEVERITY_LABEL[issue.severity].padEnd(7))
  const loc = issue.line ? `${issue.file}:${issue.line}` : issue.file
  return `  ${label} ${loc} — ${issue.message}`
}

// ─── Lint a target ───────────────────────────────────────────────────────────

function lint(target: string, filterSeverities?: Set<Severity>): LintIssue[] {
  const resolved = resolve(target)
  let issues: LintIssue[]

  // Determine what to lint based on the target
  if (resolved.endsWith('.yml') || resolved.endsWith('.yaml')) {
    // Single track file
    issues = lintTrack(resolved)
  } else if (resolved.includes('sequences') && !resolved.endsWith('sequences')) {
    // Likely a sequence directory
    issues = lintSequence(resolved)
  } else if (existsSync(join(resolved, 'song.yml'))) {
    // Song directory with song.yml
    issues = lintSongDir(resolved)
  } else {
    // Try to detect song subdirectories
    const subdirs = readdirSync(resolved, { withFileTypes: true })
      .filter(d => d.isDirectory() && existsSync(join(resolved, d.name, 'song.yml')))
      .map(d => d.name)
      .sort()

    if (subdirs.length > 0) {
      // Lint each song subdirectory
      issues = []
      for (const sub of subdirs) {
        issues.push(...lintSongDir(join(resolved, sub)))
      }
    } else {
      // Single directory without song.yml — lint as song dir anyway (will report error)
      issues = lintSongDir(resolved)
    }
  }

  if (filterSeverities) {
    issues = issues.filter(i => filterSeverities.has(i.severity))
  }

  return issues
}

// ─── Main ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`Usage: lint <target> [options]

Targets:
  <song-dir>    Lint a song directory (song.yml + all sequences/tracks)
  <seq-dir>     Lint a single sequence directory
  <track-file>  Lint a single track file (.yml)

Options:
  --errors      Show only errors
  --warnings    Show errors and warnings (default)
  --style       Show all (errors, warnings, style suggestions)
  --no-color    Disable colored output

Examples:
  lint songs/afro-vibe
  lint songs/neo-soul/sequences/1
  lint songs/dark-trap/sequences/1/drums.yml
`)
  process.exit(0)
}

// Parse options
let filterLevel: 'errors' | 'warnings' | 'style' = 'warnings'
let noColor = false
const targets: string[] = []

for (const arg of args) {
  if (arg === '--errors') filterLevel = 'errors'
  else if (arg === '--warnings') filterLevel = 'warnings'
  else if (arg === '--style') filterLevel = 'style'
  else if (arg === '--no-color') noColor = true
  else targets.push(arg)
}

if (noColor) {
  // Temporarily disable chalk
  chalk.level = 0
}

const severityFilter = new Set<Severity>()
if (filterLevel === 'errors') severityFilter.add('error')
else if (filterLevel === 'warnings') { severityFilter.add('error'); severityFilter.add('warning') }
else { severityFilter.add('error'); severityFilter.add('warning'); severityFilter.add('style') }

// Default target
if (targets.length === 0) targets.push(songsHome())

let totalErrors = 0
let totalWarnings = 0
let totalStyle = 0
let totalFiles = 0

for (const target of targets) {
  const issues = lint(target, severityFilter)

  // Group by file
  const byFile = new Map<string, LintIssue[]>()
  for (const issue of issues) {
    if (!byFile.has(issue.file)) byFile.set(issue.file, [])
    byFile.get(issue.file)!.push(issue)
  }

  for (const [file, fileIssues] of byFile) {
    totalFiles++
    const hasError = fileIssues.some(i => i.severity === 'error')
    const hasWarning = fileIssues.some(i => i.severity === 'warning')
    const hasStyle = fileIssues.some(i => i.severity === 'style')

    if (hasError) {
      console.log(chalk.red(`✗ ${file}`))
    } else if (hasWarning) {
      console.log(chalk.yellow(`⚠ ${file}`))
    } else if (hasStyle) {
      console.log(chalk.blue(`ℹ ${file}`))
    } else {
      console.log(chalk.green(`  ${file}`))
    }

    for (const issue of fileIssues) {
      console.log(formatIssue(issue))
      if (issue.severity === 'error') totalErrors++
      else if (issue.severity === 'warning') totalWarnings++
      else totalStyle++
    }
  }
}

// Summary
console.log()
const parts: string[] = []
if (totalErrors > 0) parts.push(chalk.red(`${totalErrors} error(s)`))
if (totalWarnings > 0) parts.push(chalk.yellow(`${totalWarnings} warning(s)`))
if (totalStyle > 0) parts.push(chalk.blue(`${totalStyle} style issue(s)`))
if (parts.length === 0) parts.push(chalk.green('All checks passed'))
else parts.push(`across ${totalFiles} file(s)`)
console.log(parts.join(', '))

process.exit(totalErrors > 0 ? 1 : 0)