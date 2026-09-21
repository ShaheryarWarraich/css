import { useEffect, useMemo, useState } from 'react'
import type { Fact } from '../content/types'
import { db, type CardRow } from '../db'

export function Browse() {
  const [facts, setFacts] = useState<Fact[]>([])
  const [cards, setCards] = useState<Map<string, CardRow>>(new Map())
  const [q, setQ] = useState('')
  const [theme, setTheme] = useState('')
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    db.items.where('kind').equals('fact').toArray().then((rows) => setFacts(rows.filter((r) => !r.retired).map((r) => r.data as Fact)))
    db.cards.toArray().then((cs) => setCards(new Map(cs.map((c) => [c.id, c]))))
  }, [])

  const themes = useMemo(() => [...new Set(facts.map((f) => f.theme))].sort(), [facts])
  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return facts.filter((f) => (!theme || f.theme === theme) && (!needle || `${f.id} ${f.title} ${f.value} ${f.tags.join(' ')} ${f.source}`.toLowerCase().includes(needle)))
  }, [facts, q, theme])

  const status = (id: string) => {
    const c = cards.get(id)
    if (!c) return ['todo', 'To learn']
    return c.card.stability >= 21 ? ['good', 'Strong'] : ['mid', 'Learning']
  }

  return (
    <>
      <h1>Evidence bank</h1>
      <div className="row">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search facts, tags, sources" />
        <select value={theme} onChange={(e) => setTheme(e.target.value)}>
          <option value="">All themes</option>
          {themes.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <p className="muted small">{hits.length} of {facts.length} facts{hits.length > 100 ? ' · showing the first 100' : ''}</p>
      <ul className="list">
        {hits.slice(0, 100).map((f) => {
          const [cls, label] = status(f.id)
          return (
            <li key={f.id} onClick={() => setOpen(open === f.id ? null : f.id)}>
              <div className="line">
                <span><b>{f.titleIsValue ? f.value : f.title}</b>{!f.titleIsValue && <> — {f.value}</>}</span>
                <span className={`pill ${cls}`}>{label}</span>
              </div>
              <div className="muted small">{f.theme} · Tier {f.tier} · {[f.source, f.period].filter(Boolean).join(', ')}</div>
              {open === f.id && (
                <div className="detail small">
                  {f.proves && <p><b>Proves:</b> {f.proves}</p>}
                  {f.whyItMatters && <p><b>Why it matters:</b> {f.whyItMatters}</p>}
                  {f.qualification && <p><b>Caution:</b> {f.qualification}</p>}
                  {f.chainIds.length > 0 && <p><b>Argument chains:</b> {f.chainIds.join(', ')}</p>}
                  <p className="muted">{f.id} · {f.verificationNote}{f.sourceUrl && <> · <a href={f.sourceUrl} target="_blank" rel="noreferrer">source</a></>}</p>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
