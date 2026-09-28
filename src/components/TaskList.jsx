import { forwardRef } from 'react'

import EmptyState from './EmptyState.jsx'
import Tabs from './Tabs.jsx'
import TaskRow from './TaskRow.jsx'

/**
 * The full-width task panel: tabs, search, then the rows.
 * Filtering and ordering already happened upstream in App.
 */
const TaskList = forwardRef(function TaskList(
  {
    todos,
    tab,
    counts,
    query,
    total,
    onTabChange,
    onQueryChange,
    onToggle,
    onUpdate,
    onRemove,
    onClearDone,
    onLoadDemo,
  },
  searchRef,
) {
  return (
    <section className="card list-card" aria-label="Tasks">
      <div className="list-head">
        <Tabs tab={tab} counts={counts} onChange={onTabChange} />

        <div className="list-tools">
          <label className="sr-only" htmlFor="task-search">
            Search tasks
          </label>
          <input
            id="task-search"
            ref={searchRef}
            type="search"
            className="search-input"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search…  ( / )"
            autoComplete="off"
          />

          {tab === 'done' && counts.done > 0 ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClearDone}>
              Clear done
            </button>
          ) : null}
        </div>
      </div>

      {todos.length > 0 ? (
        <ul className="task-list" data-testid="todo-list">
          {todos.map((todo, index) => (
            <TaskRow
              key={todo.id}
              todo={todo}
              index={index}
              onToggle={onToggle}
              onUpdate={onUpdate}
              onRemove={onRemove}
            />
          ))}
        </ul>
      ) : (
        <EmptyState hasTodos={total > 0} tab={tab} query={query} onLoadDemo={onLoadDemo} />
      )}
    </section>
  )
})

export default TaskList
