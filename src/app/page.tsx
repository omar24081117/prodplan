'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Leaf, Factory, Truck, LayoutDashboard, X, Mail, Lock, Loader2, Warehouse, Users, ShoppingCart } from 'lucide-react'
import LeafBackground from '@/components/LeafBackground'

const CARDS = [
  {
    label: 'Asistencia',
    desc:  'Registra tu entrada y salida',
    href:  '/asistencia',
    grad:  'linear-gradient(135deg, #2e6e20, #3d8830)',
    border:'#5aaa40',
    shadow:'rgba(60,140,40,0.3)',
    textColor: 'text-green-200/70',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <polyline points="16 11 18 13 22 9"/>
      </svg>
    ),
  },
  {
    label: 'Producción',
    desc:  'Ejecución y administración',
    href:  '/produccion',
    grad:  'linear-gradient(135deg, #3d5c18, #527820)',
    border:'#7aaa30',
    shadow:'rgba(90,140,20,0.3)',
    textColor: 'text-lime-200/70',
    icon: <Factory size={32} strokeWidth={1.5} className="text-white" />,
  },
  {
    label: 'Almacén',
    desc:  'Inventario y existencias',
    href:  '/almacen',
    grad:  'linear-gradient(135deg, #5c2a08, #7a3a0a)',
    border:'#b45309',
    shadow:'rgba(180,80,10,0.3)',
    textColor: 'text-amber-200/70',
    icon: <Warehouse size={32} strokeWidth={1.5} className="text-white" />,
  },
  {
    label: 'Control de Despachos',
    desc:  'Gestión y seguimiento de salidas',
    href:  '/despachos',
    grad:  'linear-gradient(135deg, #1a3a5c, #1e4d7a)',
    border:'#3a7abf',
    shadow:'rgba(30,100,180,0.3)',
    textColor: 'text-blue-200/70',
    icon: <Truck size={32} strokeWidth={1.5} className="text-white" />,
  },
  {
    label: 'RRHH',
    desc:  'Recursos humanos y nómina',
    href:  '/rrhh',
    grad:  'linear-gradient(135deg, #14532d, #166534)',
    border:'#22c55e',
    shadow:'rgba(34,197,94,0.2)',
    textColor: 'text-green-200/70',
    icon: <Users size={32} strokeWidth={1.5} className="text-white" />,
  },
  {
    label: 'Solicitudes y Mensajería',
    desc:  'Compras internas y comunicación',
    href:  '/solicitudes/compras',
    grad:  'linear-gradient(135deg, #0e4f5c, #0f6674)',
    border:'#22b8cc',
    shadow:'rgba(34,184,204,0.2)',
    textColor: 'text-cyan-200/70',
    icon: <ShoppingCart size={32} strokeWidth={1.5} className="text-white" />,
  },
]

export default function Home() {
  const router = useRouter()

  const [showLogin,    setShowLogin]    = useState(false)
  const [panelEmail,   setPanelEmail]   = useState('')
  const [panelPass,    setPanelPass]    = useState('')
  const [panelLoading, setPanelLoading] = useState(false)
  const [panelError,   setPanelError]   = useState('')

  async function loginPanel(e: React.FormEvent) {
    e.preventDefault()
    setPanelLoading(true)
    setPanelError('')
    try {
      const res = await fetch('/api/auth/panel-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: panelEmail.trim(), password: panelPass }),
      })
      const data = await res.json()
      if (!res.ok) setPanelError(data.error || 'Acceso denegado')
      else router.push('/admin')
    } catch {
      setPanelError('Error de conexión.')
    } finally {
      setPanelLoading(false)
    }
  }

  function abrirLogin() {
    setPanelEmail(''); setPanelPass(''); setPanelError(''); setShowLogin(true)
  }

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center p-4 gap-5"
      style={{ background: '#d4e8b8' }}>
      <LeafBackground />

      {/* Marca */}
      <div className="relative z-10 text-center">
        <div className="flex items-center justify-center mb-2">
          <div className="p-3 rounded-full" style={{ background: 'rgba(60,130,40,0.25)', border: '1px solid rgba(90,170,60,0.4)' }}>
            <Leaf size={36} strokeWidth={1.5} className="text-green-300" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-white tracking-wide">PRODPLAN</h1>
        <p className="text-gray-400 text-xs mt-1">Sistema de planeación de producción natural</p>
      </div>

      {/* Grid de módulos */}
      <div className="relative z-10 w-full max-w-3xl grid grid-cols-2 gap-5">

        {CARDS.map(c => (
          <button key={c.href} onClick={() => router.push(c.href)}
            className="rounded-2xl p-7 flex items-center justify-between transition-all hover:scale-[1.02] active:scale-[0.98] text-left"
            style={{ background: c.grad, border: `1px solid ${c.border}`, boxShadow: `0 4px 20px ${c.shadow}` }}>
            <div>
              <p className="text-white font-bold text-xl leading-tight">{c.label}</p>
              <p className={`text-sm mt-1.5 ${c.textColor}`}>{c.desc}</p>
            </div>
            <div className="p-3.5 rounded-xl shrink-0 ml-4" style={{ background: 'rgba(255,255,255,0.12)' }}>
              {c.icon}
            </div>
          </button>
        ))}

        {/* Panel de Control — ocupa fila completa */}
        <button onClick={abrirLogin}
          className="col-span-2 rounded-2xl p-6 flex items-center justify-between transition-all hover:scale-[1.01] active:scale-[0.99] text-left"
          style={{ background: 'linear-gradient(135deg, #3a1a5c, #4d1e7a)', border: '1px solid #8a3abf', boxShadow: '0 4px 20px rgba(100,30,180,0.3)' }}>
          <div>
            <p className="text-white font-bold text-xl">Panel de Control</p>
            <p className="text-purple-200/70 text-sm mt-1">Administración y configuración del sistema</p>
          </div>
          <div className="p-3.5 rounded-xl shrink-0 ml-4" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <LayoutDashboard size={36} strokeWidth={1.5} className="text-white" />
          </div>
        </button>

      </div>

      <p className="relative z-10 text-gray-500 text-xs">Producción natural · Trazabilidad real</p>

      {/* Modal Panel de Control */}
      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
            style={{ background: '#1a0d2e', border: '1px solid #6a2aaf' }}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <LayoutDashboard size={20} className="text-purple-400" />
                <h2 className="text-white font-bold text-lg">Panel de Control</h2>
              </div>
              <button onClick={() => setShowLogin(false)} className="text-gray-500 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <p className="text-gray-400 text-sm mb-5">Ingresa tus credenciales para continuar</p>
            <form onSubmit={loginPanel} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-400 flex items-center gap-1.5"><Mail size={11} /> Correo electrónico</label>
                <input type="text" inputMode="email" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
                  placeholder="usuario@empresa.com" value={panelEmail} required
                  onChange={e => setPanelEmail(e.target.value.normalize('NFD').replace(/[̀-ͯ]/g, ''))}
                  className="bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-400 flex items-center gap-1.5"><Lock size={11} /> Contraseña</label>
                <input type="password" autoComplete="current-password" placeholder="••••••••" value={panelPass} required
                  onChange={e => setPanelPass(e.target.value)}
                  className="bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500" />
              </div>
              {panelError && <p className="text-red-400 text-sm text-center">{panelError}</p>}
              <button type="submit" disabled={panelLoading}
                className="w-full flex items-center justify-center gap-2 text-white font-semibold rounded-xl px-6 py-3 text-sm transition-all hover:scale-[1.02] disabled:opacity-60 mt-1"
                style={{ background: 'linear-gradient(135deg, #5a1aaf, #7a2ad0)', border: '1px solid #9a4aef' }}>
                {panelLoading ? <Loader2 size={16} className="animate-spin" /> : <LayoutDashboard size={16} />}
                {panelLoading ? 'Verificando...' : 'Ingresar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
