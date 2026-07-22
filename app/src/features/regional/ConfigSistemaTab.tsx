import { useEffect, useState } from 'react'
import { sb } from '../../lib/supabase'
import { useToast } from '../../components/ui/ToastProvider'
import { useDiasBloqueoMinuta } from '../../hooks/useConfigSistema'

export function ConfigSistemaTab() {
  const diasActual = useDiasBloqueoMinuta()
  const { mostrarAlerta } = useToast()
  const [dias, setDias] = useState<number | ''>(diasActual)

  useEffect(() => { setDias(diasActual) }, [diasActual])

  async function guardar() {
    if (dias === '' || dias < 0) { mostrarAlerta('Pon un número de días válido (0 o más).'); return }
    const { error } = await sb.from('configuracion_sistema').update({ valor: String(dias) }).eq('clave', 'dias_bloqueo_minuta')
    if (error) { mostrarAlerta('Error: ' + error.message); return }
    mostrarAlerta('Configuración guardada. El nuevo valor aplica de inmediato.', 'success')
  }

  return (
    <div style={{ padding: '14px 20px' }}>
      <div className="area-owner">
        <strong>Qué es:</strong> parámetros globales del sistema — aplican a todas las áreas de negocio por igual.
      </div>
      <div className="field-grid" style={{ padding: 0 }}>
        <div className="field">
          <label>Días para bloquear una minuta (queda definitiva)</label>
          <input
            type="number"
            min={0}
            style={{ width: '100%' }}
            value={dias}
            onChange={(e) => setDias(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
          />
        </div>
      </div>
      <button type="button" className="btn-eliminar-proyecto" style={{ borderColor: 'var(--verde)', color: 'var(--verde)', marginTop: 10 }} onClick={guardar}>Guardar</button>
    </div>
  )
}
