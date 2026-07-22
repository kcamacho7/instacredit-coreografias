import { Fragment, useState } from 'react'
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
}

export const ESTADOS = ['Pendiente', 'En curso', 'Cumplida', 'Vencida'] as const

export function emptyAccion(): Accion {
  return { accion: '', responsable: '', fecha: '', estado: 'Pendiente' }
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

  function actualizarCampo(idx: number, campo: 'accion' | 'responsable' | 'estado', valor: string) {
    onChange(acciones.map((a, i) => (i === idx ? { ...a, [campo]: valor } : a)))
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
    onChange(acciones.map((a, i) => (i === idx ? { ...a, estado: 'Cumplida' } : a)))
    await onMarcarCumplidaInmediato?.(idx)
  }

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
          {acciones.map((accion, i) => {
            const fechaDefinitiva = !!accion.fecha && !regionalUnlocked && (accion.ajustesUsuario || 0) >= 1
            return (
              <AccionRow
                key={i}
                index={i}
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
    </>
  )
}

interface AccionRowProps {
  index: number
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
  index, accion, locked, regionalUnlocked, fechaDefinitiva, hoy,
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
        <td>{index + 1}</td>
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
