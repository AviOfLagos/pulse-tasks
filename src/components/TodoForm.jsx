import { useRef, useState } from 'react'

import TodoFields, { draftToPayload, emptyDraft } from './TodoFields.jsx'

/**
 * Quick-add bar: one big title field + Add button, with the optional fields
 * (notes, priority, due date, tags) tucked behind a Details toggle so the
 * common case stays a single line. Validation is inline — an empty title
 * shows an alert and refocuses the field; a successful add clears the form
 * and keeps focus in the title input for fast entry.
 */
export default function TodoForm({ onAdd }) {
  const [draft, setDraft] = useState(emptyDraft)
  const [error, setError] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const formRef = useRef(null)

  const handleSubmit = (event) => {
    event.preventDefault()

    const payload = draftToPayload(draft)
    if (!payload.title) {
      setError('Please enter a task title.')
      formRef.current?.querySelector('input')?.focus()
      return
    }

    onAdd(payload)
    setDraft(emptyDraft())
    setError('')
    setShowDetails(false)
    formRef.current?.querySelector('input')?.focus()
  }

  return (
    <form
      className="quick-add"
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      data-testid="todo-form"
    >
      <div className="quick-add-row">
        <label className="sr-only" htmlFor="new-todo-title">
          Task
        </label>
        <input
          id="new-todo-title"
          type="text"
          className="quick-add-input"
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          placeholder="Add a task… press Enter"
          maxLength={140}
          autoComplete="off"
          autoFocus
          data-testid="new-todo-input"
        />

        <button
          type="button"
          className={`details-toggle${showDetails ? ' is-open' : ''}`}
          onClick={() => setShowDetails((open) => !open)}
          aria-expanded={showDetails}
          aria-controls="new-todo-details"
        >
          Details
        </button>

        <button type="submit" className="btn btn-primary">
          + Add
        </button>
      </div>

      {showDetails ? (
        <div className="quick-add-details" id="new-todo-details">
          <TodoFields draft={draft} onChange={setDraft} idPrefix="new-todo" />
        </div>
      ) : null}

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  )
}
