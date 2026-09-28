/** Shared mic button. `listening` drives the pulse ring. */
export default function MicButton({ listening, disabled, onClick, label = 'Add a task by voice' }) {
  return (
    <button
      type="button"
      className={`mic-btn${listening ? ' is-listening' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={listening}
      aria-label={listening ? 'Stop listening' : label}
      title={listening ? 'Listening… click to stop' : label}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M12 15.5a3.5 3.5 0 0 0 3.5-3.5V6a3.5 3.5 0 0 0-7 0v6a3.5 3.5 0 0 0 3.5 3.5Z"
          fill="currentColor"
        />
        <path
          d="M18.5 11.5a6.5 6.5 0 0 1-13 0M12 18v3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </button>
  )
}
