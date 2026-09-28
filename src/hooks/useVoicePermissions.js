import { useCallback, useEffect, useState } from 'react'

import { VOICE_CONSENT_KEY } from '../constants.js'

/**
 * Microphone + notification permission, asked for once, with an explainer the
 * user sees *before* the browser's own dialog.
 *
 * Nothing is requested on load: `granted` stays false until the user presses
 * the mic or turns reminders on, at which point `request()` runs. The fact that
 * they have already seen the explainer is remembered in localStorage so it does
 * not reappear on every visit.
 */

function readConsent() {
  try {
    return localStorage.getItem(VOICE_CONSENT_KEY) === 'granted'
  } catch {
    return false
  }
}

function writeConsent() {
  try {
    localStorage.setItem(VOICE_CONSENT_KEY, 'granted')
  } catch {
    /* private mode — the explainer just shows again next time */
  }
}

export function useVoicePermissions() {
  const [mic, setMic] = useState('unknown') // unknown | granted | denied
  const [notifications, setNotifications] = useState(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  )
  const [asked, setAsked] = useState(readConsent)
  const [explainerOpen, setExplainerOpen] = useState(false)

  // Read the mic state without prompting, where the browser allows it.
  useEffect(() => {
    let cancelled = false

    if (!navigator.permissions?.query) return undefined

    navigator.permissions
      .query({ name: 'microphone' })
      .then((status) => {
        if (cancelled) return

        const apply = () => setMic(status.state === 'prompt' ? 'unknown' : status.state)
        apply()
        status.onchange = apply
      })
      .catch(() => {
        /* Firefox rejects the microphone descriptor — stay 'unknown'. */
      })

    return () => {
      cancelled = true
    }
  }, [])

  /** Does the real asking: getUserMedia for the mic, then notifications. */
  const request = useCallback(async () => {
    let granted = false

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // We only needed the permission, not the audio — release the device.
      stream.getTracks().forEach((track) => track.stop())
      granted = true
      setMic('granted')
    } catch {
      setMic('denied')
    }

    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try {
        setNotifications(await Notification.requestPermission())
      } catch {
        setNotifications(Notification.permission)
      }
    }

    setAsked(true)
    writeConsent()
    setExplainerOpen(false)

    return granted
  }, [])

  /**
   * Gate a voice action behind the explainer.
   * Returns true when the caller may go ahead immediately.
   */
  const ensure = useCallback(() => {
    if (asked || mic === 'granted') return true

    setExplainerOpen(true)
    return false
  }, [asked, mic])

  const dismissExplainer = useCallback(() => setExplainerOpen(false), [])

  /** Desktop notification for a due reminder, when it is allowed. */
  const notify = useCallback(
    (title, body) => {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

      try {
        new Notification(title, { body, tag: 'pulse-reminder', icon: '/icon.svg' })
      } catch {
        /* some browsers only allow notifications from a service worker */
      }
    },
    [],
  )

  return {
    mic,
    notifications,
    asked,
    explainerOpen,
    request,
    ensure,
    dismissExplainer,
    notify,
  }
}
