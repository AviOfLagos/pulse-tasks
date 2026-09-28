import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import AppHeader from './components/AppHeader.jsx'
import NeedsAttention from './components/NeedsAttention.jsx'
import PermissionDialog from './components/PermissionDialog.jsx'
import ProgressRing from './components/ProgressRing.jsx'
import ReminderCard from './components/ReminderCard.jsx'
import TaskComposer from './components/TaskComposer.jsx'
import TaskList from './components/TaskList.jsx'
import UndoToast from './components/UndoToast.jsx'
import { CLOCK_TICK_MS, REPLY_LISTEN_MS, SNOOZE_MINUTES, UNDO_TIMEOUT } from './constants.js'
import { missingDemoTodos } from './state/demoTodos.js'
import { useReminders } from './hooks/useReminders.js'
import { useShortcuts } from './hooks/useShortcuts.js'
import { useSpeechRecognition, useSpeechSynthesis } from './hooks/useSpeech.js'
import { useTodos } from './hooks/useTodos.js'
import { useVoicePermissions } from './hooks/useVoicePermissions.js'
import { formatClockTime } from './utils/date.js'
import { parseReply, parseTaskInput } from './utils/nlp.js'
import { filterTodos, getStats, getUrgentTodos, sortTodos } from './utils/todoFilters.js'

/**
 * App shell.
 *
 * Layout (top to bottom): header → composer → progress ring + needs attention
 * → full-width task list with tabs.
 *
 * It owns view state (tab / search), the todo store, and every mutation — the
 * voice hooks deliberately know nothing about the store, they hand their result
 * back here. Mutations also (a) announce to screen readers and (b) offer an
 * undo for the two destructive ones (delete, complete).
 */
export default function App() {
  const { todos, dispatch } = useTodos()

  const [tab, setTab] = useState('today')
  const [query, setQuery] = useState('')
  const [now, setNow] = useState(() => new Date())
  const [announcement, setAnnouncement] = useState('')
  const [undo, setUndo] = useState(null)
  const [remindersOn, setRemindersOn] = useState(true)
  // Which surface the shared microphone is currently feeding.
  const [listenTarget, setListenTarget] = useState(null)

  const undoTimer = useRef(null)
  // What to resume once the first-use explainer is accepted.
  const pendingVoice = useRef(null)
  const composerRef = useRef(null)
  const searchRef = useRef(null)

  const recognition = useSpeechRecognition()
  const synthesis = useSpeechSynthesis()
  const permissions = useVoicePermissions()

  // Gentle clock: re-evaluates due times so chips and tabs stay honest.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), CLOCK_TICK_MS)
    return () => clearInterval(id)
  }, [])

  const visibleTodos = useMemo(
    () => sortTodos(filterTodos(todos, tab, query, now), tab === 'done' ? 'created' : 'priority'),
    [todos, tab, query, now],
  )
  const urgentTodos = useMemo(() => getUrgentTodos(todos, now), [todos, now])
  const stats = useMemo(() => getStats(todos, now), [todos, now])

  const announce = useCallback((message) => setAnnouncement(message), [])

  const offerUndo = useCallback((snapshot, message) => {
    clearTimeout(undoTimer.current)
    setUndo({ todos: snapshot, message })
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_TIMEOUT)
  }, [])

  useEffect(() => () => clearTimeout(undoTimer.current), [])

  /* ---------------------------------------------------------------- *
   * Mutations
   * ---------------------------------------------------------------- */

  const handleAdd = useCallback(
    (payload) => {
      if (!payload?.title) return

      dispatch({ type: 'add', payload })
      announce(
        payload.dueAt
          ? `Added “${payload.title}”, due ${formatClockTime(payload.dueAt)}.`
          : `Added “${payload.title}”.`,
      )
    },
    [announce, dispatch],
  )

  const handleToggle = useCallback(
    (id) => {
      const todo = todos.find((item) => item.id === id)
      if (!todo) return

      // Completing is undoable; un-completing is itself the undo.
      if (!todo.completed) offerUndo(todos, `Completed “${todo.title}”.`)

      dispatch({ type: 'toggle', payload: { id } })
      announce(`“${todo.title}” marked ${todo.completed ? 'not done' : 'done'}.`)
    },
    [announce, dispatch, offerUndo, todos],
  )

  const handleComplete = useCallback(
    (id) => {
      const todo = todos.find((item) => item.id === id)
      if (!todo || todo.completed) return

      offerUndo(todos, `Completed “${todo.title}”.`)
      dispatch({ type: 'complete', payload: { id } })
      announce(`“${todo.title}” marked done.`)
    },
    [announce, dispatch, offerUndo, todos],
  )

  const handleUpdate = useCallback(
    (id, changes) => {
      dispatch({ type: 'update', payload: { id, changes } })
      announce(`Saved “${changes.title}”.`)
    },
    [announce, dispatch],
  )

  const handleRemove = useCallback(
    (todo) => {
      offerUndo(todos, `Deleted “${todo.title}”.`)
      dispatch({ type: 'remove', payload: { id: todo.id } })
      announce(`Deleted “${todo.title}”.`)
    },
    [announce, dispatch, offerUndo, todos],
  )

  const handleClearDone = useCallback(() => {
    if (stats.done === 0) return

    const label = `${stats.done} completed ${stats.done === 1 ? 'task' : 'tasks'}`
    offerUndo(todos, `Cleared ${label}.`)
    dispatch({ type: 'clear-completed' })
    announce(`Cleared ${label}.`)
  }, [announce, dispatch, offerUndo, stats.done, todos])

  /**
   * Fills the app with a realistic set of tasks so the whole thing — tabs,
   * the ring, "needs attention" and a reminder that fires within the next
   * sweep — can be seen without typing nine tasks first.
   *
   * It adds rather than replaces, and skips titles that are already there, so
   * pressing it on a real list neither wipes it nor doubles it.
   */
  const handleLoadDemo = useCallback(() => {
    const extra = missingDemoTodos(todos, new Date())

    if (extra.length === 0) {
      announce('The demo tasks are already loaded.')
      return
    }

    offerUndo(todos, `Loaded ${extra.length} demo ${extra.length === 1 ? 'task' : 'tasks'}.`)
    dispatch({ type: 'replace', payload: { todos: [...extra, ...todos] } })
    setTab('today')
    setQuery('')
    announce(`Loaded ${extra.length} demo tasks.`)
  }, [announce, dispatch, offerUndo, todos])

  const handleUndo = useCallback(() => {
    if (!undo) return

    dispatch({ type: 'replace', payload: { todos: undo.todos } })
    clearTimeout(undoTimer.current)
    setUndo(null)
    announce('Undone.')
  }, [announce, dispatch, undo])

  const dismissUndo = useCallback(() => {
    clearTimeout(undoTimer.current)
    setUndo(null)
  }, [])

  /* ---------------------------------------------------------------- *
   * Voice
   * ---------------------------------------------------------------- */

  /** One microphone, two callers — `listenTarget` says who owns the transcript. */
  const listenAs = useCallback(
    (target, timeoutMs) => {
      setListenTarget(target)
      return recognition.listen(timeoutMs).finally(() => setListenTarget(null))
    },
    [recognition],
  )

  const handleVoiceAdd = useCallback(async () => {
    if (recognition.listening) {
      recognition.stop()
      return
    }

    // First use: explain, then ask. The dialog resumes this on Allow.
    pendingVoice.current = 'composer'
    if (!permissions.ensure()) return

    const transcript = await listenAs('composer', 10_000)
    if (!transcript) return

    handleAdd(parseTaskInput(transcript, new Date()))
  }, [handleAdd, listenAs, permissions, recognition])

  const listenForAnswer = useCallback(async () => {
    if (recognition.listening) {
      recognition.stop()
      return
    }

    pendingVoice.current = 'reply'
    if (!permissions.ensure()) return

    const transcript = await listenAs('reply', REPLY_LISTEN_MS)
    if (transcript) reminderRef.current?.resolve(parseReply(transcript))
  }, [listenAs, permissions, recognition])

  const handleAllowPermissions = useCallback(async () => {
    const granted = await permissions.request()
    if (!granted) return

    const pending = pendingVoice.current
    pendingVoice.current = null

    if (pending === 'composer') handleVoiceAdd()
    else if (pending === 'reply') listenForAnswer()
  }, [handleVoiceAdd, listenForAnswer, permissions])

  /** Applies a reminder answer, spoken or clicked. */
  const handleReminderAnswer = useCallback(
    (prompt, result) => {
      switch (result.intent) {
        case 'complete': {
          handleComplete(prompt.id)
          synthesis.speak('Nice one.')
          break
        }

        case 'snooze': {
          dispatch({ type: 'snooze', payload: { id: prompt.id, minutes: SNOOZE_MINUTES } })
          announce(`Snoozed “${prompt.title}” for ${SNOOZE_MINUTES} minutes.`)
          synthesis.speak(`Okay, I'll ask again in ${SNOOZE_MINUTES} minutes.`)
          break
        }

        case 'reschedule': {
          dispatch({ type: 'reschedule', payload: { id: prompt.id, dueAt: result.dueAt } })
          const when = formatClockTime(result.dueAt)
          announce(`Moved “${prompt.title}” to ${when}.`)
          synthesis.speak(`Moved to ${when}.`)
          break
        }

        case 'note': {
          dispatch({ type: 'append-note', payload: { id: prompt.id, note: result.note } })
          announce(`Note added to “${prompt.title}”.`)
          synthesis.speak('Noted.')
          break
        }

        default:
          break
      }
    },
    [announce, dispatch, handleComplete, synthesis],
  )

  const markPrompted = useCallback(
    (todo) => dispatch({ type: 'mark-prompted', payload: { id: todo.id } }),
    [dispatch],
  )

  /**
   * Auto-listening after a reminder must never be the thing that triggers a
   * permission prompt — being asked for the microphone by a page you are not
   * touching is how people block it for good. So the reply mic only opens once
   * the user has granted it deliberately; until then the card's own mic button
   * is the way in.
   */
  const canAutoListen =
    recognition.supported && permissions.mic === 'granted' && permissions.asked

  const listenForReply = useCallback(
    (timeoutMs) => (canAutoListen ? listenAs('reply', timeoutMs) : Promise.resolve(null)),
    [canAutoListen, listenAs],
  )

  const reminderRef = useRef(null)

  const reminder = useReminders({
    todos,
    enabled: remindersOn,
    speak: synthesis.speak,
    listen: listenForReply,
    notify: permissions.notify,
    onPrompted: markPrompted,
    onAnswer: handleReminderAnswer,
  })

  reminderRef.current = reminder

  /* ---------------------------------------------------------------- *
   * Keyboard shortcuts: N new, / search, Space complete
   * ---------------------------------------------------------------- */

  useShortcuts({
    onNew: () => composerRef.current?.focus(),
    onSearch: () => searchRef.current?.focus(),
    onComplete: () => {
      const row =
        document.activeElement?.closest?.('[data-todo-id]') ??
        document.querySelector('.task-list [data-todo-id]')

      if (!row) return

      row.focus()
      handleToggle(row.dataset.todoId)
    },
    onEscape: () => {
      if (recognition.listening) recognition.stop()
      else if (reminder.prompt) reminder.dismiss()
      else if (undo) dismissUndo()
    },
  })

  return (
    <div className="app">
      <AppHeader
        now={now}
        remindersOn={remindersOn}
        onToggleReminders={() => {
          const next = !remindersOn
          setRemindersOn(next)
          if (next) {
            pendingVoice.current = null
            permissions.ensure()
          }
          else synthesis.cancel()
          announce(`Voice reminders ${next ? 'on' : 'off'}.`)
        }}
        onLoadDemo={handleLoadDemo}
        voiceSupported={synthesis.supported}
      />

      <TaskComposer
        ref={composerRef}
        onAdd={handleAdd}
        onVoice={handleVoiceAdd}
        listening={listenTarget === 'composer'}
        transcript={recognition.transcript}
        voiceError={listenTarget === 'composer' ? recognition.error : ''}
        micSupported={recognition.supported}
      />

      <div className="overview">
        <ProgressRing stats={stats} />
        <NeedsAttention todos={urgentTodos} now={now} onComplete={handleComplete} />
      </div>

      <TaskList
        ref={searchRef}
        todos={visibleTodos}
        tab={tab}
        counts={{ today: stats.today, upcoming: stats.upcoming, done: stats.done }}
        query={query}
        total={stats.total}
        onTabChange={setTab}
        onQueryChange={setQuery}
        onToggle={handleToggle}
        onUpdate={handleUpdate}
        onRemove={handleRemove}
        onClearDone={handleClearDone}
        onLoadDemo={handleLoadDemo}
      />

      <footer className="app-footer">
        <p>
          Everything stays in this browser. <kbd>N</kbd> new · <kbd>/</kbd> search ·{' '}
          <kbd>Space</kbd> complete
        </p>
        {!recognition.supported ? (
          <p className="muted-note">
            Voice input needs a Chromium browser or Safari. Reminders still appear as cards here.
          </p>
        ) : null}
      </footer>

      {/* Screen-reader-only status region for action feedback. */}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      {reminder.prompt ? (
        <ReminderCard
          prompt={reminder.prompt}
          heard={reminder.heard}
          listening={listenTarget === 'reply'}
          onYes={() => reminder.resolve({ intent: 'complete' })}
          onSnooze={() => reminder.resolve({ intent: 'snooze' })}
          onListen={listenForAnswer}
          onDismiss={reminder.dismiss}
        />
      ) : null}

      {undo ? (
        <UndoToast message={undo.message} onUndo={handleUndo} onDismiss={dismissUndo} />
      ) : null}

      {permissions.explainerOpen ? (
        <PermissionDialog
          micState={permissions.mic}
          notificationState={permissions.notifications}
          onAllow={handleAllowPermissions}
          onDismiss={permissions.dismissExplainer}
        />
      ) : null}
    </div>
  )
}
