/** Five-second undo for a delete or a completion. */
export default function UndoToast({ message, onUndo, onDismiss }) {
  return (
    <div className="undo-toast" role="status">
      <p className="undo-message">{message}</p>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onUndo}>
        Undo
      </button>
      <button
        type="button"
        className="icon-btn"
        onClick={onDismiss}
        aria-label="Dismiss"
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}
