import Link from 'next/link'

const modulos = [
  { href: '/admin/planeacion', icon: '📋', label: 'Planeación', desc: 'Crear y editar jornadas y actividades' },
  { href: '/admin/ejecucion', icon: '⚡', label: 'Ejecución', desc: 'Reportes hora a hora y asignación de personal' },
  { href: '/admin/asistencia', icon: '👥', label: 'Asistencia', desc: 'Ver quién está en planta hoy' },
  { href: '/admin/catalogo', icon: '📦', label: 'Catálogo', desc: 'Productos y SKUs' },
  { href: '/admin/personal', icon: '🪪', label: 'Personal', desc: 'Operarios registrados' },
  { href: '/admin/dashboard', icon: '📊', label: 'Dashboard', desc: 'KPIs y cumplimiento' },
]

export default function AdminHome() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Panel de administración</h1>
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
