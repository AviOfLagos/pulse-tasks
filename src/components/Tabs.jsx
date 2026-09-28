import { TABS } from '../constants.js'

/** Today / Upcoming / Done. The active tab is the only green thing here. */
export default function Tabs({ tab, counts, onChange }) {
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
