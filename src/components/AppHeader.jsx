import ProgressBar from './ProgressBar.jsx'

/**
 * The top nav: clock, completion bar, and the three things you reach for
 * without scrolling — add a task, see what is due, and mute the voice.
 *
 * The wordmark lives in the sidebar, so this row stays a status strip rather
 * than a second place the app introduces itself.
 */
export default function AppHeader({
  now,
  stats,
  dueCount,
  remindersOn,
  onToggleReminders,
  onNewTask,
  onShowDue,
  voiceSupported,
}) {
  const time = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  const date = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })

  return (
    <header className="app-header">
      <p className="header-clock">
        <span className="header-date">{date}</span>
        <span className="header-time">{time}</span>
      </p>

      <ProgressBar stats={stats} />

      <div className="header-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={onNewTask}>
          + New
        </button>

        <button
          type="button"
          className={`bell-btn${dueCount > 0 ? ' has-due' : ''}`}
          onClick={onShowDue}
          aria-label={
            dueCount > 0
              ? `${dueCount} ${dueCount === 1 ? 'task is' : 'tasks are'} due — open the reminder`
              : 'Nothing is due'
          }
          title={dueCount > 0 ? 'Open the reminder' : 'Nothing is due'}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M18 15.5V10a6 6 0 1 0-12 0v5.5L4.5 18h15L18 15.5Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <path
              d="M10 20.5a2.2 2.2 0 0 0 4 0"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>

          {dueCount > 0 ? <span className="bell-badge">{dueCount > 9 ? '9+' : dueCount}</span> : null}
        </button>

        <button
          type="button"
          className={`voice-switch${remindersOn ? ' is-on' : ''}`}
          onClick={onToggleReminders}
          aria-pressed={remindersOn}
          title={
            voiceSupported
              ? 'Spoken reminders when a task falls due'
              : 'This browser cannot speak — reminder cards still appear'
          }
        >
          <span className="voice-switch-dot" aria-hidden="true" />
          Voice {remindersOn ? 'on' : 'off'}
        </button>
      </div>
    </header>
  )
}
