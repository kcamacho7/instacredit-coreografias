import { useEffect, useState } from 'react'
import { sb } from '../../lib/supabase'
import { CollapsibleCard } from '../../components/CollapsibleCard'
import { CHART_COLORS } from '../../lib/chartSetup'

interface ReunionRow {
  id: string
  titulo: string
  fecha: string | null
  estado: string
  envio_enviado_at: string | null
}

interface AcuerdoRow {
  id: string
  reunion_id: string | null
  descripcion: string
  responsable_nombre: string | null
  responsable_email: string
  fecha: string | null
  estado: string
}

interface SeguimientoMinutasTabProps {
  areaNegocio: string
}

const ESTADO_REUNION_LABEL: Record<string, string> = {
  pendiente_procesar: '🕓 Pendiente de procesar',
  procesada: '✅ Procesada',
  error: '⚠️ Error al procesar',
}

/**
 * Vista de solo lectura: cómo va evolucionando el cumplimiento de cada
 * acuerdo, agrupado por la persona responsable, dentro de cada reunión —
 * sin importar quién creó la minuta. La edición sigue viviendo en "Acuerdos
 * de reuniones" (creador) o en la vista personal de cada responsable.
 */
export function SeguimientoMinutasTab({ areaNegocio }: SeguimientoMinutasTabProps) {
  const [reuniones, setReuniones] = useState<ReunionRow[] | null>(null)
  const [acuerdosPorReunion, setAcuerdosPorReunion] = useState<Record<string, AcuerdoRow[]>>({})

  useEffect(() => {
    let activo = true
    ;(async () => {
      const { data: reunionesData } = await sb.from('reuniones')
        .select('id,titulo,fecha,estado,envio_enviado_at')
        .eq('area_negocio', areaNegocio)
        .order('fecha', { ascending: false })
      if (!activo) return
      const ids = (reunionesData || []).map((r) => r.id)
      const { data: acuerdosData } = ids.length
        ? await sb.from('acuerdos_reunion').select('id,reunion_id,descripcion,responsable_nombre,responsable_email,fecha,estado').in('reunion_id', ids)
        : { data: [] as AcuerdoRow[] }
      if (!activo) return

      const mapa: Record<string, AcuerdoRow[]> = {}
      ;(acuerdosData || []).forEach((a) => {
        const key = a.reunion_id || ''
        if (!mapa[key]) mapa[key] = []
        mapa[key].push(a)
      })
      setAcuerdosPorReunion(mapa)
      setReuniones(reunionesData || [])
    })()
    return () => { activo = false }
  }, [areaNegocio])

  if (reuniones === null) return <div className="sin-proyectos">Cargando…</div>

  return (
    <div style={{ paddingTop: 20 }}>
      <div className="area-owner" style={{ borderRadius: 8, marginBottom: 16 }}>
        <strong>Qué es:</strong> seguimiento de cómo cada responsable va actualizando sus acuerdos de minuta — agrupados por persona dentro de cada reunión, con la fecha y el estado siempre en vivo (aunque la minuta ya esté enviada y bloqueada).
      </div>
      {reuniones.length === 0 ? (
        <div className="sin-proyectos">Sin reuniones registradas todavía en esta área.</div>
      ) : (
        reuniones.map((r) => <ReunionSeguimiento key={r.id} reunion={r} acuerdos={acuerdosPorReunion[r.id] || []} />)
      )}
    </div>
  )
}

function ReunionSeguimiento({ reunion, acuerdos }: { reunion: ReunionRow; acuerdos: AcuerdoRow[] }) {
  const [abierta, setAbierta] = useState(false)
  const estadoLabel = reunion.envio_enviado_at ? '📧 Enviada' : (ESTADO_REUNION_LABEL[reunion.estado] || reunion.estado)
  const total = acuerdos.length
  const cumplidos = acuerdos.filter((a) => a.estado === 'Cumplida').length

  const porUsuario = new Map<string, AcuerdoRow[]>()
  acuerdos.forEach((a) => {
    const key = a.responsable_email || '(sin responsable)'
    if (!porUsuario.has(key)) porUsuario.set(key, [])
    porUsuario.get(key)!.push(a)
  })

  return (
    <CollapsibleCard
      titulo={reunion.titulo || '(sin título)'}
      variant="reunion"
      open={abierta}
      onToggle={setAbierta}
      metaRight={
        <span style={{ fontSize: 12, color: 'var(--azul-claro)', whiteSpace: 'nowrap' }}>
          {reunion.fecha || ''} · {estadoLabel} · {cumplidos}/{total} cumplidos
        </span>
      }
    >
      {porUsuario.size === 0 ? (
        <div className="sin-proyectos">Sin acuerdos registrados en esta reunión.</div>
      ) : (
        [...porUsuario.entries()].map(([email, lista]) => (
          <div key={email} style={{ padding: '12px 20px', borderBottom: '1px solid var(--gris-borde)' }}>
            <div style={{ fontWeight: 700, color: 'var(--azul)', fontSize: 13, marginBottom: 8 }}>
              {lista[0].responsable_nombre || email}
              {lista[0].responsable_nombre && <span style={{ fontWeight: 400, color: 'var(--azul-claro)', fontSize: 12 }}> — {email}</span>}
            </div>
            {lista.map((a) => (
              <div key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', fontSize: 13, flexWrap: 'wrap' }}>
                <span style={{ flex: 1, minWidth: 200 }}>{a.descripcion || '(sin descripción)'}</span>
                <span style={{ fontSize: 12, color: 'var(--azul-claro)', whiteSpace: 'nowrap' }}>{a.fecha || 'Sin fecha'}</span>
                <span style={{
                  fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 20, color: '#fff',
                  background: CHART_COLORS[a.estado] || 'var(--azul-claro)', whiteSpace: 'nowrap',
                }}>
                  {a.estado}
                </span>
              </div>
            ))}
          </div>
        ))
      )}
    </CollapsibleCard>
  )
}
