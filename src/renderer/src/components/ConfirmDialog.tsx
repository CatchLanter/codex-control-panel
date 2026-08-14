export interface ConfirmRequest {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
}

export function ConfirmDialog({
  request,
  onClose,
}: {
  request: ConfirmRequest
  onClose: () => void
}) {
  return (
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="dialog confirm-dialog">
        <div className="dialog-title">{request.title}</div>
        <div className="dialog-message">{request.message}</div>
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className={`btn ${request.danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => {
              void request.onConfirm()
              onClose()
            }}
          >
            {request.confirmLabel ?? '确定'}
          </button>
        </div>
      </div>
    </div>
  )
}
