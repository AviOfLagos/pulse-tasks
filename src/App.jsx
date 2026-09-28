import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import EmptyState from './components/EmptyState.jsx'
import StatsBar from './components/StatsBar.jsx'
import TodoForm from './components/TodoForm.jsx'
import TodoList from './components/TodoList.jsx'
import TodoTabs from './components/TodoTabs.jsx'
import UrgentPanel from './components/UrgentPanel.jsx'
import { CLOCK_TICK_MS, UNDO_TIMEOUT } from './constants.js'
import { useTodos } from './hooks/useTodos.js'
import { filterTodos, getStats, getUrgentTodos, sortTodos } from './utils/todoFilters.js'

/**
 * App shell.
 *
 * Layout: a main column (quick add → tabs → list) and a right sidebar
 * ("Needs attention" + progress). A slow clock tick re-checks due dates so
 * urgent items expire off the sidebar automatically.
 *
 * Responsibilities:
 *  - owns view state (tab / search) and the todo store via useTodos
 *  - wraps every mutation so it can also (a) announce to screen readers and
 *    (b) offer an undo for destructive actions
 */
export default function App() {
  const { todos, dispatch } = useTodos()

  const [tab, setTab] = useState('active')
  const [query, setQuery] = useState('')
  const [now, setNow] = useState(() => new Date())
  const [announcement, setAnnouncement] = useState('')
  const [undo, setUndo] = useState(null)
  const undoTimer = useRef(null)

  // Gentle clock: re-evaluates due dates so the urgent panel self-cleans.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), CLOCK_TICK_MS)
    return () => clearInterval(id)
  }, [])

  // "To do" opens with the most urgent work on top; "Done" is a simple
  // timeline of completed notes, newest first.
  const visibleTodos = useMemo(
    () => sortTodos(filterTodos(todos, tab, query), tab === 'completed' ? 'created' : 'priority'),
    [todos, tab, query],
  )
  const urgentTodos = useMemo(() => getUrgentTodos(todos, now), [todos, now])
  const stats = useMemo(() => getStats(todos), [todos])

  const announce = useCallback((message) => setAnnouncement(message), [])

  const offerUndo = useCallback((snapshot, message) => {
    clearTimeout(undoTimer.current)
    setUndo({ todos: snapshot, message })
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_TIMEOUT)
  }, [])

  useEffect(() => () => clearTimeout(undoTimer.current), [])

  const handleAdd = (payload) => {
    dispatch({ type: 'add', payload })
    announce(`Added “${payload.title}”.`)
  }

  const handleToggle = (id) => {
    const todo = todos.find((item) => item.id === id)
    dispatch({ type: 'toggle', payload: { id } })
    if (todo) {
      announce(`“${todo.title}” marked ${todo.completed ? 'active' : 'complete'}.`)
    }
  }

  const handleUpdate = (id, changes) => {
    dispatch({ type: 'update', payload: { id, changes } })
    announce(`Saved changes to “${changes.title}”.`)
  }

  const handleRemove = (todo) => {
    offerUndo(todos, `Deleted “${todo.title}”.`)
    dispatch({ type: 'remove', payload: { id: todo.id } })
    announce(`Deleted “${todo.title}”.`)
  }

  const handleClearCompleted = () => {
    if (stats.completed === 0) return

    const label = `${stats.completed} completed ${stats.completed === 1 ? 'task' : 'tasks'}`
    offerUndo(todos, `Cleared ${label}.`)
    dispatch({ type: 'clear-completed' })
    announce(`Cleared ${label}.`)
  }

  const handleUndo = () => {
    if (!undo) return

    dispatch({ type: 'replace', payload: { todos: undo.todos } })
    clearTimeout(undoTimer.current)
    setUndo(null)
    announce('Undo complete.')
  }

  const handleDismissUndo = () => {
    clearTimeout(undoTimer.current)
    setUndo(null)
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            ▮▮
          </span>
          <h1>
            pulse<span className="brand-accent">tasks</span>
          </h1>
        </div>

        <p className="header-clock">
          <span className="clock-dot" aria-hidden="true" />
          {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          <span className="clock-sep" aria-hidden="true">
            ·
          </span>
          {now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
        </p>
      </header>

      <div className="app-body">
        <main className="app-main">
          <TodoForm onAdd={handleAdd} />

          <section className="panel panel-terminal" aria-label="Task list">
            <div className="panel-chrome" aria-hidden="true">
              <span className="chrome-dot" />
              <span className="chrome-dot" />
              <span className="chrome-dot" />
              <span className="chrome-title">~/tasks</span>
            </div>

            <TodoTabs
              tab={tab}
              onChange={setTab}
              counts={{ active: stats.active, completed: stats.completed }}
            />

            <div className="list-toolbar">
              <div className="field search-field">
                <label className="sr-only" htmlFor="todo-search">
                  Search tasks
                </label>
                <input
                  id="todo-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search…"
                  autoComplete="off"
                />
              </div>

              <p className="panel-count">
                {visibleTodos.length} of {stats.total}
              </p>

              {tab === 'completed' && stats.completed > 0 ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleClearCompleted}
                >
                  Clear done
                </button>
              ) : null}
            </div>

            {visibleTodos.length > 0 ? (
              <TodoList
                todos={visibleTodos}
                onToggle={handleToggle}
                onUpdate={handleUpdate}
                onRemove={handleRemove}
              />
            ) : (
              <EmptyState hasTodos={stats.total > 0} filter={tab} query={query} />
            )}
          </section>
        </main>

        <aside className="sidebar" aria-label="Focus and progress">
          <UrgentPanel todos={urgentTodos} now={now} onToggle={handleToggle} />
          <StatsBar stats={stats} />
        </aside>
      </div>

      <footer className="app-footer">
        <p>Everything lives in this browser — expired tasks drop off the focus panel on their own.</p>
      </footer>

      {/* Screen-reader-only status region for action feedback. */}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      {undo ? (
        <div className="undo-toast">
          <p className="undo-message">{undo.message}</p>
          <button type="button" className="btn btn-primary" onClick={handleUndo}>
            Undo
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleDismissUndo}
            aria-label="Dismiss undo"
          >
            ✕
          </button>
        </div>
      ) : null}
    </div>
  )
}
