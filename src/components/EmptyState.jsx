/** Placeholder shown when nothing matches the current tab or search. */
export default function EmptyState({ hasTodos, tab, query, selectedDay, onLoadDemo }) {
  let title = 'No tasks yet'
  let hint = 'Add one above — type it, or press the mic and say it.'

  if (selectedDay) {
    title = 'Nothing on this day'
    hint = 'Pick another day, or clear the filter to see everything.'
  } else if (query.trim()) {
    title = 'No matches'
    hint = `Nothing matches “${query.trim()}”.`
  } else if (hasTodos && tab === 'today') {
    title = 'Today is clear'
    hint = 'Nothing due today and nothing overdue.'
  } else if (hasTodos && tab === 'upcoming') {
    title = 'Nothing scheduled'
    hint = 'Give a task a due time and it will show up here.'
  } else if (hasTodos && tab === 'done') {
    title = 'Nothing finished yet'
    hint = 'Tick a task off and it lands here.'
  }

  return (
    <div className="empty-state" data-testid="empty-state">
      <p className="empty-title">{title}</p>
      <p className="empty-hint">{hint}</p>

      {/* Only offered on a genuinely empty app — never as a way out of a search
          that found nothing. */}
      {!hasTodos && !query.trim() && !selectedDay && onLoadDemo ? (
        <button type="button" className="btn btn-ghost btn-sm empty-demo" onClick={onLoadDemo}>
          Load demo data
        </button>
      ) : null}
    </div>
  )
}
