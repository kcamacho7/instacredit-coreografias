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

// Respaldo de fábrica — se sobreescribe en tiempo de ejecución con el catálogo
// vivo de Supabase (tabla kpis_catalogo), que Riesgo Regional/Admin puede editar.
export const AREAS_FALLBACK: AreaCatalogo[] = [
  {
    id: 'A',
    nombre: 'Originación y Calidad de Cartera',
    ejecuta: 'Comercial',
    controla: 'Riesgo',
    kpis: [
      { id: '1pd_4pd', nombre: '1PD / 2PD / 3PD / 4PD', def: '% de créditos que caen en mora en el primer, segundo, tercer y cuarto pago.' },
      { id: 'coincident60', nombre: 'Coincident 60 (6/9/12/16 MOB)', def: '% de cosecha en mora 60+ días según meses de madurez.' },
      { id: 'coincident90', nombre: 'Coincident 90 (6/9/12/16 MOB)', def: '% de cosecha en mora 90+ días según meses de madurez.' },
      { id: 'castigo', nombre: 'Castigo (6/9/12/16 MOB)', def: '% de cosecha castigada según meses de madurez.' },
    ],
  },
  {
    id: 'B',
    nombre: 'Ejecución Comercial de Colocación',
    ejecuta: 'Comercial',
    controla: 'Riesgo',
    kpis: [
      { id: 'auditaje_expedientes', nombre: 'Auditaje de expedientes', def: '% de expedientes sin hallazgo sobre expedientes auditados.' },
      { id: 'compromisos_colocacion', nombre: 'Compromisos en estrategia de colocación', def: '% de compromisos pactados en comité cumplidos en fecha.' },
      { id: 'aprobados_sin_formalizar', nombre: 'Créditos aprobados sin formalizar', def: 'Cantidad y monto de aprobados sin formalizar, con aging en días desde aprobación.' },
      { id: 'conversion_preaprobados', nombre: 'Conversión de preaprobados', def: '% de colocados sobre preaprobados contactados.' },
      { id: 'prospectacion', nombre: 'Prospectación', def: 'Prospectos nuevos vs meta; tasa prospecto → solicitud → aprobado.' },
      { id: 'pilotos_segmentos', nombre: 'Pilotos de nuevos segmentos', def: 'Desempeño de KPI Dominio A del segmento piloto vs segmento control.' },
      { id: 'aprovechamiento_monto', nombre: '% aprovechamiento de monto aprobado', def: 'Monto desembolsado sobre monto aprobado.' },
    ],
  },
  {
    id: 'C',
    nombre: 'Ejecución de Cobro',
    ejecuta: 'Cobro',
    controla: 'Riesgo',
    kpis: [
      { id: 'contactos_por_cuenta', nombre: 'contactos_por_cuenta', def: 'Gestiones totales sobre cuentas en mora gestionadas (excluye judicial).' },
      { id: 'tasa_contacto_efectivo', nombre: 'tasa_contacto_efectivo', def: 'Gestiones con RPC sobre gestiones totales.' },
      { id: 'contacto_bruto', nombre: '% de contacto (bruto)', def: 'Cuentas contactadas (con o sin RPC) sobre cuentas asignadas a gestión.' },
      { id: 'tasa_promesa_pago', nombre: 'tasa_promesa_pago', def: 'PTP generadas sobre cuentas con RPC.' },
      { id: 'tasa_cumplimiento_ptp', nombre: 'tasa_cumplimiento_ptp', def: 'PTP cumplidas sobre PTP generadas.' },
      { id: 'incumplimiento_promesas', nombre: '% incumplimiento de promesas', def: '1 − tasa_cumplimiento_ptp, desagregado por canal/gestor.' },
      { id: 'dias_primer_contacto', nombre: 'dias_primer_contacto', def: 'Días de mora promedio hasta primer RPC.' },
      { id: 'llamada_bienvenida', nombre: 'Llamada de bienvenida', def: 'Contacto proactivo al cliente nuevo en los primeros días post-desembolso, antes de la fecha de primer pago.' },
      { id: 'visitas_cobertura', nombre: 'Estrategia de visitas de campo — cobertura', def: 'Cuentas visitadas sobre cuentas asignadas a ruta.' },
      { id: 'visitas_efectividad', nombre: 'Estrategia de visitas de campo — efectividad', def: 'PTP o recuperación generada por visita realizada.' },
    ],
  },
]
