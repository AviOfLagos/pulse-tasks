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
 * One-shot dictation.
 *
 * `listen()` resolves with the transcript, or null when nothing was heard
 * (no speech, denied mic, timeout, unsupported browser). A fresh recognition
 * object is created per call: reusing one across sessions is where Chrome's
 * "already started" and stuck-listening bugs come from.
 */
export function useSpeechRecognition() {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')

  const activeRef = useRef(null)
  const timerRef = useRef(null)

  const supported = useMemo(() => getRecognitionClass() !== null, [])

  const teardown = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = null

    const recognition = activeRef.current
    activeRef.current = null
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

    setListening(false)
  }, [])

  useEffect(() => teardown, [teardown])

  const stop = useCallback(() => {
    const recognition = activeRef.current
    if (!recognition) return

    try {
      // `stop` (unlike `abort`) still delivers whatever was heard so far.
      recognition.stop()
    } catch {
      teardown()
    }
  }, [teardown])

  const listen = useCallback(
    (timeoutMs = 10_000) => {
      const Recognition = getRecognitionClass()
      if (!Recognition) {
        setError('This browser has no speech recognition.')
        return Promise.resolve(null)
      }

      // Never run two sessions at once.
      teardown()

      setError('')
      setTranscript('')
      setListening(true)

      return new Promise((resolve) => {
        const recognition = new Recognition()
        activeRef.current = recognition

        recognition.lang = navigator.language || 'en-US'
        recognition.continuous = false
        recognition.interimResults = true
        recognition.maxAlternatives = 1

        let finalText = ''
        let settled = false

        const finish = (value) => {
          if (settled) return
          settled = true
          teardown()
          resolve(value)
        }

        recognition.onresult = (event) => {
          let interim = ''

          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const result = event.results[i]
            if (result.isFinal) finalText += result[0].transcript
            else interim += result[0].transcript
          }

          setTranscript((finalText + interim).trim())
        }

        recognition.onerror = (event) => {
          const code = event.error
          if (code === 'not-allowed' || code === 'service-not-allowed') {
            setError('Microphone access is blocked. Enable it in your browser settings.')
          } else if (code === 'no-speech') {
            setError('Did not catch that.')
          } else if (code !== 'aborted') {
            setError('Speech recognition failed. Try typing instead.')
          }

          finish(finalText.trim() || null)
        }

        recognition.onend = () => finish(finalText.trim() || null)

        try {
          recognition.start()
        } catch {
          setError('Could not start the microphone.')
          finish(null)
          return
        }

        timerRef.current = setTimeout(() => {
          try {
            recognition.stop()
          } catch {
            finish(finalText.trim() || null)
          }
        }, timeoutMs)
      })
    },
    [teardown],
  )

  return { supported, listening, transcript, error, listen, stop, reset: teardown }
}

/**
 * Text to speech. `speak()` resolves once the utterance finishes (or fails), so
 * the reminder flow can wait for the question to be *said* before it starts
 * listening for the answer — otherwise the mic hears the app itself.
 */
export function useSpeechSynthesis() {
  const [speaking, setSpeaking] = useState(false)

  const supported = useMemo(
    () => typeof window !== 'undefined' && 'speechSynthesis' in window,
    [],
  )

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
        utterance.rate = 1
        utterance.pitch = 1

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
    [supported],
  )

  return { supported, speaking, speak, cancel }
}
