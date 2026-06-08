'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ClipboardList, Loader2, Save, CheckCircle2, Search, ScanLine } from 'lucide-react'

type Usuario = { cedula: string; nombre: string; rol: string }
type Producto = {
  id: string; codigo: string; nombre: string; categoria: string; bodega: string
  unidad_medida: string; costo_unitario: number; stock_sistema: number
  conteo: { conteo_fisico: number; diferencia: number; observacion: string } | null
}

const SESSION_KEY = 'almacen_usuario'

const CAT_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  materia_prima:      { bg: 'rgba(16,185,129,0.1)',  color: '#10b981', label: 'MP' },
  material_empaque:   { bg: 'rgba(14,165,233,0.1)',  color: '#0ea5e9', label: 'ME' },
  producto_terminado: { bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b', label: 'MF' },
}

export default function InventarioPage() {
  const router  = useRouter()
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

  const [usuario,   setUsuario]   = useState<Usuario | null>(null)
  const [checking,  setChecking]  = useState(true)
  const [fecha,     setFecha]     = useState(hoy)
  const [productos, setProductos] = useState<Producto[]>([])
  const [conteos,   setConteos]   = useState<Record<string, string>>({})
  const [observ,    setObserv]    = useState<Record<string, string>>({})
  const [loading,   setLoading]   = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [guardado,  setGuardado]  = useState(false)
  const [filtro,    setFiltro]    = useState('todos')
  const [busqueda,  setBusqueda]  = useState('')

  useEffect(() => {
    try { const s = localStorage.getItem(SESSION_KEY); if (s) setUsuario(JSON.parse(s)) } catch { /* noop */ }
    setChecking(false)
  }, [])

  const cargarDatos = useCallback(async (f: string) => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/almacen/conteos?fecha=${f}`)
      const data = await res.json()
      const prods: Producto[] = data.productos ?? []
      setProductos(prods)
      const c: Record<string, string> = {}
      const o: Record<string, string> = {}
      for (const p of prods) {
        if (p.conteo) { c[p.id] = String(p.conteo.conteo_fisico); o[p.id] = p.conteo.observacion ?? '' }
      }
      setConteos(c); setObserv(o)
    } catch { /* noop */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { if (!checking) cargarDatos(fecha) }, [fecha, checking, cargarDatos])

  if (checking) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#070b14' }}>
      <Loader2 size={28} className="animate-spin" style={{ color: '#f59e0b' }} />
    </div>
  )
  if (!usuario) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#070b14' }}>
      <button onClick={() => router.push('/almacen')} className="text-sm underline" style={{ color: '#f59e0b' }}>
        Ir al inicio
      </button>
    </div>
  )

  const bodegas = [...new Set(productos.map(p => p.bodega))].sort()

  const filtrados = productos.filter(p => {
    const bodOk = filtro === 'todos' || p.bodega === filtro
    const busOk = !busqueda || p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || p.codigo.toLowerCase().includes(busqueda.toLowerCase())
    return bodOk && busOk
  })

  const conteoCount   = Object.values(conteos).filter(v => v !== '').length
  const totalDifPos   = filtrados.reduce((s, p) => {
    const cf = conteos[p.id] !== undefined && conteos[p.id] !== '' ? Number(conteos[p.id]) - p.stock_sistema : (p.conteo?.diferencia ?? 0)
    return cf > 0 ? s + cf : s
  }, 0)
  const totalDifNeg   = filtrados.reduce((s, p) => {
    const cf = conteos[p.id] !== undefined && conteos[p.id] !== '' ? Number(conteos[p.id]) - p.stock_sistema : (p.conteo?.diferencia ?? 0)
    return cf < 0 ? s + cf : s
  }, 0)

  async function guardar() {
    const filas = Object.entries(conteos).filter(([, v]) => v !== '').map(([id, v]) => ({
      producto_id: id, conteo_fisico: Number(v), observacion: observ[id] ?? ''
    }))
    if (filas.length === 0) return
    setGuardando(true)
    try {
      await fetch('/api/almacen/conteos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, conteos: filas, usuario_cedula: usuario?.cedula, usuario_nombre: usuario?.nombre }),
      })
      setGuardado(true); setTimeout(() => setGuardado(false), 3000)
      cargarDatos(fecha)
    } catch { /* noop */ }
    finally { setGuardando(false) }
  }

  return (
    <main className="min-h-screen" style={{ background: '#070b14' }}>

      {/* Grid bg */}
      <div className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(14,165,233,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(14,165,233,0.015) 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }} />

      {/* Header */}
      <header className="sticky top-0 z-20 px-6 py-4 flex items-center justify-between"
        style={{ background: 'rgba(7,11,20,0.95)', borderBottom: '1px solid #0f1e2e', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/almacen')} className="p-2 rounded-lg hover:bg-white/5 transition-all" style={{ color: '#64748b' }}>
            <ArrowLeft size={18} />
          </button>
          <div className="w-px h-5" style={{ background: '#1a2640' }} />
          <div className="p-1.5 rounded-lg" style={{ background: 'rgba(14,165,233,0.1)' }}>
            <ScanLine size={16} style={{ color: '#0ea5e9' }} />
          </div>
          <div>
            <p className="text-white font-bold text-sm">Inventario Cíclico</p>
            <p className="text-xs" style={{ color: '#475569' }}>Conteo físico por bodega</p>
          </div>
        </div>
        <button onClick={guardar} disabled={guardando || conteoCount === 0}
          className="flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl transition-all hover:brightness-110 disabled:opacity-30"
          style={{
            background: guardado ? 'rgba(16,185,129,0.15)' : 'linear-gradient(135deg,#0c4a6e,#0369a1)',
            border: `1px solid ${guardado ? 'rgba(16,185,129,0.4)' : '#0ea5e9'}`,
            color: guardado ? '#10b981' : '#fff',
            boxShadow: '0 4px 12px rgba(14,165,233,0.15)'
          }}>
          {guardando ? <Loader2 size={14} className="animate-spin" /> : guardado ? <CheckCircle2 size={14} /> : <Save size={14} />}
          {guardado ? 'Guardado' : `Guardar${conteoCount > 0 ? ` (${conteoCount})` : ''}`}
        </button>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-5 pb-16">

        {/* Controls */}
        <div className="rounded-2xl p-4 mb-5 flex flex-wrap items-end gap-3"
          style={{ background: '#0d1525', border: '1px solid #1a2640' }}>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: '#475569' }}>Fecha</label>
            <input type="date" value={fecha} max={hoy}
              onChange={e => { setFecha(e.target.value); setGuardado(false) }}
              className="rounded-lg px-3 py-2 text-sm font-mono focus:outline-none"
              style={{ background: '#070b14', border: '1px solid #1a2640', color: '#f1f5f9' }} />
          </div>
          <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: '#475569' }}>Buscar</label>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#334155' }} />
              <input type="text" placeholder="Código o nombre..." value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="w-full rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none"
                style={{ background: '#070b14', border: '1px solid #1a2640', color: '#f1f5f9' }} />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[['todos', 'TODOS'], ...bodegas.map(b => [b, `BOD ${b}`])].map(([v, l]) => (
              <button key={v} onClick={() => setFiltro(v)}
                className="text-xs px-3 py-2 rounded-lg font-bold uppercase tracking-wider transition-all"
                style={{
                  background: filtro === v ? '#0ea5e9' : '#070b14',
                  border: `1px solid ${filtro === v ? '#0ea5e9' : '#1a2640'}`,
                  color: filtro === v ? 'white' : '#475569'
                }}>{l}</button>
            ))}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total productos', val: filtrados.length, color: '#94a3b8' },
            { label: 'Contados', val: conteoCount, color: '#0ea5e9' },
            { label: 'Sobrante acum.', val: `+${Math.round(totalDifPos * 10) / 10}`, color: '#10b981' },
            { label: 'Faltante acum.', val: Math.round(totalDifNeg * 10) / 10, color: '#ef4444' },
          ].map(k => (
            <div key={k.label} className="rounded-xl p-4 text-center" style={{ background: '#0d1525', border: '1px solid #1a2640' }}>
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#334155' }}>{k.label}</p>
              <p className="text-2xl font-black" style={{ color: k.color }}>{k.val}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={32} className="animate-spin" style={{ color: '#0ea5e9' }} />
              <p className="text-sm" style={{ color: '#334155' }}>Cargando productos...</p>
            </div>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-24 rounded-2xl" style={{ background: '#0d1525', border: '1px solid #1a2640' }}>
            <ClipboardList size={48} className="mx-auto mb-4" strokeWidth={1} style={{ color: '#1a2640' }} />
            <p className="font-bold" style={{ color: '#334155' }}>Sin productos</p>
            <p className="text-sm mt-1" style={{ color: '#1a2640' }}>Carga el inventario desde Excel primero</p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1a2640' }}>
            <table className="w-full text-sm min-w-[750px]">
              <thead>
                <tr style={{ background: '#0a1020' }}>
                  {['BOD','CAT','CÓDIGO','PRODUCTO','UM','STOCK SISTEMA','CONTEO FÍSICO','DIFERENCIA','NOTA'].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-black uppercase tracking-widest whitespace-nowrap"
                      style={{ color: '#334155', borderBottom: '1px solid #0f1e2e' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p, i) => {
                  const cf   = conteos[p.id] ?? ''
                  const dif  = cf !== '' ? Number(cf) - p.stock_sistema : (p.conteo?.diferencia ?? null)
                  const difR = dif !== null ? Math.round(dif * 1000) / 1000 : null
                  const cat  = CAT_STYLE[p.categoria] ?? { bg: 'rgba(75,85,99,0.1)', color: '#6b7280', label: '??' }
                  return (
                    <tr key={p.id}
                      style={{ background: i % 2 === 0 ? '#0d1525' : '#070b14', borderBottom: '1px solid #0f1e2e' }}
                      className="hover:bg-white/[0.02] transition-colors">
                      {/* BOD */}
                      <td className="px-3 py-2.5">
                        <span className="text-xs font-black px-2 py-0.5 rounded-md font-mono"
                          style={{ background: 'rgba(14,165,233,0.1)', color: '#0ea5e9', border: '1px solid rgba(14,165,233,0.2)' }}>
                          {p.bodega}
                        </span>
                      </td>
                      {/* CAT */}
                      <td className="px-3 py-2.5">
                        <span className="text-xs font-black px-2 py-0.5 rounded-md"
                          style={{ background: cat.bg, color: cat.color }}>
                          {cat.label}
                        </span>
                      </td>
                      {/* CÓDIGO */}
                      <td className="px-3 py-2.5 font-mono text-xs" style={{ color: '#475569' }}>{p.codigo}</td>
                      {/* PRODUCTO */}
                      <td className="px-3 py-2.5 max-w-[200px]">
                        <span className="text-xs font-semibold line-clamp-2" style={{ color: '#cbd5e1' }}>{p.nombre}</span>
                      </td>
                      {/* UM */}
                      <td className="px-3 py-2.5 text-xs font-mono" style={{ color: '#334155' }}>{p.unidad_medida}</td>
                      {/* STOCK */}
                      <td className="px-3 py-2.5">
                        <span className="text-sm font-black font-mono" style={{ color: '#0ea5e9' }}>{p.stock_sistema}</span>
                      </td>
                      {/* CONTEO */}
                      <td className="px-3 py-2.5">
                        <input
                          type="number" step="0.001" min="0"
                          value={cf}
                          onChange={e => setConteos(prev => ({ ...prev, [p.id]: e.target.value }))}
                          placeholder="—"
                          className="w-24 rounded-lg px-2.5 py-1.5 text-sm font-mono text-right focus:outline-none transition-all"
                          style={{
                            background: cf ? 'rgba(245,158,11,0.06)' : '#070b14',
                            border: `1px solid ${cf ? 'rgba(245,158,11,0.3)' : '#1a2640'}`,
                            color: '#f1f5f9'
                          }}
                        />
                      </td>
                      {/* DIFERENCIA */}
                      <td className="px-3 py-2.5">
                        {difR !== null ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black"
                            style={{
                              background: difR < 0 ? 'rgba(239,68,68,0.1)' : difR > 0 ? 'rgba(16,185,129,0.1)' : '#070b14',
                              color: difR < 0 ? '#ef4444' : difR > 0 ? '#10b981' : '#475569',
                              border: `1px solid ${difR < 0 ? 'rgba(239,68,68,0.2)' : difR > 0 ? 'rgba(16,185,129,0.2)' : '#1a2640'}`
                            }}>
                            {difR > 0 ? '+' : ''}{difR}
                          </span>
                        ) : <span style={{ color: '#1a2640' }}>—</span>}
                      </td>
                      {/* NOTA */}
                      <td className="px-3 py-2.5">
                        <input type="text" value={observ[p.id] ?? ''}
                          onChange={e => setObserv(prev => ({ ...prev, [p.id]: e.target.value }))}
                          placeholder="nota..."
                          className="w-28 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none transition-all"
                          style={{ background: '#070b14', border: '1px solid #1a2640', color: '#64748b' }}
                        />
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
