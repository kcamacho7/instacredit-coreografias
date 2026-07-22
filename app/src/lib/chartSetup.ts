import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

export const CHART_COLORS: Record<string, string> = {
  Pendiente: '#677C98',
  'En curso': '#4C9C2E',
  Cumplida: '#002554',
  Vencida: '#EE212E',
}

export const ESTADOS = ['Pendiente', 'En curso', 'Cumplida', 'Vencida'] as const
