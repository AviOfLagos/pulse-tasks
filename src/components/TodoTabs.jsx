import { TABS } from '../constants.js'

/**
 * The two app views: "To do" and "Done". Replaces the old filter chips,
 * sort dropdown and toolbar row with one obvious control. Each tab shows a
 * live count so you always know what is behind it.
 */
export default function TodoTabs({ tab, onChange, counts }) {
  return (
    <div className="tabs" role="tablist" aria-label="Task views">
      {TABS.map((option) => {
        const active = tab === option.id

        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`tab${active ? ' is-active' : ''}`}
            onClick={() => onChange(option.id)}
            data-testid={`tab-${option.id}`}
          >
            {option.label}
            <span className="tab-count">{counts[option.id] ?? 0}</span>
          </button>
        )
      })}
    </div>
  )
}