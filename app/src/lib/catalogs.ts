export interface Pais {
  code: string
  nombre: string
  bandera: string
}

export const PAISES: Pais[] = [
  { code: 'CR', nombre: 'Costa Rica', bandera: '🇨🇷' },
  { code: 'NI', nombre: 'Nicaragua', bandera: '🇳🇮' },
  { code: 'PA', nombre: 'Panamá', bandera: '🇵🇦' },
  { code: 'SV', nombre: 'El Salvador', bandera: '🇸🇻' },
]

export interface KpiCatalogo {
  id: string
  nombre: string
  def: string
}

export interface AreaCatalogo {
  id: string
  nombre: string
  ejecuta: string
  controla: string
  kpis: KpiCatalogo[]
}
