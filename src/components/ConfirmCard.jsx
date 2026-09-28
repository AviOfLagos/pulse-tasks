import { useRef } from 'react'

import { PRIORITIES, PRIORITY_LABELS } from '../constants.js'
import { toDateTimeLocal } from '../utils/date.js'
import MicButton from './MicButton.jsx'

/**
 * "Add 'Call mum' for tomorrow 5:00 PM? Say yes or no."
 *
 * Dictation is a guess twice over — what was heard, and what the parser made
 * of it — so nothing is created until this card is answered. Every field is
 * editable here, which means a near-miss gets corrected in place instead of
 * being said again.
 */
export default function ConfirmCard({
  draft,
  heard,
  listening,
  onChange,
  onConfirm,
  onCancel,
  onListen,
}) {
  const titleRef = useRef(null)

  return (
    <div className="reminder-card confirm-card" role="alertdialog" aria-labelledby="confirm-title">
      <p className="reminder-kicker">New task</p>

      <h2 className="reminder-question" id="confirm-title">
        Add this task?
      </h2>

      {heard ? <p className="reminder-heard">Heard: “{heard}”</p> : null}

      <div className="confirm-fields">
        <div className="field">
          <label htmlFor="confirm-task-title">Task</label>
          <input
            id="confirm-task-title"
            ref={titleRef}
            type="text"
            value={draft.title}
            maxLength={200}
            onChange={(event) => onChange({ ...draft, title: event.target.value })}
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="confirm-task-due">Due</label>
            <input
              id="confirm-task-due"
              type="datetime-local"
              value={toDateTimeLocal(draft.dueAt)}
              onChange={(event) =>
                onChange({ ...draft, dueAt: event.target.value ? event.target.value : null })
              }
            />
          </div>

          <div className="field">
            <label htmlFor="confirm-task-priority">Priority</label>
            <select
              id="confirm-task-priority"
              value={draft.priority}
              onChange={(event) => onChange({ ...draft, priority: event.target.value })}
            >
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_LABELS[priority]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <p className="reminder-hint">
        {listening
          ? 'Listening… say “yes”, “no”, or “change time to 8pm”.'
          : 'Say yes to add it, or edit the fields above.'}
      </p>

      <div className="reminder-actions">
        <button type="button" className="btn btn-primary" onClick={onConfirm}>
          Add ✓
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            titleRef.current?.focus()
            titleRef.current?.select()
          }}
        >
          Edit ✎
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel ✕
        </button>

        <MicButton listening={listening} onClick={onListen} label="Answer by voice" />
      </div>
    </div>
  )
}
