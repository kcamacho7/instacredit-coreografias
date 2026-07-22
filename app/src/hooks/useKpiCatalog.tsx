import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { sb } from '../lib/supabase'
import { AREAS_FALLBACK, type AreaCatalogo, type KpiCatalogo } from '../lib/catalogs'

interface KpiCatalogContextValue {
  areas: AreaCatalogo[]
  loading: boolean
  refetch: () => void
}

const KpiCatalogContext = createContext<KpiCatalogContextValue | null>(null)

interface KpiCatalogoRow {
  id: string
  area_id: string
  kpi_id: string
  nombre: string
  definicion: string | null
}

/**
 * El catálogo de KPI fijo (AREAS_FALLBACK) es el respaldo de fábrica — este
 * provider lo sobreescribe con el catálogo vivo de `kpis_catalogo` (que
 * Riesgo Regional/Admin puede editar/crear/eliminar), igual que
 * `loadKpiCatalog()` del sitio legado. Si un dominio no tiene filas propias
 * en la tabla, conserva su catálogo de fábrica.
 */
export function KpiCatalogProvider({ areaNegocio, children }: { areaNegocio: string; children: ReactNode }) {
  const [areas, setAreas] = useState<AreaCatalogo[]>(AREAS_FALLBACK)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data } = await sb.from('kpis_catalogo').select('*').eq('area_negocio', areaNegocio).eq('activo', true).order('area_id').order('orden')
    const filas = (data || []) as KpiCatalogoRow[]
    const nuevasAreas = AREAS_FALLBACK.map((area) => {
      const propias = filas.filter((f) => f.area_id === area.id)
      if (propias.length === 0) return area
      const kpis: KpiCatalogo[] = propias.map((f) => ({ id: f.kpi_id, nombre: f.nombre, def: f.definicion || '' }))
      return { ...area, kpis }
    })
    setAreas(nuevasAreas)
    setLoading(false)
  }, [areaNegocio])

  useEffect(() => { cargar() }, [cargar, tick])

  return (
    <KpiCatalogContext.Provider value={{ areas, loading, refetch: () => setTick((t) => t + 1) }}>
      {children}
    </KpiCatalogContext.Provider>
  )
}

export function useKpiCatalog() {
  const ctx = useContext(KpiCatalogContext)
  if (!ctx) throw new Error('useKpiCatalog debe usarse dentro de <KpiCatalogProvider>')
  return ctx
}
