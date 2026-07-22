import { useEffect, useState } from 'react'
import { sb } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useDialog } from '../../components/ui/DialogProvider'
import { useToast } from '../../components/ui/ToastProvider'
import { PAISES } from '../../lib/catalogs'
import type { AreaNegocio } from '../../hooks/useAreaNegocio'
import type { Tables } from '../../types/database.types'

type PerfilUsuario = Tables<'perfiles_usuario'>

interface UsuariosTabProps {
  areaNegocio: string
}

export function UsuariosTab({ areaNegocio }: UsuariosTabProps) {
  const [usuarios, setUsuarios] = useState<PerfilUsuario[] | null>(null)
  const [areasActivas, setAreasActivas] = useState<AreaNegocio[]>([])
  const [error, setError] = useState<string | null>(null)

  async function cargar() {
    const [{ data, error }, { data: areasData }] = await Promise.all([
      sb.from('perfiles_usuario').select('*').eq('area_negocio', areaNegocio).order('email'),
      sb.from('areas_negocio').select('*').eq('activo', true).order('orden'),
    ])
    if (error) { setError(error.message); return }
    setUsuarios(data || [])
    setAreasActivas(areasData || [])
  }
  useEffect(() => { cargar() }, [areaNegocio])

  if (error) return <div className="sin-proyectos">Error al cargar usuarios: {error}</div>
  if (usuarios === null) return <div className="sin-proyectos">Cargando…</div>

  return (
    <div>
      {usuarios.length === 0 ? (
        <div className="sin-proyectos">Todavía no hay correos preautorizados.</div>
      ) : (
        <table className="coreo">
          <thead>
            <tr>
              <th style={{ width: '14%' }}>Correo</th>
              <th style={{ width: '12%' }}>Nombre</th>
              <th style={{ width: '9%' }}>Estado</th>
              <th style={{ width: '11%' }}>País asignado</th>
              <th style={{ width: '11%' }}>Área</th>
              <th style={{ width: '6%' }}>Regional</th>
              <th style={{ width: '6%' }}>Admin</th>
              <th style={{ width: '6%' }}>Líder</th>
              <th style={{ width: '25%' }}>&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <FilaUsuario key={u.id} usuario={u} areasActivas={areasActivas} onCambio={cargar} />
            ))}
          </tbody>
        </table>
      )}

      <AgregarUsuario areaNegocio={areaNegocio} usuariosExistentes={usuarios} onAgregado={cargar} />
    </div>
  )
}

function FilaUsuario({ usuario, areasActivas, onCambio }: { usuario: PerfilUsuario; areasActivas: AreaNegocio[]; onCambio: () => void }) {
  const { user, refrescarPerfil } = useAuth()
  const { mostrarConfirm } = useDialog()
  const { mostrarAlerta } = useToast()
  const [nombre, setNombre] = useState(usuario.nombre || '')
  const [paisCode, setPaisCode] = useState(usuario.pais_code || '')
  const [areaUsuario, setAreaUsuario] = useState(usuario.area_negocio)
  const [esRegional, setEsRegional] = useState(usuario.es_regional)
  const [esAdmin, setEsAdmin] = useState(usuario.es_admin)
  const [esLider, setEsLider] = useState(usuario.es_lider)

  async function guardar() {
    const { error } = await sb.from('perfiles_usuario').update({
      pais_code: paisCode || null, area_negocio: areaUsuario, es_regional: esRegional, es_admin: esAdmin, es_lider: esLider, nombre: nombre.trim(),
    }).eq('id', usuario.id)
    if (error) { mostrarAlerta('Error: ' + error.message); return }
    if (user && usuario.user_id && user.id === usuario.user_id) await refrescarPerfil()
    mostrarAlerta('Cambios guardados para ' + usuario.email + '.', 'success')
  }

  async function resetPassword() {
    const ok = await mostrarConfirm(`¿Enviar un correo a ${usuario.email} con un enlace para crear una contraseña nueva?`)
    if (!ok) return
    const { error } = await sb.auth.resetPasswordForEmail(usuario.email, { redirectTo: window.location.href.split('#')[0] })
    if (error) { mostrarAlerta('Error: ' + error.message); return }
    mostrarAlerta('Enlace de restablecimiento enviado a ' + usuario.email + '.', 'success')
  }

  async function quitarAcceso() {
    const detalle = usuario.user_id ? 'Su cuenta ya no podrá editar ningún país ni entrar a Regional.' : 'Se cancela la preautorización antes de que se haya registrado.'
    const ok = await mostrarConfirm(`¿Quitar el acceso de ${usuario.email}? ${detalle}`)
    if (!ok) return
    const { error } = await sb.from('perfiles_usuario').delete().eq('id', usuario.id)
    if (error) { mostrarAlerta('Error: ' + error.message); return }
    onCambio()
  }

  return (
    <tr>
      <td>{usuario.email}</td>
      <td><input type="text" style={{ width: '100%' }} placeholder="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} /></td>
      <td>{usuario.user_id ? <span style={{ color: 'var(--verde)', fontWeight: 700 }}>Registrado</span> : <span style={{ color: 'var(--azul-claro)' }}>Pendiente de registro</span>}</td>
      <td>
        <select value={paisCode} onChange={(e) => setPaisCode(e.target.value)}>
          <option value="">Sin asignar</option>
          {PAISES.map((p) => <option key={p.code} value={p.code}>{p.nombre}</option>)}
          <option value="RG">Regional</option>
        </select>
      </td>
      <td>
        <select value={areaUsuario} onChange={(e) => setAreaUsuario(e.target.value)}>
          {areasActivas.map((a) => <option key={a.codigo} value={a.codigo}>{a.nombre}</option>)}
        </select>
      </td>
      <td style={{ textAlign: 'center' }}><input type="checkbox" checked={esRegional} onChange={(e) => setEsRegional(e.target.checked)} /></td>
      <td style={{ textAlign: 'center' }}><input type="checkbox" checked={esAdmin} onChange={(e) => setEsAdmin(e.target.checked)} /></td>
      <td style={{ textAlign: 'center' }}><input type="checkbox" checked={esLider} onChange={(e) => setEsLider(e.target.checked)} /></td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <button type="button" className="btn-eliminar-proyecto" style={{ borderColor: 'var(--verde)', color: 'var(--verde)', marginRight: 6 }} onClick={guardar}>Guardar</button>
        {usuario.user_id && (
          <button type="button" className="btn-eliminar-proyecto" style={{ borderColor: 'var(--azul-claro)', color: 'var(--azul-claro)', marginRight: 6 }} onClick={resetPassword}>Restablecer contraseña</button>
        )}
        <button type="button" className="btn-eliminar-proyecto" onClick={quitarAcceso}>Quitar acceso</button>
      </td>
    </tr>
  )
}

function AgregarUsuario({ areaNegocio, usuariosExistentes, onAgregado }: { areaNegocio: string; usuariosExistentes: PerfilUsuario[]; onAgregado: () => void }) {
  const { mostrarAlerta } = useToast()
  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  const [pais, setPais] = useState('')
  const [esRegional, setEsRegional] = useState(false)
  const [esAdmin, setEsAdmin] = useState(false)
  const [esLider, setEsLider] = useState(false)

  async function agregar() {
    const emailNorm = email.trim().toLowerCase()
    if (!emailNorm || !emailNorm.includes('@')) { mostrarAlerta('Pon un correo válido.'); return }
    if (usuariosExistentes.some((u) => (u.email || '').toLowerCase() === emailNorm)) { mostrarAlerta('Ese correo ya existe en la lista de usuarios.'); return }
    const { error } = await sb.from('perfiles_usuario').insert([{
      email: emailNorm, nombre: nombre.trim(), pais_code: pais || null, area_negocio: areaNegocio, es_regional: esRegional, es_admin: esAdmin, es_lider: esLider,
    }])
    if (error) { mostrarAlerta('Error: ' + error.message); return }
    setEmail(''); setNombre(''); setPais(''); setEsRegional(false); setEsAdmin(false); setEsLider(false)
    onAgregado()
  }

  return (
    <div style={{ background: '#F0F7EE', border: '1px dashed var(--verde)', borderRadius: 8, padding: '14px 20px', marginTop: 12 }}>
      <div className="field-grid" style={{ padding: '0 0 10px 0' }}>
        <div className="field">
          <label>Correo a preautorizar</label>
          <input type="email" placeholder="correo@instacredit.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label>Nombre completo</label>
          <input type="text" placeholder="Ej. Juan Pérez" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="field">
          <label>País que podrá editar</label>
          <select value={pais} onChange={(e) => setPais(e.target.value)}>
            <option value="">Sin asignar</option>
            {PAISES.map((p) => <option key={p.code} value={p.code}>{p.nombre}</option>)}
            <option value="RG">Regional</option>
          </select>
        </div>
        <div className="field">
          <label>Permisos</label>
          <div className="permisos-checks">
            <label><input type="checkbox" checked={esRegional} onChange={(e) => setEsRegional(e.target.checked)} /> Es Regional (de su propia área)</label>
            <label><input type="checkbox" checked={esAdmin} onChange={(e) => setEsAdmin(e.target.checked)} /> Es Administrador (Administración del sistema)</label>
            <label><input type="checkbox" checked={esLider} onChange={(e) => setEsLider(e.target.checked)} /> Es Líder (acceso a Acuerdos de reuniones)</label>
          </div>
        </div>
      </div>
      <button type="button" className="add-proyecto-btn" style={{ margin: 0 }} onClick={agregar}>+ Preautorizar correo</button>
    </div>
  )
}
