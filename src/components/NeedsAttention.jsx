import { dueDayOffset, formatDueChip } from '../utils/date.js'

/**
 * "Needs attention": overdue tasks first, then whatever falls due this week.
 * Sits beside the progress ring and is deliberately read-only apart from the
 * tick button — it is a glance, not a second task list.
 */
export default function NeedsAttention({ todos, now, onComplete }) {
  return (
    <section className="card attention-card" aria-labelledby="attention-heading">
      <h2 className="card-title" id="attention-heading">
        Needs attention
        {todos.length > 0 ? <span className="count-pill">{todos.length}</span> : null}
      </h2>

      {todos.length > 0 ? (
        <ul className="attention-list" data-testid="urgent-list">
          {todos.map((todo) => {
            const overdue = (dueDayOffset(todo.dueAt, now) ?? 0) < 0

            return (
              <li key={todo.id} className="attention-item">
                <button
                  type="button"
                  className="tick-btn"
                  onClick={() => onComplete(todo.id)}
                  aria-label={`Mark “${todo.title}” complete`}
                  title="Mark complete"
                >
                  ✓
                </button>

                <span className="attention-title">{todo.title}</span>

                <span className={`chip chip-time${overdue ? ' is-overdue' : ''}`}>
                  {overdue ? 'Overdue · ' : ''}
                  {formatDueChip(todo.dueAt, now)}
                </span>

                <span
                  className={`priority-dot is-${todo.priority}`}
                  aria-hidden="true"
                  title={`${todo.priority} priority`}
                />
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="muted-note">Nothing due in the next seven days.</p>
      )}
    </section>
  )
}
