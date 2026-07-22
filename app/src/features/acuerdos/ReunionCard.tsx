import { useEffect, useState } from 'react'
import { sb } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useDialog } from '../../components/ui/DialogProvider'
import { useToast } from '../../components/ui/ToastProvider'
import { useAutoGrowTextarea } from '../../hooks/useAutoGrowTextarea'
import { useEdgeFunctionProgress } from '../../hooks/useEdgeFunctionProgress'
import { CollapsibleCard } from '../../components/CollapsibleCard'
import { AcuerdosTable, type AcuerdoReunion, type PerfilAcuerdo } from './AcuerdosTable'
import { ParticipantesSection, type Participante } from './ParticipantesSection'
import type { Tables } from '../../types/database.types'

export type Reunion = Tables<'reuniones'>

interface HistorialEdicion {
  accion: 'desbloqueo' | 'edicion'
  usuario_email: string
  usuario_nombre: string
  fecha: string
}

function minutaBloqueada(reunion: Reunion, diasBloqueoMinuta: number): boolean {
  const inicio = reunion.desbloqueada_en || reunion.creado_at
  if (!inicio) return false
  const limite = new Date(inicio)
  limite.setDate(limite.getDate() + diasBloqueoMinuta)
  return new Date() >= limite
}

interface ReunionCardProps {
  reunion: Reunion
  acuerdosIniciales: AcuerdoReunion[]
  perfiles: PerfilAcuerdo[]
  diasBloqueoMinuta: number
  abierta: boolean
  onToggleAbierta: (abierta: boolean) => void
  onReload: () => void
}

export function ReunionCard({ reunion, acuerdosIniciales, perfiles, diasBloqueoMinuta, abierta, onToggleAbierta, onReload }: ReunionCardProps) {
  const { user, profile, regionalUnlocked } = useAuth()
  const { mostrarConfirm } = useDialog()
  const { mostrarAlerta } = useToast()
  const procesarIA = useEdgeFunctionProgress()
  const enviarMinuta = useEdgeFunctionProgress()

  const [titulo, setTitulo] = useState(reunion.titulo || '')
  const [minuta, setMinuta] = useState(reunion.minuta || '')
  const [acuerdos, setAcuerdos] = useState<AcuerdoReunion[]>(acuerdosIniciales)
  const minutaRef = useAutoGrowTextarea(minuta)

  useEffect(() => { setTitulo(reunion.titulo || '') }, [reunion.titulo])
  useEffect(() => { setMinuta(reunion.minuta || '') }, [reunion.minuta])
  useEffect(() => { setAcuerdos(acuerdosIniciales) }, [acuerdosIniciales])

  const esCreadorReunion = !!(user?.email && reunion.creado_por_email && reunion.creado_por_email.toLowerCase() === user.email.toLowerCase())
  const puedeGestionarBloqueo = esCreadorReunion || regionalUnlocked
  const bloqueada = minutaBloqueada(reunion, diasBloqueoMinuta)
  const participantes: Participante[] = Array.isArray(reunion.participantes) ? (reunion.participantes as unknown as Participante[]) : []

  const estadoLabel = reunion.envio_enviado_at
    ? '📨 Guardada y enviada'
    : ({ pendiente_procesar: '🕓 Pendiente de procesar', procesada: '✅ Procesada', error: '⚠️ Error al procesar' } as Record<string, string>)[reunion.estado] || reunion.estado

  async function guardarCamposPendientes() {
    for (const ac of acuerdos) {
      await sb.from('acuerdos_reunion').update({
        descripcion: ac.descripcion, responsable_nombre: ac.responsable_nombre, fecha: ac.fecha || null, estado: ac.estado,
      }).eq('id', ac.id)
    }
  }

  async function eliminarReunion() {
    const ok = await mostrarConfirm('¿Eliminar esta reunión y todos sus acuerdos? Esta acción no se puede deshacer.')
    if (!ok) return
    await sb.from('reuniones').delete().eq('id', reunion.id)
    onReload()
  }

  async function desbloquear() {
    const ok = await mostrarConfirm(`¿Desbloquear esta minuta para editarla? Quedará registrado quién y cuándo la desbloqueó, y vuelve a bloquearse sola en ${diasBloqueoMinuta} día(s).`)
    if (!ok) return
    const historial: HistorialEdicion[] = Array.isArray(reunion.historial_ediciones) ? (reunion.historial_ediciones as unknown as HistorialEdicion[]) : []
    historial.push({ accion: 'desbloqueo', usuario_email: user?.email?.toLowerCase() || '', usuario_nombre: profile?.nombre || '', fecha: new Date().toISOString() })
    const { error } = await sb.from('reuniones').update({ desbloqueada_en: new Date().toISOString(), historial_ediciones: historial as never }).eq('id', reunion.id)
    if (error) { mostrarAlerta('Error: ' + error.message); return }
    onReload()
  }

  async function procesarConIA() {
    const resultado = await procesarIA.invocar({
      nombreFuncion: 'generar-minuta',
      reunionId: reunion.id,
      mensajeError: 'No se pudo procesar la minuta con IA:',
      onOk: (data) => `✅ Minuta lista — se generaron ${data.acuerdos || 0} acuerdo(s).`,
    })
    if (!resultado.ok) mostrarAlerta(resultado.mensaje)
    onReload()
  }

  async function reintentarEnvio() {
    const resultado = await enviarMinuta.invocar({
      nombreFuncion: 'enviar-minuta',
      reunionId: reunion.id,
      mensajeError: 'Minuta guardada, pero no se pudo enviar el correo:',
      onOk: (data) => `✅ Minuta enviada — ${data.enviados || 0} correo(s) despachados.`,
    })
    if (!resultado.ok) mostrarAlerta(resultado.mensaje + '\n\nPuedes reintentar el envío desde esta misma tarjeta.')
    onReload()
  }

  async function guardarMinuta() {
    for (const ac of acuerdos) {
      if (!ac.responsable_email?.trim()) {
        mostrarAlerta('Todos los acuerdos necesitan un responsable asignado antes de guardar la minuta. Revisa la fila marcada en rojo.')
        return
      }
    }
    for (const ac of acuerdos) {
      const { error } = await sb.from('acuerdos_reunion').update({
        descripcion: ac.descripcion, responsable_nombre: ac.responsable_nombre, responsable_email: (ac.responsable_email || '').trim().toLowerCase(),
        fecha: ac.fecha || null, estado: ac.estado,
      }).eq('id', ac.id)
      if (error) { mostrarAlerta('Error al guardar: ' + error.message); return }
    }

    const camposReunion: Partial<Reunion> = { titulo: titulo.trim(), minuta }
    if (reunion.desbloqueada_en) {
      const historial: HistorialEdicion[] = Array.isArray(reunion.historial_ediciones) ? (reunion.historial_ediciones as unknown as HistorialEdicion[]) : []
      historial.push({ accion: 'edicion', usuario_email: user?.email?.toLowerCase() || '', usuario_nombre: profile?.nombre || '', fecha: new Date().toISOString() })
      camposReunion.historial_ediciones = historial as never
    }
    const enviar = await mostrarConfirm('Minuta guardada.\n\n¿Deseas además enviarla por correo a los responsables y a Riesgo Regional?\n\nAceptar = Guardar y enviar\nCancelar = Solo guardar')
    const { error: errReunion } = await sb.from('reuniones').update(camposReunion as never).eq('id', reunion.id)
    if (errReunion) { mostrarAlerta('No se pudo guardar el título/minuta: ' + errReunion.message); return }
    if (!enviar) { mostrarAlerta('Minuta guardada.'); onReload(); return }
    await reintentarEnvio()
  }

  const progresoTexto = (p: ReturnType<typeof useEdgeFunctionProgress>['estado'], accionando: string) => {
    if (p.tipo === 'cargando') return `${accionando} ${p.segundos}s`
    if (p.tipo === 'ok') return p.mensaje
    if (p.tipo === 'error') return `⚠️ ${p.mensaje}`
    return ''
  }

  return (
    <CollapsibleCard
      titulo={titulo}
      onTituloChange={setTitulo}
      placeholder="(sin título)"
      variant="reunion"
      locked={bloqueada}
      open={abierta}
      onToggle={onToggleAbierta}
      metaRight={<span style={{ fontSize: 12, color: 'var(--azul-claro)', whiteSpace: 'nowrap', marginRight: 12 }}>{reunion.fecha || ''} {estadoLabel}</span>}
      onEliminar={eliminarReunion}
      eliminarLabel="Eliminar reunión"
    >
      {bloqueada && (
        <div style={{ padding: '10px 20px', background: '#FFF6E0', borderBottom: '1px solid #E8D48A', fontSize: 12.5, color: '#8a6d1f', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>🔒 Esta minuta quedó definitiva y no se puede editar (se bloquea sola a los {diasBloqueoMinuta} día(s) de creada).</span>
          {puedeGestionarBloqueo && (
            <button type="button" className="btn-desbloquear-minuta" style={{ background: 'var(--azul)', color: '#fff', border: 'none', borderRadius: 5, padding: '5px 10px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', flex: '0 0 auto' }} onClick={desbloquear}>
              Desbloquear para editar
            </button>
          )}
        </div>
      )}

      {Array.isArray(reunion.historial_ediciones) && (reunion.historial_ediciones as unknown[]).length > 0 && (
        <div style={{ padding: '8px 20px', background: '#F0F3F7', borderBottom: '1px solid var(--gris-borde)', fontSize: 11.5, color: 'var(--azul-claro)' }}>
          <strong style={{ color: 'var(--azul)' }}>Historial de bloqueo:</strong>{' '}
          {(reunion.historial_ediciones as unknown as HistorialEdicion[]).map((h, i) => (
            <span key={i}>{i > 0 && ' · '}{h.usuario_nombre || h.usuario_email || 'alguien'} — {h.accion === 'desbloqueo' ? 'desbloqueada' : 'editada tras desbloqueo'} — {h.fecha ? new Date(h.fecha).toLocaleString('es-CR') : ''}</span>
          ))}
        </div>
      )}

      {(reunion.estado === 'pendiente_procesar' || reunion.estado === 'error') && (
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--gris-borde)' }}>
          <button type="button" className="add-proyecto-btn" style={{ margin: 0 }} disabled={procesarIA.estado.tipo === 'cargando'} onClick={procesarConIA}>🔄 Procesar con IA</button>
          {procesarIA.estado.tipo !== 'inactivo' && (
            <div style={{ marginTop: 10, padding: '10px 14px', background: '#fff', border: '1px solid var(--gris-borde)', borderRadius: 6, fontSize: 13 }}>
              <strong style={{ color: procesarIA.estado.tipo === 'error' ? 'var(--rojo)' : procesarIA.estado.tipo === 'ok' ? 'var(--verde)' : 'var(--azul)' }}>
                {procesarIA.estado.tipo === 'cargando' ? '🤖 Analizando la transcripción con IA…' : progresoTexto(procesarIA.estado, '')}
              </strong>
              {procesarIA.estado.tipo === 'cargando' && ` ${procesarIA.estado.segundos}s`}
            </div>
          )}
        </div>
      )}

      {reunion.envio_pendiente && (
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--gris-borde)' }}>
          <button type="button" className="add-proyecto-btn" style={{ margin: 0, background: 'var(--verde)' }} disabled={enviarMinuta.estado.tipo === 'cargando'} onClick={reintentarEnvio}>📧 Reintentar envío por correo</button>
          {enviarMinuta.estado.tipo !== 'inactivo' && (
            <div style={{ marginTop: 10, padding: '10px 14px', background: '#fff', border: '1px solid var(--gris-borde)', borderRadius: 6, fontSize: 13 }}>
              <strong style={{ color: enviarMinuta.estado.tipo === 'error' ? 'var(--rojo)' : enviarMinuta.estado.tipo === 'ok' ? 'var(--verde)' : 'var(--azul)' }}>
                {enviarMinuta.estado.tipo === 'cargando' ? '📧 Enviando minuta por correo…' : progresoTexto(enviarMinuta.estado, '')}
              </strong>
              {enviarMinuta.estado.tipo === 'cargando' && ` ${enviarMinuta.estado.segundos}s`}
            </div>
          )}
        </div>
      )}

      {reunion.minuta && (
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--gris-borde)' }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--azul-claro)', textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 4 }}>Minuta</label>
          <textarea ref={minutaRef} rows={4} disabled={bloqueada} style={{ width: '100%', fontSize: 13, whiteSpace: 'pre-wrap', color: 'var(--gris-texto)', border: '1px solid var(--gris-borde)', borderRadius: 6, padding: '8px 10px' }} value={minuta} onChange={(e) => setMinuta(e.target.value)} />
        </div>
      )}

      <AcuerdosTable
        acuerdos={acuerdos}
        onChange={setAcuerdos}
        perfiles={perfiles}
        locked={bloqueada}
        areaNegocio={reunion.area_negocio}
        onGuardarCamposPendientes={guardarCamposPendientes}
        onReload={onReload}
      />

      <button
        type="button"
        className="add-row-btn"
        disabled={bloqueada}
        onClick={async () => {
          await guardarCamposPendientes()
          const { error } = await sb.from('acuerdos_reunion').insert([{ reunion_id: reunion.id, descripcion: '', responsable_nombre: '', responsable_email: '', estado: 'Pendiente', area_negocio: reunion.area_negocio }])
          if (error) { mostrarAlerta('Error: ' + error.message); return }
          onReload()
        }}
      >
        + Agregar acuerdo manual
      </button>

      <ParticipantesSection
        reunionId={reunion.id}
        participantes={participantes}
        locked={bloqueada}
        onGuardarCamposPendientes={guardarCamposPendientes}
        onReload={onReload}
      />

      {(acuerdos.length > 0 || participantes.length > 0) && (
        <button type="button" className="add-proyecto-btn" style={{ background: 'var(--verde)' }} disabled={bloqueada} onClick={guardarMinuta}>
          💾 Guardar minuta
        </button>
      )}
    </CollapsibleCard>
  )
}
