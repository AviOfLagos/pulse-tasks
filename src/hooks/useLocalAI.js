import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  TAG_SCHEMA,
  buildSystemPrompt,
  buildTaskPrompt,
  isWorthAsking,
  parseAiResult,
} from '../utils/aiTagger.js'

/**
 * Chrome's built-in Prompt API (Gemini Nano), used to guess a task's category.
 *
 * It runs on the device: no key, no network after the first download, and no
 * task text leaves the browser. It is also unavailable on most machines, so
 * every path here degrades to "no suggestion" and the keyword table in
 * `categorise.js` remains the thing that always works.
 *
 * Session handling follows the API's own guidance: one base session holding the
 * system prompt, created when the user shows intent (focusing the composer),
 * then a clone per request so one task's answer cannot colour the next.
 */

/** 'unsupported' | 'unavailable' | 'downloadable' | 'downloading' | 'ready'. */
function readClass() {
  return typeof window !== 'undefined' && typeof window.LanguageModel !== 'undefined'
    ? window.LanguageModel
    : null
}

export function useLocalAI({ knownTags = [], enabled = true } = {}) {
  const [status, setStatus] = useState('unsupported')
  const [progress, setProgress] = useState(0)

  const baseRef = useRef(null)
  const abortRef = useRef(null)
  // The vocabulary is baked into the base session at creation, so changing it
  // later has to rebuild that session rather than the next prompt.
  const vocabularyRef = useRef('')

  const supported = useMemo(() => readClass() !== null, [])

  useEffect(() => {
    const LanguageModel = readClass()
    if (!LanguageModel || !enabled) return undefined

    let cancelled = false

    LanguageModel.availability()
      .then((availability) => {
        if (cancelled) return

        setStatus(
          availability === 'available'
            ? 'ready'
            : availability === 'downloading'
              ? 'downloading'
              : availability === 'downloadable'
                ? 'downloadable'
                : 'unavailable',
        )
      })
      .catch(() => {
        if (!cancelled) setStatus('unavailable')
      })

    return () => {
      cancelled = true
    }
  }, [supported, enabled])

  const destroy = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null

    try {
      baseRef.current?.destroy()
    } catch {
      /* already gone */
    }
    baseRef.current = null
  }, [])

  useEffect(() => destroy, [destroy])

  /**
   * Creates the base session. Safe to call repeatedly — it is a no-op once the
   * session exists and the vocabulary has not changed.
   *
   * `download` must come from a user gesture: the first call pulls a model of
   * several gigabytes, which the browser will not start on its own.
   */
  const warmUp = useCallback(
    async ({ download = false } = {}) => {
      const LanguageModel = readClass()
      if (!LanguageModel || !enabled) return null

      const vocabulary = knownTags.join(',')
      if (baseRef.current && vocabularyRef.current === vocabulary) return baseRef.current

      const availability = await LanguageModel.availability().catch(() => 'unavailable')
      if (availability === 'unavailable') {
        setStatus('unavailable')
        return null
      }

      // Downloading is the user's call, not ours.
      if (availability !== 'available' && !download) {
        setStatus(availability === 'downloading' ? 'downloading' : 'downloadable')
        return null
      }

      destroy()
      setStatus(availability === 'available' ? 'ready' : 'downloading')

      try {
        const session = await LanguageModel.create({
          initialPrompts: [{ role: 'system', content: buildSystemPrompt(knownTags) }],
          monitor(monitor) {
            monitor.addEventListener('downloadprogress', (event) => {
              setProgress(Math.round((event.loaded ?? 0) * 100))
            })
          },
        })

        baseRef.current = session
        vocabularyRef.current = vocabulary
        setStatus('ready')
        return session
      } catch {
        setStatus('unavailable')
        return null
      }
    },
    [destroy, enabled, knownTags],
  )

  /**
   * Asks about one task. Returns `{ tag, priority }`, either of which may be
   * null, or null when the model could not be reached at all. A new call
   * cancels the one before it, because the text has moved on.
   */
  const suggest = useCallback(
    async (text) => {
      if (!enabled || !isWorthAsking(text)) return null

      const base = await warmUp()
      if (!base) return null

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      let clone
      try {
        // A clone per task: the base holds the rules, nothing else, so one
        // task's answer cannot colour the next.
        clone = await base.clone({ signal: controller.signal })

        const raw = await clone.prompt(buildTaskPrompt(text), {
          responseConstraint: TAG_SCHEMA,
          signal: controller.signal,
        })

        return parseAiResult(raw)
      } catch {
        return null
      } finally {
        try {
          clone?.destroy()
        } catch {
          /* already gone */
        }
        if (abortRef.current === controller) abortRef.current = null
      }
    },
    [enabled, warmUp],
  )

  return {
    supported,
    status,
    progress,
    /** Call on a user gesture to allow the first (large) model download. */
    enable: () => warmUp({ download: true }),
    /** Call when the user shows intent, to avoid a cold start later. */
    warmUp: () => warmUp(),
    suggest,
  }
}
