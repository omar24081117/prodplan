import Link from 'next/link'
import { cookies } from 'next/headers'

const MODULOS_COMPLETO = [
  { href: '/admin/planeacion',              icon: '📋', label: 'Planeación',     desc: 'Crear y editar jornadas y actividades' },
  { href: '/admin/ejecucion',               icon: '⚡', label: 'Ejecución',      desc: 'Reportes hora a hora y asignación de personal' },
  { href: '/admin/asistencia',              icon: '👥', label: 'Asistencia',     desc: 'Ver quién está en planta hoy' },
  { href: '/admin/catalogo',               icon: '📦', label: 'Catálogo',       desc: 'Productos y SKUs' },
  { href: '/admin/personal',               icon: '🪪', label: 'Personal',       desc: 'Operarios registrados' },
  { href: '/admin/dashboard',              icon: '📊', label: 'Dashboard',      desc: 'KPIs y cumplimiento' },
  { href: '/admin/base-procesos',           icon: '🧪', label: 'Base Procesos', desc: 'Estándares y tiempos por proceso' },
  { href: '/admin/causales-paro',           icon: '⚠️', label: 'Causales Paro', desc: 'Motivos de tiempo improductivo' },
  { href: '/admin/usuarios',               icon: '⚙️', label: 'Usuarios',       desc: 'Gestión de accesos administrativos' },
  { href: '/admin/actividades-adicionales', icon: '📈', label: 'Actividades',   desc: 'Actividades adicionales del plan' },
  { href: '/admin/horas-extra',             icon: '⏱️', label: 'Horas Extra',   desc: 'Control de tiempo extra y recargo nocturno' },
]

const MODULOS_PANEL = [
  { href: '/admin/asistencia',   icon: '👥', label: 'Asistencia',     desc: 'Ver quién está en planta hoy' },
  { href: '/admin/catalogo',     icon: '📦', label: 'Catálogo',       desc: 'Productos y SKUs' },
  { href: '/admin/base-procesos',icon: '🧪', label: 'Base Procesos',  desc: 'Estándares y tiempos por proceso' },
  { href: '/admin/causales-paro',icon: '⚠️', label: 'Causales Paro',  desc: 'Motivos de tiempo improductivo' },
  { href: '/admin/personal',     icon: '🪪', label: 'Personal',       desc: 'Operarios registrados' },
  { href: '/admin/usuarios',     icon: '⚙️', label: 'Usuarios',       desc: 'Gestión de accesos administrativos' },
]

export default async function AdminHome() {
  const cookieStore = await cookies()
  const modo = cookieStore.get('prodplan_modo')?.value
  const modulos = modo === 'panel' ? MODULOS_PANEL : MODULOS_COMPLETO
  const titulo  = modo === 'panel' ? 'Panel de Control' : 'Panel de administración'

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">{titulo}</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {modulos.map(m => (
          <Link
            key={m.href}
            href={m.href}
            className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-5 flex flex-col gap-2 transition-colors"
          >
            <span className="text-3xl">{m.icon}</span>
            <span className="text-white font-semibold">{m.label}</span>
            <span className="text-gray-400 text-sm">{m.desc}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
