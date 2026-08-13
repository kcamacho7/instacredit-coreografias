import { sb } from '../../lib/supabase'
import { useDialog } from '../../components/ui/DialogProvider'
import { useToast } from '../../components/ui/ToastProvider'
import { toJson } from '../../lib/json'
import type { PerfilAcuerdo } from './AcuerdosTable'

export interface Participante {
  email: string
  nombre?: string
}

interface ParticipantesSectionProps {
  reunionId: string
  participantes: Participante[]
  perfiles: PerfilAcuerdo[]
  locked: boolean
  onGuardarCamposPendientes: () => Promise<void>
  onReload: () => void
}

export function ParticipantesSection({ reunionId, participantes, perfiles, locked, onGuardarCamposPendientes, onReload }: ParticipantesSectionProps) {
  const { mostrarPrompt } = useDialog()
  const { mostrarAlerta } = useToast()

  async function actualizarParticipantes(nuevos: Participante[]) {
    const { error } = await sb.from('reuniones').update({ participantes: toJson(nuevos) }).eq('id', reunionId)
    if (error) { mostrarAlerta('Error: ' + error.message); return }
    await onGuardarCamposPendientes()
    onReload()
  }

  async function agregarCorreo(idx: number) {
    const p = participantes[idx]
    const nuevoEmail = ((await mostrarPrompt(`Correo de ${p.nombre || 'este participante'}:`)) || '').trim().toLowerCase()
    if (!nuevoEmail) return
    if (!nuevoEmail.includes('@')) { mostrarAlerta('Pon un correo válido.'); return }
    await actualizarParticipantes(participantes.map((x, i) => (i === idx ? { ...x, email: nuevoEmail } : x)))
  }

  async function quitar(idx: number) {
    await actualizarParticipantes(participantes.filter((_, i) => i !== idx))
  }

  async function agregarParticipante() {
    const email = ((await mostrarPrompt('Correo del participante:')) || '').trim().toLowerCase()
    if (!email) return
    if (!email.includes('@')) { mostrarAlerta('Pon un correo válido.'); return }
    if (participantes.some((p) => p.email.toLowerCase() === email)) { mostrarAlerta('Ese correo ya está en la lista de participantes.'); return }
    const nombre = ((await mostrarPrompt('Nombre (opcional):')) || '').trim()
    await actualizarParticipantes([...participantes, { email, nombre }])
  }

  async function agregarDesdeUsuario(email: string) {
    const perfil = perfiles.find((p) => p.email.toLowerCase() === email.toLowerCase())
    if (!perfil) return
    if (participantes.some((p) => p.email.toLowerCase() === perfil.email.toLowerCase())) { mostrarAlerta('Ese correo ya está en la lista de participantes.'); return }
    await actualizarParticipantes([...participantes, { email: perfil.email.toLowerCase(), nombre: perfil.nombre }])
  }

  const perfilesDisponibles = perfiles.filter((p) => !participantes.some((part) => part.email.toLowerCase() === p.email.toLowerCase()))

  return (
    <div style={{ padding: '14px 20px', borderTop: '1px solid var(--gris-borde)', marginTop: 10 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--azul-claro)', textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 8 }}>
        Participantes adicionales (sin acuerdos, pero reciben la minuta)
      </label>
      {participantes.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--azul-claro)', marginBottom: 8 }}>Nadie agregado todavía.</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {participantes.map((p, idx) => {
            const sinCorreo = !p.email
            return (
              <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: sinCorreo ? '#FFF6E0' : '#F0F3F7', border: '1px solid ' + (sinCorreo ? '#E8D48A' : 'var(--gris-borde)'), borderRadius: 20, padding: '5px 6px 5px 12px', fontSize: 12.5, color: 'var(--gris-texto)' }}>
                <span>{p.nombre ? p.nombre + ' — ' : ''}{sinCorreo ? <em style={{ color: '#8a6d1f' }}>sin correo</em> : p.email}</span>
                {sinCorreo && !locked && (
                  <button type="button" title="Agregar correo" style={{ background: 'var(--verde)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '3px 8px' }} onClick={() => agregarCorreo(idx)}>+ correo</button>
                )}
                {!locked && (
                  <button type="button" title="Quitar" style={{ background: 'none', border: 'none', color: 'var(--rojo)', fontSize: 15, fontWeight: 700, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }} onClick={() => quitar(idx)}>×</button>
                )}
              </span>
            )
          })}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {perfilesDisponibles.length > 0 && (
          <select
            disabled={locked}
            value=""
            onChange={(e) => { if (e.target.value) agregarDesdeUsuario(e.target.value) }}
            style={{ fontSize: 12.5, padding: '6px 8px' }}
          >
            <option value="">+ Agregar desde usuarios existentes…</option>
            {perfilesDisponibles.map((p) => (
              <option key={p.email} value={p.email.toLowerCase()}>
                {p.nombre ? p.nombre + ' — ' : ''}{p.email}{p.pais_code ? ' — ' + p.pais_code : ''}
              </option>
            ))}
          </select>
        )}
        <button type="button" className="add-row-btn" disabled={locked} onClick={agregarParticipante}>+ Agregar participante manual</button>
      </div>
    </div>
  )
}
