import { forwardRef, useEffect, useRef, useState } from 'react'

import { DEFAULT_DUE_HOUR, PRIORITY_LABELS } from '../constants.js'
import { loadDraft, saveDraft } from '../state/storage.js'
import { formatDueChip } from '../utils/date.js'
import { parseTaskInput } from '../utils/nlp.js'
import MicButton from './MicButton.jsx'

/**
 * The big input: type or dictate a task, press Add.
 *
 * Typed and spoken text go through exactly the same parser, so
 * "pay rent tomorrow 5pm, urgent" gives you a high-priority task due at 17:00
 * whether you said it or typed it. A live preview shows what was understood
 * before you commit, which is the only honest way to expose a fuzzy parser.
 *
 * Whatever is in the field persists like the tasks do: a half-typed task
 * survives a reload, and is cleared the moment it becomes a real task.
 */
const TaskComposer = forwardRef(function TaskComposer(
  { onAdd, onVoice, listening, transcript, voiceError, micSupported, ai },
  inputRef,
) {
  const [value, setValue] = useState(loadDraft)
  const [error, setError] = useState('')
  // What the on-device model said, and about which text — a suggestion from
  // two words ago is worse than none.
  const [aiResult, setAiResult] = useState(null)
  const aiRef = useRef(ai)
  aiRef.current = ai

  const updateValue = (next) => {
    setValue(next)
    saveDraft(next)
    setError('')
  }

  // While dictating, show what the mic is picking up in the field itself.
  const shown = listening && transcript ? transcript : value

  /**
   * Ask the on-device model about the task once typing settles. Debounced
   * because it is a model, not a lookup, and skipped entirely when it is not
   * ready — the keyword suggestion is already on screen either way.
   */
  // `ai.status` is a dependency on purpose: the model often becomes ready a
  // moment *after* you start typing, and without it the first task you write
  // in a session never gets a suggestion.
  useEffect(() => {
    const text = value.trim()
    if (!text || ai?.status !== 'ready') return undefined

    let cancelled = false
    const timer = setTimeout(async () => {
      const result = await aiRef.current?.suggest(text)
      if (!cancelled && result?.tag) setAiResult({ text, ...result })
    }, 700)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [value, ai?.status])
  const parsed = shown.trim() ? parseTaskInput(shown, new Date(), DEFAULT_DUE_HOUR) : null

  // Only trust the model's answer while it still describes what is in the box.
  const aiTag = aiResult && aiResult.text === value.trim() ? aiResult.tag : null

  const handleSubmit = (event) => {
    event.preventDefault()

    const text = value.trim()
    if (!text) {
      setError('Type a task first — or press the mic.')
      inputRef?.current?.focus()
      return
    }

    onAdd({ ...parseTaskInput(text, new Date(), DEFAULT_DUE_HOUR), aiTag })
    updateValue('')
    setAiResult(null)
    inputRef?.current?.focus()
  }

  return (
    <form className="composer" onSubmit={handleSubmit} noValidate data-testid="todo-form">
      <div className="composer-row">
        <label className="sr-only" htmlFor="new-task">
          New task
        </label>
        <input
          id="new-task"
          ref={inputRef}
          type="text"
          className="composer-input"
          value={shown}
          onChange={(event) => updateValue(event.target.value)}
          readOnly={listening}
          onFocus={() => ai?.warmUp?.()}
          placeholder="Add a task — try “call mum tomorrow 5pm, urgent”"
          maxLength={200}
          autoComplete="off"
          data-testid="new-todo-input"
        />

        <MicButton
          listening={listening}
          disabled={!micSupported}
          onClick={onVoice}
          label="Add a task by voice"
        />

        <button type="submit" className="btn btn-primary composer-add">
          Add
        </button>
      </div>

      <div className="composer-foot">
        {parsed &&
        (parsed.dueAt ||
          parsed.priority !== 'medium' ||
          parsed.tags.length > 0 ||
          parsed.suggestedTag ||
          aiTag) ? (
          <p className="parse-preview" aria-live="polite">
            <span className="parse-label">Understood:</span>
            <span className="chip">{parsed.title}</span>
            {parsed.dueAt ? <span className="chip chip-time">{formatDueChip(parsed.dueAt)}</span> : null}
            {parsed.priority !== 'medium' ? (
              <span className={`chip chip-priority is-${parsed.priority}`}>
                {PRIORITY_LABELS[parsed.priority]}
              </span>
            ) : null}
            {parsed.tags.map((tag) => (
              <span className="chip" key={tag}>
                #{tag}
              </span>
            ))}
            {aiTag ? (
              <span className="chip chip-suggested" title="Suggested by the on-device model">
                #{aiTag}
                <span className="chip-note">ai</span>
              </span>
            ) : parsed.suggestedTag ? (
              <span className="chip chip-suggested" title="Guessed from the words — edit it later">
                #{parsed.suggestedTag}
                <span className="chip-note">suggested</span>
              </span>
            ) : null}
          </p>
        ) : (
          <p className="composer-hint">
            {listening
              ? 'Listening… say the task, when it is due, and “urgent” if it matters.'
              : 'Press N to jump here, / to search.'}
          </p>
        )}

        {parsed?.warning ? (
          <p className="parse-warning" role="status">
            {parsed.warning} It stays in the title — set a due date by hand if you meant one.
          </p>
        ) : null}

        {ai?.status === 'downloadable' ? (
          <p className="ai-offer">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => ai.enable()}>
              Enable on-device AI
            </button>
            <span className="field-hint">
              Chrome downloads a local model once (a few GB). Nothing you type leaves the browser.
            </span>
          </p>
        ) : null}

        {ai?.status === 'downloading' ? (
          <p className="field-hint" role="status">
            Downloading the on-device model… {ai.progress}%
          </p>
        ) : null}

        {error || voiceError ? (
          <p className="form-error" role="alert">
            {error || voiceError}
          </p>
        ) : null}
      </div>
    </form>
  )
})

export default TaskComposer
