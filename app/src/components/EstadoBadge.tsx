interface AccionConEstado {
  estado: string
}

export function claseBadgeEstado(acciones: AccionConEstado[]): string {
  if (acciones.some((a) => a.estado === 'Vencida')) return ' vencida'
  if (acciones.some((a) => a.estado === 'Cumplida')) return ' completada'
  return ''
}

export function tituloBadgeEstado(acciones: AccionConEstado[]): string {
  if (acciones.some((a) => a.estado === 'Vencida')) return 'Tiene al menos una acción vencida'
  if (acciones.some((a) => a.estado === 'Cumplida')) return 'Tiene al menos una acción cumplida'
  return 'Tiene información registrada'
}

export function EstadoBadge({ acciones }: { acciones: AccionConEstado[] }) {
  return <span className={'badge-tiene-datos' + claseBadgeEstado(acciones)} title={tituloBadgeEstado(acciones)} />
}
