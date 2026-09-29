import { useEffect, useRef, useState } from 'react'

import { MAX_STEPS, PRIORITIES, PRIORITY_LABELS, SNOOZE_MINUTES } from '../constants.js'
import { formatClockTime, formatDueChip, toDateTimeLocal } from '../utils/date.js'

/**
 * The details drawer — everything about one task, in one place.
 *
 * It slides in from the right when a row is clicked. Editing is direct: the
 * selects, chips and checkboxes commit the moment they are used, while the
 * free-text fields (title, notes) commit on blur or Enter so a half-typed word
 * is never written to the store.
 *
 * The drawer is a modal: Escape closes it, the backdrop closes it, focus lands
 * on the title when it opens and returns to the row it came from when it
 * closes — otherwise closing would drop a keyboard user at the top of the page.
 */
export default function TaskDrawer({
  todo,
  knownTags = [],
  onClose,
  onToggle,
  onUpdate,
  onComplete,
  onSnooze,
  onDuplicate,
  onRemove,
  onSelectTag,
  onAddStep,
  onEditStep,
  onToggleStep,
  onRemoveStep,
  onVoiceNote,
  listening = false,
  micSupported = false,
}) {
  const [title, setTitle] = useState(todo.title)
  const [notes, setNotes] = useState(todo.description ?? '')
  const [titleError, setTitleError] = useState('')
  const [tagDraft, setTagDraft] = useState('')
  const [stepDraft, setStepDraft] = useState('')

  const titleRef = useRef(null)
  const returnFocusTo = useRef(null)

  // Reset the drafts when the drawer switches to a different task, so the
  // fields never show one task's text while saving to another.
  useEffect(() => {
    setTitle(todo.title)
    setNotes(todo.description ?? '')
    setTitleError('')
    setTagDraft('')
    setStepDraft('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todo.id])

  useEffect(() => {
    returnFocusTo.current = document.activeElement
    titleRef.current?.focus()
    titleRef.current?.select?.()

    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = overflow

      const row = document.querySelector(`[data-todo-id="${todo.id}"]`)
      // Prefer the row this task lives in; if it is gone (completed and
      // filtered out), fall back to whatever had focus before the drawer.
      ;(row ?? returnFocusTo.current)?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todo.id])

  const commitTitle = () => {
    const next = title.trim()
    if (!next) {
      setTitleError('A task needs a title.')
      titleRef.current?.focus()
      return
    }

    setTitleError('')
    if (next !== todo.title) onUpdate(todo.id, { title: next })
  }

  const commitNotes = () => {
    if (notes.trim() !== (todo.description ?? '').trim()) onUpdate(todo.id, { description: notes })
  }

  const addTag = (raw) => {
    const tag = String(raw ?? '').trim()
    if (!tag) return

    onUpdate(todo.id, { tags: [...todo.tags, tag] })
    setTagDraft('')
  }

  const removeTag = (tag) => onUpdate(todo.id, { tags: todo.tags.filter((item) => item !== tag) })

  const addStep = (event) => {
    event.preventDefault()

    const text = stepDraft.trim()
    if (!text) return

    onAddStep(todo.id, text)
    setStepDraft('')
  }

  const stepsDone = todo.steps.filter((step) => step.done).length
  const suggestions = knownTags
    .filter((tag) => !todo.tags.some((mine) => mine.toLowerCase() === tag.toLowerCase()))
    .filter((tag) => (tagDraft ? tag.toLowerCase().includes(tagDraft.trim().toLowerCase()) : true))
    .slice(0, 6)

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} aria-hidden="true" />

      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-heading"
        data-testid="task-drawer"
      >
        <header className="drawer-head">
          <h2 className="drawer-title" id="drawer-heading">
            Task details
          </h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close details"
            title="Close (Esc)"
          >
            ✕
          </button>
        </header>

        <div className="drawer-body">
          <div className="drawer-status">
            <label className="drawer-done">
              <input
                type="checkbox"
                className="task-check"
                checked={todo.completed}
                onChange={() => onToggle(todo.id)}
              />
              <span>{todo.completed ? 'Done' : 'Open'}</span>
            </label>

            {todo.dueAt ? (
              <span className={`chip chip-time${todo.completed ? '' : ' is-live'}`}>
                {formatDueChip(todo.dueAt)}
              </span>
            ) : (
              <span className="chip chip-time is-quiet">No due time</span>
            )}
          </div>

          <div className="field">
            <label htmlFor={`drawer-title-${todo.id}`}>Task</label>
            <input
              id={`drawer-title-${todo.id}`}
              ref={titleRef}
              type="text"
              value={title}
              maxLength={200}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={commitTitle}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  commitTitle()
                }
              }}
            />
            {titleError ? (
              <p className="form-error" role="alert">
                {titleError}
              </p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor={`drawer-due-${todo.id}`}>Due</label>
            <input
              id={`drawer-due-${todo.id}`}
              type="datetime-local"
              value={toDateTimeLocal(todo.dueAt)}
              onChange={(event) => onUpdate(todo.id, { dueAt: event.target.value || null })}
            />

            <div className="due-chips">
              {DUE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className="chip chip-btn"
                  onClick={() => onUpdate(todo.id, { dueAt: preset.at().toISOString() })}
                >
                  {preset.label}
                </button>
              ))}
              {todo.dueAt ? (
                <button
                  type="button"
                  className="chip chip-btn"
                  onClick={() => onUpdate(todo.id, { dueAt: null })}
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          <div className="field">
            <span className="field-label" id={`drawer-priority-${todo.id}`}>
              Priority
            </span>
            <div className="seg" role="group" aria-labelledby={`drawer-priority-${todo.id}`}>
              {PRIORITIES.map((priority) => {
                const active = todo.priority === priority

                return (
                  <button
                    key={priority}
                    type="button"
                    className={`seg-btn${active ? ' is-active' : ''}`}
                    aria-pressed={active}
                    onClick={() => onUpdate(todo.id, { priority })}
                  >
                    <span className={`priority-dot is-${priority}`} aria-hidden="true" />
                    {PRIORITY_LABELS[priority]}
                  </button>
                )
              })}
            </div>
          </div>


          <div className="field">
            <label htmlFor={`drawer-tags-${todo.id}`}>Tags</label>

            {todo.tags.length > 0 ? (
              <ul className="drawer-tags">
                {todo.tags.map((tag) => (
                  <li key={tag}>
                    <button
                      type="button"
                      className="tag-chip"
                      onClick={() => onSelectTag?.(tag)}
                      title={`Show everything under ${tag}`}
                    >
                      #{tag}
                    </button>
                    <button
                      type="button"
                      className="tag-remove"
                      onClick={() => removeTag(tag)}
                      aria-label={`Remove tag ${tag}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <input
              id={`drawer-tags-${todo.id}`}
              type="text"
              value={tagDraft}
              placeholder="Add a tag…"
              autoComplete="off"
              onChange={(event) => setTagDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ',') {
                  event.preventDefault()
                  addTag(tagDraft)
                }
              }}
              onBlur={() => addTag(tagDraft)}
            />

            {suggestions.length > 0 ? (
              <div className="tag-suggest">
                {suggestions.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="chip chip-btn"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => addTag(tag)}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="field">
            <span className="field-label">
              Steps
              {todo.steps.length > 0 ? (
                <span className="field-hint">
                  {stepsDone}/{todo.steps.length} done
                </span>
              ) : null}
            </span>

            {todo.steps.length > 0 ? (
              <ul className="step-list">
                {todo.steps.map((step) => (
                  <li key={step.id} className={`step-row${step.done ? ' is-done' : ''}`}>
                    <input
                      type="checkbox"
                      className="task-check"
                      checked={step.done}
                      onChange={() => onToggleStep(todo.id, step.id)}
                      aria-label={`Mark step “${step.text}” as ${step.done ? 'not done' : 'done'}`}
                    />
                    <input
                      type="text"
                      className="step-text"
                      defaultValue={step.text}
                      maxLength={200}
                      aria-label={`Step: ${step.text}`}
                      onBlur={(event) => onEditStep(todo.id, step.id, event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') event.currentTarget.blur()
                      }}
                    />
                    <button
                      type="button"
                      className="icon-btn is-danger"
                      onClick={() => onRemoveStep(todo.id, step.id)}
                      aria-label={`Remove step “${step.text}”`}
                      title="Remove step"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {todo.steps.length < MAX_STEPS ? (
              <form className="step-add" onSubmit={addStep}>
                <input
                  type="text"
                  value={stepDraft}
                  placeholder="Add a step…"
                  maxLength={200}
                  aria-label="Add a step"
                  onChange={(event) => setStepDraft(event.target.value)}
                />
                <button type="submit" className="btn btn-ghost btn-sm" disabled={!stepDraft.trim()}>
                  Add step
                </button>
              </form>
            ) : (
              <p className="field-hint">That is as many steps as one task can hold.</p>
            )}
          </div>


          <div className="field">
            <label htmlFor={`drawer-notes-${todo.id}`}>Notes</label>
            <textarea
              id={`drawer-notes-${todo.id}`}
              rows={4}
              value={notes}
              maxLength={2000}
              placeholder="Anything worth remembering…"
              onChange={(event) => setNotes(event.target.value)}
              onBlur={commitNotes}
            />

            {micSupported && onVoiceNote ? (
              <div className="notes-voice">
                <button
                  type="button"
                  className={`mic-btn${listening ? ' is-live' : ''}`}
                  onClick={onVoiceNote}
                  aria-label={listening ? 'Stop dictating the note' : 'Dictate a note'}
                  title="Dictate a note"
                >
                  ◉
                </button>
                <span className="field-hint">
                  {listening ? 'Listening…' : 'Dictate a note and it lands here'}
                </span>
              </div>
            ) : null}
          </div>

          <p className="drawer-meta">
            Added {stamp(todo.createdAt)}
            {todo.dueAt ? ` · due ${stamp(todo.dueAt)}` : ''}
            {todo.promptedAt ? ` · reminded ${formatClockTime(todo.promptedAt)}` : ''}
          </p>
        </div>

        <footer className="drawer-foot">
          {todo.completed ? (
            <button type="button" className="btn btn-ghost" onClick={() => onToggle(todo.id)}>
              Reopen
            </button>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => onComplete(todo.id)}>
              Mark done
            </button>
          )}

          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onSnooze(todo.id, SNOOZE_MINUTES)}
          >
            Snooze {SNOOZE_MINUTES}m
          </button>

          <button type="button" className="btn btn-ghost" onClick={() => onDuplicate(todo.id)}>
            Duplicate
          </button>

          <button type="button" className="btn btn-danger" onClick={() => onRemove(todo)}>
            Delete
          </button>
        </footer>
      </aside>
    </>
  )
}

/** Quick due-date presets, in the order people reach for them. */
const DUE_PRESETS = [
  { label: `+${SNOOZE_MINUTES}m`, at: () => new Date(Date.now() + SNOOZE_MINUTES * 60_000) },
  { label: '+1h', at: () => new Date(Date.now() + 60 * 60_000) },
  { label: 'Today 6pm', at: () => onDay(0, 18) },
  { label: 'Tomorrow 9am', at: () => onDay(1, 9) },
  { label: 'In a week', at: () => onDay(7, 9) },
]

/** A day offset at a given local hour, rolled forward if it has already passed. */
function onDay(offset, hour) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  date.setHours(hour, 0, 0, 0)

  if (offset === 0 && date.getTime() <= Date.now()) date.setDate(date.getDate() + 1)
  return date
}

/** "Sep 28, 5:00 PM" — short enough for a meta line, precise enough to trust. */
function stamp(value) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

