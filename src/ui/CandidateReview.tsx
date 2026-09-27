import { useEffect, useMemo, useState } from 'react'
import type { Fact } from '../content/types'
import { db, exportReview, saveSettings, type CandidateEdit, type CandidateRow, type Settings } from '../db'

type Filter = 'pending' | 'approved' | 'revised' | 'rejected' | 'all'
const MATCH: Record<string, string> = { new: 'New to the bank', update: 'Updates an existing fact', conflict: 'Conflicts with an existing fact', duplicate: 'Duplicate' }
const CAUTION: Record<string, string> = { DENOM: 'Denominator', DEF: 'Definition-sensitive', STOCKFLOW: 'Stock vs flow', IMF: 'IMF commitment vs disbursement', RANK: 'Ranking', CAUSAL: 'Association, not cause', HIST: 'Historical, not current' }
const pick = (c: CandidateRow): CandidateEdit => ({ title: c.title, value: c.value, period: c.period, src: c.src, proves: c.proves, method: c.method, theme: c.theme })

export function CandidateReview({ settings, onSettings }: { settings: Settings; onSettings: (s: Settings) => void }) {
  const [rows, setRows] = useState<CandidateRow[]>([])
  const [facts, setFacts] = useState<Map<string, Fact>>(new Map())
  const [filter, setFilter] = useState<Filter>('pending')
  const [cursor, setCursor] = useState(0)
  const [draft, setDraft] = useState<CandidateEdit | null>(null)
  const [note, setNote] = useState('')
  const [checked, setChecked] = useState(false)
  const [asNew, setAsNew] = useState(false)
  const [name, setName] = useState(settings.reviewerName)
  const [msg, setMsg] = useState('')

  const reload = async () => {
    const [cs, items] = await Promise.all([db.candidates.toArray(), db.items.where('kind').equals('fact').toArray()])
    setRows(cs.sort((a, b) => (b.t1 ?? 0) - (a.t1 ?? 0) || b.story.at - a.story.at))
    setFacts(new Map(items.map((i) => [i.id, i.data as Fact])))
  }
  useEffect(() => { reload() }, [])

  const list = useMemo(() => rows.filter((p) => filter === 'all' || p.status === filter), [rows, filter])
  const count = (s: string) => rows.filter((p) => p.status === s).length
  const c = list[Math.min(cursor, list.length - 1)]
  const near = c?.match.factId ? facts.get(c.match.factId) : undefined

  useEffect(() => {
    if (!c) return
    setDraft(c.edited ?? pick(c))
    setNote(c.note ?? '')
    setChecked(!!c.primaryChecked)
    setAsNew(!!c.asNew)
  }, [c?.id])

  const changed = c && draft && JSON.stringify(draft) !== JSON.stringify(pick(c))

  const decide = async (status: CandidateRow['status']) => {
    if (!c || !draft) return
    if (!name.trim()) return setMsg('Enter your name first so decisions are attributed.')
    const revised = status === 'approved' && changed
    await db.candidates.put({ ...c, status: revised ? 'revised' : status, edited: revised ? draft : undefined, note: note.trim() || undefined, reviewer: name.trim(), decidedAt: Date.now(), primaryChecked: checked, asNew })
    if (name.trim() !== settings.reviewerName) { const s = { ...settings, reviewerName: name.trim() }; await saveSettings(s); onSettings(s) }
    setMsg('')
    await reload()
    if (filter !== 'all') setCursor((k) => Math.min(k, Math.max(0, list.length - 2)))
  }

  const download = async () => {
    const blob = new Blob([await exportReview()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `css-os-review-${(name || 'reviewer').replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    setMsg('Downloaded. Send this file to the maintainer; approved facts enter the bank in the next release.')
  }

  if (!rows.length) return <section className="card"><h2>New evidence from the news</h2><p className="muted">No candidate facts are waiting. They appear here after the news run extracts them from shortlisted stories.</p></section>

  return (
    <>
      <section className="card">
        <h2>New evidence from the news</h2>
        <p className="muted small">
          Facts extracted from shortlisted stories. Each figure was checked to appear word-for-word in the article, but a newspaper is a secondary source: open the article, and where you can, confirm the figure against the body it is attributed to. Nothing enters the bank until you approve it.
        </p>
        <div className="row">
          {(['pending', 'approved', 'revised', 'rejected', 'all'] as Filter[]).map((f) => (
            <button key={f} className={filter === f ? 'opt on' : 'opt'} onClick={() => { setFilter(f); setCursor(0) }}>{f[0].toUpperCase() + f.slice(1)} {f !== 'all' && <span className="muted">({count(f)})</span>}</button>
          ))}
        </div>
        <div className="row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (attributed to decisions)" />
          <button onClick={download} disabled={!rows.some((r) => r.status !== 'pending')}>Download decisions</button>
        </div>
        {msg && <p className="note">{msg}</p>}
      </section>

      {!c || !draft ? (
        <section className="card"><p className="muted">Nothing in this list.</p></section>
      ) : (
        <section className="card form">
          <div className="bar">
            <span><span className="tag">{c.status}</span> <span className={`pill ${c.match.kind === 'conflict' ? 'mid' : c.match.kind === 'update' ? 'good' : ''}`}>{MATCH[c.match.kind]}</span>{c.t1 === 1 && <span className="pill good">Tier-1 potential</span>}</span>
            <span className="muted small">{cursor + 1} / {list.length}</span>
          </div>

          <p className="small"><b>From:</b> <a href={c.story.link} target="_blank" rel="noreferrer" dir={c.story.lang === 'ur' ? 'rtl' : 'ltr'}>{c.story.title}</a> <span className="muted">· {c.story.outlet} · {new Date(c.story.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span></p>
          <blockquote className="quote" dir={c.story.lang === 'ur' ? 'rtl' : 'ltr'}>“{c.quote}”</blockquote>

          {near && (
            <p className="note small">
              <b>{c.match.kind === 'new' ? 'Nearest fact in the bank' : 'Existing fact'} ({near.id}):</b> {near.titleIsValue ? near.value : `${near.title}: ${near.value}`}{near.period ? ` (${near.period})` : ''} — {near.source}
              {c.match.kind === 'update' && <><br />Approving replaces this value. Learners who already know it get an “updated” card showing the old and new figures.</>}
              {c.match.kind === 'conflict' && <><br />Same period, different figure. Sources may use different definitions: approve only if both should be kept, and say which definition in the method note.</>}
            </p>
          )}
          {c.cautions.length > 0 && <p className="warn small">Cautions: {c.cautions.map((x) => CAUTION[x] ?? x).join(' · ')}</p>}

          <label>Indicator<input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
          <div className="row">
            <label>Value<input value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} /></label>
            <label>Year / period<input value={draft.period} onChange={(e) => setDraft({ ...draft, period: e.target.value })} /></label>
          </div>
          <label>Primary source (the body the figure belongs to)<input value={draft.src} onChange={(e) => setDraft({ ...draft, src: e.target.value })} placeholder="e.g. Pakistan Bureau of Statistics" /></label>
          <label>What it proves<textarea rows={3} value={draft.proves} onChange={(e) => setDraft({ ...draft, proves: e.target.value })} /></label>
          <label>Method note — denominator, definition, coverage<input value={draft.method} onChange={(e) => setDraft({ ...draft, method: e.target.value })} /></label>
          <p className="muted small">{c.type} · {c.role} · {draft.theme}{c.map ? ` · ${c.map}` : ''} · {c.tags.join(', ')}</p>
          {c.match.kind === 'update' && <label className="tick"><input type="checkbox" checked={asNew} onChange={() => setAsNew(!asNew)} /><span>Keep the existing fact and add this as a separate one (different definition or source)</span></label>}
          <label className="tick"><input type="checkbox" checked={checked} onChange={() => setChecked(!checked)} /><span>I confirmed this figure against the primary source, not only the newspaper</span></label>
          <label>Note to the maintainer (optional)<input value={note} onChange={(e) => setNote(e.target.value)} /></label>

          {c.status === 'pending' ? (
            <div className="row">
              <button className="primary" onClick={() => decide('approved')}>{changed ? 'Approve with my edits' : 'Approve'}</button>
              <button onClick={() => decide('rejected')}>Reject</button>
            </div>
          ) : (
            <div className="row">
              <button className="primary" onClick={() => decide('approved')}>Save changes</button>
              <button onClick={async () => { await db.candidates.put({ ...c, status: 'pending', decidedAt: undefined }); await reload() }}>Reopen</button>
            </div>
          )}
          <div className="row">
            <button disabled={cursor === 0} onClick={() => setCursor(cursor - 1)}>← Previous</button>
            <button disabled={cursor >= list.length - 1} onClick={() => setCursor(cursor + 1)}>Skip →</button>
          </div>
        </section>
      )}
    </>
  )
}
