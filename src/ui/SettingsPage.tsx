import { useState } from 'react'
import type { Issue } from '../content/types'
import { exportState, importState, mergePack, saveSettings, type MergeResult, type Settings } from '../db'
import { pingJudge } from '../judge'

export function SettingsPage({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const [msg, setMsg] = useState('')
  const [issues, setIssues] = useState<Issue[]>([])
  const set = async (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch }
    await saveSettings(next)
    onChange(next)
  }

  const importSheet = async (file: File) => {
    setMsg('Reading sheet…')
    try {
      const [XLSX, { buildPack }] = await Promise.all([import('xlsx'), import('../content/normalize')])
      const pack = buildPack(XLSX.read(await file.arrayBuffer(), { type: 'array' }), 'user:' + file.name, file.name)
      const blocking = pack.issues.filter((i) => i.level === 'error')
      setIssues(pack.issues.filter((i) => i.level !== 'info'))
      if (!pack.facts.length) return setMsg('No usable rows found. The sheet needs an "Evidence Bank" tab with ID, Title, Value / Text and Source columns.')
      const r: MergeResult = await mergePack(pack)
      setMsg(`Imported: ${r.added} new (marked to learn), ${r.changed} updated (will return as change cards), ${r.unchanged} unchanged.${blocking.length ? ` ${blocking.length} rows were skipped — see below.` : ''}`)
      onChange(settings)
    } catch (e) { setMsg('Import failed: ' + (e as Error).message) }
  }

  const backup = async () => {
    const blob = new Blob([await exportState()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `css-os-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const restore = async (file: File) => {
    if (!confirm('Restoring replaces all progress on this device with the backup. Continue?')) return
    try { await importState(await file.text()); location.reload() } catch (e) { setMsg('Restore failed: ' + (e as Error).message) }
  }

  return (
    <>
      <h1>Settings</h1>
      <section className="card form">
        <h2>Exam and workload</h2>
        <label>Written exam date<input type="date" value={settings.examDate} onChange={(e) => set({ examDate: e.target.value })} /></label>
        <label>Minutes per day<input type="number" min={5} max={180} value={settings.minutesPerDay} onChange={(e) => set({ minutesPerDay: Math.max(5, Number(e.target.value) || 30) })} /></label>
        <label>New items per day<input type="number" min={0} max={60} value={settings.newPerDay} onChange={(e) => set({ newPerDay: Math.max(0, Number(e.target.value) || 0) })} /></label>
        <p className="muted small">Every new item costs roughly 7–10 reviews over the next month. Raise this slowly.</p>
        <div className="row">
          {[1, 2, 3].map((t) => (
            <label key={t} className="tick"><input type="checkbox" checked={settings.tiers.includes(t)} onChange={() => set({ tiers: settings.tiers.includes(t) ? settings.tiers.filter((x) => x !== t) : [...settings.tiers, t].sort() })} /><span>Tier {t}</span></label>
          ))}
        </div>
        <p className="muted small">Tier 1 is the 150 facts that feed the most argument chains. Finish it before widening.</p>
      </section>

      <section className="card form">
        <h2>Add your own facts</h2>
        <p className="muted small">Import an Excel sheet in the evidence-bank format. New rows are marked to learn; rows whose value changed come back as change cards. Your progress is kept.</p>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && importSheet(e.target.files[0])} />
        {msg && <p className="note">{msg}</p>}
        {issues.length > 0 && <ul className="small">{issues.slice(0, 30).map((i, k) => <li key={k}><b>{i.ref}</b>: {i.message}</li>)}</ul>}
      </section>

      <section className="card form">
        <h2>AI answer checking (optional)</h2>
        <p className="muted small">Everything works without it. To have free-text answers checked by your own Claude, Gemini or Codex subscription, run <code>npm run judge</code> on this computer and enter its address.</p>
        <label>Judge bridge address<input placeholder="http://127.0.0.1:8787" value={settings.judgeUrl} onChange={(e) => set({ judgeUrl: e.target.value.trim() })} /></label>
        <button onClick={async () => setMsg((await pingJudge(settings.judgeUrl)) ? 'Judge bridge is reachable.' : 'Judge bridge is not reachable.')} disabled={!settings.judgeUrl}>Test connection</button>
      </section>

      <section className="card form">
        <h2>Your data</h2>
        <p className="muted small">Progress lives only on this device. Back it up before clearing the browser or changing computers.</p>
        <div className="row">
          <button onClick={backup}>Download backup</button>
          <label className="filebtn">Restore backup<input type="file" accept=".json" hidden onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} /></label>
        </div>
      </section>
    </>
  )
}
