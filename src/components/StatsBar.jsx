/**
 * Compact progress card for the sidebar: a glowing SVG gauge plus the counts.
 * The wrapper carries `progressbar` semantics so assistive tech can read the
 * numbers; visible text stays static to avoid double-announcing with the app's
 * screen-reader-only status region.
 */

const RING_RADIUS = 42
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

export default function StatsBar({ stats }) {
  const { total, active, completed } = stats
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100)
  const dashOffset = RING_CIRCUMFERENCE * (1 - percent / 100)

  return (
    <section className="panel stats-card" aria-label="Task progress">
      <h2 className="section-title">Progress</h2>

      <div className="stats-body">
        <div
          className={`ring-wrap${percent === 100 && total > 0 ? ' is-complete' : ''}`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={`${completed} of ${total} tasks completed`}
        >
          <svg className="ring" viewBox="0 0 100 100" aria-hidden="true">
            <circle className="ring-track" cx="50" cy="50" r={RING_RADIUS} />
            <circle
              className="ring-value"
              cx="50"
              cy="50"
              r={RING_RADIUS}
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <span className="ring-label">{percent}%</span>
        </div>

        <div className="stats-copy">
          <p className="stats-numbers">
            <strong>{active}</strong> to do
          </p>
          <p className="stats-numbers">
            <strong>{completed}</strong> done
          </p>
          <p className="stats-numbers is-muted">{total} total</p>
        </div>
      </div>
    </section>
  )
}
