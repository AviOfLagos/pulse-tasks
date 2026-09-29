# Pulse Tasks — voice-first todo app

A fast, accessible **dark + neon** todo app built with **React 19 + Vite 8**. You can type a task
or say it; when a task falls due the app asks you out loud whether it is done, and listens for the
answer. Everything is stored in the browser (`localStorage`) — no backend, no account, no keys.
Voice uses the **Web Speech API** built into the browser, so there is nothing to pay for.

![stack](https://img.shields.io/badge/React-19-149eca) ![stack](https://img.shields.io/badge/Vite-8-646cff) ![tests](https://img.shields.io/badge/tests-node--test-5fa04e) ![pwa](https://img.shields.io/badge/PWA-installable-39FF88)

## Features

### Voice

- **Say a task, then confirm it.** Press the mic and speak. "Call mum tomorrow 5pm, urgent" is
  parsed into *Call mum*, due tomorrow at 17:00, priority high — and then **read back** rather than
  created: *"Add 'Call mum' for tomorrow 5:00 PM? Say yes or no."* Answer "yes" / "add it" to
  create it, "no" / "cancel" to discard, or "change time to 8pm" to correct it and be asked again.
  Every field on the card is editable, and the buttons (**Add ✓ / Edit ✎ / Cancel ✕**) do the same
  job when you would rather not talk. Dictation is a guess twice over — what was heard, then what
  the parser made of it — so nothing reaches the list unconfirmed. The parser understands times
  (`5pm`, `5:30 pm`, `17:00`, `at 6`), days (`today`, `tonight`, `tomorrow`, `friday`, `next week`,
  `next month`), calendar dates (`12 Oct`, `3rd of April 2027`, `October 12`, `on the 3rd`,
  `12/10/2026`, `2026-10-12`), relative offsets (`in 30 minutes`, `in 2 hours`, `in 3 days`), parts
  of the day (`morning`, `evening`, `midnight`) and urgency words (`urgent`, `asap`, `someday`). Typed input goes through
  exactly the same parser, and a live preview shows what was understood before you press **Add**.
- **Spoken due reminders.** Every 30 seconds the app looks for a task that is due, unfinished and
  not yet asked about. It says *"It's 5:00 PM. Have you water the plants?"*, then listens:

  | You say | What happens |
  | --- | --- |
  | "yes" / "done" / "did it" | marked complete (undoable for 5s) |
  | "no" / "later" / "not yet" | snoozed 15 minutes |
  | "change it to 6pm" | due time moved, and it becomes askable again |
  | "add note bring the receipt" | appended to the task's notes |

- **Edit by voice.** "Change water the plants to 7pm" reschedules; "edit buy milk to buy oat milk"
  renames; a rename can carry a new time and priority too. The task is matched by title, loosely —
  and if the match is not good enough, nothing happens, because acting on the wrong task is worse
  than admitting the name was not caught.
- **The mic stays open while you think.** Chrome ends a recognition session at the first pause —
  including the pause *before* you start talking, which made the mic look like it closed on its
  own. A listening window here is a deadline, not a single recogniser: when the browser ends one
  early, another starts, until the deadline passes, you stop it, or a phrase has landed and gone
  quiet. Sessions that die instantly three times in a row stop rather than spin, and say so.
- **Always a fallback.** The same question appears as an on-screen card with **Yes, done** and
  **Snooze 15m** buttons. It stays up until answered, so the feature still works when speech is
  unsupported (Firefox), the mic is denied, or the reply was not understood.
- **Permission with an explainer.** Nothing is requested on load. The first time you use voice you
  get a plain-language dialog about what the microphone and notifications are for, and only then
  the browser's own prompts. Auto-listening after a reminder is deliberately gated behind a
  microphone you have already granted — a page that asks for your mic while you are not touching it
  is a page people block for good.

### Borrowed from Obsidian

- **Nested tags, not folders.** Tag a task `#work/clients/vettika` — typed, or spoken as
  "under work slash clients". The left rail draws them as a collapsible tree with counts, so it
  reads like a folder pane, and clicking a branch includes everything beneath it. Tags rather than
  folders because a folder gives a task exactly one home, and a task is usually "work" *and*
  "vettika" *and* "billing" at once. Adding a task while a branch is selected files it there.
- **Quick switcher (⌘K / Ctrl+K).** Type a few letters and jump: the match is a subsequence, so
  "wtp" finds *Water the plants*, and tags are searched alongside titles. Picking a task drops every
  filter that could be hiding it, moves to its tab and focuses the row. A query that matches
  nothing still offers to create it.

### Reading a plain instruction

Type or say a sentence; the parser pulls out what it can and shows you before anything is created.

- **Dates that do not exist are refused, not rounded.** "launch 30th of Feb 3030" leaves the due
  date empty, keeps the words in the title and says *“30th of feb 3030” is not a real date* —
  because `new Date(3030, 1, 30)` quietly becomes 2 March, and a plausible wrong date is worse than
  no date. A year in the past with no year given rolls forward: in September, "3 March" means next
  year.
- **A tag is guessed from the words.** "send the invoice" suggests `work/clients`, "book the
  dentist" suggests `health`, "water the plants" suggests `home/garden`. It is a keyword table, not
  a model: it runs offline on every keystroke and, more importantly, it is predictable. A wrong
  guess you can see coming is a small annoyance; a clever one you cannot is a filing system you
  stop trusting.
- **A local model refines the guess, where there is one.** Chrome ships Gemini Nano on-device
  (the Prompt API). When it is available, the task is also sent to it — on the device, no key, no
  network, nothing typed ever leaving the browser — and its answer replaces the keyword guess,
  labelled `ai` rather than `suggested`. It is asked once typing settles, given the tags you
  already use so it reuses your vocabulary instead of inventing a parallel one, and its reply is
  JSON-schema constrained *and* re-validated here: anything that is not a plausible tag path is
  dropped rather than shown.
- **The guess never wins over a decision.** An explicit `#tag` beats it, and so does the tag branch
  you are working in. It is shown as a dashed *suggested* chip before you commit, and matching is
  whole-word, so "app" does not fire inside "apparel".

### Settings

**Settings** in the sidebar, above *Load demo data*. One place for the things that used to be
hard-coded or tucked into a corner:

- **Voice** — spoken reminders on or off, which system voice speaks and how fast (with a Test
  button), how long "later" snoozes for, and the microphone and notification permissions with a
  status and a way to grant them.
- **On-device AI** — whether the local model may suggest categories, what the browser currently
  reports, and — when it says unavailable — the exact four steps to turn it on, since the app can
  explain a `chrome://flags` page but cannot open one for you.
- **New tasks** — what hour a bare "tomorrow" means, and the priority a task gets when it does not
  say.
- **Your data** — export every task to JSON, import one back, load the demo set, or delete
  everything behind a confirm. Import *merges*: it adds tasks whose ids you do not already have, so
  importing the same file twice changes nothing and an import can never silently replace your list.

### On-device AI (optional)

| | |
| --- | --- |
| **Needs** | Chrome 148+ on desktop, ~22GB free disk, 16GB RAM, 4+ cores |
| **Costs** | nothing — no API key, no request, no account |
| **Sends** | nothing; the model runs locally after a one-off download |
| **If missing** | the keyword table in `categorise.js` does the job, and nothing else changes |

`LanguageModel.availability()` returns `unavailable` on plenty of otherwise capable machines,
usually because the feature is still behind a flag. To turn it on: `chrome://flags/#prompt-api` →
*Enabled* (on Chrome 140 and older the flag is `#prompt-api-for-gemini-nano`), relaunch, then
`chrome://on-device-internals` to watch the model download. The app shows an **Enable on-device AI** button when the browser reports the
model as downloadable, because the first download is several gigabytes and needs a deliberate
click rather than a page load.

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
- **Every row** — checkbox, title, due-time chip, priority dot (red / amber / green). Click the
  title (or the ✎) to edit title, due date/time, priority and notes inline; Enter or **Save**
  commits, Escape or **Cancel** discards, and focus returns to the Edit button.
- **Two-week calendar** — this week and next, rather than a six-row month most of which you are
  never going to touch. Days with tasks get a neon dot, days with overdue work get a red one, and
  today keeps a green ring wherever you page to. Click a day to filter the list to it
  (*Showing: Tue 29*, with a ✕ to clear); new tasks then default to that day.
- **Top nav** — sticky, so it is there wherever you have scrolled to: the completion bar, a
  **+ New** button that drops you in the composer, and a bell
  badged with how many tasks are due. Pressing the bell raises the reminder for the next one, so a
  due task never waits on the 30-second sweep and voice can stay switched off.
- **Undo toast (5s)** after a delete or a completion, including completions made by voice.
- **Keyboard**: <kbd>⌘K</kbd> quick switcher · <kbd>N</kbd> new task · <kbd>/</kbd> search ·
  <kbd>Space</kbd> complete the focused row · <kbd>Esc</kbd> stop listening / dismiss.
- **Installable PWA** — manifest, icons, and a service worker that keeps the app opening offline.

## Design

| Token | Value | Used for |
| --- | --- | --- |
| `--bg` | `#0B0F0E` | page |
| `--card` | `#141A18` | cards and the composer |
| `--border` | `#1F2A26` | hairlines |
| `--text` | `#E6E6E6` | body text |
| `--muted` | `#9AA5A0` | secondary text, chips |
| `--accent` | `#39FF88` | **only** the primary button, the active tab, the progress ring, calendar dots, the selected tag and focus rings |

Spacing runs on an 8px scale, cards use a 12px radius, and the base font is 16px.

## Layout

An app shell: a full-height tag navbar on the left, and to its right the top bar, the composer and
a workspace of list + side rail. The workspace is the part that reflows.

| Width | Columns |
| --- | --- |
| ≥ 1500px | **four** — navbar, list, calendar, needs attention (the rail splits) |
| 1180–1500px | three — navbar, list, rail |
| 980–1180px | three, with a narrower navbar |
| 760–980px | two — the navbar folds into a row of tag chips above the content |
| < 760px | one — chips scroll horizontally, the rail stacks under the list |

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
    Sidebar.jsx            left navbar: wordmark, tag tree, settings
    SettingsDialog.jsx     voice, AI, defaults and import/export
    AppHeader.jsx          top nav: clock, progress, + New, bell, reminder switch
    ProgressBar.jsx        completion bar for the top nav
    TaskComposer.jsx       big input + mic + Add, with a live parse preview
    MicButton.jsx          shared mic control with the listening pulse
    TagTree.jsx            collapsible nested-tag rail
    QuickSwitcher.jsx      ⌘K jump-to-task palette
    MiniCalendar.jsx       two-week strip, task dots, day filter
    ConfirmCard.jsx        read-back card for a dictated task
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
    useSpeech.js           SpeechRecognition (restarts until its deadline) / speechSynthesis
    useLocalAI.js          Chrome Prompt API session lifecycle, download and suggestion
    useSettings.js         settings state, persisted like the tasks are
    useVoicePermissions.js mic + notification permission, asked once
    useReminders.js        the 30-second due sweep and the ask/listen cycle
    useShortcuts.js        N / · Space, ignored while typing
  state/
    settings.js            defaults, validation and persistence for settings
    todoReducer.js         pure store, incl. snooze/reschedule/note/prompted
    storage.js             defensive localStorage adapter (tasks + composer draft)
    demoTodos.js           the "Load demo data" set, positioned relative to now
  utils/
    date.js                calendar-day helpers + dueAt timestamp helpers
    nlp.js                 parsing for tasks, replies, confirmations, edits and tags
    tags.js                nested-tag paths, matching and the sidebar tree
    categorise.js          keyword table behind the suggested tag
    aiTagger.js            prompts, JSON schema and validation for the on-device model
    backup.js              export, import and the merge that makes import safe
    rank.js                subsequence ranking for the quick switcher
    todoFilters.js         tabs, sorting, stats, calendar index, urgent + reminder selectors
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
- **One microphone, three callers.** The composer, the confirmation card and the reminder reply
  share a single recognition session; `listenTarget` decides whose transcript is on screen, and
  starting a new session always tears down the old one. Reminders pause while a confirmation is
  open, so two cards never talk over each other.
- **A picked day replaces the tab; a picked tag narrows it.** "Everything on Monday" is a different
  question from "everything due today", so a calendar day overrides the tab rather than intersecting
  with it. A tag is a different axis entirely, so it narrows whatever the tab or day already chose.
- **Tags are paths, matched by prefix.** `work` matches `work/clients/vettika` because the filter
  compares whole segments — which is why the tree can count a task once at every level it belongs
  to without storing anything but the tag string.
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
| `src/utils/nlp.test.js` | task parsing (times, days, offsets, priorities, preamble stripping), reply parsing (yes/no/reschedule/note), confirmations, edit commands and loose title matching |
| `src/state/todoReducer.test.js` | tag normalisation, creation defaults, validation, every action incl. snooze/reschedule/notes, legacy `dueDate` upgrade |
| `src/state/storage.test.js` | persistence round-trip, corrupted/legacy/invalid payloads, draft round-trip, throwing or missing `localStorage` |
| `src/state/demoTodos.test.js` | demo data fills every tab, includes an overdue task, unique ids, idempotent re-loading |
| `src/state/settings.test.js` | defaults for junk input, clamping a speech rate, rejecting an unoffered snooze length or an unknown priority |
| `src/utils/backup.test.js` | round-tripping an export, hand-edited files, partial recovery, and that importing twice adds nothing |
| `src/utils/aiTagger.test.js` | prompt construction, vocabulary cap, and validating what a small model actually returns (prose, junk, empty, over-deep paths) |
| `src/utils/categorise.test.js` | whole-word matching, specificity, returning nothing rather than guessing |
| `src/utils/tags.test.js` | path splitting, branch matching (a parent includes its children), tree shape and per-node counts |
| `src/utils/rank.test.js` | subsequence matching, word-start ranking, tie-breaking, tag search, empty query |
| `src/utils/date.test.js` | ISO validation (`2026-02-30` rejected), day maths, due labels, overdue rules |
| `src/utils/todoFilters.test.js` | tab rules, search, sort modes (incl. non-mutation), stats, urgent window, reminder queue, calendar day index |

## Possible next steps

- Recurring tasks ("every weekday at 9").
- Reminders that fire with the tab closed (a periodic background sync or a push service).
- Sync across devices (would need a backend).
