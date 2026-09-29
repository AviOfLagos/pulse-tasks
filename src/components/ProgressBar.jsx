/**
 * The completion bar in the top nav.
 *
 * Linear rather than the ring it replaces: a nav bar is a strip, and a strip
 * is the one shape a ring cannot sit in without stealing height from the
 * content below it.
 */
export default function ProgressBar({ stats }) {
  const { percent, done, total, active } = stats

  return (
    <div className="progress-strip">
      <div
        className="progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`${done} of ${total} tasks complete`}
      >
        <span className="progress-fill" style={{ width: `${percent}%` }} />
      </div>

      <p className="progress-legend">
        <strong>{percent}%</strong>
        <span className="progress-detail">
          {active} open · {done} done
        </span>
      </p>
    </div>
  )
}
