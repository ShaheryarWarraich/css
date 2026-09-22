import { useEffect, useMemo, useState } from 'react'
import type { Fact, ProposalFields } from '../content/types'
import { db, exportReview, saveSettings, type ProposalRow, type Settings } from '../db'

type Filter = 'pending' | 'approved' | 'revised' | 'rejected' | 'all'

const sentence = (f: Fact) => (f.titleIsValue ? f.value : `${f.title}${f.period ? ` (${f.period})` : ''}: ${f.value}`)

export function Review({ settings, onSettings }: { settings: Settings; onSettings: (s: Settings) => void }) {
  const [rows, setRows] = useState<ProposalRow[]>([])
  const [facts, setFacts] = useState<Map<string, Fact>>(new Map())
  const [filter, setFilter] = useState<Filter>('pending')
  const [cursor, setCursor] = useState(0)
  const [draft, setDraft] = useState<ProposalFields | null>(null)
  const [pairText, setPairText] = useState('')
  const [note, setNote] = useState('')
  const [name, setName] = useState(settings.reviewerName)
  const [msg, setMsg] = useState('')

  const reload = async () => {
    const [ps, items] = await Promise.all([db.proposals.toArray(), db.items.where('kind').equals('fact').toArray()])
    setRows(ps.sort((a, b) => a.factId.localeCompare(b.factId)))
    setFacts(new Map(items.map((i) => [i.id, i.data as Fact])))
  }
  useEffect(() => { reload() }, [])

  const list = useMemo(() => rows.filter((p) => filter === 'all' || p.status === filter), [rows, filter])
  const counts = useMemo(() => ({ pending: rows.filter((p) => p.status === 'pending').length, approved: rows.filter((p) => p.status === 'approved').length, revised: rows.filter((p) => p.status === 'revised').length, rejected: rows.filter((p) => p.status === 'rejected').length }), [rows])
  const p = list[Math.min(cursor, list.length - 1)]
  const fact = p ? facts.get(p.factId) : undefined

  // Numbers in a draft must come from the fact, its pairings, or elsewhere in the bank. Anything else is the AI's own.
  const bankNumbers = useMemo(() => {
    const set = new Set<string>()
    for (const f of facts.values()) for (const m of `${f.title} ${f.value} ${f.period ?? ''}`.matchAll(/\d[\d,]*(?:\.\d+)?/g)) set.add(m[0].replace(/,/g, ''))
    return set
  }, [facts])
  const foreignNumbers = useMemo(() => {
    if (!p || !fact) return []
    const v = p.edited ?? p.field
    const text = `${v.qualification} ${v.hook} ${v.useAgainst} ${v.deploy ?? ''}`
    const local = new Set<string>()
    for (const f of [fact, ...v.pairsWith.map((id) => facts.get(id)).filter((x): x is Fact => !!x)])
      for (const m of `${f.title} ${f.value} ${f.period ?? ''} ${f.proves} ${f.whyItMatters ?? ''} ${JSON.stringify(f.benchmark ?? '')}`.matchAll(/\d[\d,]*(?:\.\d+)?/g)) local.add(m[0].replace(/,/g, ''))
    const out: string[] = []
    for (const m of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
      const n = m[0].replace(/,/g, '')
      if (/^(19|20)\d\d$/.test(n) || Number(n) < 10 && !n.includes('.')) continue
      if (!local.has(n)) out.push(n + (bankNumbers.has(n) ? ' (elsewhere in bank)' : ' (NOT in bank)'))
    }
    return [...new Set(out)]
  }, [p, fact, facts, bankNumbers])

  useEffect(() => {
    if (!p) return
    const v = p.edited ?? p.field
    setDraft({ ...v })
    setPairText(v.pairsWith.join(', '))
    setNote(p.note ?? '')
  }, [p?.id])

  const changed = p && draft && JSON.stringify({ ...draft, pairsWith: parsePairs(pairText) }) !== JSON.stringify(p.field)

  function parsePairs(s: string): string[] {
    return s.split(/[,;\s]+/).map((x) => x.trim()).filter((x) => x && facts.has(x))
  }

  const decide = async (status: ProposalRow['status']) => {
    if (!p || !draft) return
    if (!name.trim()) return setMsg('Enter your name first so decisions are attributed.')
    const edited = { ...draft, pairsWith: parsePairs(pairText) }
    const isRevised = status === 'approved' && changed
    await db.proposals.put({ ...p, status: isRevised ? 'revised' : status, edited: isRevised || status === 'revised' ? edited : undefined, note: note.trim() || undefined, reviewer: name.trim(), decidedAt: Date.now() })
    if (name.trim() !== settings.reviewerName) { const s = { ...settings, reviewerName: name.trim() }; await saveSettings(s); onSettings(s) }
    setMsg('')
    await reload()
    if (filter !== 'all') setCursor((c) => Math.min(c, Math.max(0, list.length - 2)))
  }

  const reopen = async () => {
    if (!p) return
    await db.proposals.put({ ...p, status: 'pending', decidedAt: undefined })
    await reload()
  }

  const download = async () => {
    const blob = new Blob([await exportReview()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `css-os-review-${(name || 'reviewer').replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    setMsg('Downloaded. Send this file to the maintainer; approved content goes into the next release for everyone.')
  }

  if (!rows.length) return <section className="card"><h2>Content review</h2><p className="muted">No drafts are waiting for review.</p></section>

  return (
    <>
      <section className="card">
        <h2>Content review · Tier 1 pass</h2>
        <p className="muted small">
          For the 150 most-used facts, an AI drafted the parts the workbook left blank: the caveat, the pairings, a memory hook, and the wrong claim the fact rebuts. Nothing reaches learners until you approve it. Edit freely; your version wins.
        </p>
        <div className="row">
          {(['pending', 'approved', 'revised', 'rejected', 'all'] as Filter[]).map((f) => (
            <button key={f} className={filter === f ? 'opt on' : 'opt'} onClick={() => { setFilter(f); setCursor(0) }}>
              {f[0].toUpperCase() + f.slice(1)} {f !== 'all' && <span className="muted">({counts[f]})</span>}
            </button>
          ))}
        </div>
        <div className="row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (attributed to decisions)" />
          <button onClick={download} disabled={!counts.approved && !counts.revised && !counts.rejected}>Download decisions</button>
        </div>
        {msg && <p className="note">{msg}</p>}
      </section>

      {!p || !fact ? (
        <section className="card"><p className="muted">Nothing in this list.</p></section>
      ) : (
        <section className="card form">
          <div className="bar">
            <span className="tag">{p.status}</span>
            <span className="muted small">{cursor + 1} / {list.length}</span>
          </div>
          <p className="stem">{sentence(fact)}</p>
          <p className="muted small">{fact.source}{fact.sourceUrl && <> · <a href={fact.sourceUrl} target="_blank" rel="noreferrer">source</a></>} · {fact.id} · {fact.theme}</p>
          <p className="small"><b>Proves:</b> {fact.proves}</p>
          {p.draftIssues.length > 0 && <p className="warn small">Draft flags: {p.draftIssues.join('; ')}</p>}
          {foreignNumbers.length > 0 && <p className="warn small">Figures not in this fact or its pairings: {foreignNumbers.join(', ')}. Check them before approving.</p>}

          {draft && (
            <>
              <label>Caveat — what this does not prove
                <textarea rows={4} value={draft.qualification} onChange={(e) => setDraft({ ...draft, qualification: e.target.value })} />
              </label>
              <label>Memory hook — figure → meaning
                <input value={draft.hook} onChange={(e) => setDraft({ ...draft, hook: e.target.value })} />
              </label>
              <label>Use it against — the wrong claim this rebuts
                <textarea rows={3} value={draft.useAgainst} onChange={(e) => setDraft({ ...draft, useAgainst: e.target.value })} />
              </label>
              <label>Model sentence — how a candidate might write it (different wording from "proves")
                <textarea rows={3} value={draft.deploy ?? ''} onChange={(e) => setDraft({ ...draft, deploy: e.target.value })} />
              </label>
              <label>Pairs with — evidence IDs
                <input value={pairText} onChange={(e) => setPairText(e.target.value)} placeholder="E288, E229" />
              </label>
              <ul className="small muted">
                {parsePairs(pairText).map((id) => <li key={id}>{id}: {sentence(facts.get(id)!)}</li>)}
              </ul>
              <label>Note to the maintainer (optional)
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. figure looks outdated; check the 2026 survey" />
              </label>
            </>
          )}

          {p.status === 'pending' ? (
            <div className="row">
              <button className="primary" onClick={() => decide('approved')}>{changed ? 'Approve with my edits' : 'Approve'}</button>
              <button onClick={() => decide('rejected')}>Reject</button>
            </div>
          ) : (
            <div className="row">
              <button className="primary" onClick={() => decide('approved')}>Save changes</button>
              <button onClick={reopen}>Reopen</button>
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
