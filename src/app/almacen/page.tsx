'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Warehouse, Loader2, LogOut, Upload, ClipboardList,
  BarChart3, Package, TrendingUp, ArrowRight, Shield, Clock
} from 'lucide-react'

type Usuario = { cedula: string; nombre: string; rol: string }
const SESSION_KEY = 'almacen_usuario'

export default function AlmacenPage() {
  const router   = useRouter()
  const [cedula,   setCedula]   = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [usuario,  setUsuario]  = useState<Usuario | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    try {
      const s = localStorage.getItem(SESSION_KEY)
      if (s) setUsuario(JSON.parse(s))
    } catch { /* noop */ }
    setChecking(false)
  }, [])

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res  = await fetch('/api/almacen/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula: cedula.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Acceso denegado'); return }
      localStorage.setItem(SESSION_KEY, JSON.stringify(data.usuario))
      setUsuario(data.usuario)
    } catch { setError('Error de conexión') }
    finally { setLoading(false) }
  }

  function salir() { localStorage.removeItem(SESSION_KEY); setUsuario(null); setCedula('') }

  if (checking) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#070b14' }}>
      <Loader2 size={28} className="animate-spin" style={{ color: '#f59e0b' }} />
    </div>
  )

  /* ── LOGIN ── */
  if (!usuario) return (
    <main className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: '#070b14' }}>

      {/* Grid background */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(245,158,11,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }} />

      {/* Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)' }} />

      <div className="relative z-10 w-full max-w-md px-6">

        {/* Gráficos decorativos de logística */}
        <div className="relative mb-8 h-48 w-full max-w-sm mx-auto select-none pointer-events-none">

          {/* Líneas de ruta */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 192" fill="none">
            {/* Ruta principal */}
            <path d="M30 96 Q100 30 200 96 Q300 162 370 96" stroke="#f59e0b" strokeWidth="1.5"
              strokeDasharray="6 4" opacity="0.25" />
            {/* Ruta secundaria */}
            <path d="M60 150 Q160 60 340 120" stroke="#0ea5e9" strokeWidth="1"
              strokeDasharray="4 6" opacity="0.15" />
            {/* Nodos */}
            {[[30,96],[200,96],[370,96],[60,150],[340,120]].map(([x,y],i) => (
              <circle key={i} cx={x} cy={y} r="4" fill="#f59e0b" opacity="0.3" />
            ))}
          </svg>

          {/* Ícono bodega central */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#92400e,#b45309)', border: '1px solid rgba(245,158,11,0.4)', boxShadow: '0 0 40px rgba(245,158,11,0.25)' }}>
              <Warehouse size={38} strokeWidth={1.5} className="text-white" />
            </div>
          </div>

          {/* Camión izquierda */}
          <div className="absolute left-0 top-1/2 -translate-y-8 flex flex-col items-center gap-1">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#f59e0b" strokeWidth="1.5">
                <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/>
                <rect x="9" y="11" width="14" height="10" rx="2"/>
                <circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              </svg>
            </div>
            <span className="text-xs font-bold" style={{ color: '#f59e0b', fontSize:'0.6rem', letterSpacing:'0.1em' }}>TRANSPORTE</span>
          </div>

          {/* Caja derecha */}
          <div className="absolute right-0 top-1/2 -translate-y-8 flex flex-col items-center gap-1">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)' }}>
              <Package size={22} style={{ color: '#0ea5e9' }} strokeWidth={1.5} />
            </div>
            <span className="text-xs font-bold" style={{ color: '#0ea5e9', fontSize:'0.6rem', letterSpacing:'0.1em' }}>STOCK</span>
          </div>

          {/* Tendencia abajo izq */}
          <div className="absolute bottom-0 left-8 flex flex-col items-center gap-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <TrendingUp size={18} style={{ color: '#10b981' }} strokeWidth={1.5} />
            </div>
            <span className="text-xs font-bold" style={{ color: '#10b981', fontSize:'0.55rem', letterSpacing:'0.1em' }}>KPIs</span>
          </div>

          {/* Barras abajo der */}
          <div className="absolute bottom-0 right-8 flex flex-col items-center gap-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}>
              <BarChart3 size={18} style={{ color: '#a855f7' }} strokeWidth={1.5} />
            </div>
            <span className="text-xs font-bold" style={{ color: '#a855f7', fontSize:'0.55rem', letterSpacing:'0.1em' }}>ANÁLISIS</span>
          </div>
        </div>

        {/* Título */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black tracking-tight" style={{ color: '#f59e0b' }}>ALMACÉN</h1>
          <p className="text-sm mt-2" style={{ color: '#475569' }}>Control de inventario y existencias</p>
        </div>

        {/* Card login */}
        <div className="rounded-2xl p-8"
          style={{ background: '#0d1525', border: '1px solid #1a2640', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}>
          <div className="flex items-center gap-2 mb-6">
            <Shield size={14} style={{ color: '#f59e0b' }} />
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#64748b' }}>
              Acceso restringido
            </p>
          </div>

          <form onSubmit={login} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: '#94a3b8' }}>
                Número de cédula
              </label>
              <input
                type="text" inputMode="numeric" required autoFocus
                placeholder="Ingresa tu cédula"
                value={cedula} onChange={e => { setCedula(e.target.value); setError('') }}
                className="w-full rounded-xl px-4 py-3 text-lg font-mono focus:outline-none transition-all"
                style={{
                  background: '#070b14', border: `1px solid ${error ? '#ef4444' : '#1a2640'}`,
                  color: '#f1f5f9', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)'
                }}
                onFocus={e => { if (!error) e.target.style.borderColor = '#f59e0b' }}
                onBlur={e => { if (!error) e.target.style.borderColor = '#1a2640' }}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || !cedula.trim()}
              className="w-full font-bold rounded-xl py-3.5 flex items-center justify-center gap-2 transition-all hover:brightness-110 disabled:opacity-40 mt-1"
              style={{ background: 'linear-gradient(135deg,#92400e,#b45309,#d97706)', color: 'white', boxShadow: '0 4px 20px rgba(245,158,11,0.2)' }}>
              {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
              {loading ? 'Verificando...' : 'Ingresar al sistema'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#334155' }}>
          Acceso: Gerencia · Director · Almacenista
        </p>
      </div>
    </main>
  )

  /* ── DASHBOARD ── */
  const cards = [
    {
      title: 'Cargar Inventario',
      desc:  'Importar productos desde Excel ERP',
      icon:  <Upload size={28} strokeWidth={1.5} />,
      href:  '/almacen/carga',
      accent:'#f59e0b',
      bg:    'linear-gradient(135deg,#1c1200,#2a1a00)',
      border:'rgba(245,158,11,0.25)',
      tag:   'IMPORTAR',
    },
    {
      title: 'Inventario Cíclico',
      desc:  'Conteo físico diario por bodega',
      icon:  <ClipboardList size={28} strokeWidth={1.5} />,
      href:  '/almacen/inventario',
      accent:'#0ea5e9',
      bg:    'linear-gradient(135deg,#001825,#002535)',
      border:'rgba(14,165,233,0.25)',
      tag:   'CONTAR',
    },
    {
      title: 'Informe de Variaciones',
      desc:  'Reporte semanal físico vs sistema',
      icon:  <BarChart3 size={28} strokeWidth={1.5} />,
      href:  '/almacen/informe',
      accent:'#10b981',
      bg:    'linear-gradient(135deg,#001a12,#002a1c)',
      border:'rgba(16,185,129,0.25)',
      tag:   'ANALIZAR',
    },
    {
      title: 'Horas Extra',
      desc:  'Control de horas extra del personal de almacén',
      icon:  <Clock size={28} strokeWidth={1.5} />,
      href:  '/almacen/horas-extra',
      accent:'#a855f7',
      bg:    'linear-gradient(135deg,#150a25,#1e1035)',
      border:'rgba(168,85,247,0.25)',
      tag:   'TURNOS',
    },
  ]

  return (
    <main className="min-h-screen relative overflow-hidden" style={{ background: '#070b14' }}>

      {/* Grid bg */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(245,158,11,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,0.02) 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }} />

      {/* Header */}
      <header className="relative z-10 px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid #0f1e2e', background: 'rgba(7,11,20,0.8)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <Warehouse size={20} style={{ color: '#f59e0b' }} />
          </div>
          <div>
            <p className="text-white font-black text-sm tracking-wide">ALMACÉN</p>
            <p className="text-xs" style={{ color: '#475569' }}>Gestión de inventario</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end">
            <p className="text-sm font-semibold" style={{ color: '#cbd5e1' }}>{usuario.nombre}</p>
            <span className="text-xs font-bold px-2 py-0.5 rounded-md"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
              {usuario.rol.toUpperCase()}
            </span>
          </div>
          <button onClick={salir}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-all hover:bg-red-900/20 hover:text-red-400"
            style={{ color: '#64748b', border: '1px solid #1a2640' }}>
            <LogOut size={13} /> Salir
          </button>
        </div>
      </header>

      <div className="relative z-10 max-w-3xl mx-auto px-6 py-10">

        {/* Hero */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-0.5 rounded-full" style={{ background: '#f59e0b' }} />
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#f59e0b' }}>
              Panel principal
            </p>
          </div>
          <h2 className="text-3xl font-black" style={{ color: '#f1f5f9' }}>
            Control de <span style={{ color: '#f59e0b' }}>Existencias</span>
          </h2>
          <p className="text-sm mt-2" style={{ color: '#64748b' }}>
            Materia prima · Material de empaque · Productos manufacturados
          </p>
        </div>

        {/* Info strip */}
        <div className="rounded-xl px-5 py-4 mb-8 flex items-center gap-4"
          style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.12)' }}>
          <Package size={20} style={{ color: '#f59e0b' }} className="flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: '#cbd5e1' }}>
              Flujo de trabajo recomendado
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
              1. Carga el Excel del ERP → 2. Realiza el conteo físico diario → 3. Genera el informe semanal
            </p>
          </div>
          <TrendingUp size={16} style={{ color: '#f59e0b' }} className="flex-shrink-0" />
        </div>

        {/* Module cards */}
        <div className="flex flex-col gap-4">
          {cards.map((c, idx) => (
            <button key={c.href} onClick={() => router.push(c.href)}
              className="group w-full rounded-2xl p-6 flex items-center gap-5 transition-all hover:scale-[1.01] active:scale-[0.99] text-left"
              style={{ background: c.bg, border: `1px solid ${c.border}`, boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>

              <div className="flex-shrink-0 flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center"
                  style={{ background: `${c.accent}15`, border: `1px solid ${c.accent}30`, color: c.accent }}>
                  {c.icon}
                </div>
                <span className="text-xs font-black tracking-widest" style={{ color: c.accent, fontSize: '0.6rem' }}>
                  {c.tag}
                </span>
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: c.accent }}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div className="w-4 h-px" style={{ background: c.accent }} />
                </div>
                <p className="text-white font-black text-lg leading-tight">{c.title}</p>
                <p className="text-sm mt-1" style={{ color: '#64748b' }}>{c.desc}</p>
              </div>

              <ArrowRight size={20} style={{ color: c.accent }}
                className="flex-shrink-0 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
