import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * Web Speech API wrappers. No paid services, no dependencies — everything here
 * is the browser's own `SpeechRecognition` and `speechSynthesis`.
 *
 * Both hooks are written so the rest of the app never has to feature-detect:
 * when the API is missing, `supported` is false and the calls resolve to a
 * harmless value, which is what makes the on-screen fallbacks work in Firefox.
 */

function getRecognitionClass() {
  if (typeof window === 'undefined') return null

  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

/**
 * Dictation.
 *
 * `listen()` resolves with the transcript, or null when nothing was heard.
 *
 * The important part is that it *keeps* listening. Chrome ends a recognition
 * session on the first pause — including the pause before you have started
 * talking — which made the mic look like it closed the moment it opened. So a
 * session here is a deadline, not a single recogniser: when the browser ends
 * one early we start another until the deadline passes, the user stops it, or
 * a real phrase has landed and gone quiet.
 *
 * A fresh recogniser per attempt is deliberate: reusing one across sessions is
 * where Chrome's "already started" and stuck-listening bugs come from.
 */

/** How long to wait after a final phrase before assuming the user is done. */
const SILENCE_AFTER_SPEECH_MS = 1200

/** A restart this soon after starting means the mic never really opened. */
const FAILED_START_MS = 400

export function useSpeechRecognition() {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')

  const sessionRef = useRef(null)

  const supported = useMemo(() => getRecognitionClass() !== null, [])

  /** Ends whatever is running right now, resolving it with what it heard. */
  const abandon = useCallback(() => {
    sessionRef.current?.settle(sessionRef.current.finalText.trim() || null)
  }, [])

  useEffect(() => abandon, [abandon])

  const stop = useCallback(() => {
    const session = sessionRef.current
    if (!session) return

    session.stopping = true
    try {
      // `stop` (unlike `abort`) still delivers whatever was heard so far.
      session.recognition?.stop()
    } catch {
      session.settle(session.finalText.trim() || null)
    }
  }, [])

  const listen = useCallback(
    (timeoutMs = 15_000) => {
      const Recognition = getRecognitionClass()
      if (!Recognition) {
        setError('This browser has no speech recognition.')
        return Promise.resolve(null)
      }

      // Never run two sessions at once.
      abandon()

      setError('')
      setTranscript('')
      setListening(true)

      return new Promise((resolve) => {
        const session = {
          finalText: '',
          settled: false,
          stopping: false,
          failedStarts: 0,
          deadline: Date.now() + timeoutMs,
          recognition: null,
          timers: [],
        }

        const clearTimers = () => {
          session.timers.forEach(clearTimeout)
          session.timers = []
        }

        session.settle = (value) => {
          if (session.settled) return
          session.settled = true

          clearTimers()

          const recognition = session.recognition
          session.recognition = null
          if (recognition) {
            recognition.onresult = null
            recognition.onerror = null
            recognition.onend = null
            try {
              recognition.abort()
            } catch {
              /* already stopped */
            }
          }

          if (sessionRef.current === session) sessionRef.current = null
          setListening(false)
          resolve(value)
        }

        sessionRef.current = session

        const finish = () => {
          session.stopping = true
          try {
            session.recognition?.stop()
          } catch {
            session.settle(session.finalText.trim() || null)
          }
        }

        const start = () => {
          const recognition = new Recognition()
          session.recognition = recognition
          const startedAt = Date.now()

          recognition.lang = navigator.language || 'en-US'
          // Continuous, so a thinking pause does not end the session.
          recognition.continuous = true
          recognition.interimResults = true
          recognition.maxAlternatives = 1

          recognition.onresult = (event) => {
            let interim = ''

            for (let i = event.resultIndex; i < event.results.length; i += 1) {
              const result = event.results[i]
              if (result.isFinal) session.finalText += result[0].transcript
              else interim += result[0].transcript
            }

            setTranscript((session.finalText + interim).trim())
            session.failedStarts = 0

            // A complete phrase, then quiet: that is the end of the sentence.
            if (session.finalText.trim()) {
              clearTimers()
              session.timers.push(setTimeout(finish, SILENCE_AFTER_SPEECH_MS))
            }
          }

          recognition.onerror = (event) => {
            const code = event.error

            if (code === 'not-allowed' || code === 'service-not-allowed') {
              setError('Microphone access is blocked. Enable it in your browser settings.')
              session.settle(null)
              return
            }

            if (code === 'audio-capture') {
              setError('No microphone was found.')
              session.settle(null)
              return
            }

            // 'no-speech', 'network' and 'aborted' are all survivable — let
            // `onend` decide whether there is still time to try again.
          }

          recognition.onend = () => {
            if (session.settled) return

            if (session.stopping) {
              session.settle(session.finalText.trim() || null)
              return
            }

            // A session that ended almost immediately never really opened. A
            // few of those in a row means restarting will not help.
            if (Date.now() - startedAt < FAILED_START_MS) session.failedStarts += 1

            if (session.failedStarts >= 3) {
              setError('The microphone kept closing. Check it is not in use elsewhere.')
              session.settle(session.finalText.trim() || null)
              return
            }

            if (Date.now() < session.deadline) {
              try {
                start()
                return
              } catch {
                /* fall through to settling */
              }
            }

            if (!session.finalText.trim()) setError('Did not catch that.')
            session.settle(session.finalText.trim() || null)
          }

          try {
            recognition.start()
          } catch {
            setError('Could not start the microphone.')
            session.settle(null)
          }
        }

        session.timers.push(setTimeout(finish, timeoutMs))
        start()
      })
    },
    [abandon],
  )

  return { supported, listening, transcript, error, listen, stop, reset: abandon }
}

/**
 * Text to speech. `speak()` resolves once the utterance finishes (or fails), so
 * the reminder flow can wait for the question to be *said* before it starts
 * listening for the answer — otherwise the mic hears the app itself.
 *
 * The voice and rate come from settings rather than each call site, so there is
 * one place that decides how the app sounds.
 */
export function useSpeechSynthesis({ voiceURI = '', rate = 1 } = {}) {
  const [speaking, setSpeaking] = useState(false)
  const [voices, setVoices] = useState([])

  const supported = useMemo(
    () => typeof window !== 'undefined' && 'speechSynthesis' in window,
    [],
  )

  // The voice list is populated asynchronously and is empty on the first call
  // in most browsers, so read it again when the browser says it has changed.
  useEffect(() => {
    if (!supported) return undefined

    const read = () => setVoices(window.speechSynthesis.getVoices())

    read()
    window.speechSynthesis.addEventListener('voiceschanged', read)

    return () => window.speechSynthesis.removeEventListener('voiceschanged', read)
  }, [supported])

  const cancel = useCallback(() => {
    if (!supported) return

    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [supported])

  useEffect(() => cancel, [cancel])

  const speak = useCallback(
    (text) => {
      const line = String(text ?? '').trim()
      if (!supported || !line) return Promise.resolve(false)

      window.speechSynthesis.cancel()

      return new Promise((resolve) => {
        const utterance = new SpeechSynthesisUtterance(line)
        utterance.lang = navigator.language || 'en-US'
        utterance.rate = rate
        utterance.pitch = 1

        const chosen = voiceURI
          ? window.speechSynthesis.getVoices().find((voice) => voice.voiceURI === voiceURI)
          : null
        if (chosen) utterance.voice = chosen

        let settled = false
        const finish = (value) => {
          if (settled) return
          settled = true
          setSpeaking(false)
          resolve(value)
        }

        utterance.onend = () => finish(true)
        utterance.onerror = () => finish(false)

        setSpeaking(true)
        window.speechSynthesis.speak(utterance)

        // Safety net: some browsers never fire `onend` for a cancelled voice.
        setTimeout(() => finish(true), Math.min(20_000, 2_000 + line.length * 120))
      })
    },
    [rate, supported, voiceURI],
  )

  return { supported, speaking, speak, cancel, voices }
}
