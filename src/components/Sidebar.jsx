import TagTree from './TagTree.jsx'

/**
 * The left navbar: wordmark, then the nested-tag tree.
 *
 * It owns the app's only `h1`, which is why the top bar no longer carries the
 * name — an app shell should say what it is once, in the place that never
 * scrolls away.
 */
export default function Sidebar({ tagTree, selectedTag, total, onSelectTag, onLoadDemo }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h1 className="brand-name">Pulse Tasks</h1>
        <p className="brand-sub">Voice-first todo</p>
      </div>

      <TagTree tree={tagTree} selected={selectedTag} total={total} onSelect={onSelectTag} />

      <div className="sidebar-foot">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onLoadDemo}>
          Load demo data
        </button>
      </div>
    </aside>
  )
}
