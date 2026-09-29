import { useEffect, useRef, useState } from 'react'

import { PRIORITIES, PRIORITY_LABELS } from '../constants.js'
import { formatDueChip, isDue, toDateTimeLocal } from '../utils/date.js'

/**
 * One task: checkbox, title, due-time chip, priority dot.
 *
 * The row itself is focusable and carries `data-todo-id`, which is how the
 * global Space shortcut knows which task to complete. Clicking the row (or its
 * title, or the chevron) opens the details drawer; the pencil still opens the
 * inline editor for a one-field rename. Enter opens the drawer from the
 * keyboard; Escape cancels an inline edit and focus returns to the pencil.
 */
export default function TaskRow({
  todo,
  index = 0,
  onToggle,
  onUpdate,
  onRemove,
  onSelectTag,
  onOpen,
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(() => toDraft(todo))
  const [error, setError] = useState('')

  const editButtonRef = useRef(null)
  const formRef = useRef(null)
  const wasEditing = useRef(false)

  useEffect(() => {
    if (editing) {
      const first = formRef.current?.querySelector('input, textarea, select')
      first?.focus()
      first?.select?.()
    } else if (wasEditing.current) {
      editButtonRef.current?.focus()
    }

    wasEditing.current = editing
  }, [editing])

  const startEditing = () => {
    setDraft(toDraft(todo))
    setError('')
    setEditing(true)
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    const title = draft.title.trim()
    if (!title) {
      setError('A task needs a title.')
      formRef.current?.querySelector('input')?.focus()
      return
    }

    onUpdate(todo.id, {
      title,
      description: draft.description,
      priority: draft.priority,
      dueAt: draft.dueAt ? draft.dueAt : null,
      tags: draft.tags,
    })
    setEditing(false)
    setError('')
  }

  const overdue = isDue(todo)
  const dueLabel = formatDueChip(todo.dueAt)
  const steps = todo.steps ?? []
  const stepsDone = steps.filter((step) => step.done).length

  const classes = [
    'task-row',
    `priority-${todo.priority}`,
    todo.completed ? 'is-done' : '',
    overdue ? 'is-overdue' : '',
    editing ? 'is-editing' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <li
      className={classes}
      data-testid="todo-item"
      data-todo-id={todo.id}
      tabIndex={0}
      style={{ '--i': Math.min(index, 12) }}
      onClick={(event) => {
        // Anything meant for a control keeps its own click; only clicks that
        // land on the row itself (or its plain text) open the drawer.
        if (event.target.closest('button, input, textarea, select, a, label')) return
        onOpen?.(todo)
      }}
      onKeyDown={(event) => {
        // Enter opens the details, the way activating a list row does. Space is
        // left to the app-wide shortcut, which completes the task.
        if (event.key === 'Enter' && event.target === event.currentTarget) {
          event.preventDefault()
          onOpen?.(todo)
        }
      }}
    >
      <div className="task-main">
        <input
          type="checkbox"
          className="task-check"
          checked={todo.completed}
          onChange={() => onToggle(todo.id)}
          aria-label={`Mark “${todo.title}” as ${todo.completed ? 'not done' : 'done'}`}
        />

        <div className="task-body">
          {/* The title opens the details drawer — the pencil beside it is the
              one-field shortcut for anyone who only wants to rename. */}
          <button
            type="button"
            className="task-title"
            data-testid="todo-title"
            onClick={() => onOpen?.(todo)}
            aria-haspopup="dialog"
            title="Open details"
          >
            {todo.title}
          </button>
          {todo.description ? <p className="task-notes">{todo.description}</p> : null}

          {(todo.tags ?? []).length > 0 ? (
            <ul className="task-tags">
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
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {dueLabel ? (
          <span className={`chip chip-time${overdue ? ' is-overdue' : ''}`}>{dueLabel}</span>
        ) : null}

        {steps.length > 0 ? (
          <span
            className={`chip chip-steps${stepsDone === steps.length ? ' is-done' : ''}`}
            title={`${stepsDone} of ${steps.length} steps done`}
          >
            {stepsDone}/{steps.length}
          </span>
        ) : null}

        <span
          className={`priority-dot is-${todo.priority}`}
          role="img"
          aria-label={`${PRIORITY_LABELS[todo.priority] ?? 'Medium'} priority`}
          title={`${PRIORITY_LABELS[todo.priority] ?? 'Medium'} priority`}
        />

        <div className="task-actions">
          <button
            type="button"
            className="icon-btn is-open"
            onClick={() => onOpen?.(todo)}
            aria-label={`Open details for “${todo.title}”`}
            title="Open details"
          >
            ›
          </button>
          <button
            type="button"
            className="icon-btn"
            ref={editButtonRef}
            onClick={editing ? () => setEditing(false) : startEditing}
            aria-expanded={editing}
            aria-label={`Rename “${todo.title}”`}
            title="Quick rename"
          >
            ✎
          </button>
          <button
            type="button"
            className="icon-btn is-danger"
            onClick={() => onRemove(todo)}
            aria-label={`Delete “${todo.title}”`}
            title="Delete"
          >
            ✕
          </button>
        </div>
      </div>

      {editing ? (
        <form
          className="task-edit"
          ref={formRef}
          onSubmit={handleSubmit}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              setEditing(false)
            }
          }}
          noValidate
        >
          <div className="field">
            <label htmlFor={`title-${todo.id}`}>Task</label>
            <input
              id={`title-${todo.id}`}
              type="text"
              value={draft.title}
              maxLength={200}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor={`due-${todo.id}`}>Due</label>
              <input
                id={`due-${todo.id}`}
                type="datetime-local"
                value={draft.dueAt}
                onChange={(event) => setDraft({ ...draft, dueAt: event.target.value })}
              />
            </div>

            <div className="field">
              <label htmlFor={`priority-${todo.id}`}>Priority</label>
              <select
                id={`priority-${todo.id}`}
                value={draft.priority}
                onChange={(event) => setDraft({ ...draft, priority: event.target.value })}
              >
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {PRIORITY_LABELS[priority]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor={`tags-${todo.id}`}>
              Tags <span className="field-hint">comma separated · nest with /</span>
            </label>
            <input
              id={`tags-${todo.id}`}
              type="text"
              value={draft.tags}
              placeholder="work/clients, billing"
              autoComplete="off"
              onChange={(event) => setDraft({ ...draft, tags: event.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor={`notes-${todo.id}`}>
              Notes <span className="field-hint">optional</span>
            </label>
            <textarea
              id={`notes-${todo.id}`}
              rows={2}
              value={draft.description}
              maxLength={800}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
          </div>

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Save
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <span className="field-hint">Escape cancels</span>
          </div>
        </form>
      ) : null}
    </li>
  )
}

/** Stored todo → the string-shaped values the form inputs want. */
function toDraft(todo) {
  return {
    title: todo.title,
    description: todo.description ?? '',
    priority: todo.priority,
    dueAt: toDateTimeLocal(todo.dueAt),
    tags: (todo.tags ?? []).join(', '),
  }
}
