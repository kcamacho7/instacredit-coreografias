import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { BitacoraTab } from './BitacoraTab'
import { FechasReunionTab } from './FechasReunionTab'
import { GestionAccionesTab } from './GestionAccionesTab'
import { CatalogoKpiTab } from './CatalogoKpiTab'
import { UsuariosTab } from './UsuariosTab'
import { AreasNegocioTab } from './AreasNegocioTab'
import { ConfigSistemaTab } from './ConfigSistemaTab'

const REGIONAL_SUBTAB_KEY = 'instacredit_coreografias_regional_subtab'

interface Seccion {
  id: string
  nombre: string
}

interface RegionalPanelProps {
  areaNegocio: string
}

export function RegionalPanel({ areaNegocio }: RegionalPanelProps) {
  const { profile } = useAuth()
  const esAdminActivo = !!profile?.es_admin
  // Bitácora/Fechas/Acciones/Catálogo: visibles para regional, admin, o cualquiera de
  // los admin scopeados (área/país) — es el mismo alcance amplio que ya tenía antes.
  const puedeGestionar = !!(profile && (profile.es_regional || profile.es_admin || profile.es_admin_area || profile.es_admin_pais))
  const puedeEntrar = puedeGestionar

  const secciones: Seccion[] = []
  if (puedeGestionar) {
    secciones.push({ id: 'bitacora', nombre: 'Bitácora' })
    secciones.push({ id: 'fechas', nombre: 'Fechas y horas' })
    secciones.push({ id: 'acciones', nombre: 'Acciones' })
    secciones.push({ id: 'catalogo', nombre: 'Catálogo KPI' })
  }
  secciones.push({ id: 'usuarios', nombre: 'Usuarios' })
  if (esAdminActivo) {
    secciones.push({ id: 'areas', nombre: 'Áreas de negocio' })
    secciones.push({ id: 'config', nombre: 'Configuración' })
  }

  const [subTab, setSubTab] = useState<string>(() => {
    const guardada = sessionStorage.getItem(REGIONAL_SUBTAB_KEY)
    return guardada && secciones.some((s) => s.id === guardada) ? guardada : secciones[0]?.id
  })

  function seleccionar(id: string) {
    setSubTab(id)
    sessionStorage.setItem(REGIONAL_SUBTAB_KEY, id)
  }

  if (!puedeEntrar) {
    return (
      <div style={{ paddingTop: 20 }}>
        <div className="pin-bar">
          <span>🔒 Esta pestaña es solo para Regional/Administración. Tu cuenta no tiene ese permiso — pide a tu Regional o a Administración que te lo asigne.</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ paddingTop: 20 }}>
      <div className="filtro-bar">
        {secciones.map((s) => (
          <button key={s.id} type="button" className={'filtro-btn' + (subTab === s.id ? ' active' : '')} onClick={() => seleccionar(s.id)}>
            {s.nombre}
          </button>
        ))}
      </div>

      {subTab === 'bitacora' && puedeGestionar && <BitacoraTab areaNegocio={areaNegocio} />}
      {subTab === 'fechas' && puedeGestionar && <FechasReunionTab areaNegocio={areaNegocio} />}
      {subTab === 'acciones' && puedeGestionar && <GestionAccionesTab areaNegocio={areaNegocio} />}
      {subTab === 'catalogo' && puedeGestionar && <CatalogoKpiTab areaNegocio={areaNegocio} />}
      {subTab === 'usuarios' && <UsuariosTab areaNegocio={areaNegocio} />}
      {subTab === 'areas' && esAdminActivo && <AreasNegocioTab />}
      {subTab === 'config' && esAdminActivo && <ConfigSistemaTab />}
    </div>
  )
}
