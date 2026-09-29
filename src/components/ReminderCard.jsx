import MicButton from './MicButton.jsx'

/**
 * On-screen twin of the spoken reminder.
 *
 * The app asks the same question out loud and here, and either answer counts.
 * This card is what keeps the feature usable when speech is unsupported, the
 * mic is denied, or the reply was not understood — which is also why it stays
 * up until it is answered or dismissed.
 */
export default function ReminderCard({
  prompt,
  heard,
  listening,
  snoozeMinutes = 15,
  onYes,
  onSnooze,
  onListen,
  onDismiss,
}) {
  return (
    <div className="reminder-card" role="alertdialog" aria-labelledby="reminder-question">
      <p className="reminder-kicker">Reminder</p>

      <p className="reminder-question" id="reminder-question">
        {prompt.line}
      </p>

      {heard ? (
        <p className="reminder-heard">
          Heard: “{heard}” — not sure what that meant. Use the buttons below.
        </p>
      ) : (
        <p className="reminder-hint">
          {listening
            ? 'Listening… say “yes”, “later”, “change it to 6pm”, or “add note …”.'
            : 'Tap an answer, or press the mic to reply out loud.'}
        </p>
      )}

      <div className="reminder-actions">
        <button type="button" className="btn btn-primary" onClick={onYes}>
          Yes, done
        </button>
        <button type="button" className="btn btn-ghost" onClick={onSnooze}>
          Snooze {snoozeMinutes}m
        </button>

        <MicButton
          listening={listening}
          onClick={onListen}
          label="Answer by voice"
        />

        <button
          type="button"
          className="icon-btn"
          onClick={onDismiss}
          aria-label="Dismiss reminder"
          title="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
