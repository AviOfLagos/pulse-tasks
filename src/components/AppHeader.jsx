/**
 * App header: wordmark, live clock, and the switch that arms spoken reminders.
 *
 * The old terminal chrome (dots, `~/tasks`, blinking cursor) is gone — the
 * header is now the only thing above the composer.
 */
export default function AppHeader({
  now,
  remindersOn,
  onToggleReminders,
  onLoadDemo,
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
      <div className="brand">
        <h1 className="brand-name">Pulse Tasks</h1>
        <p className="brand-sub">
          {date} · {time}
        </p>
      </div>

      <div className="header-actions">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onLoadDemo}
          title="Fill the app with a realistic set of tasks"
        >
          Load demo data
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
          Voice reminders {remindersOn ? 'on' : 'off'}
        </button>
      </div>
    </header>
  )
}
