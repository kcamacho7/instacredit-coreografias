import { sb } from './supabase'

export function normalizarNombreSimple(s: string | null | undefined): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
}

interface AcuerdoParaMatch {
  id: string
  responsable_nombre: string | null
  responsable_email: string
}

/**
 * Cuando un acuerdo recibe correo+nombre confirmados, busca otros acuerdos de la
 * misma reunión con el mismo nombre (normalizado) y sin correo, y les aplica el
 * mismo correo automáticamente — evita repetir el paso para la misma persona.
 */
export async function aplicarCorreoAAcuerdosCoincidentes(
  acuerdos: AcuerdoParaMatch[],
  acActualId: string,
  nombre: string,
  email: string,
): Promise<number> {
  const nombreNorm = normalizarNombreSimple(nombre)
  if (!nombreNorm || !email) return 0
  const coincidentes = acuerdos.filter((a) => a.id !== acActualId && !a.responsable_email && normalizarNombreSimple(a.responsable_nombre) === nombreNorm)
  for (const a of coincidentes) {
    await sb.from('acuerdos_reunion').update({ responsable_email: email, responsable_nombre: nombre }).eq('id', a.id)
  }
  return coincidentes.length
}
