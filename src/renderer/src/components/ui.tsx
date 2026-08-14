import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function IconButton({
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className="icon-btn" {...rest}>
      {children}
    </button>
  )
}

export function Section({
  title,
  children,
  actions,
}: {
  title: string
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <section className="section">
      <header className="section-header">
        <span>{title}</span>
        {actions}
      </header>
      <div className="section-body">{children}</div>
    </section>
  )
}

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}
