const RADIUS = 42
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * Completion ring. The wrapper carries `progressbar` semantics so assistive tech
 * reads the numbers; the visible text stays static to avoid double-announcing
 * with the app's screen-reader status region.
 */
export default function ProgressRing({ stats }) {
  const { total, done, active, percent } = stats
  const offset = CIRCUMFERENCE * (1 - percent / 100)

  return (
    <section className="card progress-card" aria-label="Progress">
      <h2 className="card-title">Progress</h2>

      <div className="progress-body">
        <div
          className={`ring-wrap${percent === 100 && total > 0 ? ' is-complete' : ''}`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={`${done} of ${total} tasks complete`}
        >
          <svg className="ring" viewBox="0 0 100 100" aria-hidden="true">
            <circle className="ring-track" cx="50" cy="50" r={RADIUS} />
            <circle
              className="ring-value"
              cx="50"
              cy="50"
              r={RADIUS}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
            />
          </svg>
          <span className="ring-label">{percent}%</span>
        </div>

        <dl className="progress-counts">
          <div>
            <dt>Open</dt>
            <dd>{active}</dd>
          </div>
          <div>
            <dt>Done</dt>
            <dd>{done}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>{total}</dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
