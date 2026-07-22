import { useAuth } from '../../hooks/useAuth'
import { PAISES } from '../../lib/catalogs'
import type { AreaNegocio } from '../../hooks/useAreaNegocio'

interface AuthBarProps {
  currentArea: string
  nombreAreaActiva: string
  areasCatalogo: AreaNegocio[]
  onCambiarArea: (codigo: string) => void
}

export function AuthBar({ currentArea, nombreAreaActiva, areasCatalogo, onCambiarArea }: AuthBarProps) {
  const { user, profile, logout } = useAuth()
  if (!user) return null

  const paisNombre = profile?.pais_code ? PAISES.find((p) => p.code === profile.pais_code)?.nombre : null
  const esRegionalOAdmin = !!(profile && (profile.es_regional || profile.es_admin))
  const areasActivas = areasCatalogo.filter((a) => a.activo)

  return (
    <div id="authBar">
      <span className="auth-status">
        Sesión: {user.email} —{' '}
        {esRegionalOAdmin ? (
          <span className="pais-asignado">
            {profile!.es_regional ? `${nombreAreaActiva} Regional` : 'Administrador'} — edita los 4 países
            {profile!.es_admin ? ` de ${nombreAreaActiva}` : ''}
          </span>
        ) : paisNombre ? (
          <span className="pais-asignado">{paisNombre} — {nombreAreaActiva}</span>
        ) : (
          <span className="sin-pais">sin país asignado, contacta a tu Regional</span>
        )}
      </span>

      {profile?.es_admin && areasActivas.length > 1 && (
        <select value={currentArea} onChange={(e) => onCambiarArea(e.target.value)} style={{ fontFamily: "'Inter Tight',sans-serif", border: '1px solid var(--gris-borde)', borderRadius: '5px', padding: '6px 9px', fontSize: '12.5px' }}>
          {areasActivas.map((a) => (
            <option key={a.codigo} value={a.codigo}>{a.nombre}</option>
          ))}
        </select>
      )}

      <button type="button" className="btn-auth-secondary" onClick={logout}>Cerrar sesión</button>
    </div>
  )
}
