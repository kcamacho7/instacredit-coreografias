import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'

/** Lee configuracion_sistema.dias_bloqueo_minuta. La edición (solo Admin) se agrega en la Fase 9. */
export function useDiasBloqueoMinuta(): number {
  const [dias, setDias] = useState(3)
  useEffect(() => {
    let activo = true
    sb.from('configuracion_sistema').select('clave,valor').then(({ data }) => {
      if (!activo) return
      const fila = (data || []).find((r) => r.clave === 'dias_bloqueo_minuta')
      if (fila) setDias(parseInt(fila.valor, 10) || 3)
    })
    return () => { activo = false }
  }, [])
  return dias
}
