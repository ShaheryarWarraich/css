import { useEffect, useState } from 'react'
import type { Fact } from '../content/types'
import { db, type Settings } from '../db'

interface Stats {
  reviews: number
  retention: number | null
  medianLatency: number | null
  calibration: { label: string; n: number; acc: number | null }[]
  themes: { theme: string; total: number; seen: number; strong: number }[]
  totals: { total: number; seen: number; strong: number }
  forecast: { day: string; n: number }[]
  leeches: { id: string; label: string; lapses: number }[]
}

const DAY = 86_400_000

async function compute(): Promise<Stats> {
  const [items, cards, logs] = await Promise.all([db.items.toArray(), db.cards.toArray(), db.logs.toArray()])
  const live = items.filter((i) => !i.retired)
  const cardById = new Map(cards.map((c) => [c.id, c]))
  const since = Date.now() - 14 * DAY
  const recent = logs.filter((l) => !l.isNew && l.ts >= since)
  const lat = logs.filter((l) => l.score === 1).map((l) => l.latencyMs).sort((a, b) => a - b)

  const themes = new Map<string, { theme: string; total: number; seen: number; strong: number }>()
  for (const i of live) {
    const theme = i.kind === 'fact' ? (i.data as Fact).theme : 'Argument chains'
    const t = themes.get(theme) ?? { theme, total: 0, seen: 0, strong: 0 }
    const c = cardById.get(i.id)
    t.total++
    if (c) t.seen++
    if (c && c.card.stability >= 21) t.strong++
    themes.set(theme, t)
  }
  const list = [...themes.values()].sort((a, b) => b.total - a.total)
  const start = new Date(); start.setHours(0, 0, 0, 0)
  return {
    reviews: logs.length,
    retention: recent.length ? recent.filter((l) => l.score === 1).length / recent.length : null,
    medianLatency: lat.length ? lat[Math.floor(lat.length / 2)] : null,
    calibration: ([1, 2, 3] as const).map((c) => {
      const g = logs.filter((l) => l.confidence === c)
      return { label: ['Guessing', 'Think so', 'Sure'][c - 1], n: g.length, acc: g.length ? g.filter((l) => l.score === 1).length / g.length : null }
    }),
    themes: list,
    totals: list.reduce((a, t) => ({ total: a.total + t.total, seen: a.seen + t.seen, strong: a.strong + t.strong }), { total: 0, seen: 0, strong: 0 }),
    forecast: Array.from({ length: 7 }, (_, d) => {
      const from = start.getTime() + d * DAY
      const n = cards.filter((c) => (d === 0 ? c.due < from + DAY : c.due >= from && c.due < from + DAY)).length
      return { day: d === 0 ? 'Today' : new Date(from).toLocaleDateString(undefined, { weekday: 'short' }), n }
    }),
    leeches: cards.filter((c) => c.card.lapses >= 4).map((c) => {
      const it = items.find((i) => i.id === c.id)
      return { id: c.id, label: it ? (it.kind === 'fact' ? (it.data as Fact).title : c.id) : c.id, lapses: c.card.lapses }
    }),
  }
}

const pct = (x: number | null) => (x == null ? '—' : Math.round(x * 100) + '%')

export function Progress({ settings }: { settings: Settings }) {
  const [s, setS] = useState<Stats | null>(null)
  useEffect(() => { compute().then(setS) }, [])
  if (!s) return <p className="muted">Crunching…</p>
  const max = Math.max(1, ...s.forecast.map((f) => f.n))
  return (
    <>
      <h1>Progress</h1>
      <section className="card">
        <div className="stats">
          <div><strong>{pct(s.retention)}</strong><span>recall, last 14 days</span></div>
          <div><strong>{s.totals.strong}</strong><span>exam-strong items</span></div>
          <div><strong>{s.medianLatency ? (s.medianLatency / 1000).toFixed(1) + 's' : '—'}</strong><span>median time to a right answer</span></div>
        </div>
        <p className="muted small">Target recall is 85–90%. Much higher means intervals could be longer; lower means too much new material. "Exam-strong" = memory predicted to hold 21+ days.</p>
      </section>

      <section className="card">
        <h2>Do you know what you know?</h2>
        <table>
          <thead><tr><th>When you said</th><th>Answers</th><th>Actually correct</th></tr></thead>
          <tbody>{s.calibration.map((c) => <tr key={c.label}><td>{c.label}</td><td>{c.n}</td><td>{pct(c.acc)}</td></tr>)}</tbody>
        </table>
        <p className="muted small">"Sure" should be above 90%. If it is not, you are carrying confident errors into the exam hall.</p>
      </section>

      <section className="card">
        <h2>Coverage by theme</h2>
        {s.themes.map((t) => (
          <div key={t.theme} className="cov">
            <div className="line small"><span>{t.theme}</span><span className="muted">{t.strong} strong · {t.seen} seen · {t.total}</span></div>
            <div className="meter"><i className="seen" style={{ width: `${(t.seen / t.total) * 100}%` }} /><i className="strong" style={{ width: `${(t.strong / t.total) * 100}%` }} /></div>
          </div>
        ))}
        <p className="muted small">Studying tiers: {settings.tiers.join(', ')}. Change this in Settings.</p>
      </section>

      <section className="card">
        <h2>Next 7 days</h2>
        <div className="bars">{s.forecast.map((f) => <div key={f.day}><span className="small">{f.n}</span><i style={{ height: `${(f.n / max) * 60 + 2}px` }} /><span className="muted small">{f.day}</span></div>)}</div>
      </section>

      {s.leeches.length > 0 && (
        <section className="card">
          <h2>Keeps slipping</h2>
          <p className="muted small">Forgotten four or more times. Repeating will not fix these: attach a comparison, a cause, or an argument you would use them in.</p>
          <ul>{s.leeches.map((l) => <li key={l.id}>{l.label} <span className="muted small">({l.lapses} lapses)</span></li>)}</ul>
        </section>
      )}
    </>
  )
}
