import type { ReactNode } from 'react'

export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="field-grid">{children}</div>
}

interface FieldRowProps {
  label: string
  children: ReactNode
  span?: number
}

export function FieldRow({ label, children, span }: FieldRowProps) {
  return (
    <div className="field" style={span ? { gridColumn: `span ${span}` } : undefined}>
      <label>{label}</label>
      {children}
    </div>
  )
}
