import TagTree from './TagTree.jsx'

/**
 * The left navbar: wordmark, then the nested-tag tree.
 *
 * It owns the app's only `h1`, which is why the top bar no longer carries the
 * name — an app shell should say what it is once, in the place that never
 * scrolls away.
 */
export default function Sidebar({
  tagTree,
  selectedTag,
  total,
  onSelectTag,
  onLoadDemo,
  onOpenSettings,
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h1 className="brand-name">Pulse Tasks</h1>
        <p className="brand-sub">Voice-first todo</p>
      </div>

      <TagTree tree={tagTree} selected={selectedTag} total={total} onSelect={onSelectTag} />

      <div className="sidebar-foot">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenSettings}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="btn-icon">
            <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
            <path
              d="M12 2.8v2.4M12 18.8v2.4M4.5 12H2.1M21.9 12h-2.4M6.7 6.7 5 5M19 19l-1.7-1.7M17.3 6.7 19 5M5 19l1.7-1.7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
          Settings
        </button>

        <button type="button" className="btn btn-ghost btn-sm" onClick={onLoadDemo}>
          Load demo data
        </button>
      </div>
    </aside>
  )
}
