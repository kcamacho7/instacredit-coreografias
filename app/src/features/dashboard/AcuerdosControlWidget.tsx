import { useEffect, useMemo, useState } from 'react'
import { Bar } from 'react-chartjs-2'
import '../../lib/chartSetup'
import { CHART_COLORS, ESTADOS } from '../../lib/chartSetup'
import { sb } from '../../lib/supabase'
import { lunesDeLaSemana, etiquetaSemana } from '../../lib/dashboardMetrics'
import { CollapsibleSection } from '../../components/CollapsibleSection'

interface AcuerdoUsuario {
  email: string
  nombre: string
  cantidad: number
}

interface AcuerdosControlWidgetProps {
  areaNegocio: string
  nombreAreaActiva: string
}

export function AcuerdosControlWidget({ areaNegocio, nombreAreaActiva }: AcuerdosControlWidgetProps) {
  const [reuniones, setReuniones] = useState<{ fecha: string | null }[] | null>(null)
  const [acuerdos, setAcuerdos] = useState<{ responsable_email: string; responsable_nombre: string | null; estado: string }[] | null>(null)
  const [filtroUsuario, setFiltroUsuario] = useState('')

  useEffect(() => {
    let activo = true
    setReuniones(null); setAcuerdos(null)
    ;(async () => {
      const [{ data: reunionesData }, { data: acuerdosData }, { data: perfiles }] = await Promise.all([
        sb.from('reuniones').select('id,fecha').eq('area_negocio', areaNegocio),
        sb.from('acuerdos_reunion').select('responsable_email,responsable_nombre,estado').eq('area_negocio', areaNegocio),
        sb.from('perfiles_usuario').select('email,nombre').eq('area_negocio', areaNegocio),
      ])
      if (!activo) return
      const nombrePorEmail = new Map((perfiles || []).map((p) => [(p.email || '').toLowerCase(), p.nombre]))
      setReuniones(reunionesData || [])
      setAcuerdos((acuerdosData || []).map((a) => ({ ...a, responsable_nombre: a.responsable_nombre || nombrePorEmail.get((a.responsable_email || '').toLowerCase()) || null })))
    })()
    return () => { activo = false }
  }, [areaNegocio])

  const filasUsuarios: AcuerdoUsuario[] = useMemo(() => {
    if (!acuerdos) return []
    const conteo = new Map<string, AcuerdoUsuario>()
    let sinResp = 0
    acuerdos.forEach((a) => {
      const email = (a.responsable_email || '').trim().toLowerCase()
      if (!email) { sinResp++; return }
      if (!conteo.has(email)) conteo.set(email, { email, nombre: a.responsable_nombre || '', cantidad: 0 })
      conteo.get(email)!.cantidad++
    })
    void sinResp
    return [...conteo.values()].sort((a, b) => b.cantidad - a.cantidad)
  }, [acuerdos])

  const sinResponsable = useMemo(() => (acuerdos || []).filter((a) => !a.responsable_email?.trim()).length, [acuerdos])

  if (reuniones === null || acuerdos === null) {
    return (
      <CollapsibleSection titulo="Control de acuerdos" etiqueta={`Solo Regional/Admin de ${nombreAreaActiva}`} queEs="resumen de reuniones registradas y acuerdos por responsable, en todas las reuniones del sistema.">
        <div className="sin-proyectos">Cargando…</div>
      </CollapsibleSection>
    )
  }

  const totalReuniones = reuniones.length

  const conteoPorSemana = new Map<string, number>()
  reuniones.forEach((r) => {
    if (!r.fecha) return
    const key = lunesDeLaSemana(r.fecha).toISOString().slice(0, 10)
    conteoPorSemana.set(key, (conteoPorSemana.get(key) || 0) + 1)
  })
  const semanasOrdenadas = [...conteoPorSemana.keys()].sort()

  const alturaUsuarios = Math.max(220, filasUsuarios.length * 26)
  const acuerdosBase = filtroUsuario ? acuerdos.filter((a) => (a.responsable_email || '').trim().toLowerCase() === filtroUsuario) : acuerdos

  return (
    <CollapsibleSection titulo="Control de acuerdos" etiqueta={`Solo Regional/Admin de ${nombreAreaActiva}`} queEs="resumen de reuniones registradas y acuerdos por responsable, en todas las reuniones del sistema.">
      <div className="dashboard-kpis">
        <div className="kpi-stat"><div className="valor">{totalReuniones}</div><div className="etiqueta">Reuniones registradas</div></div>
        <div className="kpi-stat"><div className="valor" style={{ color: 'var(--verde)' }}>{filasUsuarios.length}</div><div className="etiqueta">Usuarios con acuerdos</div></div>
        <div className="kpi-stat"><div className="valor" style={{ color: 'var(--azul-claro)' }}>{acuerdos.length}</div><div className="etiqueta">Total de acuerdos</div></div>
      </div>

      {totalReuniones === 0 && filasUsuarios.length === 0 ? (
        <div className="sin-proyectos">Sin reuniones ni acuerdos registrados todavía.</div>
      ) : (
        <>
          <div className="dashboard-grid">
            <div className="dashboard-card full">
              <h4>Reuniones por semana</h4>
              <div className="subtitulo">Cantidad de reuniones creadas cada semana (lunes a domingo)</div>
              {totalReuniones > 0 ? (
                <Bar
                  data={{ labels: semanasOrdenadas.map(etiquetaSemana), datasets: [{ label: 'Reuniones', data: semanasOrdenadas.map((k) => conteoPorSemana.get(k) || 0), backgroundColor: '#002554', borderRadius: 4 }] }}
                  options={{ scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { display: false } } }}
                />
              ) : <div className="sin-proyectos">Sin reuniones registradas todavía.</div>}
            </div>

            <div className="dashboard-card full">
              <h4>Acuerdos por usuario</h4>
              <div className="subtitulo">Cantidad de acuerdos asignados a cada responsable</div>
              {filasUsuarios.length > 0 ? (
                <div style={{ maxHeight: alturaUsuarios }}>
                  <Bar
                    data={{ labels: filasUsuarios.map((u) => u.nombre || u.email), datasets: [{ label: 'Acuerdos', data: filasUsuarios.map((u) => u.cantidad), backgroundColor: '#4C9C2E', borderRadius: 4 }] }}
                    options={{ indexAxis: 'y' as const, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { display: false } } }}
                  />
                </div>
              ) : <div className="sin-proyectos">Sin acuerdos con responsable asignado todavía.</div>}
            </div>

            <div className="dashboard-card full">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h4 style={{ margin: 0 }}>Acuerdos por estado</h4>
                  <div className="subtitulo">Consolidado, o filtrado por responsable</div>
                </div>
                <select value={filtroUsuario} onChange={(e) => setFiltroUsuario(e.target.value)} style={{ fontFamily: "'Inter Tight',sans-serif", fontSize: '12.5px', border: '1px solid var(--gris-borde)', borderRadius: '5px', padding: '6px 9px', background: '#FAFDF9', color: 'var(--gris-texto)' }}>
                  <option value="">Consolidado (todos)</option>
                  {filasUsuarios.map((u) => <option key={u.email} value={u.email}>{u.nombre || u.email}</option>)}
                </select>
              </div>
              {acuerdos.length > 0 ? (
                <Bar
                  data={{ labels: [...ESTADOS], datasets: [{ label: 'Acuerdos', data: ESTADOS.map((e) => acuerdosBase.filter((a) => (a.estado || 'Pendiente') === e).length), backgroundColor: ESTADOS.map((e) => CHART_COLORS[e]), borderRadius: 4 }] }}
                  options={{ scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { display: false } } }}
                />
              ) : <div className="sin-proyectos">Sin acuerdos registrados todavía.</div>}
            </div>
          </div>

          {sinResponsable > 0 && (
            <div style={{ padding: '0 20px 14px 20px', fontSize: 12, color: 'var(--azul-claro)' }}>
              {sinResponsable} acuerdo(s) todavía sin responsable asignado (no incluidos en el gráfico).
            </div>
          )}
        </>
      )}
    </CollapsibleSection>
  )
}
