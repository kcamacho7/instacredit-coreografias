import { Fragment, useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useDialog } from './ui/DialogProvider'
import { useToast } from './ui/ToastProvider'
import { useAutoGrowTextarea } from '../hooks/useAutoGrowTextarea'
import { useLocked } from '../lib/lockedContext'

export interface HistorialFecha {
  fechaAnterior: string
  fechaNueva: string
  ajustadaEl: string
  ajustadaPor: string
}

export interface Accion {
  accion: string
  responsable: string
  fecha: string
  estado: string
  resultado?: string
  historialFechas?: HistorialFecha[]
  ajustesUsuario?: number
  cumplidaEn?: string
}

export const ESTADOS = ['Pendiente', 'En curso', 'Cumplida', 'Vencida'] as const

export function emptyAccion(): Accion {
  return { accion: '', responsable: '', fecha: '', estado: 'Pendiente' }
}

export type RetencionDias = 0 | 30 | 60 | 90
const RETENCION_KEY = 'acciones_cumplidas_retencion_dias'

export function leerRetencion(): RetencionDias {
  try {
    const v = Number(localStorage.getItem(RETENCION_KEY))
    if (v === 30 || v === 60 || v === 90) return v
  } catch { /* localStorage no disponible */ }
  return 0
}

export function guardarRetencion(v: RetencionDias) {
  try { localStorage.setItem(RETENCION_KEY, String(v)) } catch { /* localStorage no disponible */ }
}

interface AccionesTableProps {
  acciones: Accion[]
  onChange: (acciones: Accion[]) => void
  onMarcarCumplidaInmediato?: (idx: number) => void | Promise<void>
  hoy: string
}

export function AccionesTable({ acciones, onChange, onMarcarCumplidaInmediato, hoy }: AccionesTableProps) {
  const { regionalUnlocked } = useAuth()
  const { mostrarConfirm } = useDialog()
  const { mostrarAlerta } = useToast()
  const locked = useLocked()
  const [retencion, setRetencion] = useState<RetencionDias>(() => leerRetencion())

  // Purga automática: una acción cumplida hace más días que el período elegido
  // se elimina sola de la lista de cumplidas (0 = nunca purgar).
  useEffect(() => {
    if (!retencion) return
    const corte = Date.now() - retencion * 86400000
    const restantes = acciones.filter((a) => !(a.estado === 'Cumplida' && a.cumplidaEn && new Date(a.cumplidaEn).getTime() < corte))
    if (restantes.length !== acciones.length) onChange(restantes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acciones, retencion])

  function cambiarRetencion(v: RetencionDias) {
    guardarRetencion(v)
    setRetencion(v)
  }

  function actualizarCampo(idx: number, campo: 'accion' | 'responsable' | 'estado', valor: string) {
    onChange(acciones.map((a, i) => {
      if (i !== idx) return a
      if (campo === 'estado') {
        if (valor === 'Cumplida' && a.estado !== 'Cumplida') return { ...a, estado: valor, cumplidaEn: new Date().toISOString() }
        if (valor !== 'Cumplida' && a.estado === 'Cumplida') return { ...a, estado: valor, cumplidaEn: undefined }
        return { ...a, estado: valor }
      }
      return { ...a, [campo]: valor }
    }))
  }

  async function cambiarFecha(idx: number, nuevaFecha: string) {
    const accion = acciones[idx]
    const comprometida = accion.fecha
    const yaAgotoAjuste = !!comprometida && !regionalUnlocked && (accion.ajustesUsuario || 0) >= 1
    if (yaAgotoAjuste) {
      mostrarAlerta('Esta fecha de compromiso ya la ajustaste una vez (' + comprometida + ') y ahora es definitiva. Si necesitas cambiarla de nuevo, comunícate con Riesgo Regional.')
      return
    }
    if (nuevaFecha && nuevaFecha < hoy && !regionalUnlocked) {
      mostrarAlerta('La fecha de compromiso debe ser una fecha futura (a partir de hoy).')
      return
    }
    const esAjusteUsuario = !!comprometida && !regionalUnlocked && nuevaFecha !== comprometida
    if (esAjusteUsuario) {
      const ok = await mostrarConfirm(
        'Este es tu único ajuste permitido a esta fecha sin pasar por Riesgo Regional (de ' + comprometida + ' a ' + nuevaFecha + '). Después de guardar, cualquier otro cambio deberá solicitarse a Riesgo Regional. ¿Continuar?',
      )
      if (!ok) return
    }
    let historial = accion.historialFechas || []
    if ((comprometida && regionalUnlocked && nuevaFecha !== comprometida) || esAjusteUsuario) {
      historial = [
        ...historial,
        { fechaAnterior: comprometida, fechaNueva: nuevaFecha, ajustadaEl: new Date().toISOString(), ajustadaPor: regionalUnlocked ? 'Riesgo Regional' : 'el país' },
      ]
    }
    onChange(
      acciones.map((a, i) =>
        i === idx
          ? { ...a, fecha: nuevaFecha, historialFechas: historial, ajustesUsuario: esAjusteUsuario ? (a.ajustesUsuario || 0) + 1 : a.ajustesUsuario }
          : a,
      ),
    )
  }

  function verHistorial(idx: number) {
    const hist = acciones[idx].historialFechas || []
    if (!hist.length) return
    const texto = hist
      .map((h, i) => `${i + 1}. ${h.fechaAnterior} → ${h.fechaNueva} — ajustada por ${h.ajustadaPor} el ${new Date(h.ajustadaEl).toLocaleString('es-CR')}`)
      .join('\n')
    mostrarAlerta('Historial de cambios de fecha:\n\n' + texto)
  }

  function agregar() {
    onChange([...acciones, emptyAccion()])
  }

  function eliminar(idx: number) {
    onChange(acciones.filter((_, i) => i !== idx))
  }

  async function marcarCumplida(idx: number) {
    const ok = await mostrarConfirm('¿Marcar esta acción como cumplida? Riesgo Regional puede hacer esto sin necesitar el PIN del país.')
    if (!ok) return
    onChange(acciones.map((a, i) => (i === idx ? { ...a, estado: 'Cumplida', cumplidaEn: new Date().toISOString() } : a)))
    await onMarcarCumplidaInmediato?.(idx)
  }

  const activas = acciones.map((a, i) => ({ a, i })).filter(({ a }) => a.estado !== 'Cumplida')
  const cumplidas = acciones.map((a, i) => ({ a, i })).filter(({ a }) => a.estado === 'Cumplida')

  return (
    <>
      <table className="coreo">
        <tbody>
          <tr>
            <th style={{ width: '5%' }}>#</th>
            <th style={{ width: '36%' }}>Acción</th>
            <th style={{ width: '20%' }}>Responsable</th>
            <th style={{ width: '16%' }}>Fecha compromiso</th>
            <th style={{ width: '16%' }}>Estado</th>
            <th className="row-actions">&nbsp;</th>
          </tr>
          {activas.length === 0 && (
            <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--azul-claro)', padding: 12 }}>Sin acciones activas.</td></tr>
          )}
          {activas.map(({ a: accion, i }, pos) => {
            const fechaDefinitiva = !!accion.fecha && !regionalUnlocked && (accion.ajustesUsuario || 0) >= 1
            return (
              <AccionRow
                key={i}
                index={i}
                numero={pos + 1}
                accion={accion}
                locked={locked}
                regionalUnlocked={regionalUnlocked}
                fechaDefinitiva={fechaDefinitiva}
                hoy={hoy}
                onCampoChange={actualizarCampo}
                onFechaChange={cambiarFecha}
                onVerHistorial={verHistorial}
                onEliminar={eliminar}
                onMarcarCumplida={marcarCumplida}
                onResultadoChange={(valor) => onChange(acciones.map((a, j) => (j === i ? { ...a, resultado: valor } : a)))}
              />
            )
          })}
        </tbody>
      </table>
      <button type="button" className="add-row-btn" disabled={locked} onClick={agregar}>+ Agregar acción</button>

      {cumplidas.length > 0 && (
        <AccionesCumplidasSection items={cumplidas} locked={locked} retencion={retencion} onRetencionChange={cambiarRetencion} onEliminar={eliminar} />
      )}
    </>
  )
}

interface AccionesCumplidasSectionProps {
  items: { a: Accion; i: number }[]
  locked: boolean
  retencion: RetencionDias
  onRetencionChange: (v: RetencionDias) => void
  onEliminar: (idx: number) => void
}

function AccionesCumplidasSection({ items, locked, retencion, onRetencionChange, onEliminar }: AccionesCumplidasSectionProps) {
  const [abierta, setAbierta] = useState(false)

  return (
    <div style={{ marginTop: 14, border: '1px solid var(--gris-borde)', borderRadius: 8, overflow: 'hidden' }}>
      <div
        onClick={() => setAbierta((v) => !v)}
        style={{ background: '#F0F7EE', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontWeight: 700, color: 'var(--azul)', fontSize: 13 }}>
          {abierta ? '▾' : '▸'} ✅ Acciones cumplidas ({items.length})
        </span>
        <span onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--azul-claro)' }}>
          Eliminar automáticamente después de:
          <select value={retencion} disabled={locked} onChange={(e) => onRetencionChange(Number(e.target.value) as RetencionDias)} style={{ fontSize: 11.5, padding: '2px 4px' }}>
            <option value={0}>Nunca</option>
            <option value={30}>30 días</option>
            <option value={60}>60 días</option>
            <option value={90}>90 días</option>
          </select>
        </span>
      </div>
      {abierta && (
        <div>
          {items.map(({ a, i }) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 16px', borderTop: '1px solid var(--gris-borde)', fontSize: 12.5, flexWrap: 'wrap' }}>
              <span style={{ flex: 1, minWidth: 160, color: 'var(--gris-texto)' }}>{a.accion || '(sin descripción)'}</span>
              <span style={{ color: 'var(--azul-claro)', whiteSpace: 'nowrap' }}>{a.responsable}</span>
              <span style={{ color: 'var(--azul-claro)', whiteSpace: 'nowrap' }}>{a.cumplidaEn ? new Date(a.cumplidaEn).toLocaleDateString('es-CR') : ''}</span>
              <button
                type="button"
                title="Eliminar de la lista de cumplidas"
                disabled={locked}
                onClick={() => onEliminar(i)}
                style={{ background: 'none', border: 'none', color: 'var(--rojo)', fontSize: 16, fontWeight: 700, cursor: locked ? 'default' : 'pointer', lineHeight: 1, padding: '0 4px', opacity: locked ? 0.5 : 1 }}
              >×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface AccionRowProps {
  index: number
  numero: number
  accion: Accion
  locked: boolean
  regionalUnlocked: boolean
  fechaDefinitiva: boolean
  hoy: string
  onCampoChange: (idx: number, campo: 'accion' | 'responsable' | 'estado', valor: string) => void
  onFechaChange: (idx: number, valor: string) => void
  onVerHistorial: (idx: number) => void
  onEliminar: (idx: number) => void
  onMarcarCumplida: (idx: number) => void
  onResultadoChange: (valor: string) => void
}

function AccionRow({
  index, numero, accion, locked, regionalUnlocked, fechaDefinitiva, hoy,
  onCampoChange, onFechaChange, onVerHistorial, onEliminar, onMarcarCumplida, onResultadoChange,
}: AccionRowProps) {
  const [comentarioAbierto, setComentarioAbierto] = useState(false)
  const accionRef = useAutoGrowTextarea(accion.accion)
  const responsableRef = useAutoGrowTextarea(accion.responsable)
  const resultadoRef = useAutoGrowTextarea(accion.resultado || '')
  const tieneHistorial = !!(accion.historialFechas && accion.historialFechas.length)
  const cumplida = accion.estado === 'Cumplida'
  const btnCumplidaClickable = !locked && !cumplida

  return (
    <Fragment>
      <tr>
        <td>{numero}</td>
        <td>
          <textarea ref={accionRef} rows={1} disabled={locked} value={accion.accion} onChange={(e) => onCampoChange(index, 'accion', e.target.value)} />
        </td>
        <td>
          <textarea ref={responsableRef} rows={1} disabled={locked} value={accion.responsable} onChange={(e) => onCampoChange(index, 'responsable', e.target.value)} />
        </td>
        <td>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, width: '100%' }}>
            <input
              type="date"
              min={hoy}
              disabled={locked}
              className={fechaDefinitiva ? 'fecha-definitiva' : ''}
              value={accion.fecha}
              style={{ flex: 1, minWidth: 0, width: 'auto' }}
              onChange={(e) => onFechaChange(index, e.target.value)}
            />
            {tieneHistorial && (
              <button type="button" className="btn-historial-fecha" title="Ver historial de cambios de esta fecha" onClick={() => onVerHistorial(index)}>🕓</button>
            )}
          </span>
        </td>
        <td>
          <select className="estado" disabled={locked} value={accion.estado} onChange={(e) => onCampoChange(index, 'estado', e.target.value)}>
            <option value="Pendiente">Pendiente</option>
            <option value="En curso">En curso</option>
            <option value="Cumplida">Cumplida</option>
            <option value="Vencida">Vencida</option>
          </select>
        </td>
        <td className="row-actions">
          {regionalUnlocked && (
            <button
              type="button"
              className="btn-regional-check"
              title={cumplida ? 'Ya marcada como cumplida' : 'Marcar cumplida'}
              disabled={!btnCumplidaClickable}
              onClick={() => onMarcarCumplida(index)}
            >✓</button>
          )}
          <button
            type="button"
            className={'btn-comentario' + (accion.resultado?.trim() ? ' tiene-texto' : '')}
            title={cumplida ? 'Ver/agregar resultado' : 'Disponible cuando la acción esté Cumplida'}
            disabled={!cumplida}
            onClick={() => setComentarioAbierto((v) => !v)}
          >💬</button>
          <button type="button" title="Eliminar fila" disabled={locked} onClick={() => onEliminar(index)}>×</button>
        </td>
      </tr>
      {comentarioAbierto && (
        <tr className="fila-resultado">
          <td colSpan={6}>
            <label>Resultado obtenido</label>
            <textarea
              ref={resultadoRef}
              rows={2}
              disabled={locked}
              placeholder="Describe el resultado obtenido con esta acción..."
              value={accion.resultado || ''}
              onChange={(e) => onResultadoChange(e.target.value)}
            />
          </td>
        </tr>
      )}
    </Fragment>
  )
}
