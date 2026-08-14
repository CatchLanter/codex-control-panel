import { useEffect, useMemo, useRef, useState } from 'react'

export interface PaletteAction {
  id: string
  label: string
  hint?: string
  run: () => void
}

export function CommandPalette({
  open,
  actions,
  onClose,
}: {
  open: boolean
  actions: PaletteAction[]
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return actions
    return actions.filter((a) => a.label.toLowerCase().includes(q))
  }, [actions, query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  useEffect(() => {
    setIndex(0)
  }, [query])

  if (!open) return null

  const run = (action: PaletteAction) => {
    onClose()
    action.run()
  }

  return (
    <div
      className="overlay palette-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="palette">
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="输入命令名称…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onClose()
            else if (event.key === 'ArrowDown') {
              event.preventDefault()
              setIndex((i) => Math.min(i + 1, filtered.length - 1))
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setIndex((i) => Math.max(i - 1, 0))
            } else if (event.key === 'Enter') {
              event.preventDefault()
              const action = filtered[index]
              if (action) run(action)
            }
          }}
        />
        <div className="palette-list">
          {filtered.length === 0 && (
            <div className="palette-empty">没有匹配的命令</div>
          )}
          {filtered.map((action, i) => (
            <button
              type="button"
              key={action.id}
              className={`palette-item ${i === index ? 'active' : ''}`}
              onMouseEnter={() => setIndex(i)}
              onClick={() => run(action)}
            >
              <span>{action.label}</span>
              {action.hint && <span className="palette-hint">{action.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
