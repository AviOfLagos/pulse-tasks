import { useRef, useState } from 'react'

import { PRIORITIES, PRIORITY_LABELS } from '../constants.js'
import { SNOOZE_OPTIONS } from '../state/settings.js'

/**
 * Settings.
 *
 * One place for the things that were previously either hard-coded or hidden in
 * a corner of the UI: how the app speaks, whether it may use the on-device
 * model, what "tomorrow" means, and how to get your tasks out of this browser.
 *
 * The AI section is the reason this exists — the model is unavailable on most
 * machines and the fix is a browser flag, which the app can explain but cannot
 * click for you.
 */

const AI_COPY = {
  unsupported: {
    label: 'Not in this browser',
    detail:
      'The built-in Prompt API is a Chrome feature, on desktop. Everything else in the app works the same without it — categories are guessed from a keyword list instead.',
  },
  unavailable: {
    label: 'Not available yet',
    detail:
      'Chrome has the API but reports no model for this profile. It is usually a flag rather than your hardware.',
  },
  downloadable: {
    label: 'Ready to download',
    detail:
      'Chrome will fetch a local model once — a few gigabytes. After that it runs on your device, offline, and nothing you type is sent anywhere.',
  },
  downloading: { label: 'Downloading…', detail: 'You can keep using the app while this finishes.' },
  ready: {
    label: 'On',
    detail: 'Categories are suggested by the model on your device. Nothing leaves the browser.',
  },
}

function Row({ label, hint, htmlFor, children }) {
  return (
    <div className="setting-row">
      <div className="setting-label">
        <label htmlFor={htmlFor}>{label}</label>
        {hint ? <p className="field-hint">{hint}</p> : null}
      </div>
      <div className="setting-control">{children}</div>
    </div>
  )
}

function Toggle({ id, checked, onChange, label }) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle${checked ? ' is-on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-knob" aria-hidden="true" />
    </button>
  )
}

export default function SettingsDialog({
  settings,
  onChange,
  ai,
  voices,
  permissions,
  taskCount,
  onSpeakTest,
  onLoadDemo,
  onExport,
  onImport,
  onClearAll,
  onClose,
}) {
  const fileRef = useRef(null)
  const [importNote, setImportNote] = useState('')
  const [confirmingClear, setConfirmingClear] = useState(false)

  const aiCopy = AI_COPY[ai.status] ?? AI_COPY.unavailable

  const handleFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setImportNote(await onImport(file))
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="settings-head">
          <h2 id="settings-title">Settings</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close settings">
            ✕
          </button>
        </div>

        <section className="settings-section">
          <h3>Voice</h3>

          <Row
            label="Spoken reminders"
            hint="Ask out loud when a task falls due. The card still appears either way."
            htmlFor="set-reminders"
          >
            <Toggle
              id="set-reminders"
              checked={settings.voiceReminders}
              onChange={(value) => onChange({ voiceReminders: value })}
              label="Spoken reminders"
            />
          </Row>

          <Row label="Voice" hint="Whichever voices your system has installed." htmlFor="set-voice">
            <div className="setting-inline">
              <select
                id="set-voice"
                value={settings.voiceURI}
                onChange={(event) => onChange({ voiceURI: event.target.value })}
              >
                <option value="">Browser default</option>
                {voices.map((voice) => (
                  <option key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onSpeakTest}>
                Test
              </button>
            </div>
          </Row>

          <Row label="Speaking rate" htmlFor="set-rate">
            <div className="setting-inline">
              <input
                id="set-rate"
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={settings.speechRate}
                onChange={(event) => onChange({ speechRate: Number(event.target.value) })}
              />
              <span className="setting-value">{settings.speechRate.toFixed(1)}×</span>
            </div>
          </Row>

          <Row label="Snooze for" htmlFor="set-snooze">
            <select
              id="set-snooze"
              value={settings.snoozeMinutes}
              onChange={(event) => onChange({ snoozeMinutes: Number(event.target.value) })}
            >
              {SNOOZE_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} minutes
                </option>
              ))}
            </select>
          </Row>

          <Row label="Microphone" hint="Only open while you are talking to the app.">
            <div className="setting-inline">
              <span className={`status-pill is-${permissions.mic}`}>
                {permissions.mic === 'granted'
                  ? 'Allowed'
                  : permissions.mic === 'denied'
                    ? 'Blocked'
                    : 'Not asked'}
              </span>
              {permissions.mic !== 'granted' ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => permissions.request()}
                >
                  Allow
                </button>
              ) : null}
            </div>
          </Row>

          <Row label="Notifications" hint="Lets a reminder reach you when this tab is behind another.">
            <span className={`status-pill is-${permissions.notifications}`}>
              {permissions.notifications === 'granted'
                ? 'Allowed'
                : permissions.notifications === 'denied'
                  ? 'Blocked'
                  : 'Not asked'}
            </span>
          </Row>
        </section>

        <section className="settings-section">
          <h3>On-device AI</h3>

          <Row
            label="Suggest categories with the local model"
            hint="Chrome's built-in Gemini Nano. It runs on your device; nothing is uploaded."
            htmlFor="set-ai"
          >
            <Toggle
              id="set-ai"
              checked={settings.aiSuggestions}
              onChange={(value) => onChange({ aiSuggestions: value })}
              label="Use the on-device model"
            />
          </Row>

          <div className="settings-note">
            <p>
              <span className={`status-pill is-${ai.status}`}>{aiCopy.label}</span> {aiCopy.detail}
            </p>

            {ai.status === 'downloadable' ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => ai.enable()}>
                Download the model
              </button>
            ) : null}

            {ai.status === 'downloading' ? (
              <div className="progress-track" aria-label="Download progress">
                <span className="progress-fill" style={{ width: `${ai.progress}%` }} />
              </div>
            ) : null}

            {ai.status === 'unavailable' ? (
              <ol className="settings-steps">
                <li>
                  Open <code>chrome://flags/#prompt-api</code> and set it to{' '}
                  <strong>Enabled</strong>. On Chrome 140 and older the flag is called{' '}
                  <code>#prompt-api-for-gemini-nano</code>.
                </li>
                <li>Relaunch Chrome.</li>
                <li>
                  Open <code>chrome://on-device-internals</code> to watch the model download.
                </li>
                <li>Come back here — this panel will say “Ready to download” or “On”.</li>
              </ol>
            ) : null}
          </div>

          <Row
            label="Guess categories from keywords"
            hint="The offline fallback: “invoice” → work/clients, “dentist” → health."
            htmlFor="set-keywords"
          >
            <Toggle
              id="set-keywords"
              checked={settings.keywordSuggestions}
              onChange={(value) => onChange({ keywordSuggestions: value })}
              label="Guess categories from keywords"
            />
          </Row>
        </section>

        <section className="settings-section">
          <h3>New tasks</h3>

          <Row
            label="Default time"
            hint="What “tomorrow” means when you do not say an hour."
            htmlFor="set-hour"
          >
            <select
              id="set-hour"
              value={settings.defaultDueHour}
              onChange={(event) => onChange({ defaultDueHour: Number(event.target.value) })}
            >
              {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={hour}>
                  {String(hour).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </Row>

          <Row label="Default priority" htmlFor="set-priority">
            <select
              id="set-priority"
              value={settings.defaultPriority}
              onChange={(event) => onChange({ defaultPriority: event.target.value })}
            >
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_LABELS[priority]}
                </option>
              ))}
            </select>
          </Row>
        </section>

        <section className="settings-section">
          <h3>Your data</h3>

          <p className="field-hint">
            {taskCount} {taskCount === 1 ? 'task' : 'tasks'} in this browser. Nothing is stored
            anywhere else, so a backup is the only copy that survives clearing site data.
          </p>

          <div className="settings-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onExport}>
              Export JSON
            </button>

            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => fileRef.current?.click()}
            >
              Import JSON
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={handleFile}
            />

            <button type="button" className="btn btn-ghost btn-sm" onClick={onLoadDemo}>
              Load demo data
            </button>

            <button
              type="button"
              className={`btn btn-ghost btn-sm${confirmingClear ? ' is-danger' : ''}`}
              onClick={() => {
                if (!confirmingClear) {
                  setConfirmingClear(true)
                  return
                }

                onClearAll()
                setConfirmingClear(false)
              }}
              onBlur={() => setConfirmingClear(false)}
            >
              {confirmingClear ? 'Click again to delete everything' : 'Delete all tasks'}
            </button>
          </div>

          {importNote ? (
            <p className="field-hint" role="status">
              {importNote}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  )
}
