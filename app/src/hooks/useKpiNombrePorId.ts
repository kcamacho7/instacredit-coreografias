import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'

/** Mapa kpi_id -> nombre para mostrar en tablas de solo lectura (Bitácora, Fechas, Acciones). Incluye KPI inactivos/eliminados del catálogo para poder mostrar nombres históricos. */
export function useKpiNombrePorId(areaNegocio: string): Record<string, string> {
  const [mapa, setMapa] = useState<Record<string, string>>({})

  useEffect(() => {
    let activo = true
    sb.from('kpis_catalogo').select('kpi_id,nombre').eq('area_negocio', areaNegocio).then(({ data }) => {
      if (!activo) return
      setMapa(Object.fromEntries((data || []).map((r) => [r.kpi_id, r.nombre])))
    })
    return () => { activo = false }
  }, [areaNegocio])

  return mapa
}
