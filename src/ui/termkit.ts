import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const termkit = require('terminal-kit')

export const term = termkit.terminal as typeof termkit.terminal
export const ScreenBuffer = termkit.ScreenBuffer as typeof termkit.ScreenBuffer