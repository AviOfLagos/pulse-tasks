import { useCallback, useEffect, useRef, useState } from 'react'

import { CLOCK_TICK_MS, REPLY_LISTEN_MS } from '../constants.js'
import { formatClockTime } from '../utils/date.js'
import { parseReply } from '../utils/nlp.js'
import { getDueReminders } from '../utils/todoFilters.js'

/** "Water the plants" → "water the plants"; "Call Ada" and "RSVP" keep their caps. */
function softenTitle(title) {
  const [first = ''] = String(title).split(' ')
  const isAcronymOrName = first.length > 1 && /[A-Z]/.test(first.slice(1))

  return isAcronymOrName ? title : title.charAt(0).toLowerCase() + title.slice(1)
}

/**
 * The due-reminder loop.
 *
 * Every CLOCK_TICK_MS (30s) it looks for a task that is due, unfinished and has
 * not been asked about yet. It then:
 *   1. marks it prompted, so the next sweep does not ask again
 *   2. speaks "It's 5:00 PM. Have you water the plants?"
 *   3. listens for a spoken answer and hands the parsed intent back
 *   4. leaves the on-screen card up either way — the card, with its Yes and
 *      Snooze buttons, is the fallback when speech is unsupported, denied, or
 *      simply not understood
 *
 * Only one prompt is ever live: `promptRef` blocks the sweep until the card is
 * answered or dismissed, so a pile of overdue tasks is worked through one at a
 * time instead of all shouting at once.
 *
 * This hook owns timing and voice only. Every state change goes back to the
 * caller through `onPrompted` / `onAnswer`.
 */
export function useReminders({
  todos,
  enabled = true,
  speak,
  listen,
  notify,
  onPrompted,
  onAnswer,
}) {
  const [prompt, setPrompt] = useState(null)
  const [heard, setHeard] = useState('')
  const [listeningForReply, setListeningForReply] = useState(false)

  const promptRef = useRef(null)
  const sweepRef = useRef(null)
  const todosRef = useRef(todos)
  const handlers = useRef({ speak, listen, notify, onPrompted, onAnswer })

  todosRef.current = todos
  handlers.current = { speak, listen, notify, onPrompted, onAnswer }

  const clearPrompt = useCallback(() => {
    promptRef.current = null
    setPrompt(null)
    setHeard('')
    setListeningForReply(false)
  }, [])

  /** Applies an answer (spoken or clicked) and closes the card. */
  const resolve = useCallback(
    (result) => {
      const current = promptRef.current
      if (!current || !result || result.intent === 'unknown') return

      handlers.current.onAnswer?.(current, result)

      // A note answers nothing — keep asking whether it is done.
      if (result.intent === 'note') {
        setHeard('')
        return
      }

      clearPrompt()
    },
    [clearPrompt],
  )

  useEffect(() => {
    if (!enabled) {
      clearPrompt()
      return undefined
    }

    let cancelled = false

    const sweep = async () => {
      if (promptRef.current || cancelled) return

      const [next] = getDueReminders(todosRef.current)
      if (!next) return

      // The spec's sentence, with two bits of polish: the clock is *now*
      // (a task can sit overdue for hours before its turn comes up), and the
      // title is lower-cased so "Have you water the plants?" reads as speech
      // rather than as a headline.
      const line = `It's ${formatClockTime(new Date())}. Have you ${softenTitle(next.title)}?`
      const current = { id: next.id, title: next.title, dueAt: next.dueAt, line }

      promptRef.current = current
      setPrompt(current)
      setHeard('')

      handlers.current.onPrompted?.(next)
      handlers.current.notify?.('Pulse Tasks', line)

      await handlers.current.speak?.(line)
      if (cancelled || promptRef.current !== current) return

      setListeningForReply(true)
      const transcript = await handlers.current.listen?.(REPLY_LISTEN_MS)
      setListeningForReply(false)

      if (cancelled || promptRef.current !== current) return

      if (transcript) {
        setHeard(transcript)
        resolve(parseReply(transcript))
      }
      // Nothing understood: the card stays on screen with its buttons.
    }

    sweepRef.current = sweep
    sweep()
    const id = setInterval(sweep, CLOCK_TICK_MS)

    return () => {
      cancelled = true
      sweepRef.current = null
      clearInterval(id)
    }
  }, [enabled, clearPrompt, resolve])

  // A task can join the queue between ticks — a due one is added, or a snooze
  // lands in the past. Sweep as soon as the queue stops being empty instead of
  // sitting out the rest of the interval.
  const hasDueWork = getDueReminders(todos).length > 0

  useEffect(() => {
    if (hasDueWork) sweepRef.current?.()
  }, [hasDueWork])

  return { prompt, heard, listeningForReply, resolve, dismiss: clearPrompt }
}
