/**
 * Compact progress card for the sidebar: how much is done, with a neon
 * progress bar. The bar is a proper `progressbar` so assistive tech can read
 * the numbers; visible text stays static to avoid double-announcing with the
 * app's screen-reader-only status region.
 */
export default function StatsBar({ stats }) {
  const { total, active, completed } = stats
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100)

  return (
    <section className="panel stats-card" aria-label="Task progress">
      <h2 className="section-title">Progress</h2>

      <p className="stats-percent">
        <strong>{percent}</strong>
        <span className="stats-unit">% done</span>
      </p>

      <div
        className="progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`${completed} of ${total} tasks completed`}
      >
        <span className="progress-fill" style={{ width: `${percent}%` }} />
      </div>

      <p className="stats-numbers">
        <strong>{active}</strong> to do · <strong>{completed}</strong> done
      </p>
    </section>
  )
}
