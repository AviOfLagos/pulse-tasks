import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import AppHeader from './components/AppHeader.jsx'
import ConfirmCard from './components/ConfirmCard.jsx'
import MiniCalendar from './components/MiniCalendar.jsx'
import NeedsAttention from './components/NeedsAttention.jsx'
import PermissionDialog from './components/PermissionDialog.jsx'
import QuickSwitcher from './components/QuickSwitcher.jsx'
import Sidebar from './components/Sidebar.jsx'
import TaskDrawer from './components/TaskDrawer.jsx'
import ReminderCard from './components/ReminderCard.jsx'
import SettingsDialog from './components/SettingsDialog.jsx'
import TaskComposer from './components/TaskComposer.jsx'
import TaskList from './components/TaskList.jsx'
import UndoToast from './components/UndoToast.jsx'
import {
  CLOCK_TICK_MS,
  DICTATION_MS,
  PRIORITY_LABELS,
  REPLY_LISTEN_MS,
  UNDO_TIMEOUT,
} from './constants.js'
import { missingDemoTodos } from './state/demoTodos.js'
import { fromBackup, mergeTodos, toBackup } from './utils/backup.js'
import { useReminders } from './hooks/useReminders.js'
import { useLocalAI } from './hooks/useLocalAI.js'
import { useSettings } from './hooks/useSettings.js'
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
  getDueReminders,
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
  const { settings, update: updateSettings } = useSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Which surface the shared microphone is currently feeding.
  const [listenTarget, setListenTarget] = useState(null)
  // Who *last* used the mic. `listenTarget` clears when listening stops, but
  // an error has to outlive the session that produced it to be readable.
  const [lastListenTarget, setLastListenTarget] = useState(null)
  // A day picked in the calendar, as `YYYY-MM-DD`, or null for "all days".
  const [selectedDay, setSelectedDay] = useState(null)
  // A dictated task waiting to be confirmed: { id, draft, heard }.
  const [pending, setPending] = useState(null)
  // A tag path from the sidebar; includes everything nested under it.
  const [selectedTag, setSelectedTag] = useState(null)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  // The task whose details drawer is open, if any. Tracking the id (not the
  // task) means the drawer always renders live store data, and closes itself
  // if the task is deleted underneath it.
  const [openId, setOpenId] = useState(null)

  const undoTimer = useRef(null)
  // What to resume once the first-use explainer is accepted.
  const pendingVoice = useRef(null)
  // Set below; lets the explainer resume a confirmation it interrupted.
  const confirmListenRef = useRef(null)
  const composerRef = useRef(null)
  const searchRef = useRef(null)

  const recognition = useSpeechRecognition()
  const synthesis = useSpeechSynthesis({
    voiceURI: settings.voiceURI,
    rate: settings.speechRate,
  })
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
  // Flattened tag paths, so the model reuses the vocabulary already in use
  // instead of inventing a parallel one.
  const knownTags = useMemo(() => {
    const paths = []
    const walk = (nodes) => nodes.forEach((node) => (paths.push(node.path), walk(node.children)))
    walk(tagTree)
    return paths
  }, [tagTree])

  // Declared after the vocabulary it is given, not with the other hooks.
  const ai = useLocalAI({ knownTags, enabled: settings.aiSuggestions })
  // What the bell counts: unfinished work whose moment has passed.
  const dueCount = useMemo(
    () => todos.filter((todo) => !todo.completed && todo.dueAt && new Date(todo.dueAt) <= now).length,
    [todos, now],
  )

  const openTodo = useMemo(() => todos.find((todo) => todo.id === openId) ?? null, [todos, openId])

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
    () => (selectedDay ? toDueAt(selectedDay, settings.defaultDueHour) : null),
    [selectedDay, settings.defaultDueHour],
  )

  const handleAdd = useCallback(
    (input) => {
      if (!input?.title) return

      const payload = {
        ...input,
        dueAt: input.dueAt ?? defaultDueAt(),
        // Adding a task inside a tag branch files it there, the way adding a
        // note inside a folder does.
        // Explicit beats the branch you are in, which beats the model, which
        // beats the keyword table. Everything the user decided outranks
        // everything that was guessed.
        priority: input.priorityFound ? input.priority : settings.defaultPriority,
        tags: input.tags?.length
          ? input.tags
          : selectedTag
            ? [selectedTag]
            : input.aiTag
              ? [input.aiTag]
              : settings.keywordSuggestions && input.suggestedTag
                ? [input.suggestedTag]
                : [],
      }
      dispatch({ type: 'add', payload })
      announce(
        payload.dueAt
          ? `Added “${payload.title}”, due ${formatDueChip(payload.dueAt)}.`
          : `Added “${payload.title}”.`,
      )
    },
    [
      announce,
      defaultDueAt,
      dispatch,
      selectedTag,
      settings.defaultPriority,
      settings.keywordSuggestions,
    ],
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

      // The drawer saves one field at a time, so the announcement says which
      // field moved rather than repeating the title for a priority tweak.
      const todo = todos.find((item) => item.id === id)
      const title = changes.title ?? todo?.title ?? 'task'

      if (changes.title !== undefined) {
        announce(`Renamed to “${title}”.`)
        return
      }

      const what = changeLabel(changes)
      announce(what ? `${what} for “${title}”.` : `Saved “${title}”.`)
    },
    [announce, dispatch, todos],
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

  /* ---------------------------------------------------------------- *
   * Details drawer
   * ---------------------------------------------------------------- */

  const openDetails = useCallback((todo) => setOpenId(todo.id), [])
  const closeDetails = useCallback(() => setOpenId(null), [])

  const handleSnooze = useCallback(
    (id, minutes = settings.snoozeMinutes) => {
      dispatch({ type: 'snooze', payload: { id, minutes } })
      announce(`Snoozed for ${minutes} minutes.`)
    },
    [announce, dispatch, settings.snoozeMinutes],
  )

  const handleDuplicate = useCallback(
    (id) => {
      const todo = todos.find((item) => item.id === id)
      if (!todo) return

      offerUndo(todos, `Duplicated “${todo.title}”.`)
      dispatch({ type: 'duplicate', payload: { id } })
      announce(`Duplicated “${todo.title}”.`)
    },
    [announce, dispatch, offerUndo, todos],
  )

  const handleAddStep = useCallback(
    (id, text) => {
      dispatch({ type: 'step-add', payload: { id, text } })
      announce(`Step added to the checklist: ${text}.`)
    },
    [announce, dispatch],
  )

  const handleEditStep = useCallback(
    (id, stepId, text) => dispatch({ type: 'step-edit', payload: { id, stepId, text } }),
    [dispatch],
  )

  const handleToggleStep = useCallback(
    (id, stepId) => dispatch({ type: 'step-toggle', payload: { id, stepId } }),
    [dispatch],
  )

  const handleRemoveStep = useCallback(
    (id, stepId) => {
      dispatch({ type: 'step-remove', payload: { id, stepId } })
      announce('Step removed.')
    },
    [announce, dispatch],
  )

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
      // If the drawer is open, it follows the jump instead of pointing at a task
      // the user has just navigated away from.
      setOpenId((current) => (current ? todo.id : current))
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

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(toBackup(todos), null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = `pulse-tasks-${new Date().toISOString().slice(0, 10)}.json`
    link.click()

    URL.revokeObjectURL(url)
    announce(`Exported ${todos.length} tasks.`)
  }, [announce, todos])

  /** Merges a backup in. Adding rather than replacing: an import that wiped
   *  what you already had would be the most expensive undo in the app. */
  const handleImport = useCallback(
    async (file) => {
      const { todos: incoming, error, skipped } = fromBackup(await file.text())
      if (error) return error

      const { todos: next, added } = mergeTodos(todos, incoming)
      if (added === 0) return 'Those tasks are already here.'

      offerUndo(todos, `Imported ${added} ${added === 1 ? 'task' : 'tasks'}.`)
      dispatch({ type: 'replace', payload: { todos: next } })
      announce(`Imported ${added} tasks.`)

      return `Imported ${added} ${added === 1 ? 'task' : 'tasks'}.${
        skipped ? ` ${skipped} unreadable entries were skipped.` : ''
      }`
    },
    [announce, dispatch, offerUndo, todos],
  )

  const handleClearAll = useCallback(() => {
    if (todos.length === 0) return

    offerUndo(todos, `Deleted all ${todos.length} tasks.`)
    dispatch({ type: 'replace', payload: { todos: [] } })
    announce('Deleted every task.')
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
      setLastListenTarget(target)
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
      const edit = parseEditCommand(transcript, todos, new Date(), settings.defaultDueHour)

      if (edit) {
        dispatch({ type: 'update', payload: { id: edit.todo.id, changes: edit.changes } })

        const title = edit.changes.title ?? edit.todo.title
        const when = edit.changes.dueAt ? `, due ${formatDueChip(edit.changes.dueAt)}` : ''
        announce(`Updated “${title}”${when}.`)
        synthesis.speak(`Updated ${title}.`)
        return
      }

      const parsed = parseTaskInput(transcript, new Date(), settings.defaultDueHour)
      if (!parsed.title) return

      const decided = parsed.tags.length > 0 || Boolean(selectedTag)

      setPending({
        id: 1,
        heard: transcript,
        draft: {
          title: parsed.title,
          dueAt: parsed.dueAt ?? defaultDueAt(),
          priority: parsed.priority,
          tags: parsed.tags.length
            ? parsed.tags
            : selectedTag
              ? [selectedTag]
              : parsed.suggestedTag
                ? [parsed.suggestedTag]
                : [],
        },
      })

      // The card goes up immediately with the keyword guess; if the on-device
      // model has a better answer it lands a moment later. Waiting for it
      // first would put a model's latency in front of every dictated task.
      if (!decided) {
        ai.suggest(parsed.title).then((result) => {
          if (!result?.tag) return

          setPending((current) =>
            current && current.heard === transcript
              ? { ...current, draft: { ...current.draft, tags: [result.tag] } }
              : current,
          )
        })
      }
    },
    [ai, announce, defaultDueAt, dispatch, selectedTag, settings.defaultDueHour, synthesis, todos],
  )

  const handleVoiceAdd = useCallback(async () => {
    if (recognition.listening) {
      recognition.stop()
      return
    }

    // First use: explain, then ask. The dialog resumes this on Allow.
    pendingVoice.current = 'composer'
    if (!permissions.ensure()) return

    const transcript = await listenAs('composer', DICTATION_MS)
    if (!transcript) return

    handleTranscript(transcript)
  }, [handleTranscript, listenAs, permissions, recognition])

  /**
   * Dictate straight into the open drawer's notes.
   *
   * The task is captured before the mic opens: listening takes seconds, and the
   * note must land on the task you were looking at when you pressed the button.
   */
  const handleVoiceNote = useCallback(async () => {
    if (recognition.listening) {
      recognition.stop()
      return
    }

    const target = openId
    if (!target) return

    pendingVoice.current = 'note'
    if (!permissions.ensure()) return

    const transcript = await listenAs('note', DICTATION_MS)
    if (!transcript) return

    dispatch({ type: 'append-note', payload: { id: target, note: transcript } })
    announce('Note added.')
  }, [announce, dispatch, listenAs, openId, permissions, recognition])

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
    else if (resume === 'note') handleVoiceNote()
    else if (resume === 'confirm') confirmListenRef.current?.()
  }, [handleVoiceAdd, handleVoiceNote, listenForAnswer, permissions])

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
          handleSnooze(prompt.id)
          synthesis.speak(`Okay, I'll ask again in ${settings.snoozeMinutes} minutes.`)
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
    [announce, dispatch, handleComplete, handleSnooze, synthesis],
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
    enabled: settings.voiceReminders && !pending,
    speak: synthesis.speak,
    listen: listenForReply,
    notify: permissions.notify,
    onPrompted: markPrompted,
    onAnswer: handleReminderAnswer,
  })

  reminderRef.current = reminder

  /**
   * The bell. Raising the prompt by hand means a due task never waits on the
   * next 30-second sweep, and it is the way in when spoken reminders are off.
   */
  const handleShowDue = useCallback(() => {
    if (reminderRef.current?.prompt) return

    const [next] = getDueReminders(todos)
    if (!next) {
      // Everything already asked about still counts as due.
      const [asked] = todos.filter(
        (todo) => !todo.completed && todo.dueAt && new Date(todo.dueAt) <= new Date(),
      )

      if (!asked) {
        announce('Nothing is due.')
        return
      }

      dispatch({ type: 'update', payload: { id: asked.id, changes: { dueAt: asked.dueAt } } })
    }

    reminderRef.current?.askNow()
  }, [announce, dispatch, todos])

  /* ---------------------------------------------------------------- *
   * Keyboard shortcuts: N new, / search, Space complete
   * ---------------------------------------------------------------- */

  useShortcuts({
    onSwitcher: () => setSwitcherOpen((open) => !open),
    // The drawer is a modal: task shortcuts must not act on the list behind it.
    onNew: () => {
      if (openId) return
      composerRef.current?.focus()
    },
    onSearch: () => {
      if (openId) return
      searchRef.current?.focus()
    },
    onComplete: () => {
      if (openId) return

      const row =
        document.activeElement?.closest?.('[data-todo-id]') ??
        document.querySelector('.task-list [data-todo-id]')

      if (!row) return

      row.focus()
      handleToggle(row.dataset.todoId)
    },
    onEscape: () => {
      // The drawer is a modal, so it is the first thing Escape closes.
      if (switcherOpen) setSwitcherOpen(false)
      else if (openId) closeDetails()
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
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="content">
        <AppHeader
          now={now}
          stats={stats}
          dueCount={dueCount}
          onNewTask={() => composerRef.current?.focus()}
          onShowDue={handleShowDue}
          remindersOn={settings.voiceReminders}
          onToggleReminders={() => {
            const next = !settings.voiceReminders
            updateSettings({ voiceReminders: next })
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
          voiceError={lastListenTarget === 'composer' ? recognition.error : ''}
          micSupported={recognition.supported}
          ai={ai}
          defaultDueHour={settings.defaultDueHour}
          keywordSuggestions={settings.keywordSuggestions}
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
              onOpen={openDetails}
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
          snoozeMinutes={settings.snoozeMinutes}
          onYes={() => reminder.resolve({ intent: 'complete' })}
          onSnooze={() => reminder.resolve({ intent: 'snooze' })}
          onListen={listenForAnswer}
          onDismiss={reminder.dismiss}
        />
      ) : null}

      {openTodo ? (
        <TaskDrawer
          todo={openTodo}
          knownTags={knownTags}
          onClose={closeDetails}
          onToggle={handleToggle}
          onUpdate={handleUpdate}
          onComplete={handleComplete}
          onSnooze={handleSnooze}
          onDuplicate={handleDuplicate}
          onRemove={handleRemove}
          onSelectTag={(tag) => setSelectedTag(tagPath(tag))}
          onAddStep={handleAddStep}
          onEditStep={handleEditStep}
          onToggleStep={handleToggleStep}
          onRemoveStep={handleRemoveStep}
          onVoiceNote={handleVoiceNote}
          listening={listenTarget === 'note'}
          micSupported={recognition.supported}
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
            handleAdd(parseTaskInput(text, new Date(), settings.defaultDueHour))
          }}
          onClose={() => setSwitcherOpen(false)}
        />
      ) : null}

      {settingsOpen ? (
        <SettingsDialog
          settings={settings}
          onChange={updateSettings}
          ai={ai}
          voices={synthesis.voices}
          permissions={permissions}
          taskCount={todos.length}
          onSpeakTest={() => synthesis.speak('This is how reminders will sound.')}
          onLoadDemo={handleLoadDemo}
          onExport={handleExport}
          onImport={handleImport}
          onClearAll={handleClearAll}
          onClose={() => setSettingsOpen(false)}
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

/** Names the field an edit touched, for the screen-reader announcement. */
function changeLabel(changes = {}) {
  if (changes.title !== undefined) return 'Renamed'
  if (changes.dueAt !== undefined) return changes.dueAt ? 'Due time set' : 'Due time cleared'
  if (changes.priority !== undefined) {
    return `Priority set to ${PRIORITY_LABELS[changes.priority] ?? changes.priority}`
  }
  if (changes.description !== undefined) return 'Notes saved'
  if (changes.tags !== undefined) return 'Tags saved'
  if (changes.steps !== undefined) return 'Checklist saved'

  return ''
}

