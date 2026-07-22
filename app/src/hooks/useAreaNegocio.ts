import { useEffect, useMemo, useState } from 'react'
import { sb } from '../lib/supabase'
import type { Tables } from '../types/database.types'
import type { PerfilUsuario } from './useAuth'

export type AreaNegocio = Tables<'areas_negocio'>

const AREA_NEGOCIO_ADMIN_KEY = 'instacredit_coreografias_area_admin'

const FALLBACK: AreaNegocio[] = [
  { codigo: 'riesgo', nombre: 'Riesgo', activo: true, orden: 1, creado_at: '' },
]

function resolverAreaActiva(profile: PerfilUsuario | null): string {
  if (profile && profile.es_admin) {
    return sessionStorage.getItem(AREA_NEGOCIO_ADMIN_KEY) || profile.area_negocio || 'riesgo'
  }
  return (profile && profile.area_negocio) || 'riesgo'
}

export function useAreaNegocio(profile: PerfilUsuario | null) {
  const [catalogo, setCatalogo] = useState<AreaNegocio[]>(FALLBACK)
  const [currentArea, setCurrentArea] = useState<string>(() => resolverAreaActiva(profile))

  useEffect(() => {
    let activo = true
    sb.from('areas_negocio').select('*').order('orden').then(({ data }) => {
      if (activo && data && data.length) setCatalogo(data)
    })
    return () => { activo = false }
  }, [])

  // Cuando cambia el perfil (login/logout), recalcula el área activa.
  useEffect(() => {
    setCurrentArea(resolverAreaActiva(profile))
  }, [profile])

  const nombreAreaActiva = useMemo(() => {
    return catalogo.find((a) => a.codigo === currentArea)?.nombre || currentArea
  }, [catalogo, currentArea])

  function cambiarAreaActiva(nuevaArea: string) {
    if (nuevaArea === currentArea) return
    sessionStorage.setItem(AREA_NEGOCIO_ADMIN_KEY, nuevaArea)
    setCurrentArea(nuevaArea)
  }

  return { catalogo, currentArea, nombreAreaActiva, cambiarAreaActiva }
}
