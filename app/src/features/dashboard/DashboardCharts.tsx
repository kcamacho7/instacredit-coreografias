import { useEffect, useMemo, useState } from 'react'
import { Bar, Doughnut } from 'react-chartjs-2'
import '../../lib/chartSetup'
import { CHART_COLORS, ESTADOS } from '../../lib/chartSetup'
import { sb } from '../../lib/supabase'
import { PAISES } from '../../lib/catalogs'
import { construirTodas, ordenarVencidas, type AccionAgregada, type OrdenVencidas } from '../../lib/dashboardMetrics'

interface DashboardChartsProps {
  areaNegocio: string
  paisFiltro: string
}

const legendBottom = { legend: { position: 'bottom' as const, labels: { boxWidth: 12, font: { size: 11 } } } }

export function DashboardCharts({ areaNegocio, paisFiltro }: DashboardChartsProps) {
  const [todas, setTodas] = useState<AccionAgregada[] | null>(null)
  const [orden, setOrden] = useState<OrdenVencidas>({ campo: 'pais', dir: 'asc' })
  const [filtroUsuarioEstado, setFiltroUsuarioEstado] = useState('')

  useEffect(() => {
    let activo = true
    setTodas(null)
    ;(async () => {
      const [{ data: coreoData }, { data: proyData }, { data: customData }, { data: reunionesData }, { data: acuerdosData }] = await Promise.all([
        sb.from('coreografias').select('*').eq('area_negocio', areaNegocio),
        sb.from('proyectos_especiales').select('*').eq('area_negocio', areaNegocio),
        sb.from('kpis_adicionales').select('*').eq('area_negocio', areaNegocio),
        sb.from('reuniones').select('id,titulo').eq('area_negocio', areaNegocio),
        sb.from('acuerdos_reunion').select('*').eq('area_negocio', areaNegocio),
      ])
      if (!activo) return
      setTodas(construirTodas(coreoData as never, proyData as never, customData as never, reunionesData, acuerdosData as never))
    })()
    return () => { activo = false }
  }, [areaNegocio])

  const nombrePais = (code: string) => PAISES.find((p) => p.code === code)?.nombre || code

  const acciones = useMemo(() => {
    if (!todas) return []
    return !paisFiltro || paisFiltro === 'ALL' ? todas : todas.filter((a) => a.pais === paisFiltro)
  }, [todas, paisFiltro])

  if (todas === null) return <div className="sin-proyectos">Cargando dashboard…</div>
  if (acciones.length === 0) {
    return <div className="sin-proyectos">No hay acciones registradas todavía para graficar{paisFiltro && paisFiltro !== 'ALL' ? ' en este país' : ''}.</div>
  }

  const total = acciones.length
  const cumplidas = acciones.filter((a) => a.estado === 'Cumplida').length
  const vencidas = acciones.filter((a) => a.estado === 'Vencida').length
  const enCurso = acciones.filter((a) => a.estado === 'En curso').length
  const avancePct = Math.round((cumplidas / total) * 100)

  const vencidasOrdenadas = ordenarVencidas(acciones, orden, nombrePais)

  const paisesConDatos = PAISES.map((p) => {
    const deEstePais = todas.filter((a) => a.pais === p.code)
    const pct = deEstePais.length ? Math.round((deEstePais.filter((a) => a.estado === 'Cumplida').length / deEstePais.length) * 100) : 0
    return { nombre: p.nombre, pct, esFiltro: p.code === paisFiltro }
  })

  const dominios = [...new Set(acciones.map((a) => a.dominio))].sort()
  const porKpi: Record<string, { total: number } & Record<string, number>> = {}
  acciones.forEach((a) => {
    if (!porKpi[a.kpi]) porKpi[a.kpi] = { total: 0, Pendiente: 0, 'En curso': 0, Cumplida: 0, Vencida: 0 }
    porKpi[a.kpi].total++
    porKpi[a.kpi][a.estado] = (porKpi[a.kpi][a.estado] || 0) + 1
  })
  const topKpis = Object.entries(porKpi).sort((a, b) => b[1].total - a[1].total).slice(0, 10)

  const responsables = [...new Set(acciones.map((a) => a.responsable).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const accionesPorEstadoBase = filtroUsuarioEstado ? acciones.filter((a) => a.responsable === filtroUsuarioEstado) : acciones

  function alternarOrden(campo: 'pais' | 'fecha') {
    setOrden((prev) => (prev.campo === campo ? { campo, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { campo, dir: campo === 'fecha' ? 'desc' : 'asc' }))
  }
  const flecha = (campo: 'pais' | 'fecha') => (orden.campo === campo ? (orden.dir === 'asc' ? '▲' : '▼') : '')

  return (
    <>
      <div className="dashboard-kpis">
        <div className="kpi-stat"><div className="valor">{total}</div><div className="etiqueta">Acciones totales</div></div>
        <div className="kpi-stat"><div className="valor" style={{ color: 'var(--verde)' }}>{avancePct}%</div><div className="etiqueta">Avance (cumplidas)</div></div>
        <div className="kpi-stat"><div className="valor" style={{ color: 'var(--azul-claro)' }}>{enCurso}</div><div className="etiqueta">En curso</div></div>
        <div className="kpi-stat"><div className="valor" style={{ color: 'var(--rojo)' }}>{vencidas}</div><div className="etiqueta">Vencidas</div></div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h4>Estado general</h4>
          <div className="subtitulo">Distribución de todas las acciones</div>
          <Doughnut
            data={{ labels: [...ESTADOS], datasets: [{ data: ESTADOS.map((e) => acciones.filter((a) => a.estado === e).length), backgroundColor: ESTADOS.map((e) => CHART_COLORS[e]) }] }}
            options={{ plugins: legendBottom }}
          />
        </div>

        <div className="dashboard-card">
          <h4>Avance por país</h4>
          <div className="subtitulo">% de acciones cumplidas por país</div>
          <Bar
            data={{ labels: paisesConDatos.map((p) => p.nombre), datasets: [{ label: '% cumplidas', data: paisesConDatos.map((p) => p.pct), backgroundColor: paisesConDatos.map((p) => (p.esFiltro ? '#002554' : '#4C9C2E')), borderRadius: 4 }] }}
            options={{ scales: { y: { beginAtZero: true, max: 100, ticks: { callback: (v) => v + '%' } } }, plugins: { legend: { display: false } } }}
          />
        </div>

        <div className="dashboard-card full">
          <h4>Avance por dominio</h4>
          <div className="subtitulo">Cantidad de acciones por estado, en cada dominio y en proyectos especiales</div>
          <Bar
            data={{ labels: dominios, datasets: ESTADOS.map((e) => ({ label: e, data: dominios.map((d) => acciones.filter((a) => a.dominio === d && a.estado === e).length), backgroundColor: CHART_COLORS[e] })) }}
            options={{ scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } }, plugins: legendBottom }}
          />
        </div>

        <div className="dashboard-card full">
          <h4>Avance por KPI</h4>
          <div className="subtitulo">Los 10 KPI/proyectos con más acciones registradas</div>
          <Bar
            data={{ labels: topKpis.map(([nombre]) => nombre), datasets: ESTADOS.map((e) => ({ label: e, data: topKpis.map(([, v]) => v[e] || 0), backgroundColor: CHART_COLORS[e], borderRadius: 4 })) }}
            options={{ indexAxis: 'y' as const, scales: { x: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }, y: { stacked: true, ticks: { font: { size: 10.5 } } } }, plugins: legendBottom }}
          />
        </div>

        <div className="dashboard-card full">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h4 style={{ margin: 0 }}>Acciones por estado</h4>
              <div className="subtitulo">Consolidado, o filtrado por responsable</div>
            </div>
            <select value={filtroUsuarioEstado} onChange={(e) => setFiltroUsuarioEstado(e.target.value)} style={{ fontFamily: "'Inter Tight',sans-serif", fontSize: '12.5px', border: '1px solid var(--gris-borde)', borderRadius: '5px', padding: '6px 9px', background: '#FAFDF9', color: 'var(--gris-texto)' }}>
              <option value="">Consolidado (todos)</option>
              {responsables.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <Bar
            data={{ labels: [...ESTADOS], datasets: [{ label: 'Acciones', data: ESTADOS.map((e) => accionesPorEstadoBase.filter((a) => a.estado === e).length), backgroundColor: ESTADOS.map((e) => CHART_COLORS[e]), borderRadius: 4 }] }}
            options={{ scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { display: false } } }}
          />
        </div>

        <div className="dashboard-card full">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <h4>⚠️ Acciones vencidas</h4>
              <div className="subtitulo">Fecha de compromiso ya superada y sin cumplir. Se actualiza sola todos los días.</div>
            </div>
          </div>
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table className="coreo">
              <tbody>
                <tr>
                  <th style={{ width: '14%', cursor: 'pointer' }} onClick={() => alternarOrden('pais')}>País <span className="orden-flecha">{flecha('pais')}</span></th>
                  <th style={{ width: '22%' }}>KPI / Proyecto</th>
                  <th style={{ width: '34%' }}>Acción</th>
                  <th style={{ width: '16%' }}>Responsable</th>
                  <th style={{ width: '14%', cursor: 'pointer' }} onClick={() => alternarOrden('fecha')}>Fecha <span className="orden-flecha">{flecha('fecha')}</span></th>
                </tr>
                {vencidasOrdenadas.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--azul-claro)', padding: 16 }}>Sin acciones vencidas 🎉</td></tr>
                ) : vencidasOrdenadas.map((a, i) => (
                  <tr key={i}>
                    <td>{nombrePais(a.pais)}</td>
                    <td>{a.kpi}</td>
                    <td>{a.accionTexto}</td>
                    <td>{a.responsable}</td>
                    <td style={{ color: 'var(--rojo)', fontWeight: 700 }}>{a.fecha || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
