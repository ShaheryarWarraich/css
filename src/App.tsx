import { useCallback, useEffect, useState } from 'react'
import type { Pack } from './content/types'
import { db, getSettings, mergePack, type Settings } from './db'
import { Browse } from './ui/Browse'
import { Progress } from './ui/Progress'
import { Session } from './ui/Session'
import { SettingsPage } from './ui/SettingsPage'
import { Today } from './ui/Today'

type Tab = 'today' | 'bank' | 'progress' | 'settings'

/** Load the bundled pack; merge only when the published pack is newer than what this device has. */
async function syncCorePack(): Promise<void> {
  const res = await fetch(`${import.meta.env.BASE_URL}packs/core.json`)
  if (!res.ok) throw new Error('Could not load the evidence bank.')
  const pack: Pack = await res.json()
  const seen = (await db.kv.get('core-builtAt'))?.value
  if (seen === pack.builtAt) return
  await mergePack(pack, { retireMissing: true })
  await db.kv.put({ key: 'core-builtAt', value: pack.builtAt })
}

export function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [inSession, setInSession] = useState(false)
  const [error, setError] = useState('')
  const [rev, setRev] = useState(0)
  const refresh = useCallback(() => setRev((r) => r + 1), [])

  useEffect(() => {
    syncCorePack()
      .catch((e) => db.items.count().then((n) => (n ? null : setError(String(e.message ?? e)))))
      .then(getSettings)
      .then(setSettings)
  }, [])

  if (error) return <main className="wrap"><p className="bad">{error}</p></main>
  if (!settings) return <main className="wrap"><p className="muted">Loading the evidence bank…</p></main>
  if (inSession) return <Session settings={settings} onExit={() => (setInSession(false), refresh())} />

  const tabs: [Tab, string][] = [['today', 'Today'], ['bank', 'Bank'], ['progress', 'Progress'], ['settings', 'Settings']]
  return (
    <>
      <main className="wrap">
        {tab === 'today' && <Today key={rev} settings={settings} onStart={() => setInSession(true)} />}
        {tab === 'bank' && <Browse />}
        {tab === 'progress' && <Progress settings={settings} />}
        {tab === 'settings' && <SettingsPage settings={settings} onChange={(s) => (setSettings(s), refresh())} />}
      </main>
      <nav className="tabs">
        {tabs.map(([id, label]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>
    </>
  )
}
