// Build the app and push it to the gh-pages branch (the public link). Force-pushed as a single commit: no history growth.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, cpSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim()
const remote = run('git', ['remote', 'get-url', 'origin'])
run('npm', ['run', 'build'])
const dir = mkdtempSync(join(tmpdir(), 'css-os-pages-'))
try {
  cpSync('dist', dir, { recursive: true })
  writeFileSync(join(dir, '.nojekyll'), '')
  run('git', ['init', '-q', '-b', 'gh-pages'], dir)
  run('git', ['add', '-A'], dir)
  run('git', ['-c', 'user.name=CSS OS publisher', '-c', 'user.email=noreply@users.noreply.github.com', 'commit', '-q', '-m', `Deploy ${new Date().toISOString()}`], dir)
  run('git', ['push', '-q', '-f', remote, 'gh-pages'], dir)
  console.log('published to gh-pages')
} finally {
  rmSync(dir, { recursive: true, force: true })
}
