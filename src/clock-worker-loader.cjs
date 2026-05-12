// CJS loader for clock-worker.ts — avoids ESM loader conflict with native midi addon
// @ts-ignore
require('tsx/cjs')
require('./clock-worker.ts')
