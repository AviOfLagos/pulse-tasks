/** Placeholder shown when nothing matches the current filter/search. */
export default function EmptyState({ hasTodos, filter, query }) {
  let title = 'No tasks yet'
  let hint = 'Add your first task with the form above.'

  if (query.trim()) {
    title = 'No matching tasks'
    hint = `Nothing matches “${query.trim()}”. Try a different search.`
  } else if (hasTodos && filter === 'active') {
    title = 'All caught up'
    hint = 'Every task is complete. Nice work.'
  } else if (hasTodos && filter === 'completed') {
    title = 'Nothing completed yet'
    hint = 'Tick a task off and it will show up here.'
  }

  return (
    <div className="empty-state" data-testid="empty-state">
      <p className="empty-title">{title}</p>
      <p className="empty-hint">{hint}</p>
      <span className="empty-cursor" aria-hidden="true">
        ▌
      </span>
    </div>
  )
}
