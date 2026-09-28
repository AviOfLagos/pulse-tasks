import { useEffect, useRef, useState } from 'react'

import { PRIORITIES, PRIORITY_LABELS } from '../constants.js'
import { formatDueChip, isDue, toDateTimeLocal } from '../utils/date.js'

/**
 * One task: checkbox, title, due-time chip, priority dot.
 *
 * The row itself is focusable and carries `data-todo-id`, which is how the
 * global Space shortcut knows which task to complete. Edit mode is local state
 * and opens from either the title or the pencil; Enter saves, Escape cancels,
 * and focus returns to the Edit button so keyboard users never lose their place.
 */
export default function TaskRow({ todo, index = 0, onToggle, onUpdate, onRemove }) {
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
    })
    setEditing(false)
    setError('')
  }

  const overdue = isDue(todo)
  const dueLabel = formatDueChip(todo.dueAt)

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
          {/* The title is the edit affordance — the pencil is there for anyone
              who expects a button, but clicking the words is what people try. */}
          <button
            type="button"
            className="task-title"
            data-testid="todo-title"
            onClick={editing ? () => setEditing(false) : startEditing}
            aria-expanded={editing}
            title="Edit task"
          >
            {todo.title}
          </button>
          {todo.description ? <p className="task-notes">{todo.description}</p> : null}
        </div>

        {dueLabel ? (
          <span className={`chip chip-time${overdue ? ' is-overdue' : ''}`}>{dueLabel}</span>
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
            className="icon-btn"
            ref={editButtonRef}
            onClick={editing ? () => setEditing(false) : startEditing}
            aria-expanded={editing}
            aria-label={`Edit “${todo.title}”`}
            title="Edit"
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
  }
}
