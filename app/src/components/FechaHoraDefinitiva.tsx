import { useAuth } from '../hooks/useAuth'
import { useDialog } from './ui/DialogProvider'
import { useToast } from './ui/ToastProvider'
import { useLocked } from '../lib/lockedContext'
import type { HistorialFecha } from './AccionesTable'

export interface FechaHoraValue {
  fecha: string
  hora: string
  historial?: HistorialFecha[]
  ajustesUsuario?: number
}

interface FechaHoraDefinitivaProps {
  value: FechaHoraValue
  label: string
  fechaLabel?: string
  horaLabel?: string
  onChange: (valor: FechaHoraValue) => void
}

/**
 * Campo fecha+hora con la regla de "un solo ajuste libre" del sitio legado
 * (wireFechaHoraDefinitiva): una vez comprometida una fecha, el país solo
 * puede recorrerla una vez sin pasar por Riesgo Regional; después queda
 * definitiva y se registra el historial de cambios.
 */
export function FechaHoraDefinitiva({ value, label, fechaLabel = 'Fecha', horaLabel = 'Hora sugerida', onChange }: FechaHoraDefinitivaProps) {
  const { regionalUnlocked } = useAuth()
  const { mostrarConfirm } = useDialog()
  const { mostrarAlerta } = useToast()
  const locked = useLocked()

  const comprometida = value.fecha
  const yaAgotoAjuste = !!comprometida && !regionalUnlocked && (value.ajustesUsuario || 0) >= 1
  const tieneHistorial = !!(value.historial && value.historial.length)

  async function cambiarFecha(nuevaFecha: string) {
    if (yaAgotoAjuste) {
      mostrarAlerta(`La ${label} ya la ajustaste una vez (${comprometida}${value.hora ? ' ' + value.hora : ''}) y ahora es definitiva. Si necesitas cambiarla de nuevo, comunícate con Riesgo Regional.`)
      return
    }
    const esAjusteUsuario = !!comprometida && !regionalUnlocked && nuevaFecha !== comprometida
    if (esAjusteUsuario) {
      const ok = await mostrarConfirm(
        `Este es tu único ajuste permitido a la ${label} sin pasar por Riesgo Regional (de ${comprometida} a ${nuevaFecha}). Después de guardar, cualquier otro cambio deberá solicitarse a Riesgo Regional. ¿Continuar?`,
      )
      if (!ok) return
    }
    let historial = value.historial || []
    if ((comprometida && regionalUnlocked && nuevaFecha !== comprometida) || esAjusteUsuario) {
      historial = [
        ...historial,
        { fechaAnterior: comprometida, fechaNueva: nuevaFecha, ajustadaEl: new Date().toISOString(), ajustadaPor: regionalUnlocked ? 'Riesgo Regional' : 'el país' },
      ]
    }
    onChange({ fecha: nuevaFecha, hora: value.hora, historial, ajustesUsuario: esAjusteUsuario ? (value.ajustesUsuario || 0) + 1 : value.ajustesUsuario })
  }

  function cambiarHora(nuevaHora: string) {
    if (yaAgotoAjuste) {
      mostrarAlerta(`La ${label} ya la ajustaste una vez (${comprometida}${value.hora ? ' ' + value.hora : ''}) y ahora es definitiva. Si necesitas cambiarla de nuevo, comunícate con Riesgo Regional.`)
      return
    }
    onChange({ ...value, hora: nuevaHora })
  }

  function verHistorial() {
    const hist = value.historial || []
    if (!hist.length) return
    const texto = hist
      .map((h, i) => `${i + 1}. ${h.fechaAnterior} → ${h.fechaNueva} — ajustada por ${h.ajustadaPor} el ${new Date(h.ajustadaEl).toLocaleString('es-CR')}`)
      .join('\n')
    mostrarAlerta('Historial de cambios de fecha:\n\n' + texto)
  }

  return (
    <>
      <div className="field">
        <label>{fechaLabel}</label>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, width: '100%' }}>
          <input
            type="date"
            disabled={locked}
            className={yaAgotoAjuste ? 'fecha-definitiva' : ''}
            value={value.fecha}
            style={{ flex: 1, minWidth: 0, width: 'auto' }}
            onChange={(e) => cambiarFecha(e.target.value)}
          />
          {tieneHistorial && (
            <button type="button" className="btn-historial-fecha" title="Ver historial de cambios de esta fecha" onClick={verHistorial}>🕓</button>
          )}
        </span>
      </div>
      <div className="field">
        <label>{horaLabel}</label>
        <input type="time" disabled={locked} className={yaAgotoAjuste ? 'fecha-definitiva' : ''} value={value.hora} onChange={(e) => cambiarHora(e.target.value)} />
      </div>
    </>
  )
}
