import { useState } from 'react'
import { sb } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useDialog } from '../../components/ui/DialogProvider'
import { useToast } from '../../components/ui/ToastProvider'
import { useAutoGrowTextarea } from '../../hooks/useAutoGrowTextarea'
import { aplicarCorreoAAcuerdosCoincidentes } from '../../lib/participantMatching'
import type { Tables } from '../../types/database.types'

export type AcuerdoReunion = Tables<'acuerdos_reunion'>
export interface PerfilAcuerdo {
  email: string
  nombre: string
  user_id: string | null
  pais_code: string | null
  es_regional: boolean
  es_lider: boolean
}

const ESTADOS = ['Pendiente', 'En curso', 'Cumplida', 'Vencida'] as const

interface AcuerdosTableProps {
  acuerdos: AcuerdoReunion[]
  onChange: (acuerdos: AcuerdoReunion[]) => void
  perfiles: PerfilAcuerdo[]
  locked: boolean
  areaNegocio: string
  onGuardarCamposPendientes: () => Promise<void>
  onReload: () => void
}

export function AcuerdosTable({ acuerdos, onChange, perfiles, locked, areaNegocio, onGuardarCamposPendientes, onReload }: AcuerdosTableProps) {
  const { mostrarConfirm } = useDialog()
  const { mostrarAlerta } = useToast()
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())

  const emailsConCuenta = new Set(perfiles.filter((p) => p.user_id).map((p) => p.email.toLowerCase()))
  const emailsEnLista = new Set(perfiles.map((p) => p.email.toLowerCase()))

  function actualizarCampo(id: string, campo: 'descripcion' | 'responsable_nombre' | 'fecha' | 'estado', valor: string) {
    onChange(acuerdos.map((a) => (a.id === id ? { ...a, [campo]: valor } : a)))
  }

  function toggleSeleccion(id: string, marcado: boolean) {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (marcado) next.add(id); else next.delete(id)
      return next
    })
  }

  async function eliminarUno(id: string) {
    const ok = await mostrarConfirm('¿Eliminar este acuerdo?')
    if (!ok) return
    await sb.from('acuerdos_reunion').delete().eq('id', id)
    onReload()
  }

  async function eliminarSeleccionados() {
    if (seleccionados.size === 0) return
    const ok = await mostrarConfirm(`¿Eliminar ${seleccionados.size} acuerdo(s) seleccionado(s)? Esta acción no se puede deshacer.`)
    if (!ok) return
    await sb.from('acuerdos_reunion').delete().in('id', [...seleccionados])
    onReload()
  }

  async function cambiarResponsableEmail(ac: AcuerdoReunion, valor: string) {
    onChange(acuerdos.map((a) => (a.id === ac.id ? { ...a, responsable_email: valor } : a)))
    const { error } = await sb.from('acuerdos_reunion').update({ responsable_email: valor }).eq('id', ac.id)
    if (error) { mostrarAlerta('No se pudo guardar el responsable: ' + error.message); return }
    if (valor) {
      const nCoincidentes = await aplicarCorreoAAcuerdosCoincidentes(acuerdos, ac.id, ac.responsable_nombre || '', valor)
      if (nCoincidentes > 0) { await onGuardarCamposPendientes(); onReload() }
    }
  }

  return (
    <>
      <table className="coreo">
        <tbody>
          <tr>
            <th style={{ width: '4%' }}><input type="checkbox" title="Seleccionar todos" disabled={locked} checked={seleccionados.size > 0 && seleccionados.size === acuerdos.length} onChange={(e) => setSeleccionados(e.target.checked ? new Set(acuerdos.map((a) => a.id)) : new Set())} /></th>
            <th style={{ width: '23%' }}>Acuerdo</th>
            <th style={{ width: '15%' }}>Responsable</th>
            <th style={{ width: '17%' }}>Correo</th>
            <th style={{ width: '11%' }}>Fecha</th>
            <th style={{ width: '11%' }}>Estado</th>
            <th style={{ width: '16%' }}>&nbsp;</th>
          </tr>
          {acuerdos.length === 0 && (
            <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--azul-claro)', padding: 12 }}>Sin acuerdos todavía.</td></tr>
          )}
          {acuerdos.map((ac) => (
            <AcuerdoFila
              key={ac.id}
              ac={ac}
              acuerdos={acuerdos}
              perfiles={perfiles}
              emailsEnLista={emailsEnLista}
              emailsConCuenta={emailsConCuenta}
              locked={locked}
              areaNegocio={areaNegocio}
              seleccionado={seleccionados.has(ac.id)}
              onToggleSeleccion={(marcado) => toggleSeleccion(ac.id, marcado)}
              onCampoChange={(campo, valor) => actualizarCampo(ac.id, campo, valor)}
              onCambiarResponsableEmail={(valor) => cambiarResponsableEmail(ac, valor)}
              onEliminar={() => eliminarUno(ac.id)}
              onGuardarCamposPendientes={onGuardarCamposPendientes}
              onReload={onReload}
            />
          ))}
        </tbody>
      </table>

      {seleccionados.size > 0 && (
        <button type="button" className="btn-eliminar-proyecto" style={{ margin: '8px 20px 0 20px' }} onClick={eliminarSeleccionados}>
          🗑️ Eliminar {seleccionados.size} acuerdo(s) seleccionado(s)
        </button>
      )}
    </>
  )
}

interface AcuerdoFilaProps {
  ac: AcuerdoReunion
  acuerdos: AcuerdoReunion[]
  perfiles: PerfilAcuerdo[]
  emailsEnLista: Set<string>
  emailsConCuenta: Set<string>
  locked: boolean
  areaNegocio: string
  seleccionado: boolean
  onToggleSeleccion: (marcado: boolean) => void
  onCampoChange: (campo: 'descripcion' | 'responsable_nombre' | 'fecha' | 'estado', valor: string) => void
  onCambiarResponsableEmail: (valor: string) => void
  onEliminar: () => void
  onGuardarCamposPendientes: () => Promise<void>
  onReload: () => void
}

function AcuerdoFila({
  ac, acuerdos, perfiles, emailsEnLista, emailsConCuenta, locked, areaNegocio,
  seleccionado, onToggleSeleccion, onCampoChange, onCambiarResponsableEmail, onEliminar, onGuardarCamposPendientes, onReload,
}: AcuerdoFilaProps) {
  const { profile } = useAuth()
  const { mostrarPrompt } = useDialog()
  const { mostrarAlerta } = useToast()
  const descripcionRef = useAutoGrowTextarea(ac.descripcion)
  const sinResponsable = !ac.responsable_email

  async function onSelectResponsable(valor: string) {
    if (valor !== '__nuevo__') { onCambiarResponsableEmail(valor); return }
    const nuevoEmail = ((await mostrarPrompt('Correo a preautorizar:')) || '').trim().toLowerCase()
    if (!nuevoEmail || !nuevoEmail.includes('@')) return
    if (emailsEnLista.has(nuevoEmail)) {
      mostrarAlerta('Ese correo ya existe en la lista de usuarios. Selecciónalo directamente del desplegable.')
      return
    }
    if (!profile?.es_admin) {
      mostrarAlerta('Solo Administración puede preautorizar correos nuevos. Pide que lo agreguen desde Mantenimiento de usuarios.')
      return
    }
    const nuevoNombre = ((await mostrarPrompt('Nombre completo:', ac.responsable_nombre || '')) || '').trim()
    const { error: errPre } = await sb.from('perfiles_usuario').insert([{ email: nuevoEmail, nombre: nuevoNombre, area_negocio: areaNegocio }])
    if (errPre) { mostrarAlerta('Error al preautorizar: ' + errPre.message); return }
    await onGuardarCamposPendientes()
    await sb.from('acuerdos_reunion').update({ responsable_email: nuevoEmail, responsable_nombre: nuevoNombre || ac.responsable_nombre }).eq('id', ac.id)
    await aplicarCorreoAAcuerdosCoincidentes(acuerdos, ac.id, nuevoNombre || ac.responsable_nombre || '', nuevoEmail)
    onReload()
  }

  async function preautorizarExistente() {
    if (emailsEnLista.has(ac.responsable_email.toLowerCase())) { mostrarAlerta('Ese correo ya existe en la lista de usuarios.'); return }
    if (!profile?.es_admin) {
      mostrarAlerta('Solo Administración puede preautorizar correos nuevos. Pide que lo agreguen desde Mantenimiento de usuarios.')
      return
    }
    const nombre = ((await mostrarPrompt(`Nombre completo de ${ac.responsable_email}:`, ac.responsable_nombre || '')) || '').trim()
    const { error } = await sb.from('perfiles_usuario').insert([{ email: ac.responsable_email.toLowerCase(), nombre, area_negocio: areaNegocio }])
    if (error) { mostrarAlerta('Error: ' + error.message); return }
    await onGuardarCamposPendientes()
    if (nombre) await sb.from('acuerdos_reunion').update({ responsable_nombre: nombre }).eq('id', ac.id)
    await aplicarCorreoAAcuerdosCoincidentes(acuerdos, ac.id, nombre || ac.responsable_nombre || '', ac.responsable_email.toLowerCase())
    mostrarAlerta('Correo preautorizado. Ya puede registrarse desde "Primera vez / correo recién autorizado".')
    onReload()
  }

  const tieneCuentaFaltante = ac.responsable_email && !emailsConCuenta.has(ac.responsable_email.toLowerCase())
  const yaPreautorizado = tieneCuentaFaltante && emailsEnLista.has(ac.responsable_email.toLowerCase())

  return (
    <>
      <tr>
        <td style={{ textAlign: 'center' }}><input type="checkbox" checked={seleccionado} disabled={locked} onChange={(e) => onToggleSeleccion(e.target.checked)} /></td>
        <td><textarea ref={descripcionRef} rows={1} disabled={locked} value={ac.descripcion} onChange={(e) => onCampoChange('descripcion', e.target.value)} /></td>
        <td><input type="text" disabled={locked} value={ac.responsable_nombre || ''} onChange={(e) => onCampoChange('responsable_nombre', e.target.value)} /></td>
        <td>
          <select
            className="responsable-select"
            disabled={locked}
            style={sinResponsable ? { borderColor: 'var(--rojo)' } : undefined}
            value={ac.responsable_email || ''}
            onChange={(e) => onSelectResponsable(e.target.value)}
          >
            <option value="">— Selecciona responsable —</option>
            {ac.responsable_email && !emailsEnLista.has(ac.responsable_email.toLowerCase()) && (
              <option value={ac.responsable_email}>{ac.responsable_email} (sin cuenta)</option>
            )}
            {perfiles.map((p) => (
              <option key={p.email} value={p.email.toLowerCase()}>
                {p.nombre ? p.nombre + ' — ' : ''}{p.email}{p.pais_code ? ' — ' + p.pais_code : ''}{p.es_regional ? ' (Regional)' : ''}{p.es_lider ? ' (Líder)' : ''}
              </option>
            ))}
            <option value="__nuevo__">+ Agregar correo nuevo…</option>
          </select>
        </td>
        <td><input type="date" disabled={locked} value={ac.fecha || ''} onChange={(e) => onCampoChange('fecha', e.target.value)} /></td>
        <td>
          <select disabled={locked} value={ac.estado} onChange={(e) => onCampoChange('estado', e.target.value)}>
            {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </td>
        <td className="row-actions" style={{ whiteSpace: 'nowrap', width: 'auto' }}>
          <button type="button" className="btn-eliminar-acuerdo" title="Eliminar" disabled={locked} onClick={onEliminar}>×</button>
        </td>
      </tr>
      {tieneCuentaFaltante && (
        <tr>
          <td colSpan={7} style={{ background: '#FFF6E0', padding: '8px 10px', fontSize: 12 }}>
            {yaPreautorizado ? (
              <span style={{ color: '#8a6d1f' }}>{ac.responsable_email} ya está preautorizado, pendiente de que la persona se registre.</span>
            ) : (
              <>
                <span style={{ color: '#8a6d1f' }}>{ac.responsable_email} no tiene cuenta en el sistema todavía.</span>
                <button type="button" style={{ marginLeft: 8, background: 'var(--verde)', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }} onClick={preautorizarExistente}>
                  Preautorizar a esta persona
                </button>
              </>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
