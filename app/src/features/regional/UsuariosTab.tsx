import { useEffect, useState, type CSSProperties } from 'react'
import { sb } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useDialog } from '../../components/ui/DialogProvider'
import { useToast } from '../../components/ui/ToastProvider'
import { PAISES } from '../../lib/catalogs'
import type { AreaNegocio } from '../../hooks/useAreaNegocio'
import type { Tables } from '../../types/database.types'

type PerfilUsuario = Tables<'perfiles_usuario'>

const ROLE_BADGE_STYLE: CSSProperties = {
  display: 'inline-block', background: 'var(--verde-claro)', color: 'var(--azul)',
  borderRadius: 10, padding: '2px 8px', fontSize: 10.5, fontWeight: 700, marginRight: 4, marginBottom: 3, whiteSpace: 'nowrap',
}

function insigniasDe(u: Pick<PerfilUsuario, 'es_regional' | 'es_admin' | 'es_lider' | 'es_gerente_pais' | 'es_admin_area' | 'es_admin_pais'>): string[] {
  const insignias: string[] = []
  if (u.es_admin) insignias.push('Super Usuario')
  if (u.es_regional) insignias.push('Regional')
  if (u.es_lider) insignias.push('Acceso Acuerdos')
  if (u.es_gerente_pais) insignias.push('Gerente país')
  if (u.es_admin_area) insignias.push('Admin área')
  if (u.es_admin_pais) insignias.push('Admin país')
  return insignias
}

interface UsuariosTabProps {
  areaNegocio: string
}

export function UsuariosTab({ areaNegocio }: UsuariosTabProps) {
  const { profile } = useAuth()
  const esSuperAdmin = !!profile?.es_admin
  // Un administrador de país puro (sin ser super usuario ni admin de área) gestiona
  // su país completo (cualquier área) en vez de una sola área — el resto de casos
  // (super usuario, admin de área) siguen viendo por área, igual que siempre.
  const modoPais = !!(profile?.es_admin_pais && !esSuperAdmin && !profile?.es_admin_area && profile?.pais_code)

  const [usuarios, setUsuarios] = useState<PerfilUsuario[] | null>(null)
  const [areasActivas, setAreasActivas] = useState<AreaNegocio[]>([])
  const [error, setError] = useState<string | null>(null)

  async function cargar() {
    const base = sb.from('perfiles_usuario').select('*').order('email')
    // area_negocio=null (Gerente de País) nunca calza con .eq() — el super usuario
    // necesita seguir viéndolos para poder gestionarlos sin importar qué área tenga
    // activa. Un admin de área no los ve (no podría editarlos: RLS exige su propia
    // área); los ve en su lista un admin de país, vía modoPais.
    const usuariosRes = modoPais
      ? await base.eq('pais_code', profile!.pais_code!)
      : esSuperAdmin
        ? await base.or(`area_negocio.eq.${areaNegocio},area_negocio.is.null`)
        : await base.eq('area_negocio', areaNegocio)
    const { data: areasData } = await sb.from('areas_negocio').select('*').eq('activo', true).order('orden')
    if (usuariosRes.error) { setError(usuariosRes.error.message); return }
    setUsuarios(usuariosRes.data || [])
    setAreasActivas(areasData || [])
  }
  useEffect(() => { cargar() }, [areaNegocio, modoPais])

  if (error) return <div className="sin-proyectos">Error al cargar usuarios: {error}</div>
  if (usuarios === null) return <div className="sin-proyectos">Cargando…</div>

  return (
    <div>
      {modoPais && (
        <div className="area-owner" style={{ borderRadius: 8, marginBottom: 16 }}>
          <strong>Administrador de país:</strong> ves y gestionas los usuarios de tu país, en cualquier área de negocio.
        </div>
      )}
      {usuarios.length === 0 ? (
        <div className="sin-proyectos">Todavía no hay correos preautorizados.</div>
      ) : (
        <table className="coreo">
          <thead>
            <tr>
              <th style={{ width: '17%' }}>Correo</th>
              <th style={{ width: '14%' }}>Nombre</th>
              <th style={{ width: '9%' }}>Estado</th>
              <th style={{ width: '11%' }}>País</th>
              <th style={{ width: '11%' }}>Área</th>
              <th style={{ width: '19%' }}>Roles</th>
              <th style={{ width: '19%' }}>&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <FilaUsuario key={u.id} usuario={u} areasActivas={areasActivas} modoPais={modoPais} onCambio={cargar} />
            ))}
          </tbody>
        </table>
      )}

      <AgregarUsuario areaNegocio={areaNegocio} areasActivas={areasActivas} modoPais={modoPais} paisFijo={profile?.pais_code || ''} usuariosExistentes={usuarios} onAgregado={cargar} />
    </div>
  )
}

function FilaUsuario({ usuario, areasActivas, modoPais, onCambio }: { usuario: PerfilUsuario; areasActivas: AreaNegocio[]; modoPais: boolean; onCambio: () => void }) {
  const { user, profile, refrescarPerfil } = useAuth()
  const { mostrarConfirm } = useDialog()
  const { mostrarAlerta } = useToast()
  const esSuperAdmin = !!profile?.es_admin
  const [nombre, setNombre] = useState(usuario.nombre || '')
  const [paisCode, setPaisCode] = useState(usuario.pais_code || '')
  const [areaUsuario, setAreaUsuario] = useState(usuario.area_negocio || '')
  const [esRegional, setEsRegional] = useState(usuario.es_regional)
  const [esAdmin, setEsAdmin] = useState(usuario.es_admin)
  const [esLider, setEsLider] = useState(usuario.es_lider)
  const [esGerentePais, setEsGerentePais] = useState(usuario.es_gerente_pais)
  const [esAdminArea, setEsAdminArea] = useState(usuario.es_admin_area)
  const [esAdminPais, setEsAdminPais] = useState(usuario.es_admin_pais)
  const [editandoRoles, setEditandoRoles] = useState(false)

  const esPropia = !!(user && usuario.user_id && user.id === usuario.user_id)
  const bloqueadaPorPropiedad = !esSuperAdmin && !!usuario.creado_por && usuario.creado_por !== user?.id
  const insignias = insigniasDe({ es_regional: esRegional, es_admin: esAdmin, es_lider: esLider, es_gerente_pais: esGerentePais, es_admin_area: esAdminArea, es_admin_pais: esAdminPais })

  async function guardar() {
    const payload: Record<string, unknown> = {
      // Un Gerente de País no está atado a ninguna área en particular — ve/edita
      // todas las de su país, así que su área_negocio se guarda como null.
      pais_code: paisCode || null, area_negocio: esGerentePais ? null : (areaUsuario || null), es_regional: esRegional, nombre: nombre.trim(),
    }
    // Los roles elevados solo los puede tocar el super usuario — el checkbox ya está
    // deshabilitado para los demás, pero además el trigger de la base lo rechazaría.
    if (esSuperAdmin) {
      payload.es_admin = esAdmin
      payload.es_lider = esLider
      payload.es_gerente_pais = esGerentePais
      payload.es_admin_area = esAdminArea
      payload.es_admin_pais = esAdminPais
    }
    const { error } = await sb.from('perfiles_usuario').update(payload as never).eq('id', usuario.id)
    if (error) { mostrarAlerta('Error: ' + error.message); return }
    if (esPropia) await refrescarPerfil()
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
    <>
      <tr>
        <td>{usuario.email}</td>
        <td><input type="text" style={{ width: '100%', minWidth: 120 }} placeholder="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={bloqueadaPorPropiedad} /></td>
        <td>{usuario.user_id ? <span style={{ color: 'var(--verde)', fontWeight: 700 }}>Registrado</span> : <span style={{ color: 'var(--azul-claro)' }}>Pendiente</span>}</td>
        <td>
          {modoPais ? (
            <span>{PAISES.find((p) => p.code === paisCode)?.nombre || paisCode || 'Sin asignar'}</span>
          ) : (
            <select value={paisCode} onChange={(e) => setPaisCode(e.target.value)} disabled={bloqueadaPorPropiedad} style={{ minWidth: 120 }}>
              <option value="">Sin asignar</option>
              {PAISES.map((p) => <option key={p.code} value={p.code}>{p.nombre}</option>)}
            </select>
          )}
        </td>
        <td>
          {esGerentePais ? (
            <span style={{ fontStyle: 'italic', color: 'var(--azul-claro)' }}>Todas las áreas</span>
          ) : (
            <select value={areaUsuario} onChange={(e) => setAreaUsuario(e.target.value)} disabled={bloqueadaPorPropiedad} style={{ minWidth: 120 }}>
              <option value="">Sin asignar</option>
              {areasActivas.map((a) => <option key={a.codigo} value={a.codigo}>{a.nombre}</option>)}
            </select>
          )}
        </td>
        <td>
          {insignias.length === 0 ? <span style={{ color: 'var(--gris-borde)', fontSize: 11 }}>Sin roles</span> : insignias.map((r) => <span key={r} style={ROLE_BADGE_STYLE}>{r}</span>)}
        </td>
        <td style={{ whiteSpace: 'nowrap' }}>
          {bloqueadaPorPropiedad ? (
            <span style={{ fontSize: 11, color: 'var(--azul-claro)' }}>🔒 Creado por otro administrador</span>
          ) : (
            <>
              <button type="button" className="btn-eliminar-proyecto" style={{ borderColor: 'var(--azul-claro)', color: 'var(--azul-claro)', marginRight: 6 }} onClick={() => setEditandoRoles((v) => !v)}>
                {editandoRoles ? 'Ocultar roles' : 'Editar roles'}
              </button>
              <button type="button" className="btn-eliminar-proyecto" style={{ borderColor: 'var(--verde)', color: 'var(--verde)', marginRight: 6 }} onClick={guardar}>Guardar</button>
              {usuario.user_id && (
                <button type="button" className="btn-eliminar-proyecto" style={{ borderColor: 'var(--azul-claro)', color: 'var(--azul-claro)', marginRight: 6 }} onClick={resetPassword}>Restablecer contraseña</button>
              )}
              <button type="button" className="btn-eliminar-proyecto" onClick={quitarAcceso}>Quitar acceso</button>
            </>
          )}
        </td>
      </tr>
      {editandoRoles && (
        <tr className="fila-resultado">
          <td colSpan={7}>
            <label>Roles de {usuario.email}</label>
            <div className="permisos-checks" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
              <label><input type="checkbox" checked={esRegional} onChange={(e) => setEsRegional(e.target.checked)} disabled={bloqueadaPorPropiedad} /> Regional (de su propia área)</label>
              <label><input type="checkbox" checked={esLider} onChange={(e) => setEsLider(e.target.checked)} disabled={!esSuperAdmin || bloqueadaPorPropiedad} title={!esSuperAdmin ? 'Solo un super usuario puede otorgar este rol' : undefined} /> Acceso Acuerdos</label>
              <label><input type="checkbox" checked={esAdmin} onChange={(e) => setEsAdmin(e.target.checked)} disabled={!esSuperAdmin} title={!esSuperAdmin ? 'Solo un super usuario puede otorgar este rol' : undefined} /> Super Usuario</label>
              <label><input type="checkbox" checked={esGerentePais} onChange={(e) => setEsGerentePais(e.target.checked)} disabled={!esSuperAdmin} title={!esSuperAdmin ? 'Solo un super usuario puede otorgar este rol' : undefined} /> Gerente de País</label>
              <label><input type="checkbox" checked={esAdminArea} onChange={(e) => setEsAdminArea(e.target.checked)} disabled={!esSuperAdmin} title={!esSuperAdmin ? 'Solo un super usuario puede otorgar este rol' : undefined} /> Admin de área</label>
              <label><input type="checkbox" checked={esAdminPais} onChange={(e) => setEsAdminPais(e.target.checked)} disabled={!esSuperAdmin} title={!esSuperAdmin ? 'Solo un super usuario puede otorgar este rol' : undefined} /> Admin de país</label>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

interface AgregarUsuarioProps {
  areaNegocio: string
  areasActivas: AreaNegocio[]
  modoPais: boolean
  paisFijo: string
  usuariosExistentes: PerfilUsuario[]
  onAgregado: () => void
}

function AgregarUsuario({ areaNegocio, areasActivas, modoPais, paisFijo, usuariosExistentes, onAgregado }: AgregarUsuarioProps) {
  const { profile } = useAuth()
  const { mostrarAlerta } = useToast()
  const esSuperAdmin = !!profile?.es_admin
  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  const [pais, setPais] = useState('')
  const [area, setArea] = useState(areasActivas[0]?.codigo || areaNegocio)
  const [esRegional, setEsRegional] = useState(false)
  const [esAdmin, setEsAdmin] = useState(false)
  const [esLider, setEsLider] = useState(false)
  const [esGerentePais, setEsGerentePais] = useState(false)
  const [esAdminArea, setEsAdminArea] = useState(false)
  const [esAdminPais, setEsAdminPais] = useState(false)

  async function agregar() {
    const emailNorm = email.trim().toLowerCase()
    if (!emailNorm || !emailNorm.includes('@')) { mostrarAlerta('Pon un correo válido.'); return }
    if (usuariosExistentes.some((u) => (u.email || '').toLowerCase() === emailNorm)) { mostrarAlerta('Ese correo ya existe en la lista de usuarios.'); return }
    if (esGerentePais && !(modoPais ? paisFijo : pais)) { mostrarAlerta('Ojo: sin país asignado, "Gerente de País" no tendrá efecto.', 'success'); }
    const payload: Record<string, unknown> = {
      email: emailNorm,
      nombre: nombre.trim(),
      pais_code: modoPais ? paisFijo : (pais || null),
      // Un Gerente de País no está atado a ninguna área en particular.
      area_negocio: esGerentePais ? null : (modoPais ? area : areaNegocio),
      es_regional: esRegional,
    }
    if (esSuperAdmin) {
      payload.es_admin = esAdmin
      payload.es_lider = esLider
      payload.es_gerente_pais = esGerentePais
      payload.es_admin_area = esAdminArea
      payload.es_admin_pais = esAdminPais
    }
    const { error } = await sb.from('perfiles_usuario').insert([payload] as never)
    if (error) { mostrarAlerta('Error: ' + error.message); return }
    setEmail(''); setNombre(''); setPais(''); setEsRegional(false); setEsAdmin(false); setEsLider(false)
    setEsGerentePais(false); setEsAdminArea(false); setEsAdminPais(false)
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
        {modoPais ? (
          <div className="field">
            <label>Área que podrá editar</label>
            <select value={area} onChange={(e) => setArea(e.target.value)}>
              {areasActivas.map((a) => <option key={a.codigo} value={a.codigo}>{a.nombre}</option>)}
            </select>
          </div>
        ) : (
          <div className="field">
            <label>País que podrá editar</label>
            <select value={pais} onChange={(e) => setPais(e.target.value)}>
              <option value="">Sin asignar</option>
              {PAISES.map((p) => <option key={p.code} value={p.code}>{p.nombre}</option>)}
            </select>
          </div>
        )}
        <div className="field">
          <label>Permisos</label>
          <div className="permisos-checks">
            <label><input type="checkbox" checked={esRegional} onChange={(e) => setEsRegional(e.target.checked)} /> Es Regional (de su propia área)</label>
            <label><input type="checkbox" checked={esLider} onChange={(e) => setEsLider(e.target.checked)} disabled={!esSuperAdmin} /> Acceso Acuerdos (pestaña "Acuerdos de reuniones")</label>
            {esSuperAdmin && (
              <>
                <label><input type="checkbox" checked={esAdmin} onChange={(e) => setEsAdmin(e.target.checked)} /> Es Super Usuario (Administración total)</label>
                <label><input type="checkbox" checked={esGerentePais} onChange={(e) => setEsGerentePais(e.target.checked)} /> Es Gerente de País (todas las áreas de su país — no se le asigna un área en particular)</label>
                <label><input type="checkbox" checked={esAdminArea} onChange={(e) => setEsAdminArea(e.target.checked)} /> Es Administrador de su área</label>
                <label><input type="checkbox" checked={esAdminPais} onChange={(e) => setEsAdminPais(e.target.checked)} /> Es Administrador de su país</label>
              </>
            )}
          </div>
        </div>
      </div>
      <button type="button" className="add-proyecto-btn" style={{ margin: 0 }} onClick={agregar}>+ Preautorizar correo</button>
    </div>
  )
}
