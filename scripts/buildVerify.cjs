// Builds the headless verify script into CJS using esbuild's JS API
// (the CLI binary spawn fails in some sandboxed environments).
const esbuild = require('esbuild')

esbuild
  .build({
    entryPoints: ['scripts/verifyIssueWorkspace.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: 'scripts/.verifyIssueWorkspace.cjs',
    alias: { '@': './src' },
    logLevel: 'info',
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })