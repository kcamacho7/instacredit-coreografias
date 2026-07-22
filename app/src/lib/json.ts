import type { Json } from '../types/database.types'

/** Convierte un valor tipado (p.ej. Accion[]) al tipo `Json` genérico de Supabase para insert/update. */
export function toJson<T>(value: T): Json {
  return value as unknown as Json
}
