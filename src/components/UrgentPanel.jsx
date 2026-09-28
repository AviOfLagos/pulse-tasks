import { daysUntil } from '../utils/date.js'

/** Short countdown label for the urgent panel ('Today', 'In 3 days'…). */
function countdownLabel(dueDate, now) {
  const diff = daysUntil(dueDate, now)
  if (diff === null) return ''
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'

  return `In ${diff} days`
}

function chipClass(dueDate, now) {
  const diff = daysUntil(dueDate, now)
  if (diff === 0) return 'urgent-chip is-now'
  if (diff !== null && diff <= 2) return 'urgent-chip is-soon'

  return 'urgent-chip'
}

/**
 * "Needs attention" sidebar panel.
 *
 * Lists active tasks due within the next week, nearest first. Expired tasks
 * are removed automatically: App re-renders on a slow clock tick, and the
 * upstream selector drops anything whose due date has passed.
 */
export default function UrgentPanel({ todos, now, onToggle }) {
  return (
    <section className="panel urgent-panel" aria-labelledby="urgent-heading">
      <h2 className="section-title" id="urgent-heading">
        <span className="pulse-dot" aria-hidden="true" />
        Needs attention
      </h2>

      {todos.length > 0 ? (
        <ul className="urgent-list" data-testid="urgent-list">
          {todos.map((todo, index) => (
            <li
              key={todo.id}
              className={`urgent-item priority-${todo.priority}`}
              style={{ '--i': Math.min(index, 6) }}
            >
              <button
                type="button"
                className="urgent-check"
                onClick={() => onToggle(todo.id)}
                aria-label={`Mark “${todo.title}” as complete`}
                title="Mark complete"
              >
                ✓
              </button>

              <div className="urgent-body">
                <p className="urgent-title">{todo.title}</p>
                <span className={chipClass(todo.dueDate, now)}>
                  {countdownLabel(todo.dueDate, now)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="urgent-empty">Nothing urgent. The neon stays calm.</p>
      )}

      <p className="urgent-hint">Items leave this list automatically once they expire.</p>
    </section>
  )
}