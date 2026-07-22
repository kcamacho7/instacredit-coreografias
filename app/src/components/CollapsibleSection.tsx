import { useState, type ReactNode } from 'react'

interface CollapsibleSectionProps {
  titulo: string
  etiqueta?: string
  queEs?: ReactNode
  className?: string
  children: ReactNode
}

/** Porta wireColapsarSeccion(): bloque .area-header colapsable, con estado solo de sesión (no persistido). */
export function CollapsibleSection({ titulo, etiqueta, queEs, className, children }: CollapsibleSectionProps) {
  const [colapsado, setColapsado] = useState(false)

  return (
    <div className={'area-block' + (className ? ' ' + className : '')}>
      <div className="area-header">
        <h2>{titulo}</h2>
        <span className="header-right">
          {etiqueta && <span>{etiqueta}</span>}
          <button type="button" className="btn-colapsar-seccion" onClick={() => setColapsado((v) => !v)}>
            {colapsado ? 'Expandir' : 'Contraer'}
          </button>
        </span>
      </div>
      <div style={{ display: colapsado ? 'none' : 'block' }}>
        {queEs && <div className="area-owner"><strong>Qué es:</strong> {queEs}</div>}
        {children}
      </div>
    </div>
  )
}
