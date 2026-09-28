import { useState } from 'react'

import { tagAncestors } from '../utils/tags.js'

/**
 * The left rail: a collapsible tree of nested tags, Obsidian's folder pane
 * without the one-home rule. A branch shows everything under it, so clicking
 * "work" covers work/clients/vettika too.
 *
 * Expansion is local state, seeded with the ancestors of whatever is selected
 * so a tag picked from the quick switcher is never hidden inside a closed
 * branch.
 */
function TagNode({ node, depth, selected, expanded, onToggle, onSelect }) {
  const hasChildren = node.children.length > 0
  const isOpen = expanded.has(node.path)
  const isSelected = selected === node.path

  return (
    <li>
      <div className={`tag-row${isSelected ? ' is-selected' : ''}`} style={{ '--depth': depth }}>
        {hasChildren ? (
          <button
            type="button"
            className={`tag-twisty${isOpen ? ' is-open' : ''}`}
            onClick={() => onToggle(node.path)}
            aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${node.label}`}
            aria-expanded={isOpen}
          >
            ›
          </button>
        ) : (
          <span className="tag-twisty is-empty" aria-hidden="true" />
        )}

        <button
          type="button"
          className="tag-name"
          onClick={() => onSelect(isSelected ? null : node.path)}
          aria-pressed={isSelected}
          title={node.path}
        >
          <span className="tag-label">{node.label}</span>
          <span className="tag-count">{node.count}</span>
        </button>
      </div>

      {hasChildren && isOpen ? (
        <ul className="tag-children">
          {node.children.map((child) => (
            <TagNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selected={selected}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export default function TagTree({ tree, selected, total, onSelect }) {
  const [expanded, setExpanded] = useState(() => new Set(tagAncestors(selected ?? '')))

  const toggle = (path) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  // Keep the selected branch open even when it was chosen elsewhere.
  const visible = new Set(expanded)
  for (const ancestor of tagAncestors(selected ?? '')) visible.add(ancestor)

  return (
    <nav className="tag-card" aria-label="Tags">
      <h2 className="card-title">Tags</h2>

      <ul className="tag-list">
        <li>
          <div className={`tag-row${selected ? '' : ' is-selected'}`} style={{ '--depth': 0 }}>
            <span className="tag-twisty is-empty" aria-hidden="true" />
            <button
              type="button"
              className="tag-name"
              onClick={() => onSelect(null)}
              aria-pressed={!selected}
            >
              <span className="tag-label">All tasks</span>
              <span className="tag-count">{total}</span>
            </button>
          </div>
        </li>

        {tree.map((node) => (
          <TagNode
            key={node.path}
            node={node}
            depth={0}
            selected={selected}
            expanded={visible}
            onToggle={toggle}
            onSelect={onSelect}
          />
        ))}
      </ul>

      {tree.length === 0 ? (
        <p className="muted-note">
          Tag a task with <code>#work/clients</code> — or say “under work slash clients” — and it
          shows up here.
        </p>
      ) : null}
    </nav>
  )
}
