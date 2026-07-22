import { useState, type ReactNode } from 'react'
import { LockedProvider, useLocked } from '../lib/lockedContext'

interface CollapsibleCardProps {
  titulo: string
  onTituloChange?: (valor: string) => void
  placeholder?: string
  badge?: ReactNode
  metaRight?: ReactNode
  onEliminar?: () => void
  eliminarLabel?: string
  defaultOpen?: boolean
  open?: boolean
  onToggle?: (abierto: boolean) => void
  locked?: boolean
  variant?: 'proyecto' | 'reunion'
  children: ReactNode
}

/**
 * Tarjeta colapsable con encabezado (chevron + título editable + acciones),
 * porta el patrón .proyecto-card-header / .reunion-card-header del sitio legado.
 * El modo `locked` usa un `disabled` real de React (vía LockedContext), no el
 * hack de `.locked{pointer-events:none}` en CSS.
 */
export function CollapsibleCard({
  titulo,
  onTituloChange,
  placeholder,
  badge,
  metaRight,
  onEliminar,
  eliminarLabel = 'Eliminar',
  defaultOpen = false,
  open: openControlado,
  onToggle,
  locked = false,
  variant = 'proyecto',
  children,
}: CollapsibleCardProps) {
  const [openInterno, setOpenInterno] = useState(defaultOpen)
  const open = openControlado ?? openInterno

  function toggle() {
    const nuevo = !open
    if (openControlado === undefined) setOpenInterno(nuevo)
    onToggle?.(nuevo)
  }

  return (
    <div className={'proyecto-card' + (variant === 'reunion' ? ' reunion-card' : '') + (open ? ' open' : '') + (locked ? ' locked' : '')}>
      <div className={'proyecto-card-header' + (variant === 'reunion' ? ' reunion-card-header' : '')}>
        <button type="button" className="proyecto-toggle" title="Mostrar/ocultar detalle" onClick={toggle} disabled={false}>▶</button>
        {badge}
        {onTituloChange ? (
          <input
            type="text"
            className="nombre-input"
            value={titulo}
            placeholder={placeholder}
            disabled={locked}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onTituloChange(e.target.value)}
          />
        ) : (
          <span className="nombre-input" style={{ flex: 1 }}>{titulo || placeholder}</span>
        )}
        {metaRight}
        {onEliminar && (
          <button type="button" className="btn-eliminar-proyecto" disabled={locked} onClick={onEliminar}>
            {eliminarLabel}
          </button>
        )}
      </div>
      <div className="proyecto-card-body">
        <LockedProvider locked={locked}>{children}</LockedProvider>
      </div>
    </div>
  )
}

export { useLocked }
