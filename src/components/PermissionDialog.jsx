/**
 * First-use explainer, shown before the browser's own permission prompts.
 *
 * Asking for a microphone with no context is how people end up denying it
 * permanently, so this spells out what is used, when, and where the audio goes
 * (nowhere — recognition is the browser's, and tasks stay in localStorage).
 */
export default function PermissionDialog({ onAllow, onDismiss, micState, notificationState }) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onDismiss}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="permission-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="permission-title">Turn on voice</h2>

        <p className="modal-lead">Two permissions, both asked once:</p>

        <ul className="permission-list">
          <li>
            <strong>Microphone</strong> — only while you hold a conversation with the app: when
            you press the mic to add a task, and right after a reminder asks whether something is
            done. Speech recognition is your browser&apos;s own; no audio is recorded or uploaded.
          </li>
          <li>
            <strong>Notifications</strong> — optional. It lets a due reminder reach you when this
            tab is in the background. Decline it and the reminder still appears here as a card.
          </li>
        </ul>

        <p className="modal-note">
          Tasks are saved in this browser only. You can revoke either permission from the padlock
          in the address bar at any time.
        </p>

        <div className="modal-actions">
          <button type="button" className="btn btn-primary" onClick={onAllow}>
            Allow and continue
          </button>
          <button type="button" className="btn btn-ghost" onClick={onDismiss}>
            Not now
          </button>
        </div>

        {micState === 'denied' ? (
          <p className="form-error">
            The microphone is currently blocked for this site — allow it in your browser settings,
            then try again. Everything still works by typing and tapping.
          </p>
        ) : null}

        {notificationState === 'denied' ? (
          <p className="modal-note">
            Notifications are blocked, so reminders will only show while this tab is open.
          </p>
        ) : null}
      </div>
    </div>
  )
}
