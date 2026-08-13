/**
 * Una reunión se considera revisada/aprobada por el organizador si quedó
 * guardada (estado='guardada') O si ya se envió por correo — reuniones
 * enviadas antes de que existiera el estado 'guardada' tienen envio_enviado_at
 * poblado pero estado='procesada', y deben tratarse igual de aprobadas.
 */
export function reunionEstaAprobada(reunion: { estado?: string | null; envio_enviado_at?: string | null } | null | undefined): boolean {
  if (!reunion) return false
  return reunion.estado === 'guardada' || !!reunion.envio_enviado_at
}
