import { useEffect, useState } from 'react'
import { IconClose, IconMaximize, IconMinimize, IconRestore } from './Icons'

export function WindowControls() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    void window.api.window.isMaximized().then(setMaximized)
    return window.api.window.onMaximizedChange(setMaximized)
  }, [])

  return (
    <div className="window-controls">
      <button
        type="button"
        className="window-control"
        title="最小化"
        aria-label="最小化"
        onClick={() => window.api.window.minimize()}
      >
        <IconMinimize size={14} />
      </button>
      <button
        type="button"
        className="window-control"
        title={maximized ? '还原' : '最大化'}
        aria-label={maximized ? '还原' : '最大化'}
        onClick={() => window.api.window.toggleMaximize()}
      >
        {maximized ? <IconRestore size={13} /> : <IconMaximize size={13} />}
      </button>
      <button
        type="button"
        className="window-control window-control-close"
        title="关闭"
        aria-label="关闭"
        onClick={() => window.api.window.close()}
      >
        <IconClose size={14} />
      </button>
    </div>
  )
}
