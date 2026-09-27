// Installs or removes a macOS launchd job that runs the news pipeline and publishes, three times a day.
//   node news/schedule.mjs install | uninstall | status
import { writeFileSync, existsSync, unlinkSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const LABEL = 'pk.cssos.news'
const plist = join(homedir(), 'Library/LaunchAgents', `${LABEL}.plist`)
const root = resolve('.')
const npm = execFileSync('which', ['npm']).toString().trim()
const path = process.env.PATH
const sh = (args) => { try { return execFileSync('launchctl', args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString() } catch (e) { return String(e.stderr ?? e.message) } }

const action = process.argv[2]
if (action === 'install') {
  if (/scratch-workspaces|\/tmp\//.test(root)) { console.error(`Refusing to schedule from a temporary folder:\n  ${root}\nClone the repo to a permanent folder first, then run this there.`); process.exit(1) }
  mkdirSync(join(root, 'news/store'), { recursive: true })
  // Times are local to this Mac. 07:00, 13:00, 19:00.
  const times = [7, 13, 19].map((h) => `<dict><key>Hour</key><integer>${h}</integer><key>Minute</key><integer>0</integer></dict>`).join('')
  writeFileSync(plist, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key><array><string>${npm}</string><string>run</string><string>news:publish</string></array>
  <key>WorkingDirectory</key><string>${root}</string>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>${path}</string></dict>
  <key>StartCalendarInterval</key><array>${times}</array>
  <key>StandardOutPath</key><string>${root}/news/store/schedule.log</string>
  <key>StandardErrorPath</key><string>${root}/news/store/schedule.log</string>
</dict></plist>\n`)
  sh(['unload', plist])
  console.log(sh(['load', plist]) || `Scheduled: 07:00, 13:00 and 19:00 daily, from ${root}`)
} else if (action === 'uninstall') {
  if (existsSync(plist)) { sh(['unload', plist]); unlinkSync(plist) }
  console.log('Schedule removed.')
} else {
  console.log(existsSync(plist) ? `Installed: ${plist}\n${sh(['list', LABEL])}` : 'Not scheduled.')
}
