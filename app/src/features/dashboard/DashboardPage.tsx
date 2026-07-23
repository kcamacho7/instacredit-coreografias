import { useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { PAISES } from '../../lib/catalogs'
import { Emoji } from '../../components/Emoji'
import { DashboardCharts } from './DashboardCharts'
import { AcuerdosControlWidget } from './AcuerdosControlWidget'
import type { AreaNegocio } from '../../hooks/useAreaNegocio'

interface DashboardPageProps {
  areaNegocio: string
  nombreAreaActiva: string
  areasCatalogo: AreaNegocio[]
}

export function DashboardPage({ areaNegocio, nombreAreaActiva, areasCatalogo }: DashboardPageProps) {
  const { profile } = useAuth()
  const puedeVerTodosPaises = !!(profile && (profile.es_regional || profile.es_admin))
  const esGerentePais = !!(profile?.es_gerente_pais && profile?.pais_code)

  const opciones = useMemo(() => {
    if (puedeVerTodosPaises) return [{ code: 'ALL', nombre: 'Consolidado', bandera: '🌎' }, ...PAISES]
    return PAISES.filter((p) => profile && profile.pais_code === p.code)
  }, [puedeVerTodosPaises, profile])

  const [paisFiltro, setPaisFiltro] = useState(opciones[0]?.code || 'ALL')

  // Un gerente de país maneja varias áreas de negocio a la vez — además del
  // país (fijo, el suyo), puede elegir ver todas sus áreas consolidadas o
  // filtrar a una sola, en vez del selector global de área en AuthBar.
  const areasActivas = useMemo(() => areasCatalogo.filter((a) => a.activo), [areasCatalogo])
  const [areaFiltro, setAreaFiltro] = useState('ALL')
  const areasParaConsulta = useMemo(() => {
    if (!esGerentePais) return [areaNegocio]
    return areaFiltro === 'ALL' ? areasActivas.map((a) => a.codigo) : [areaFiltro]
  }, [esGerentePais, areaFiltro, areasActivas, areaNegocio])

  return (
    <div style={{ paddingTop: 20 }}>
      <div className="area-block proyecto-area">
        <div className="area-header">
          <h2>Dashboard de avance</h2>
          <span>Visible para todos</span>
        </div>
        <div className="area-owner">
          <strong>Qué es:</strong> avance de las acciones registradas, incluyendo tareas especiales y acuerdos de reuniones, agrupado por dominio y por KPI. Usa los filtros para ver el consolidado regional o el detalle de un país. Nota: los acuerdos de reuniones no están ligados a un país, así que solo aparecen en el consolidado.
        </div>
      </div>

      {opciones.length === 0 ? (
        <div className="sin-proyectos">Tu cuenta no tiene un país asignado — contacta a Riesgo Regional.</div>
      ) : (
        <>
          <div className="filtro-bar">
            {opciones.map((o) => (
              <button key={o.code} type="button" className={'filtro-btn' + (paisFiltro === o.code ? ' active' : '')} onClick={() => setPaisFiltro(o.code)}>
                <Emoji text={`${o.bandera} ${o.nombre}`} />
              </button>
            ))}
          </div>
          {esGerentePais && (
            <div className="filtro-bar">
              <button type="button" className={'filtro-btn' + (areaFiltro === 'ALL' ? ' active' : '')} onClick={() => setAreaFiltro('ALL')}>Todas las áreas</button>
              {areasActivas.map((a) => (
                <button key={a.codigo} type="button" className={'filtro-btn' + (areaFiltro === a.codigo ? ' active' : '')} onClick={() => setAreaFiltro(a.codigo)}>{a.nombre}</button>
              ))}
            </div>
          )}
          <div id="dashboard-publico-charts">
            <DashboardCharts areasNegocio={areasParaConsulta} paisFiltro={paisFiltro} />
          </div>
          {puedeVerTodosPaises && <AcuerdosControlWidget areaNegocio={areaNegocio} nombreAreaActiva={nombreAreaActiva} />}
        </>
      )}
    </div>
  )
}
