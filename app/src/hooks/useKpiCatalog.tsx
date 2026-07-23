import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { sb } from '../lib/supabase'
import type { AreaCatalogo, KpiCatalogo } from '../lib/catalogs'

interface KpiCatalogContextValue {
  areas: AreaCatalogo[]
  loading: boolean
  refetch: () => void
}

const KpiCatalogContext = createContext<KpiCatalogContextValue | null>(null)

interface DominioRow {
  codigo: string
  nombre: string
  ejecuta: string | null
  controla: string | null
}

interface KpiCatalogoRow {
  area_id: string
  kpi_id: string
  nombre: string
  definicion: string | null
}

/**
 * Cada area_negocio define sus propios dominios de KPI (tabla kpi_dominios) y sus
 * propios KPI dentro de cada dominio (tabla kpis_catalogo) — ya no se comparte un
 * esqueleto fijo entre áreas. Un área sin dominios configurados simplemente no
 * muestra ninguno (antes heredaba en silencio los dominios/KPI de 'riesgo').
 */
export function KpiCatalogProvider({ areaNegocio, children }: { areaNegocio: string; children: ReactNode }) {
  const [areas, setAreas] = useState<AreaCatalogo[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  const cargar = useCallback(async () => {
    setLoading(true)
    const [{ data: dominiosData }, { data: kpisData }] = await Promise.all([
      sb.from('kpi_dominios').select('codigo,nombre,ejecuta,controla').eq('area_negocio', areaNegocio).eq('activo', true).order('orden'),
      sb.from('kpis_catalogo').select('area_id,kpi_id,nombre,definicion').eq('area_negocio', areaNegocio).eq('activo', true).order('area_id').order('orden'),
    ])
    const dominios = (dominiosData || []) as DominioRow[]
    const filas = (kpisData || []) as KpiCatalogoRow[]
    const nuevasAreas: AreaCatalogo[] = dominios.map((d) => {
      const kpis: KpiCatalogo[] = filas.filter((f) => f.area_id === d.codigo).map((f) => ({ id: f.kpi_id, nombre: f.nombre, def: f.definicion || '' }))
      return { id: d.codigo, nombre: d.nombre, ejecuta: d.ejecuta || '', controla: d.controla || '', kpis }
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
