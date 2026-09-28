import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import AppHeader from './components/AppHeader.jsx'
import ConfirmCard from './components/ConfirmCard.jsx'
import MiniCalendar from './components/MiniCalendar.jsx'
import NeedsAttention from './components/NeedsAttention.jsx'
import PermissionDialog from './components/PermissionDialog.jsx'
import ProgressRing from './components/ProgressRing.jsx'
import Sidebar from './components/Sidebar.jsx'
import QuickSwitcher from './components/QuickSwitcher.jsx'
import ReminderCard from './components/ReminderCard.jsx'
import TaskComposer from './components/TaskComposer.jsx'
import TaskList from './components/TaskList.jsx'
import UndoToast from './components/UndoToast.jsx'
import {
  CLOCK_TICK_MS,
  DEFAULT_DUE_HOUR,
  REPLY_LISTEN_MS,
  SNOOZE_MINUTES,
  UNDO_TIMEOUT,
} from './constants.js'
import { missingDemoTodos } from './state/demoTodos.js'
import { useReminders } from './hooks/useReminders.js'
import { useShortcuts } from './hooks/useShortcuts.js'
import { useSpeechRecognition, useSpeechSynthesis } from './hooks/useSpeech.js'
import { useTodos } from './hooks/useTodos.js'
import { useVoicePermissions } from './hooks/useVoicePermissions.js'
import { formatClockTime, formatDueChip, toDueAt } from './utils/date.js'
import {
  parseConfirmReply,
  parseEditCommand,
  parseReply,
  parseTaskInput,
} from './utils/nlp.js'
import { buildTagTree, matchesTag, tagPath } from './utils/tags.js'
import {
  filterByDay,
  filterTodos,
  getDayIndex,
  getStats,
  getUrgentTodos,
  matchesTab,
  sortTodos,
} from './utils/todoFilters.js'

/**
 * App shell.
 *
 * Layout is an app shell: a full-height tag navbar on the left, and to its
 * right the top bar, the composer and a workspace of list + side rail. The
 * rail splits into two columns on a very wide screen (four in total), folds to
 * two columns on a laptop, and stacks under the list on a phone.
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
  // A day picked in the calendar, as `YYYY-MM-DD`, or null for "all days".
  const [selectedDay, setSelectedDay] = useState(null)
  // A dictated task waiting to be confirmed: { id, draft, heard }.
  const [pending, setPending] = useState(null)
  // A tag path from the sidebar; includes everything nested under it.
  const [selectedTag, setSelectedTag] = useState(null)
  const [switcherOpen, setSwitcherOpen] = useState(false)

  const undoTimer = useRef(null)
  // What to resume once the first-use explainer is accepted.
  const pendingVoice = useRef(null)
  // Set below; lets the explainer resume a confirmation it interrupted.
  const confirmListenRef = useRef(null)
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

  // A picked day replaces the tab filter: "everything on Monday" is a different
  // question from "everything due today", and mixing the two reads as a bug.
  // The tag filter narrows whatever the tab or the day already chose.
  const visibleTodos = useMemo(() => {
    const base = selectedDay
      ? filterByDay(todos, selectedDay, query)
      : sortTodos(filterTodos(todos, tab, query, now), tab === 'done' ? 'created' : 'priority')

    return selectedTag ? base.filter((todo) => matchesTag(todo, selectedTag)) : base
  }, [todos, tab, query, now, selectedDay, selectedTag])
  const urgentTodos = useMemo(() => getUrgentTodos(todos, now), [todos, now])
  const stats = useMemo(() => getStats(todos, now), [todos, now])
  const dayIndex = useMemo(() => getDayIndex(todos, now), [todos, now])
  const tagTree = useMemo(() => buildTagTree(todos), [todos])

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

  /** A task with no spoken or typed time lands on the day you are looking at. */
  const defaultDueAt = useCallback(
    () => (selectedDay ? toDueAt(selectedDay, DEFAULT_DUE_HOUR) : null),
    [selectedDay],
  )

  const handleAdd = useCallback(
    (input) => {
      if (!input?.title) return

      const payload = {
        ...input,
        dueAt: input.dueAt ?? defaultDueAt(),
        // Adding a task inside a tag branch files it there, the way adding a
        // note inside a folder does.
        tags: input.tags?.length ? input.tags : selectedTag ? [selectedTag] : [],
      }
      dispatch({ type: 'add', payload })
      announce(
        payload.dueAt
          ? `Added “${payload.title}”, due ${formatDueChip(payload.dueAt)}.`
          : `Added “${payload.title}”.`,
      )
    },
    [announce, defaultDueAt, dispatch, selectedTag],
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

  const [revealId, setRevealId] = useState(null)

  /**
   * Jump to a task: drop every filter that could be hiding it, move to the tab
   * it lives in, then focus the row. Without the filter reset the switcher
   * would "find" tasks and then appear to do nothing.
   */
  const revealTodo = useCallback(
    (todo) => {
      setSwitcherOpen(false)
      setSelectedDay(null)
      setSelectedTag(null)
      setQuery('')
      setTab(todo.completed ? 'done' : matchesTab(todo, 'today', new Date()) ? 'today' : 'upcoming')
      setRevealId(todo.id)
    },
    [],
  )

  useEffect(() => {
    if (!revealId) return

    const row = document.querySelector(`[data-todo-id="${revealId}"]`)
    row?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    row?.focus()
    setRevealId(null)
  }, [revealId, visibleTodos])

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

  /**
   * What a dictated sentence means.
   *
   * An edit command applies straight away — you named the task and the change,
   * so there is nothing left to confirm. Anything else becomes a *proposal*:
   * dictation is a guess twice over (what was heard, then what the parser made
   * of it), so a new task is read back and waits for a yes.
   */
  const handleTranscript = useCallback(
    (transcript) => {
      const edit = parseEditCommand(transcript, todos, new Date())

      if (edit) {
        dispatch({ type: 'update', payload: { id: edit.todo.id, changes: edit.changes } })

        const title = edit.changes.title ?? edit.todo.title
        const when = edit.changes.dueAt ? `, due ${formatDueChip(edit.changes.dueAt)}` : ''
        announce(`Updated “${title}”${when}.`)
        synthesis.speak(`Updated ${title}.`)
        return
      }

      const parsed = parseTaskInput(transcript, new Date())
      if (!parsed.title) return

      setPending({
        id: 1,
        heard: transcript,
        draft: {
          title: parsed.title,
          dueAt: parsed.dueAt ?? defaultDueAt(),
          priority: parsed.priority,
          tags: parsed.tags.length ? parsed.tags : selectedTag ? [selectedTag] : [],
        },
      })
    },
    [announce, defaultDueAt, dispatch, selectedTag, synthesis, todos],
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

    handleTranscript(transcript)
  }, [handleTranscript, listenAs, permissions, recognition])

  const confirmPending = useCallback(
    (draft) => {
      handleAdd(draft)
      setPending(null)
    },
    [handleAdd],
  )

  const cancelPending = useCallback(() => {
    setPending(null)
    announce('Discarded.')
  }, [announce])

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

    const resume = pendingVoice.current
    pendingVoice.current = null

    if (resume === 'composer') handleVoiceAdd()
    else if (resume === 'reply') listenForAnswer()
    else if (resume === 'confirm') confirmListenRef.current?.()
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

  const pendingRef = useRef(pending)
  pendingRef.current = pending

  /** Applies an answer to the confirmation card, spoken or clicked. */
  const answerPending = useCallback(
    (result) => {
      const current = pendingRef.current
      if (!current) return

      if (result.intent === 'confirm') confirmPending(current.draft)
      else if (result.intent === 'cancel') cancelPending()
      else if (result.intent === 'reschedule') {
        // Re-ask with the new time: bumping the id restarts the read-back.
        setPending({
          ...current,
          id: current.id + 1,
          draft: { ...current.draft, dueAt: result.dueAt },
        })
      }
    },
    [cancelPending, confirmPending],
  )

  const listenForConfirm = useCallback(async () => {
    if (recognition.listening) {
      recognition.stop()
      return
    }

    pendingVoice.current = 'confirm'
    if (!permissions.ensure()) return

    const transcript = await listenAs('confirm', REPLY_LISTEN_MS)
    if (transcript) answerPending(parseConfirmReply(transcript, new Date()))
  }, [answerPending, listenAs, permissions, recognition])

  confirmListenRef.current = listenForConfirm

  /**
   * Read the proposed task back, then listen for the answer. Keyed on the
   * pending id, so correcting the time asks again with the corrected time.
   */
  useEffect(() => {
    if (!pending) return undefined

    let cancelled = false

    const ask = async () => {
      const { title, dueAt } = pending.draft
      const when = dueAt ? ` for ${formatDueChip(dueAt)}` : ''

      await synthesis.speak(`Add "${title}"${when}? Say yes or no.`)
      if (cancelled || !canAutoListen) return

      const transcript = await listenAs('confirm', REPLY_LISTEN_MS)
      if (cancelled || !transcript) return

      answerPending(parseConfirmReply(transcript, new Date()))
    }

    ask()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending?.id, pending?.draft.dueAt])

  const reminderRef = useRef(null)

  const reminder = useReminders({
    todos,
    // One card at a time: a reminder would talk over the confirmation.
    enabled: remindersOn && !pending,
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
    onSwitcher: () => setSwitcherOpen((open) => !open),
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
      if (switcherOpen) setSwitcherOpen(false)
      else if (recognition.listening) recognition.stop()
      else if (pending) cancelPending()
      else if (reminder.prompt) reminder.dismiss()
      else if (undo) dismissUndo()
    },
  })

  return (
    <div className="app">
      <Sidebar
        tagTree={tagTree}
        selectedTag={selectedTag}
        total={stats.total}
        onSelectTag={setSelectedTag}
        onLoadDemo={handleLoadDemo}
      />

      <div className="content">
        <AppHeader
          now={now}
          remindersOn={remindersOn}
          onToggleReminders={() => {
            const next = !remindersOn
            setRemindersOn(next)
            if (next) {
              pendingVoice.current = null
              permissions.ensure()
            } else synthesis.cancel()
            announce(`Voice reminders ${next ? 'on' : 'off'}.`)
          }}
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

        <div className="workspace">
          <main className="list-col">
            <TaskList
              ref={searchRef}
              todos={visibleTodos}
              tab={tab}
              counts={{ today: stats.today, upcoming: stats.upcoming, done: stats.done }}
              query={query}
              total={stats.total}
              selectedDay={selectedDay}
              onTabChange={(next) => {
                // Picking a tab is a different question from picking a day.
                setSelectedDay(null)
                setTab(next)
              }}
              onQueryChange={setQuery}
              onClearDay={() => setSelectedDay(null)}
              onSelectTag={(tag) => setSelectedTag(tagPath(tag))}
              onToggle={handleToggle}
              onUpdate={handleUpdate}
              onRemove={handleRemove}
              onClearDone={handleClearDone}
              onLoadDemo={handleLoadDemo}
            />
          </main>

          <aside className="side-col" aria-label="Calendar, focus and progress">
            <MiniCalendar
              now={now}
              dayIndex={dayIndex}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
            />
            <NeedsAttention todos={urgentTodos} now={now} onComplete={handleComplete} />
            <ProgressRing stats={stats} />
          </aside>
        </div>

        <footer className="app-footer">
          <p>
            Everything stays in this browser. <kbd>⌘K</kbd> jump · <kbd>N</kbd> new ·{' '}
            <kbd>/</kbd> search · <kbd>Space</kbd> complete
          </p>
          {!recognition.supported ? (
            <p className="muted-note">
              Voice input needs a Chromium browser or Safari. Reminders still appear as cards here.
            </p>
          ) : null}
        </footer>
      </div>

      {/* Screen-reader-only status region for action feedback. */}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      {pending ? (
        <ConfirmCard
          draft={pending.draft}
          heard={pending.heard}
          listening={listenTarget === 'confirm'}
          onChange={(draft) => setPending((current) => ({ ...current, draft }))}
          onConfirm={() => confirmPending(pending.draft)}
          onCancel={cancelPending}
          onListen={listenForConfirm}
        />
      ) : null}

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

      {switcherOpen ? (
        <QuickSwitcher
          todos={todos}
          onPick={revealTodo}
          onCreate={(text) => {
            setSwitcherOpen(false)
            handleAdd(parseTaskInput(text, new Date()))
          }}
          onClose={() => setSwitcherOpen(false)}
        />
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
