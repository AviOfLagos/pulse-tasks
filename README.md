# Pulse Tasks — voice-first todo app

A fast, accessible **dark + neon** todo app built with **React 19 + Vite 8**. You can type a task
or say it; when a task falls due the app asks you out loud whether it is done, and listens for the
answer. Everything is stored in the browser (`localStorage`) — no backend, no account, no keys.
Voice uses the **Web Speech API** built into the browser, so there is nothing to pay for.

![stack](https://img.shields.io/badge/React-19-149eca) ![stack](https://img.shields.io/badge/Vite-8-646cff) ![tests](https://img.shields.io/badge/tests-node--test-5fa04e) ![pwa](https://img.shields.io/badge/PWA-installable-39FF88)

## Features

### Voice

- **Say a task.** Press the mic in the composer and speak. "Call mum tomorrow 5pm, urgent" becomes
  a task titled *Call mum*, due tomorrow at 17:00, priority high. The parser understands times
  (`5pm`, `5:30 pm`, `17:00`, `at 6`), days (`today`, `tonight`, `tomorrow`, `friday`, `next week`),
  relative offsets (`in 30 minutes`, `in 2 hours`, `in 3 days`), parts of the day (`morning`,
  `evening`, `midnight`) and urgency words (`urgent`, `asap`, `someday`). Typed input goes through
  exactly the same parser, and a live preview shows what was understood before you press **Add**.
- **Spoken due reminders.** Every 30 seconds the app looks for a task that is due, unfinished and
  not yet asked about. It says *"It's 5:00 PM. Have you water the plants?"*, then listens:

  | You say | What happens |
  | --- | --- |
  | "yes" / "done" / "did it" | marked complete (undoable for 5s) |
  | "no" / "later" / "not yet" | snoozed 15 minutes |
  | "change it to 6pm" | due time moved, and it becomes askable again |
  | "add note bring the receipt" | appended to the task's notes |

- **Always a fallback.** The same question appears as an on-screen card with **Yes, done** and
  **Snooze 15m** buttons. It stays up until answered, so the feature still works when speech is
  unsupported (Firefox), the mic is denied, or the reply was not understood.
- **Permission with an explainer.** Nothing is requested on load. The first time you use voice you
  get a plain-language dialog about what the microphone and notifications are for, and only then
  the browser's own prompts. Auto-listening after a reminder is deliberately gated behind a
  microphone you have already granted — a page that asks for your mic while you are not touching it
  is a page people block for good.

### Tasks

- **One big input** — type or dictate, press Enter or **Add**. Whatever is half-typed in it
  survives a reload, and clears the moment it becomes a task.
- **Load demo data** — one button (in the header, and in the empty state) fills the app with a
  realistic set of tasks: something already overdue so a reminder fires straight away, work due
  later today, a full Upcoming tab and some history in Done. It adds rather than replaces, skips
  titles you already have, and is undoable.
- **Three tabs** — *Today* (due today, overdue, or undated), *Upcoming* (a later day), *Done*.
  Each has a live count. Search covers titles, notes and tags.
- **Needs attention** — overdue tasks first, then anything due within seven days.
- **Progress ring** — completion percentage with `progressbar` semantics.
- **Every row** — checkbox, title, due-time chip, priority dot (red / amber / green). Inline edit
  for title, due moment, priority and notes; Escape cancels and focus returns to the Edit button.
- **Undo toast (5s)** after a delete or a completion, including completions made by voice.
- **Keyboard**: <kbd>N</kbd> new task · <kbd>/</kbd> search · <kbd>Space</kbd> complete the focused
  row · <kbd>Esc</kbd> stop listening / dismiss.
- **Installable PWA** — manifest, icons, and a service worker that keeps the app opening offline.

## Design

| Token | Value | Used for |
| --- | --- | --- |
| `--bg` | `#0B0F0E` | page |
| `--card` | `#141A18` | cards and the composer |
| `--border` | `#1F2A26` | hairlines |
| `--text` | `#E6E6E6` | body text |
| `--muted` | `#9AA5A0` | secondary text, chips |
| `--accent` | `#39FF88` | **only** the primary button, the active tab, the progress ring and focus rings |

Priority uses its own traffic light (`#FF5A5A` / `#FFB020` / `#4FB477`) and never borrows the neon,
so green always means "this is the live control" rather than decoration.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm run build      # production bundle in dist/
npm run preview    # serve the built bundle on http://localhost:4173
npm test           # unit tests (Node's built-in runner)
```

Voice input needs a Chromium browser or Safari (`SpeechRecognition`). Speech *output* and every
non-voice feature work everywhere. Speech recognition requires a secure context, so use
`localhost` or HTTPS.

## Project structure

```
index.html                 app shell, manifest + icon links
public/
  manifest.webmanifest     PWA metadata
  sw.js                    service worker (network-first shell, SWR assets)
  icon.svg, icon-*.png     app icons, including a maskable one
src/
  main.jsx                 React entry point + service worker registration
  App.jsx                  layout, view state, every mutation, voice wiring
  index.css                design tokens + components (responsive)
  constants.js             priorities, tabs, timings, storage keys
  components/
    AppHeader.jsx          wordmark, clock, reminder switch
    TaskComposer.jsx       big input + mic + Add, with a live parse preview
    MicButton.jsx          shared mic control with the listening pulse
    ProgressRing.jsx       completion ring and counts
    NeedsAttention.jsx     overdue + this week, at a glance
    Tabs.jsx               Today / Upcoming / Done
    TaskList.jsx           tabs, search and the rows
    TaskRow.jsx            one task + inline editor
    ReminderCard.jsx       on-screen twin of the spoken reminder
    PermissionDialog.jsx   first-use explainer
    UndoToast.jsx          5-second undo
    EmptyState.jsx         context-aware placeholder
  hooks/
    useTodos.js            useReducer + persist on change
    useSpeech.js           SpeechRecognition / speechSynthesis wrappers
    useVoicePermissions.js mic + notification permission, asked once
    useReminders.js        the 30-second due sweep and the ask/listen cycle
    useShortcuts.js        N / · Space, ignored while typing
  state/
    todoReducer.js         pure store, incl. snooze/reschedule/note/prompted
    storage.js             defensive localStorage adapter (tasks + composer draft)
    demoTodos.js           the "Load demo data" set, positioned relative to now
  utils/
    date.js                calendar-day helpers + dueAt timestamp helpers
    nlp.js                 natural-language parsing for tasks and replies
    todoFilters.js         tabs, sorting, stats, urgent + reminder selectors
```

## Data model

State is a plain array of todos; the storage key is `todo-webapp:v1`.

```js
{
  id: 'e0b1…',                        // string, stable React key
  title: 'Water the plants',          // string, required
  description: 'Back porch too',      // notes, '' when empty; voice notes append here
  priority: 'high',                   // 'low' | 'medium' | 'high'
  dueAt: '2026-10-01T16:00:00.000Z',  // ISO timestamp, or null — a moment, not a day
  tags: ['home'],                     // de-duplicated, capped at 3
  completed: false,
  createdAt: '2026-09-28T12:00:00.000Z',
  promptedAt: null                    // when the reminder last fired for this moment
}
```

Reminders need a time, not a date, so `dueAt` replaced the old day-only `dueDate`. Data written by
earlier versions is upgraded on read: a `dueDate` of `2026-10-01` becomes that day at 09:00 local.
Stored data is sanitized on read — corrupted JSON, unknown priorities, impossible dates
(`2026-02-30`), the legacy `{ todos: [...] }` shape and entries without a title are all handled
without crashing the UI.

## Architecture notes

- **Pure core, thin UI.** `todoReducer`, `date`, `nlp` and `todoFilters` contain no React imports,
  so the fuzzy parts — natural-language parsing above all — are unit tested directly.
- **The voice hooks own timing, not state.** `useReminders` decides *when* to ask and handles the
  speak/listen cycle, then hands the parsed intent back to `App`, which owns every dispatch. That
  keeps a single place where tasks change, and it is why a voice completion gets the same undo
  toast as a clicked one.
- **One microphone, two callers.** The composer and the reminder reply share a single recognition
  session; `listenTarget` decides whose transcript is on screen, and starting a new session always
  tears down the old one.
- **One prompt at a time.** A backlog of overdue tasks is worked through one question at a time
  rather than all at once, and `promptedAt` is persisted so a reload does not re-ask. The 30-second
  sweep is the floor, not the latency: the queue going from empty to non-empty sweeps immediately,
  so a task that has just been added or snoozed into the past is asked about at once.
- **Date safety.** Day-level grouping still compares local midnights, so "Tomorrow" stays correct
  across DST; the reminder sweep compares absolute timestamps.

## Tests

`npm test` runs Node's built-in test runner over `src/**/*.test.js` (no extra dependencies):

| File | Covers |
| --- | --- |
| `src/utils/nlp.test.js` | task parsing (times, days, offsets, priorities, preamble stripping) and reply parsing (yes/no/reschedule/note) |
| `src/state/todoReducer.test.js` | tag normalisation, creation defaults, validation, every action incl. snooze/reschedule/notes, legacy `dueDate` upgrade |
| `src/state/storage.test.js` | persistence round-trip, corrupted/legacy/invalid payloads, draft round-trip, throwing or missing `localStorage` |
| `src/state/demoTodos.test.js` | demo data fills every tab, includes an overdue task, unique ids, idempotent re-loading |
| `src/utils/date.test.js` | ISO validation (`2026-02-30` rejected), day maths, due labels, overdue rules |
| `src/utils/todoFilters.test.js` | tab rules, search, sort modes (incl. non-mutation), stats, urgent window, reminder queue |

## Possible next steps

- Recurring tasks ("every weekday at 9").
- Reminders that fire with the tab closed (a periodic background sync or a push service).
- Sync across devices (would need a backend).
