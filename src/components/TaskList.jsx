import { forwardRef } from 'react'

import EmptyState from './EmptyState.jsx'
import { formatDayLabel } from './MiniCalendar.jsx'
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
    selectedDay,
    onClearDay,
    onSelectTag,
    onOpen,
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

      {selectedDay ? (
        <p className="day-filter">
          <span className="day-filter-label">Showing:</span>
          <span className="chip chip-time">{formatDayLabel(selectedDay)}</span>
          <button
            type="button"
            className="icon-btn"
            onClick={onClearDay}
            aria-label="Show all days"
            title="Clear day filter"
          >
            ✕
          </button>
        </p>
      ) : null}

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
              onSelectTag={onSelectTag}
              onOpen={onOpen}
            />
          ))}
        </ul>
      ) : (
        <EmptyState
          hasTodos={total > 0}
          tab={tab}
          query={query}
          selectedDay={selectedDay}
          onLoadDemo={onLoadDemo}
        />
      )}
    </section>
  )
})

export default TaskList
