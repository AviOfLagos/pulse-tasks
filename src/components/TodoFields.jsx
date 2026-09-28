import { DEFAULT_PRIORITY, MAX_TAGS, PRIORITIES, PRIORITY_LABELS } from '../constants.js'

/**
 * The add form and the inline edit form collect the same five fields, so the
 * field markup lives here once. A "draft" is the string-based, form-friendly
 * view of a todo (see `draftFromTodo` / `draftToPayload`).
 */

/** A blank draft for the add form. */
export function emptyDraft() {
  return {
    title: '',
    description: '',
    priority: DEFAULT_PRIORITY,
    dueDate: '',
    tags: '',
  }
}

/** Turns a stored todo into an editable draft. */
export function draftFromTodo(todo) {
  return {
    title: todo.title,
    description: todo.description ?? '',
    priority: todo.priority ?? DEFAULT_PRIORITY,
    dueDate: todo.dueDate ?? '',
    tags: (todo.tags ?? []).join(', '),
  }
}

/** Turns a draft back into a reducer payload. */
export function draftToPayload(draft) {
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    priority: draft.priority,
    dueDate: draft.dueDate ? draft.dueDate : null,
    tags: draft.tags,
  }
}

export default function TodoFields({ draft, onChange, idPrefix, autoFocus = false }) {
  const update = (field) => (event) => onChange({ ...draft, [field]: event.target.value })

  const ids = {
    title: `${idPrefix}-title`,
    description: `${idPrefix}-description`,
    priority: `${idPrefix}-priority`,
    dueDate: `${idPrefix}-due-date`,
    tags: `${idPrefix}-tags`,
    tagsHint: `${idPrefix}-tags-hint`,
  }

  return (
    <div className="fields">
      <div className="field">
        <label htmlFor={ids.title}>Task</label>
        <input
          id={ids.title}
          type="text"
          value={draft.title}
          onChange={update('title')}
          placeholder="What needs to be done?"
          maxLength={140}
          autoComplete="off"
          autoFocus={autoFocus}
          data-testid={autoFocus ? 'new-todo-input' : undefined}
        />
      </div>

      <div className="field">
        <label htmlFor={ids.description}>
          Notes <span className="field-hint">optional</span>
        </label>
        <textarea
          id={ids.description}
          rows={2}
          value={draft.description}
          onChange={update('description')}
          placeholder="Any extra detail…"
          maxLength={500}
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor={ids.priority}>Priority</label>
          <select id={ids.priority} value={draft.priority} onChange={update('priority')}>
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor={ids.dueDate}>Due date</label>
          <input
            id={ids.dueDate}
            type="date"
            value={draft.dueDate}
            onChange={update('dueDate')}
          />
        </div>

        <div className="field">
          <label htmlFor={ids.tags}>Tags</label>
          <input
            id={ids.tags}
            type="text"
            value={draft.tags}
            onChange={update('tags')}
            placeholder="work, home"
            autoComplete="off"
            aria-describedby={ids.tagsHint}
          />
          <p className="field-hint" id={ids.tagsHint}>
            Comma separated · up to {MAX_TAGS} shown
          </p>
        </div>
      </div>
    </div>
  )
}
