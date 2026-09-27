import { useEffect, useMemo, useState } from 'react'
import { db, type NewsMark } from '../db'
import type { NewsIndex, NewsStory } from '../news/types'

const base = import.meta.env.BASE_URL
const getJson = async <T,>(path: string): Promise<T> => {
  const res = await fetch(base + path, { cache: 'no-cache' })
  if (!res.ok) throw new Error(String(res.status))
  return res.json()
}

const timeOf = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
const dayLabel = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })

export function News() {
  const [index, setIndex] = useState<NewsIndex | null>(null)
  const [error, setError] = useState('')
  const [day, setDay] = useState('')
  const [stories, setStories] = useState<NewsStory[]>([])
  const [marks, setMarks] = useState<Map<string, NewsMark>>(new Map())
  const [view, setView] = useState<'all' | 'short' | 'starred'>('all')
  const [lang, setLang] = useState('')
  const [outlet, setOutlet] = useState('')
  const [theme, setTheme] = useState('')
  const [kind, setKind] = useState('')
  const [q, setQ] = useState('')
  const [showHealth, setShowHealth] = useState(false)
  const [limit, setLimit] = useState(60)

  useEffect(() => {
    getJson<NewsIndex>('news/index.json').then((i) => { setIndex(i); setDay(i.days[0]?.date ?? '') }).catch(() => setError('News has not been fetched yet, or you are offline and have not opened it before.'))
    db.newsMarks.toArray().then((m) => setMarks(new Map(m.map((x) => [x.id, x]))))
  }, [])
  useEffect(() => { if (day) { setLimit(60); getJson<NewsStory[]>(`news/${day}.json`).then(setStories).catch(() => setStories([])) } }, [day])

  const mark = async (id: string, patch: Partial<NewsMark>) => {
    const next = { ...(marks.get(id) ?? { id, at: Date.now() }), ...patch, at: Date.now() }
    await db.newsMarks.put(next)
    setMarks(new Map(marks).set(id, next))
  }

  const outlets = useMemo(() => [...new Set(stories.filter((s) => !lang || s.l === lang).map((s) => s.o))].sort(), [stories, lang])
  const themes = useMemo(() => [...new Set(stories.flatMap((s) => s.ps.th))].sort(), [stories])
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const out = stories.filter((s) =>
      (view !== 'short' || (index?.assessMode === 'cli' ? s.as?.keep === 1 : s.ps.s >= 9)) &&
      (view !== 'starred' || marks.get(s.id)?.star) &&
      (!lang || s.l === lang) && (!outlet || s.o === outlet) && (!kind || s.k === kind) && (!theme || s.ps.th.includes(theme)) &&
      (!needle || `${s.t} ${s.sn} ${s.o}`.toLowerCase().includes(needle)))
    return view === 'short' ? [...out].sort((a, b) => (b.as?.t1 ?? 0) - (a.as?.t1 ?? 0) || b.ps.s - a.ps.s) : out
  }, [stories, view, lang, outlet, kind, theme, q, marks, index])

  if (error) return <><h1>News</h1><section className="card"><p className="muted">{error}</p></section></>
  if (!index) return <p className="muted">Loading news…</p>
  const L = index.labels
  const bad = index.health.filter((h) => !h.ok || h.note)

  return (
    <>
      <div className="bar">
        <h1>News</h1>
        <div className="seg">
          <button className={view === 'all' ? 'on' : ''} onClick={() => setView('all')}>All</button>
          <button className={view === 'short' ? 'on' : ''} onClick={() => setView('short')}>Shortlist</button>
          <button className={view === 'starred' ? 'on' : ''} onClick={() => setView('starred')}>Starred</button>
        </div>
      </div>

      <div className="days">
        {index.days.map((d) => (
          <button key={d.date} className={d.date === day ? 'chip on' : 'chip'} onClick={() => setDay(d.date)}>
            {dayLabel(d.date)} <span className="muted small">{view === 'short' && index.assessMode === 'cli' ? d.kept : d.count}</span>
          </button>
        ))}
      </div>

      <div className="row">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search headlines" />
        <select value={lang} onChange={(e) => { setLang(e.target.value); setOutlet('') }}><option value="">English + اردو</option><option value="en">English</option><option value="ur">اردو</option></select>
      </div>
      <div className="row">
        <select value={outlet} onChange={(e) => setOutlet(e.target.value)}><option value="">All outlets</option>{outlets.map((o) => <option key={o}>{o}</option>)}</select>
        <select value={theme} onChange={(e) => setTheme(e.target.value)}><option value="">All themes</option>{themes.map((t) => <option key={t}>{t}</option>)}</select>
        <select value={kind} onChange={(e) => setKind(e.target.value)}><option value="">News + opinion</option><option value="news">News</option><option value="business">Business</option><option value="opinion">Opinion</option></select>
      </div>

      {view === 'short' && (
        <p className="note">
          {index.assessMode === 'cli'
            ? 'Stories judged likely to contain evidence worth adding to the bank, checked against the extraction criteria. Read the original before relying on any figure.'
            : 'Rule-based shortlist only: the AI assessment has not run. Stories are ranked by the hard-coded criteria.'}
        </p>
      )}
      <p className="muted small">{list.length} stories · updated {new Date(index.updatedAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>

      <ul className="list news">
        {list.slice(0, limit).map((s) => {
          const m = marks.get(s.id)
          return (
            <li key={s.id} className={m?.read ? 'read' : ''} dir={s.l === 'ur' ? 'rtl' : 'ltr'} lang={s.l}>
              <div className="line" dir="ltr">
                <span className="muted small">{s.o} · {timeOf(s.at)}{s.k !== 'news' ? ` · ${s.k}` : ''}{s.n ? ` · ${s.n} outlets` : ''}</span>
                <button className="star" aria-label={m?.star ? 'Remove star' : 'Star'} onClick={() => mark(s.id, { star: !m?.star })}>{m?.star ? '★' : '☆'}</button>
              </div>
              <a className="headline" href={s.u} target="_blank" rel="noreferrer" onClick={() => mark(s.id, { read: true })}>{s.t}</a>
              {s.sn && <p className="small snippet">{s.sn}</p>}
              {s.as?.keep === 1 && (
                <div className="assess small" dir="ltr">
                  {s.as.t1 === 1 && <span className="pill good">Tier-1 potential</span>}
                  {s.as.role && <span className="pill">{L.roles[s.as.role] ?? s.as.role}</span>}
                  {s.as.use?.map((u) => <span key={u} className="pill">{L.papers[u] ?? u}</span>)}
                  {s.as.map && <span className="pill">{L.maps[s.as.map] ?? s.as.map}</span>}
                  {s.as.th && <span className="pill">{s.as.th}</span>}
                  {s.as.why && <p className="why">Could prove: {s.as.why}</p>}
                </div>
              )}
              {(s.ps.b.length > 0 || s.ps.f.length > 0) && (
                <div className="badges" dir="ltr">
                  {s.ps.b.map((b) => <span key={b} className="badge" title={L.rule[b]}>{L.rule[b] ?? b}</span>)}
                  {s.ps.f.map((f) => <span key={f} className="badge warnb" title={L.flag[f]}>⚠ {f === 'STOCKFLOW' ? 'Stock vs flow' : f === 'RANK' ? 'Ranking' : f === 'IMF' ? 'IMF figures' : 'Definition'}</span>)}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {list.length > limit && <button className="big" onClick={() => setLimit(limit + 60)}>Show more</button>}
      {!list.length && <section className="card"><p className="muted">Nothing matches these filters.</p></section>}

      <section className="card">
        <button className="link" onClick={() => setShowHealth(!showHealth)}>{index.health.filter((h) => h.ok).length} of {index.health.length} feeds working{bad.length ? ` · ${bad.length} with notes` : ''}</button>
        {showHealth && (
          <ul className="small">
            {bad.map((h) => <li key={h.id}><b>{h.name}</b> ({h.id}): {h.note || 'failed'}</li>)}
            {index.unavailable.map((u) => <li key={u.name} className="muted"><b>{u.name}</b>: {u.reason}</li>)}
          </ul>
        )}
        <p className="muted small">Headlines and snippets are shown as published and belong to their publishers. Tap a headline to read the original.</p>
      </section>
    </>
  )
}
