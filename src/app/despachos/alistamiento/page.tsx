'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  PackageCheck, ArrowLeft, LogOut, Search, Save,
  CheckCircle2, Loader2, AlertTriangle, Clock, X, User
} from 'lucide-react'

type Usuario = { cedula: string; nombre: string; rol: string }

type Pedido = {
  id: string
  cliente: string
  oc: string | null
  documento: string | null
  fecha_subida: string | null
  fecha_max_entrega: string | null
  fecha_despacho: string | null
  entrega_tipo: string | null
  linea: string | null
  tipo_envio: string | null
  alistado_por: string | null
}

const SESSION_KEY   = 'alistamiento_usuario'
const ROLES_OK      = ['Almacenista', 'Director', 'Gerencia']

function getEstado(p: Pedido): 'PENDIENTE' | 'VENCIDO' | 'DESPACHADO' {
  if (p.fecha_despacho) return 'DESPACHADO'
  const hoy = new Date().toISOString().split('T')[0]
  if (p.fecha_max_entrega && p.fecha_max_entrega < hoy) return 'VENCIDO'
  return 'PENDIENTE'
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function AlistamientoPage() {
  const router = useRouter()
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

  /* ── Auth ── */
  const [usuario,     setUsuario]     = useState<Usuario | null>(null)
  const [checking,    setChecking]    = useState(true)
  const [cedula,      setCedula]      = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError,   setAuthError]   = useState('')

  /* ── Datos ── */
  const [pedidos,     setPedidos]     = useState<Pedido[]>([])
  const [loadingData, setLoadingData] = useState(false)

  /* ── Formulario ── */
  const [busqueda,     setBusqueda]     = useState('')
  const [seleccionado, setSeleccionado] = useState<Pedido | null>(null)
  const [tipoEntrega,  setTipoEntrega]  = useState<'PARCIAL' | 'COMPLETA' | ''>('')
  const [fechaAlist,   setFechaAlist]   = useState(hoy)
  const [guardando,    setGuardando]    = useState(false)
  const [okIds,        setOkIds]        = useState<Set<string>>(new Set())
  const [errorGuardar, setErrorGuardar] = useState('')

  /* ── Init ── */
  useEffect(() => {
    try { const s = localStorage.getItem(SESSION_KEY); if (s) setUsuario(JSON.parse(s)) } catch { /* noop */ }
    setChecking(false)
  }, [])

  const cargar = useCallback(async () => {
    setLoadingData(true)
    try {
      const res  = await fetch('/api/despachos')
      if (!res.ok) return
      const data: Pedido[] = await res.json()
      // Solo PENDIENTE o VENCIDO con entrega vacía o PARCIAL
      const filtrados = data.filter(p => {
        const est = getEstado(p)
        const entregaIncompleta = !p.entrega_tipo || p.entrega_tipo === 'PARCIAL'
        return (est === 'PENDIENTE' || est === 'VENCIDO') && entregaIncompleta
      })
      setPedidos(filtrados)
    } catch { /* noop */ }
    finally { setLoadingData(false) }
  }, [])

  useEffect(() => { if (!checking && usuario) cargar() }, [checking, usuario, cargar])

  /* ── Login ── */
  async function login(e: React.FormEvent) {
    e.preventDefault(); setAuthLoading(true); setAuthError('')
    try {
      const res  = await fetch('/api/auth/despachos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula: cedula.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setAuthError(data.error || 'Acceso denegado'); return }
      if (!ROLES_OK.includes(data.rol)) {
        setAuthError('Solo Almacenistas, Director y Gerencia pueden acceder'); return
      }
      const u = { cedula: cedula.trim(), nombre: data.nombre, rol: data.rol }
      localStorage.setItem(SESSION_KEY, JSON.stringify(u))
      setUsuario(u)
    } catch { setAuthError('Error de conexión') }
    finally { setAuthLoading(false) }
  }

  function salir() { localStorage.removeItem(SESSION_KEY); setUsuario(null); setCedula('') }

  /* ── Guardar ── */
  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!seleccionado || !tipoEntrega) return
    setGuardando(true); setErrorGuardar('')
    try {
      const res = await fetch(`/api/despachos/${seleccionado.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entrega_tipo:         tipoEntrega,
          alistado_por:         usuario?.nombre ?? null,
          alistado_por_cedula:  usuario?.cedula ?? null,
          fecha_alistamiento:   fechaAlist,
        }),
      })
      if (!res.ok) { const d = await res.json(); setErrorGuardar(d.error || 'Error'); return }
      setOkIds(prev => new Set([...prev, seleccionado.id]))
      setTimeout(() => setOkIds(prev => { const s = new Set(prev); s.delete(seleccionado.id); return s }), 4000)
      // Reset
      setBusqueda(''); setSeleccionado(null); setTipoEntrega(''); setFechaAlist(hoy)
      cargar()
    } catch { setErrorGuardar('Error de conexión') }
    finally { setGuardando(false) }
  }

  /* ── Filtro de lista ── */
  const pedidosFiltrados = pedidos.filter(p => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return (p.documento ?? '').toLowerCase().includes(q)
      || (p.oc ?? '').toLowerCase().includes(q)
      || p.cliente.toLowerCase().includes(q)
  })

  /* ── LOGIN SCREEN ── */
  if (checking) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d1a2a' }}>
      <Loader2 size={28} className="animate-spin text-orange-400" />
    </div>
  )

  if (!usuario) return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: '#0d1a2a', color: '#e2e8f0' }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="p-4 rounded-2xl" style={{ background: '#1a2a1a', border: '1px solid #2a5a1a' }}>
            <PackageCheck size={36} strokeWidth={1.5} className="text-orange-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Alistamiento de Pedidos</h1>
          <p className="text-sm text-gray-500 text-center">Ingresa tu cédula para acceder</p>
        </div>
        <form onSubmit={login} className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Cédula</label>
            <input type="text" inputMode="numeric" autoFocus required value={cedula}
              onChange={e => { setCedula(e.target.value); setAuthError('') }}
              placeholder="Número de cédula"
              className="w-full text-white text-lg font-mono rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
              style={{ background: '#0f2035', border: '1px solid #1a4060' }} />
          </div>
          {authError && (
            <div className="rounded-lg px-4 py-3 text-sm text-red-300"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
              {authError}
            </div>
          )}
          <button type="submit" disabled={authLoading || !cedula.trim()}
            className="w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#92400e,#b45309)', border: '1px solid #d97706' }}>
            {authLoading ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Ingresar'}
          </button>
        </form>
        <p className="text-center text-xs text-gray-600 mt-5">Acceso: Almacenista · Director · Gerencia</p>
        <button onClick={() => router.push('/despachos')}
          className="flex items-center gap-1.5 text-gray-600 hover:text-gray-400 text-sm mx-auto mt-4 transition-colors">
          <ArrowLeft size={14} /> Control de Despachos
        </button>
      </div>
    </main>
  )

  /* ── MÓDULO ── */
  const vencidos  = pedidosFiltrados.filter(p => getEstado(p) === 'VENCIDO').length
  const pendientes = pedidosFiltrados.filter(p => getEstado(p) === 'PENDIENTE').length

  return (
    <main className="min-h-screen flex flex-col" style={{ background: '#0d1a2a', color: '#e2e8f0' }}>

      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid #1a4060', background: '#0a1525' }}>
        <button onClick={() => router.push('/despachos')}
          className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800">
          <ArrowLeft size={18} />
        </button>
        <PackageCheck size={20} strokeWidth={1.5} className="text-orange-400" />
        <h1 className="text-lg font-bold text-white flex-1">Alistamiento de Pedidos</h1>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{ background: '#0f2035', border: '1px solid #1a4060' }}>
          <User size={13} className="text-orange-400" />
          <span className="text-xs text-gray-300">{usuario.nombre}</span>
          <span className="text-xs px-1.5 py-0.5 rounded font-medium"
            style={{ background: 'rgba(234,88,12,0.2)', color: '#fb923c', border: '1px solid rgba(234,88,12,0.3)' }}>
            {usuario.rol}
          </span>
        </div>
        <button onClick={salir} className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-900/20">
          <LogOut size={16} />
        </button>
      </div>

      <div className="flex-1 px-4 py-4 flex flex-col gap-4 max-w-6xl mx-auto w-full">

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Por alistar', val: pedidos.length, color: '#60a5fa' },
            { label: 'Pendientes',  val: pendientes,     color: '#facc15' },
            { label: 'Vencidos',    val: vencidos,       color: '#f87171' },
          ].map(k => (
            <div key={k.label} className="rounded-xl p-4" style={{ background: '#0f2035', border: '1px solid #1a4060' }}>
              <p className="text-xs text-gray-500 mb-1">{k.label}</p>
              <p className="text-2xl font-bold" style={{ color: k.color }}>{k.val}</p>
            </div>
          ))}
        </div>

        {/* Formulario de alistamiento */}
        <form onSubmit={guardar}
          className="rounded-2xl p-5"
          style={{ background: '#0f2035', border: `2px solid ${seleccionado ? '#d97706' : '#1a4060'}`, transition: 'border-color 0.2s' }}>
          <div className="flex items-center gap-2 mb-4">
            <PackageCheck size={16} className="text-orange-400" />
            <p className="text-white font-bold text-sm">Registrar Alistamiento</p>
            {seleccionado && (
              <span className="ml-auto text-xs px-2 py-0.5 rounded font-medium"
                style={{ background: 'rgba(217,119,6,0.2)', color: '#fbbf24', border: '1px solid rgba(217,119,6,0.4)' }}>
                {seleccionado.cliente} · {seleccionado.documento ?? seleccionado.oc ?? 'Sin doc'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* 1. Buscar documento */}
            <div className="flex flex-col gap-1.5 sm:col-span-1">
              <label className="text-xs text-gray-400 uppercase tracking-wide">Buscar documento</label>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input type="text" placeholder="DOC, OC o cliente..."
                  value={busqueda}
                  onChange={e => { setBusqueda(e.target.value); if (!e.target.value) setSeleccionado(null) }}
                  className="w-full pl-8 pr-3 py-2.5 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                  style={{ background: '#070d18', border: '1px solid #1a4060' }} />
                {busqueda && (
                  <button type="button" onClick={() => { setBusqueda(''); setSeleccionado(null) }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* 2. Tipo de entrega */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-400 uppercase tracking-wide">Tipo de entrega</label>
              <select required value={tipoEntrega}
                onChange={e => setTipoEntrega(e.target.value as 'PARCIAL' | 'COMPLETA' | '')}
                className="py-2.5 px-3 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
                style={{ background: '#070d18', border: '1px solid #1a4060' }}>
                <option value="">— Seleccionar —</option>
                <option value="PARCIAL">Parcial</option>
                <option value="COMPLETA">Completa</option>
              </select>
            </div>

            {/* 3. Fecha */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-400 uppercase tracking-wide">Fecha alistamiento</label>
              <input type="date" value={fechaAlist} max={hoy}
                onChange={e => setFechaAlist(e.target.value)}
                className="py-2.5 px-3 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                style={{ background: '#070d18', border: '1px solid #1a4060' }} />
            </div>

            {/* 4. Guardar */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-400 uppercase tracking-wide">Acción</label>
              <button type="submit"
                disabled={guardando || !seleccionado || !tipoEntrega}
                className="w-full py-2.5 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition-all hover:brightness-110 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#92400e,#b45309)', border: '1px solid #d97706' }}>
                {guardando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>

          {errorGuardar && (
            <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
              <AlertTriangle size={12} /> {errorGuardar}
            </p>
          )}
          {!seleccionado && (
            <p className="mt-2 text-xs text-gray-600">
              ↓ Selecciona un pedido de la lista para habilitar el guardado
            </p>
          )}
        </form>

        {/* Lista de pedidos */}
        {loadingData ? (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-orange-400" />
          </div>
        ) : pedidosFiltrados.length === 0 ? (
          <div className="text-center py-12 text-gray-600">
            <PackageCheck size={40} strokeWidth={1} className="mx-auto mb-3" />
            <p className="text-sm">
              {busqueda ? 'Sin resultados para esa búsqueda' : 'No hay pedidos pendientes de alistamiento'}
            </p>
          </div>
        ) : (
          <div className="rounded-xl overflow-auto" style={{ border: '1px solid #1a4060' }}>
            <table className="w-full text-xs min-w-[700px]">
              <thead>
                <tr style={{ background: '#0a1525', borderBottom: '1px solid #1a4060' }}>
                  {['ESTADO','CLIENTE','OC','DOCUMENTO','LÍNEA','F. SUBIDA','F. MÁX.','ENTREGA ACT.','ALISTADO POR',''].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-bold uppercase tracking-wide whitespace-nowrap"
                      style={{ color: '#475569' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pedidosFiltrados.map((p, i) => {
                  const estado    = getEstado(p)
                  const isOk      = okIds.has(p.id)
                  const isSel     = seleccionado?.id === p.id
                  const rowBg     = isOk ? '#0a200a'
                    : isSel ? '#1a1200'
                    : estado === 'VENCIDO' ? '#1a0505'
                    : i % 2 === 0 ? '#0f2035' : '#0d1a2a'
                  return (
                    <tr key={p.id}
                      onClick={() => { setSeleccionado(p); setBusqueda(p.documento ?? p.oc ?? '') }}
                      className="cursor-pointer transition-colors hover:brightness-125"
                      style={{ background: rowBg, borderBottom: '1px solid #0f1e30', outline: isSel ? '2px solid #d97706' : 'none' }}>

                      {/* ESTADO */}
                      <td className="px-3 py-2.5">
                        <span className="px-2 py-0.5 rounded-full font-bold"
                          style={{
                            background: estado === 'VENCIDO' ? 'rgba(239,68,68,0.2)' : 'rgba(250,204,21,0.15)',
                            color: estado === 'VENCIDO' ? '#f87171' : '#facc15'
                          }}>
                          {estado === 'VENCIDO' ? <span className="flex items-center gap-1"><AlertTriangle size={9} /> Vencido</span> : <span className="flex items-center gap-1"><Clock size={9} /> Pendiente</span>}
                        </span>
                      </td>

                      {/* CLIENTE */}
                      <td className="px-3 py-2.5 text-white font-semibold max-w-[160px]">
                        <span className="block truncate">{p.cliente}</span>
                      </td>

                      {/* OC */}
                      <td className="px-3 py-2.5 font-mono text-gray-400">{p.oc ?? '—'}</td>

                      {/* DOC */}
                      <td className="px-3 py-2.5 font-mono text-gray-300 font-semibold">{p.documento ?? '—'}</td>

                      {/* LÍNEA */}
                      <td className="px-3 py-2.5 text-gray-500">{p.linea ?? '—'}</td>

                      {/* F. SUBIDA */}
                      <td className="px-3 py-2.5 text-gray-500">{fmtDate(p.fecha_subida)}</td>

                      {/* F. MÁX */}
                      <td className="px-3 py-2.5" style={{ color: estado === 'VENCIDO' ? '#f87171' : '#e2e8f0' }}>
                        {fmtDate(p.fecha_max_entrega)}
                      </td>

                      {/* ENTREGA ACT */}
                      <td className="px-3 py-2.5">
                        {p.entrega_tipo
                          ? <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: 'rgba(250,204,21,0.15)', color: '#fbbf24' }}>{p.entrega_tipo}</span>
                          : <span className="text-gray-600">—</span>}
                      </td>

                      {/* ALISTADO POR */}
                      <td className="px-3 py-2.5">
                        {isOk
                          ? <span className="flex items-center gap-1 text-green-400 font-semibold"><CheckCircle2 size={11} /> Guardado</span>
                          : p.alistado_por
                          ? <span className="text-gray-400">{p.alistado_por}</span>
                          : <span className="text-gray-700">—</span>}
                      </td>

                      {/* ACCIONES */}
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1.5 flex-wrap">
                          <button type="button"
                            onClick={() => { setSeleccionado(p); setBusqueda(p.documento ?? p.oc ?? '') }}
                            className="text-xs px-2.5 py-1 rounded font-semibold transition-all hover:brightness-125"
                            style={isSel
                              ? { background: '#92400e', border: '1px solid #d97706', color: '#fde68a' }
                              : { background: '#1e293b', border: '1px solid #334155', color: '#94a3b8' }}>
                            {isSel ? '✓ Selec.' : 'Selec.'}
                          </button>
                          <button type="button"
                            onClick={() => router.push(`/despachos/alistamiento/picking?id=${p.id}&doc=${encodeURIComponent(p.documento ?? p.oc ?? '')}&cliente=${encodeURIComponent(p.cliente)}`)}
                            className="text-xs px-2.5 py-1 rounded font-semibold transition-all hover:brightness-125 flex items-center gap-1"
                            style={{ background: 'rgba(234,88,12,0.2)', border: '1px solid rgba(234,88,12,0.4)', color: '#fb923c' }}>
                            📦 Picking
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
