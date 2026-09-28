# pulse tasks — Todo Web App

A fast, accessible **dark + neon** todo app built with **React 19 + Vite 8**. Everything is stored
in the browser (`localStorage`) — no backend, no account, no build-time configuration.

![stack](https://img.shields.io/badge/React-19-149eca) ![stack](https://img.shields.io/badge/Vite-8-646cff) ![tests](https://img.shields.io/badge/tests-node--test-5fa04e)

## Features

- **Quick add** — one big input, Enter to save. Notes, priority, due date and tags live behind a
  *Details* toggle so the common case is a single line.
- **Two simple tabs** — *To do* (urgent work on top) and *Done* (your completed history, newest
  first), each with a live count. A small search covers titles, notes and tags.
- **Needs attention panel** — active tasks due within 7 days, nearest first, with countdown chips.
  Expired items **drop off the panel automatically** on a 30-second clock tick (they stay in the
  list, flagged overdue).
- **Complete / inline edit / delete** — Escape cancels editing, focus returns to the Edit button,
  and every destructive action shows an **Undo** toast for 8 seconds.
- **Progress card** — big neon percentage, `progressbar` semantics, live to-do/done counts.
- **Dark neon theme** — near-black surfaces, neon-green accents with glow, priority-coded borders
  and badges, reduced-motion support, fully responsive (sidebar reflows below the list on mobile).
- **Accessible by default**: labelled inputs, `tablist` navigation, `progressbar`, and a
  screen-reader-only `aria-live` region that announces every change.

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

## Project structure

```
index.html                 app shell (single mount point)
vite.config.js             React plugin + dev/preview ports
src/
  main.jsx                 React entry point
  App.jsx                  layout (main column + sidebar), tab/search state, clock tick, undo toast
  index.css                dark neon design tokens + components (responsive)
  constants.js             priorities, tabs, urgent window, clock tick, storage key
  components/
    TodoForm.jsx           quick-add bar with collapsible details + validation
    TodoFields.jsx         shared field markup + draft <-> payload helpers
    TodoTabs.jsx           To do / Done tabs with counts
    UrgentPanel.jsx        "Needs attention" sidebar panel with countdown chips
    TodoItem.jsx           one task: toggle, inline edit, delete, focus management
    TodoList.jsx           ordered list of tasks
    StatsBar.jsx           neon progress card (percent + counts)
    EmptyState.jsx         context-aware placeholder with blinking cursor
  hooks/
    useTodos.js            useReducer + persist on change
  state/
    todoReducer.js         pure store: add/update/toggle/toggle-all/remove/clear/replace
    storage.js             defensive localStorage adapter
  utils/
    date.js                due-date parsing, "Due tomorrow", overdue maths
    todoFilters.js         filtering, sorting, stats, urgent selector
```

## Data model

State is a plain array of todos; the storage key is `todo-webapp:v1`.

```js
{
  id: 'e0b1…',            // string, stable React key
  title: 'Ship stage 1',  // string, required
  description: '…',       // string, '' when empty
  priority: 'high',       // 'low' | 'medium' | 'high'
  dueDate: '2026-10-01',  // 'YYYY-MM-DD' local calendar date, or null
  tags: ['work'],         // de-duplicated, capped at 3
  completed: false,
  createdAt: '2026-09-28T12:00:00.000Z'
}
```

Stored data is sanitized on read: corrupted JSON, unknown priorities, impossible dates, the legacy
`{ todos: [...] }` shape and entries without a title are all handled without crashing the UI.

## Architecture notes

- **Pure core, thin UI.** `todoReducer`, `date` and `todoFilters` contain no React imports, so the
  behaviour of every mutation — including the urgent selector — is unit tested directly.
- **Single source of truth for mutations.** `App` owns `useTodos()` and wraps each dispatch so a
  change is both announced (`aria-live`) and, for destructive actions, undoable via a `replace`
  action carrying the previous array.
- **Self-cleaning focus panel.** `getUrgentTodos(todos, now)` excludes anything already expired;
  a 30-second interval in `App` refreshes `now`, so items vanish the moment they expire.
- **Draft objects.** Forms work on string-based drafts (`draftFromTodo` / `draftToPayload`), so the
  same `TodoFields` component powers the add form and the inline editor.
- **Date safety.** `YYYY-MM-DD` strings are compared as strings for sorting and converted to local
  midnight for day maths, which keeps "Due tomorrow" correct across DST.

## Tests

`npm test` runs Node's built-in test runner over `src/**/*.test.js` (no extra dependencies):

| File | Covers |
| --- | --- |
| `src/state/todoReducer.test.js` | tag normalisation, creation defaults, input validation, every reducer action, undo snapshots |
| `src/state/storage.test.js` | persistence round-trip, corrupted/legacy/invalid payloads, throwing or missing `localStorage` |
| `src/utils/date.test.js` | ISO validation (`2026-02-30` rejected), day maths, friendly due-date labels, overdue rules |
| `src/utils/todoFilters.test.js` | status filters, search, sort modes (incl. non-mutation), stats, urgent window + auto-expiry |

## Possible next steps

- Task reordering via drag and drop.
- Recurring tasks and reminders (with real times, not just calendar dates).
- Sync across devices (would need a backend or a sync service).

