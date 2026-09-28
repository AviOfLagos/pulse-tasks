import { useEffect, useMemo, useRef, useState } from 'react'

import { formatDueChip } from '../utils/date.js'
import { rankTodos } from '../utils/rank.js'

/**
 * Obsidian's quick switcher (⌘K): type a few letters, jump to the task.
 *
 * Ranking is a subsequence match — "wtp" finds "Water the plants" — which is
 * what makes a switcher feel fast; an exact-substring search would make you
 * type the words in full. As in Obsidian, a query that matches nothing is
 * still useful: the last row creates a task with that text.
 *
 * The ranking itself lives in utils/rank.js so it can be unit tested without
 * a DOM or a JSX step.
 *
 * Rows track the mouse on `mousemove`, not `mouseenter`: the list appears
 * under wherever the pointer happens to be resting, and a pointer that has not
 * moved must not steal the keyboard cursor.
 */

export default function QuickSwitcher({ todos, onPick, onCreate, onClose }) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef(null)

  const results = useMemo(() => rankTodos(todos, query), [todos, query])
  const canCreate = query.trim().length > 0
  const rowCount = results.length + (canCreate ? 1 : 0)

  // On the next frame, not this one: the keypress that opened the switcher is
  // still settling, and focusing mid-flight leaves it on the body.
  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    setCursor(0)
  }, [query])

  const commit = (index) => {
    if (index < results.length) onPick(results[index])
    else if (canCreate) onCreate(query.trim())
  }

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown' || (event.key === 'n' && event.ctrlKey)) {
      event.preventDefault()
      setCursor((current) => (rowCount === 0 ? 0 : (current + 1) % rowCount))
    } else if (event.key === 'ArrowUp' || (event.key === 'p' && event.ctrlKey)) {
      event.preventDefault()
      setCursor((current) => (rowCount === 0 ? 0 : (current - 1 + rowCount) % rowCount))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      commit(cursor)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  return (
    <div className="modal-backdrop is-top" role="presentation" onClick={onClose}>
      <div
        className="switcher"
        role="dialog"
        aria-modal="true"
        aria-label="Quick switcher"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          className="switcher-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Jump to a task…"
          aria-label="Jump to a task"
          autoComplete="off"
          autoFocus
        />

        <ul className="switcher-list">
          {results.map((todo, index) => (
            <li key={todo.id}>
              <button
                type="button"
                className={`switcher-row${index === cursor ? ' is-active' : ''}`}
                onMouseMove={() => setCursor(index)}
                onClick={() => onPick(todo)}
              >
                <span className={`priority-dot is-${todo.priority}`} aria-hidden="true" />
                <span className="switcher-title">{todo.title}</span>
                {(todo.tags ?? []).length > 0 ? (
                  <span className="switcher-tag">#{todo.tags[0]}</span>
                ) : null}
                {todo.dueAt ? (
                  <span className="switcher-due">{formatDueChip(todo.dueAt)}</span>
                ) : null}
              </button>
            </li>
          ))}

          {canCreate ? (
            <li>
              <button
                type="button"
                className={`switcher-row is-create${cursor === results.length ? ' is-active' : ''}`}
                onMouseMove={() => setCursor(results.length)}
                onClick={() => onCreate(query.trim())}
              >
                <span className="switcher-title">Create “{query.trim()}”</span>
              </button>
            </li>
          ) : null}

          {rowCount === 0 ? <li className="switcher-empty">No tasks yet.</li> : null}
        </ul>

        <p className="switcher-hint">
          <kbd>↑</kbd> <kbd>↓</kbd> move · <kbd>Enter</kbd> open · <kbd>Esc</kbd> close
        </p>
      </div>
    </div>
  )
}
