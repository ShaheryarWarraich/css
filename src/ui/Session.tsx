import { useEffect, useMemo, useRef, useState } from 'react'
import { gradeNumeric } from '../content/numeric'
import type { Settings } from '../db'
import { gradeEvidence, gradeOrder, type Exercise, type Feedback } from '../engine/forms'
import { answer, buildPlan, exerciseFor, load, type AnswerResult, type Loaded, type QueueEntry } from '../engine/session'
import { judge } from '../judge'

type Phase = 'intro' | 'ask' | 'selfgrade' | 'feedback'
type Conf = 1 | 2 | 3

function dueText(r: AnswerResult): string {
  if (r.again) return 'Coming back later in this session.'
  const days = Math.round((r.nextDue - Date.now()) / 86_400_000)
  return days <= 1 ? 'Back tomorrow.' : `Back in ${days} days.`
}

function FeedbackBlock({ fb }: { fb: Feedback }) {
  return (
    <div className="fb">
      {fb.changedFrom && <p className="warn">Updated figure. Previously: {fb.changedFrom}</p>}
      <p className="fact">{fb.fact}</p>
      {fb.soWhat && <p><b>So what:</b> {fb.soWhat}</p>}
      {fb.why && <p><b>Why it matters:</b> {fb.why}</p>}
      {fb.hook && <p className="hook">{fb.hook}</p>}
      {fb.caution && <p><b>Caution:</b> {fb.caution}</p>}
      {fb.useAgainst && <p><b>Use it against:</b> {fb.useAgainst}</p>}
      {fb.pairs && fb.pairs.length > 0 && <p className="small"><b>Pairs with:</b> {fb.pairs.join(' · ')}</p>}
      <p className="muted small">
        {fb.sourceLabel ?? 'Source'}: {fb.sourceUrl ? <a href={fb.sourceUrl} target="_blank" rel="noreferrer">{fb.source}</a> : fb.source}
      </p>
      {fb.flag && <p className="warn small">{fb.flag}</p>}
      {fb.example && (
        <details>
          <summary>{fb.exampleLabel ?? 'One way to deploy it — then write your own'}</summary>
          <p className="small">{fb.example}</p>
          {!fb.exampleLabel && <p className="muted small">Examiners penalise stock sentences. Use this as a pattern, never as a script.</p>}
        </details>
      )}
    </div>
  )
}

export function Session({ settings, onExit }: { settings: Settings; onExit: () => void }) {
  const [L, setL] = useState<Loaded | null>(null)
  const [queue, setQueue] = useState<QueueEntry[]>([])
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('ask')
  const [text, setText] = useState('')
  const [picked, setPicked] = useState<number | null>(null)
  const [order, setOrder] = useState<string[]>([])
  const [ticks, setTicks] = useState<Set<number>>(new Set())
  const [conf, setConf] = useState<Conf>(2)
  const [latency, setLatency] = useState(0)
  const [score, setScore] = useState(0)
  const [result, setResult] = useState<AnswerResult | null>(null)
  const [aiNote, setAiNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [tally, setTally] = useState({ done: 0, right: 0, fresh: 0 })
  const shownAt = useRef(Date.now())

  useEffect(() => {
    load(settings).then(async (loaded) => {
      const plan = await buildPlan(loaded)
      setL(loaded)
      setQueue(plan.queue)
    })
  }, [settings])

  const entry = queue[idx]
  const current = useMemo(() => (L && entry ? exerciseFor(L, entry) : null), [L, entry])

  useEffect(() => {
    if (!entry) return
    setPhase(!entry.card || entry.item.prevValue ? 'intro' : 'ask')
    setText(''); setPicked(null); setOrder([]); setTicks(new Set()); setAiNote(''); setResult(null)
    shownAt.current = Date.now()
  }, [entry])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || ['TEXTAREA', 'BUTTON', 'A'].includes((e.target as HTMLElement).tagName)) return
      if (phase === 'feedback') setIdx((i) => i + 1)
      else if (phase === 'intro') { shownAt.current = Date.now(); setPhase('ask') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase])

  if (!L) return <main className="wrap"><p className="muted">Building your session…</p></main>

  if (!entry || !current)
    return (
      <main className="wrap">
        <section className="card center">
          <h1>Session complete</h1>
          <div className="stats">
            <div><strong>{tally.done}</strong><span>answered</span></div>
            <div><strong>{tally.done ? Math.round((tally.right / tally.done) * 100) : 0}%</strong><span>correct</span></div>
            <div><strong>{tally.fresh}</strong><span>new learned</span></div>
          </div>
          <button className="primary big" onClick={onExit}>Done</button>
        </section>
      </main>
    )

  const { exercise: ex, feedback: fb } = current

  const finalize = async (s: number, c: Conf, ms: number) => {
    setScore(s)
    const r = await answer(L, entry, ex.form, s, c, ms)
    setResult(r)
    setTally((t) => ({ done: t.done + 1, right: t.right + (s === 1 ? 1 : 0), fresh: t.fresh + (!entry.card && !r.again ? 1 : 0) }))
    if (r.again) setQueue((q) => { const n = [...q]; n.splice(Math.min(n.length, idx + 5), 0, { item: { ...entry.item, prevValue: undefined }, card: r.card }); return n })
    setPhase('feedback')
  }

  const submit = (c: Conf) => {
    const ms = Date.now() - shownAt.current
    setConf(c); setLatency(ms)
    if (ex.form === 'mcq') return finalize(picked === ex.answer ? 1 : 0, c, ms)
    if (ex.form === 'cloze') { const g = gradeNumeric(text, ex.token); return finalize(g.correct ? 1 : g.close ? 0.25 : 0, c, ms) } // a near-miss figure is still a lapse: relearn it now
    if (ex.form === 'order') return finalize(gradeOrder(order, ex.answer), c, ms)
    setPhase('selfgrade')
  }

  const askAi = async () => {
    if (ex.form !== 'recall') return
    setBusy(true)
    try {
      const v = await judge(settings.judgeUrl, { stem: ex.stem, ask: ex.ask, reference: ex.reveal, answer: text })
      setAiNote(v.feedback)
      await finalize(v.score, conf, latency)
    } catch (e) {
      setAiNote(`AI check unavailable (${(e as Error).message}). Grade yourself below.`)
    } finally { setBusy(false) }
  }

  const ready = ex.form === 'mcq' ? picked !== null : ex.form === 'cloze' ? /\d/.test(text) : ex.form === 'order' ? order.length === ex.answer.length : true
  const verdict = score === 1 ? ['good', 'Correct'] : score > 0 ? ['mid', 'Close — not exam-safe yet'] : ['bad', 'Not yet']

  return (
    <main className="wrap session">
      <div className="bar"><button className="link" onClick={onExit}>End session</button><span className="muted small">{idx + 1} / {queue.length} · rung {ex.rung}</span></div>
      <div className="progress"><i style={{ width: `${(idx / queue.length) * 100}%` }} /></div>

      {phase === 'intro' && (
        <section className="card">
          <span className="tag">{entry.item.prevValue ? 'Updated' : 'New'}</span>
          <FeedbackBlock fb={fb} />
          <button className="primary big" onClick={() => { shownAt.current = Date.now(); setPhase('ask') }}>Test me</button>
        </section>
      )}

      {phase !== 'intro' && (
        <section className="card">
          <p className="stem">{ex.stem}</p>
          <p className="ask">{ex.ask}</p>

          {ex.form === 'mcq' && (
            <div className="opts">
              {ex.options.map((o, i) => {
                const state = phase === 'feedback' ? (i === ex.answer ? 'right' : i === picked ? 'wrong' : '') : i === picked ? 'on' : ''
                return <button key={i} className={`opt ${state}`} disabled={phase !== 'ask'} onClick={() => setPicked(i)}>{o}</button>
              })}
            </div>
          )}

          {ex.form === 'cloze' && <input autoFocus inputMode="decimal" value={text} disabled={phase !== 'ask'} onChange={(e) => setText(e.target.value)} placeholder="Your figure" />}

          {(ex.form === 'recall' || ex.form === 'evidence') && (
            <textarea autoFocus rows={4} value={text} disabled={phase !== 'ask'} onChange={(e) => setText(e.target.value)} placeholder="Write it from memory before you reveal. Typing it is the practice." />
          )}

          {ex.form === 'order' && (
            <>
              <ol className="chain">{order.map((l, i) => <li key={l}><button className="chip on" disabled={phase !== 'ask'} onClick={() => setOrder(order.filter((_, j) => j !== i))}>{l}</button></li>)}</ol>
              <div className="chips">{ex.shuffled.filter((l) => !order.includes(l)).map((l) => <button key={l} className="chip" onClick={() => setOrder([...order, l])}>{l}</button>)}</div>
            </>
          )}

          {phase === 'ask' && (
            <div className="conf">
              <p className="muted small">How sure are you? Your choice submits the answer.</p>
              <div className="row">
                <button disabled={!ready} onClick={() => submit(1)}>Guessing</button>
                <button disabled={!ready} onClick={() => submit(2)}>Think so</button>
                <button disabled={!ready} onClick={() => submit(3)}>Sure</button>
              </div>
            </div>
          )}

          {phase === 'selfgrade' && ex.form === 'recall' && (
            <div className="reveal">
              <h3>Reference</h3>
              <p className="pre">{ex.reveal}</p>
              {aiNote && <p className="warn small">{aiNote}</p>}
              <p className="muted small">Compare honestly. Substance counts, wording does not.</p>
              <div className="row">
                <button onClick={() => finalize(0, conf, latency)}>Missed</button>
                <button onClick={() => finalize(0.5, conf, latency)}>Partly</button>
                <button onClick={() => finalize(1, conf, latency)}>Got it</button>
              </div>
              {settings.judgeUrl && text.trim() && <button className="link" disabled={busy} onClick={askAi}>{busy ? 'Checking…' : 'Check with AI instead'}</button>}
            </div>
          )}

          {phase === 'selfgrade' && ex.form === 'evidence' && (
            <div className="reveal">
              <h3>Tick what you recalled</h3>
              {ex.expected.map((e, i) => (
                <label key={e.id} className="tick">
                  <input type="checkbox" checked={ticks.has(i)} onChange={() => { const n = new Set(ticks); n.has(i) ? n.delete(i) : n.add(i); setTicks(n) }} />
                  <span>{e.label}</span>
                </label>
              ))}
              <button className="primary" onClick={() => finalize(gradeEvidence(ticks.size, ex.expected.length), conf, latency)}>Done</button>
            </div>
          )}
        </section>
      )}

      {phase === 'feedback' && result && (
        <section className={`card verdict ${verdict[0]}`}>
          <h2>{verdict[1]}</h2>
          {ex.form === 'cloze' && <p>You wrote <b>{text}</b>. The figure is <b>{ex.token.raw}</b>.</p>}
          {ex.form === 'order' && score < 1 && <p className="small">Correct order: {ex.answer.join(' → ')}</p>}
          {score === 0 && conf === 3 && <p className="warn small">You were sure and it was wrong. These stick best when corrected now, but the correction fades, so this returns within two days.</p>}
          {aiNote && <p className="small"><b>AI check:</b> {aiNote}</p>}
          <FeedbackBlock fb={{ ...fb, changedFrom: undefined }} />
          <p className="muted small">{dueText(result)}</p>
          <button className="primary big" onClick={() => setIdx(idx + 1)}>Next</button>
        </section>
      )}
    </main>
  )
}
