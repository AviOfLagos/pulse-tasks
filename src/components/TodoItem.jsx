import { useEffect, useRef, useState } from 'react'

import { PRIORITY_LABELS } from '../constants.js'
import { formatDueDate, isOverdue } from '../utils/date.js'
import TodoFields, { draftFromTodo, draftToPayload } from './TodoFields.jsx'

/**
 * A single task row.
 *
 * Edit mode is local state. Focus is managed explicitly:
 *  - entering edit mode focuses the first field (and selects its text)
 *  - leaving edit mode (save, cancel or Escape) returns focus to the Edit
 *    button, so keyboard users never lose their place.
 *
 * `index` is only used to stagger the entrance animation.
 */
export default function TodoItem({ todo, index = 0, onToggle, onUpdate, onRemove }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(() => draftFromTodo(todo))
  const [error, setError] = useState('')

  const editButtonRef = useRef(null)
  const editFormRef = useRef(null)
  const wasEditing = useRef(false)

  useEffect(() => {
    if (editing) {
      const firstField = editFormRef.current?.querySelector('input, textarea, select')
      firstField?.focus()
      firstField?.select?.()
    } else if (wasEditing.current) {
      editButtonRef.current?.focus()
    }

    wasEditing.current = editing
  }, [editing])

  const startEditing = () => {
    setDraft(draftFromTodo(todo))
    setError('')
    setEditing(true)
  }

  const stopEditing = () => {
    setError('')
    setEditing(false)
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    const payload = draftToPayload(draft)
    if (!payload.title) {
      setError('Task title cannot be empty.')
      editFormRef.current?.querySelector('input')?.focus()
      return
    }

    onUpdate(todo.id, payload)
    stopEditing()
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      stopEditing()
    }
  }

  const overdue = isOverdue(todo.dueDate, { completed: todo.completed })
  const dueLabel = formatDueDate(todo.dueDate)

  const classes = [
    'todo-item',
    `priority-${todo.priority}`,
    todo.completed ? 'is-completed' : '',
    overdue ? 'is-overdue' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <li
      className={classes}
      data-testid="todo-item"
      style={{ '--i': Math.min(index, 12) }}
    >
      <div className="todo-item-main">
        <input
          type="checkbox"
          className="todo-checkbox"
          checked={todo.completed}
          onChange={() => onToggle(todo.id)}
          aria-label={`Mark “${todo.title}” as ${
            todo.completed ? 'not completed' : 'completed'
          }`}
        />

        <div className="todo-content">
          <p className="todo-title" data-testid="todo-title">
            {todo.title}
          </p>

          {todo.description ? (
            <p className="todo-description">{todo.description}</p>
          ) : null}

          <ul className="todo-meta">
            <li>
              <span className={`badge badge-${todo.priority}`}>
                {PRIORITY_LABELS[todo.priority] ?? 'Medium'} priority
              </span>
            </li>

            {dueLabel ? (
              <li>
                <span className={`meta-chip${overdue ? ' is-overdue' : ''}`}>{dueLabel}</span>
              </li>
            ) : null}

            {(todo.tags ?? []).map((tag) => (
              <li key={tag}>
                <span className="tag">#{tag}</span>
              </li>
            ))}

            {todo.completed ? (
              <li>
                <span className="meta-chip is-done">✓ Done</span>
              </li>
            ) : null}
          </ul>
        </div>

        <div className="todo-actions">
          {editing ? null : (
            <button
              type="button"
              className="icon-btn"
              ref={editButtonRef}
              onClick={startEditing}
              aria-label={`Edit “${todo.title}”`}
              title="Edit"
            >
              ✎
            </button>
          )}

          <button
            type="button"
            className="icon-btn icon-btn-danger"
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
          className="todo-edit-form"
          ref={editFormRef}
          onSubmit={handleSubmit}
          onKeyDown={handleKeyDown}
          noValidate
        >
          <h3 className="section-title section-title-sm">Edit task</h3>

          <TodoFields draft={draft} onChange={setDraft} idPrefix={`edit-${todo.id}`} />

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Save changes
            </button>
            <button type="button" className="btn btn-ghost" onClick={stopEditing}>
              Cancel
            </button>
            <span className="field-hint">Press Escape to cancel</span>
          </div>
        </form>
      ) : null}
    </li>
  )
}
