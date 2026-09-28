/**
 * The content top bar: live clock and the switch that arms spoken reminders.
 *
 * The wordmark lives in the sidebar, so this row stays a status strip rather
 * than a second place the app introduces itself.
 */
export default function AppHeader({ now, remindersOn, onToggleReminders, voiceSupported }) {
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

      <div className="header-actions">
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
