import { useCallback, useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import type { AreaCatalogo } from '../lib/catalogs'
import {
  emptyKpiState, filaCoreografiaAKpiState, filaCustomKpiAState, filaProyectoAProyectoState,
  type CustomKpiState, type KpiState, type ProyectoState,
} from '../lib/stateShape'

export interface AreaDataState {
  loading: boolean
  error: string | null
  kpisPorAreaId: Record<string, Record<string, KpiState>>
  customKpisPorAreaId: Record<string, CustomKpiState[]>
  proyectosEspeciales: ProyectoState[]
  refetch: () => void
}

/**
 * Consolida el patrón repetido ~5 veces en el sitio legado: un triple
 * `Promise.all` sobre `coreografias` + `proyectos_especiales` + `kpis_adicionales`
 * filtrado por país/área de negocio.
 *
 * `paisCode = 'RG'` es el pseudo-país del espacio propio del Regional — se
 * trata igual que un país real (mismas tablas), solo que con su propio
 * catálogo de KPI (`kpi_dominios`/`kpis_catalogo` con `es_regional=true`).
 */
export function useAreaData(paisCode: string, areaNegocio: string, areas: AreaCatalogo[]): AreaDataState {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [kpisPorAreaId, setKpisPorAreaId] = useState<Record<string, Record<string, KpiState>>>({})
  const [customKpisPorAreaId, setCustomKpisPorAreaId] = useState<Record<string, CustomKpiState[]>>({})
  const [proyectosEspeciales, setProyectosEspeciales] = useState<ProyectoState[]>([])
  const [tick, setTick] = useState(0)

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let activo = true
    setLoading(true)
    setError(null)

    const cargar = async () => {
      const [coreoRes, proyRes, customRes] = await Promise.all([
        sb.from('coreografias').select('*').eq('pais_code', paisCode).eq('area_negocio', areaNegocio),
        sb.from('proyectos_especiales').select('*').eq('pais_code', paisCode).eq('area_negocio', areaNegocio).order('orden', { ascending: true }),
        sb.from('kpis_adicionales').select('*').eq('pais_code', paisCode).eq('area_negocio', areaNegocio).order('orden', { ascending: true }),
      ])
      if (!activo) return

      const primerError = coreoRes.error || proyRes.error || customRes.error
      if (primerError) {
        setError(primerError.message)
        setLoading(false)
        return
      }

      const kpis: Record<string, Record<string, KpiState>> = {}
      areas.forEach((area) => {
        kpis[area.id] = {}
        area.kpis.forEach((kpi) => { kpis[area.id][kpi.id] = emptyKpiState() })
      })
      ;(coreoRes.data || []).forEach((row) => {
        if (kpis[row.area_id]) kpis[row.area_id][row.kpi_id] = filaCoreografiaAKpiState(row)
      })

      const customs: Record<string, CustomKpiState[]> = {}
      areas.forEach((area) => { customs[area.id] = [] })
      ;(customRes.data || []).forEach((row) => {
        if (!customs[row.area_id]) customs[row.area_id] = []
        customs[row.area_id].push(filaCustomKpiAState(row))
      })

      const proyectos = (proyRes.data || []).map(filaProyectoAProyectoState)

      setKpisPorAreaId(kpis)
      setCustomKpisPorAreaId(customs)
      setProyectosEspeciales(proyectos)
      setLoading(false)
    }

    cargar()
    return () => { activo = false }
  }, [paisCode, areaNegocio, areas, tick])

  return { loading, error, kpisPorAreaId, customKpisPorAreaId, proyectosEspeciales, refetch }
}
