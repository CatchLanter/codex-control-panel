import { useCallback, useEffect, useRef, useState } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { SessionMeta } from '../../../shared/types'
import { sanitizePtyData } from '../../../shared/pty-sanitize'

const THEMES = {
  dark: {
    background: '#111214',
    foreground: '#d6d9dd',
    cursor: '#f0f1f2',
    selectionBackground: 'rgba(122, 162, 247, 0.25)',
  },
  light: {
    background: '#fafafa',
    foreground: '#1f2326',
    cursor: '#111214',
    selectionBackground: 'rgba(47, 111, 237, 0.18)',
  },
} as const

interface MenuState {
  x: number
  y: number
}

export function TerminalPane({
  meta,
  visible,
  theme,
  fontSize,
}: {
  meta: SessionMeta
  visible: boolean
  theme: 'dark' | 'light'
  fontSize: number
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const visibleRef = useRef(visible)
  const pinRef = useRef(true)
  const pinIntervalRef = useRef<number | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)

  visibleRef.current = visible

  const stopPin = useCallback((source: string) => {
    window.api.app.log('debug', `stop pin session=${meta.id} source=${source}`)
    pinRef.current = false
    if (pinIntervalRef.current != null) {
      window.clearInterval(pinIntervalRef.current)
      pinIntervalRef.current = null
    }
  }, [])

  const startPin = useCallback(() => {
    window.api.app.log('debug', `start pin session=${meta.id}`)
    pinRef.current = true
    if (pinIntervalRef.current != null) return
    pinIntervalRef.current = window.setInterval(() => {
      if (!pinRef.current) return
      try {
        termRef.current?.scrollToBottom()
      } catch {
        // terminal may be detaching
      }
    }, 450)
  }, [])

  const doFit = useCallback(() => {
    const host = hostRef.current
    const term = termRef.current
    const fit = fitRef.current
    if (!host || !term || !fit || !visibleRef.current) return
    if (host.offsetWidth === 0 || host.offsetHeight === 0) return
    try {
      const beforeViewport = `${term.buffer.active.viewportY}/${term.buffer.active.baseY}`
      fit.fit()
      window.api.sessions.resize(meta.id, term.cols, term.rows)
      term.scrollToBottom()
      requestAnimationFrame(() => term.scrollToBottom())
      window.api.app.log(
        'debug',
        `fit session=${meta.id} host=${host.offsetWidth}x${host.offsetHeight} term=${term.cols}x${term.rows} vp=${beforeViewport}->${term.buffer.active.viewportY}/${term.buffer.active.baseY}`,
      )
    } catch {
      // terminal may be detaching
    }
  }, [meta.id])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const term = new Terminal({
      convertEol: true,
      scrollback: 10000,
      fontSize,
      fontFamily: '"Cascadia Mono", "Consolas", "Courier New", monospace',
      cursorBlink: true,
      theme: THEMES[theme],
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(host)
    termRef.current = term
    fitRef.current = fit

    let disposed = false
    let ready = false
    const pending: string[] = []
    const offData = window.api.onData(({ sessionId, data }) => {
      if (sessionId !== meta.id) return
      const clean = sanitizePtyData(data)
      if (!clean) return
      if (ready) {
        term.write(clean)
        if (pinRef.current) {
          try {
            term.scrollToBottom()
          } catch {
            // terminal may be detaching
          }
        }
      }
      else pending.push(clean)
    })

    void window.api.sessions.buffer(meta.id).then((buffer) => {
      if (disposed) return
      ready = true
      const chunks = buffer
        ? [sanitizePtyData(buffer), ...pending]
        : [...pending]
      pending.length = 0
      for (let index = 0; index < chunks.length; index += 1) {
        const isLast = index === chunks.length - 1
        const clean = chunks[index]
        if (!clean) continue
        term.write(
          clean,
          isLast
            ? () => {
                if (!disposed) term.scrollToBottom()
              }
            : undefined,
        )
      }
      requestAnimationFrame(() => {
        if (!disposed) term.scrollToBottom()
      })
    })

    const dataDisposable = term.onData((data) => {
      const isTerminalResponse =
        /^(?:\x1b\[[0-9;>?]*[cn]|\x1b\[[IO])+$/.test(data)
      if (isTerminalResponse) {
        window.api.app.log(
          'debug',
          `terminal response session=${meta.id} data=${JSON.stringify(data)}`,
        )
      } else {
        window.api.app.log(
          'debug',
          `input session=${meta.id} data=${JSON.stringify(data.slice(0, 40))}`,
        )
        stopPin('input')
      }
      window.api.sessions.write(meta.id, data)
    })

    term.attachCustomKeyEventHandler((event) => {
      if (
        event.type === 'keydown' &&
        event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey &&
        (event.key === 'c' || event.key === 'C')
      ) {
        if (term.hasSelection()) {
          event.preventDefault()
          void navigator.clipboard.writeText(term.getSelection())
          return false
        }
        return true
      }
      if (
        event.type === 'keydown' &&
        event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey &&
        (event.key === 'v' || event.key === 'V')
      ) {
        event.preventDefault()
        stopPin('paste')
        void navigator.clipboard.readText().then((text) => {
          if (text) term.paste(text)
        })
        return false
      }
      return true
    })

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(doFit)
    })
    observer.observe(host)

    const onWheel = (event: WheelEvent) => {
      if (event.deltaY < -20) {
        window.api.app.log(
          'debug',
          `wheel up session=${meta.id} delta=${event.deltaY} unpin`,
        )
        stopPin('wheel-up')
      } else if (event.deltaY > 20) {
        const term = termRef.current
        if (
          term &&
          term.buffer.active.viewportY + term.rows >=
            term.buffer.active.baseY
        ) {
          window.api.app.log(
            'debug',
            `wheel down session=${meta.id} re-pin`,
          )
          startPin()
        }
      }
    }
    host.addEventListener('wheel', onWheel)

    if (visible) requestAnimationFrame(doFit)
    startPin()
    term.focus()

    return () => {
      disposed = true
      stopPin('hidden')
      host.removeEventListener('wheel', onWheel)
      offData()
      dataDisposable.dispose()
      observer.disconnect()
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
    // Terminal instances are tied to a session, not to style changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.id, doFit, startPin, stopPin])

  useEffect(() => {
    const term = termRef.current
    if (!term) return
    term.options.fontSize = fontSize
    term.options.theme = THEMES[theme]
    requestAnimationFrame(doFit)
  }, [fontSize, theme, doFit])

  useEffect(() => {
    if (visible) {
      window.api.app.log('debug', `visible session=${meta.id}`)
      startPin()
      requestAnimationFrame(doFit)
    } else {
      window.api.app.log('debug', `hidden session=${meta.id}`)
      stopPin('cleanup')
    }
  }, [visible, doFit, startPin, stopPin])

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [menu])

  const copySelection = () => {
    const term = termRef.current
    if (!term?.hasSelection()) return
    void navigator.clipboard.writeText(term.getSelection())
    setMenu(null)
  }

  const paste = () => {
    void navigator.clipboard.readText().then((text) => {
      termRef.current?.paste(text)
      termRef.current?.focus()
    })
    setMenu(null)
  }

  const clear = () => {
    termRef.current?.clear()
    setMenu(null)
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const files = Array.from(event.dataTransfer.files ?? [])
    if (!files.length) return
    const paths: string[] = []
    for (const file of files) {
      try {
        const path = window.api.app.getPathForFile(file)
        if (path) paths.push(path)
      } catch {
        // ignore files without a local path
      }
    }
    if (paths.length) {
      termRef.current?.paste(paths.join(' '))
      termRef.current?.focus()
    }
  }

  return (
    <div
      className="pane-root"
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={handleDrop}
      onContextMenu={(event) => {
        event.preventDefault()
        setMenu({ x: event.clientX, y: event.clientY })
      }}
      onMouseDown={() => termRef.current?.focus()}
    >
      <div className="term-host" ref={hostRef} />
      {meta.status !== 'running' && (
        <div className="pane-overlay">
          <span>
            进程已退出
            {meta.exitCode != null ? `（exit ${meta.exitCode}）` : ''}
          </span>
        </div>
      )}
      {menu && (
        <div
          className="context-menu"
          style={{ left: menu.x, top: menu.y }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={copySelection}
            disabled={!termRef.current?.hasSelection()}
          >
            复制
          </button>
          <button type="button" onClick={paste}>
            粘贴
          </button>
          <button type="button" onClick={clear}>
            清屏
          </button>
        </div>
      )}
    </div>
  )
}
