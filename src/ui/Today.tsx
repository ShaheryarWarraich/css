import { useEffect, useState } from 'react'
import type { Settings } from '../db'
import { daysToExam, schedulerConfig } from '../engine/scheduler'
import { buildPlan, load, type Plan } from '../engine/session'

export function Today({ settings, onStart }: { settings: Settings; onStart: () => void }) {
  const [plan, setPlan] = useState<Plan | null>(null)
  useEffect(() => {
    load(settings).then((L) => buildPlan(L)).then(setPlan)
  }, [settings])

  const now = new Date()
  const days = daysToExam(settings.examDate, now)
  const cfg = schedulerConfig(settings.examDate, now)
  if (!plan) return <p className="muted">Planning today…</p>

  const reviews = plan.queue.filter((q) => q.card).length
  const fresh = plan.queue.length - reviews
  const minutes = Math.max(1, Math.round((reviews * 25 + fresh * 50) / 60))

  return (
    <>
      <header className="hero">
        <div>
          <h1>CSS OS</h1>
          <p className="muted">Retrieve it. Then use it.</p>
        </div>
        {days > 0 && (
          <div className="count">
            <strong>{days}</strong>
            <span>days to written exam</span>
          </div>
        )}
      </header>

      <section className="card">
        <h2>Today</h2>
        {plan.queue.length ? (
          <>
            <div className="stats">
              <div><strong>{reviews}</strong><span>to recall</span></div>
              <div><strong>{fresh}</strong><span>new</span></div>
              <div><strong>~{minutes}</strong><span>minutes</span></div>
            </div>
            <button className="primary big" onClick={onStart}>Start session</button>
            {plan.deferred > 0 && (
              <p className="note">
                {plan.deferred} more are due but do not fit today's {settings.minutesPerDay} minutes. The most-forgotten come first; the rest roll over. No new material is added until you catch up.
              </p>
            )}
          </>
        ) : (
          <p>
            {plan.newToday ? 'Done for today. Everything due has been recalled.' : 'Nothing is due.'}{' '}
            <span className="muted">{plan.newAvailable ? 'New material unlocks tomorrow, or raise the daily limit in Settings.' : 'Add tiers in Settings to bring in more of the bank.'}</span>
          </p>
        )}
      </section>

      <section className="card">
        <h2>How your schedule works</h2>
        <p className="muted">
          Each fact returns just before you are predicted to forget it. With {days > 0 ? `${days} days left` : 'no exam date set'}, no gap is allowed to exceed {cfg.maximumInterval} days, so
          everything you learn is seen again in the final weeks. Target recall: {Math.round(cfg.requestRetention * 100)}%.
        </p>
      </section>
    </>
  )
}
