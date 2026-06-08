'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, BarChart3, Loader2, Download, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react'

type Usuario = { cedula: string; nombre: string; rol: string }
type ProdInforme = {
  codigo: string; nombre: string; categoria: string
  unidad_medida: string; costo_unitario: number; stock_sistema: number
  dias_contados: number; total_dif: number; prom_dif: number; valor_dif: number
  conteos: { fecha: string; conteo_fisico: number; diferencia: number; stock_sistema: number }[]
}

const SESSION_KEY = 'almacen_usuario'

const CAT_STYLE: Record<string, { color: string; label: string }> = {
  materia_prima:      { color: '#10b981', label: 'MP' },
  material_empaque:   { color: '#0ea5e9', label: 'ME' },
  producto_terminado: { color: '#f59e0b', label: 'MF' },
}

function fmtCOP(v: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)
}

export default function InformePage() {
  const router = useRouter()
  const hoy   = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const lunes = (() => {
    const d = new Date(); const day = d.getDay()
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  })()

  const [usuario,     setUsuario]     = useState<Usuario | null>(null)
  const [checking,    setChecking]    = useState(true)
  const [desde,       setDesde]       = useState(lunes)
  const [hasta,       setHasta]       = useState(hoy)
  const [productos,   setProductos]   = useState<ProdInforme[]>([])
  const [loading,     setLoading]     = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [buscado,     setBuscado]     = useState(false)
  const [expandido,   setExpandido]   = useState<string | null>(null)

  useEffect(() => {
    try { const s = localStorage.getItem(SESSION_KEY); if (s) setUsuario(JSON.parse(s)) } catch { /* noop */ }
    setChecking(false)
  }, [])

  if (checking) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#070b14' }}>
      <Loader2 size={28} className="animate-spin" style={{ color: '#f59e0b' }} />
    </div>
  )
  if (!usuario) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#070b14' }}>
      <button onClick={() => router.push('/almacen')} className="text-sm underline" style={{ color: '#f59e0b' }}>Ir al inicio</button>
    </div>
  )

  async function buscar(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setBuscado(false)
    try {
      const res  = await fetch(`/api/almacen/informe?desde=${desde}&hasta=${hasta}`)
      const data = await res.json()
      setProductos(data.productos ?? []); setBuscado(true)
    } catch { /* noop */ }
    finally { setLoading(false) }
  }

  async function descargar() {
    setDescargando(true)
    try {
      const res  = await fetch(`/api/almacen/informe?desde=${desde}&hasta=${hasta}&exportar=true`)
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `informe-almacen_${desde}_${hasta}.xlsx`
      a.click(); URL.revokeObjectURL(url)
    } catch { /* noop */ }
    finally { setDescargando(false) }
  }

  const totalValor  = productos.reduce((s, p) => s + p.valor_dif, 0)
  const conFalt     = productos.filter(p => p.total_dif < -0.001).length
  const conSobr     = productos.filter(p => p.total_dif > 0.001).length
  const enCero      = productos.filter(p => Math.abs(p.total_dif) <= 0.001).length

  return (
    <main className="min-h-screen" style={{ background: '#070b14' }}>

      {/* Grid bg */}
      <div className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(16,185,129,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.015) 1px, transparent 1px)',
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
          <div className="p-1.5 rounded-lg" style={{ background: 'rgba(16,185,129,0.1)' }}>
            <BarChart3 size={16} style={{ color: '#10b981' }} />
          </div>
          <div>
            <p className="text-white font-bold text-sm">Informe de Variaciones</p>
            <p className="text-xs" style={{ color: '#475569' }}>Físico vs sistema · Por rango de fechas</p>
          </div>
        </div>
        {buscado && productos.length > 0 && (
          <button onClick={descargar} disabled={descargando}
            className="flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl transition-all hover:brightness-110 disabled:opacity-40"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981' }}>
            {descargando ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Exportar Excel
          </button>
        )}
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-5 pb-16">

        {/* Filters */}
        <form onSubmit={buscar} className="rounded-2xl p-4 mb-5 flex flex-wrap items-end gap-3"
          style={{ background: '#0d1525', border: '1px solid #1a2640' }}>
          {[
            { label: 'Desde', val: desde, set: setDesde, max: hasta },
            { label: 'Hasta', val: hasta, set: setHasta, min: desde, max: hoy },
          ].map(f => (
            <div key={f.label} className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: '#475569' }}>{f.label}</label>
              <input type="date" value={f.val} min={'min' in f ? f.min : undefined} max={f.max}
                onChange={e => f.set(e.target.value)}
                className="rounded-lg px-3 py-2 text-sm font-mono focus:outline-none"
                style={{ background: '#070b14', border: '1px solid #1a2640', color: '#f1f5f9' }} />
            </div>
          ))}
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all hover:brightness-110 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#064e3b,#065f46)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', boxShadow: '0 4px 12px rgba(16,185,129,0.1)' }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <BarChart3 size={14} />}
            Generar Informe
          </button>
        </form>

        {buscado && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[
                { label: 'Productos analizados', val: productos.length, color: '#94a3b8', sub: 'total con conteos' },
                { label: 'Con faltante', val: conFalt, color: '#ef4444', sub: 'diferencia negativa' },
                { label: 'Con sobrante', val: conSobr, color: '#10b981', sub: 'diferencia positiva' },
                { label: 'Sin variación', val: enCero, color: '#475569', sub: 'exactos' },
              ].map(k => (
                <div key={k.label} className="rounded-2xl p-5" style={{ background: '#0d1525', border: '1px solid #1a2640' }}>
                  <p className="text-3xl font-black" style={{ color: k.color }}>{k.val}</p>
                  <p className="text-sm font-semibold mt-1" style={{ color: '#cbd5e1' }}>{k.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#334155' }}>{k.sub}</p>
                </div>
              ))}
            </div>

            {/* Valor total */}
            <div className="rounded-2xl px-6 py-4 mb-5 flex items-center justify-between"
              style={{ background: totalValor < 0 ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.06)', border: `1px solid ${totalValor < 0 ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)'}` }}>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#475569' }}>Valor total de variación</p>
                <p className="text-3xl font-black mt-1" style={{ color: totalValor < 0 ? '#ef4444' : '#10b981' }}>
                  {fmtCOP(totalValor)}
                </p>
              </div>
              <div className="p-3 rounded-xl" style={{ background: totalValor < 0 ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)' }}>
                {totalValor < 0 ? <TrendingDown size={28} style={{ color: '#ef4444' }} /> : <TrendingUp size={28} style={{ color: '#10b981' }} />}
              </div>
            </div>

            {/* Table */}
            {productos.length === 0 ? (
              <div className="text-center py-24 rounded-2xl" style={{ background: '#0d1525', border: '1px solid #1a2640' }}>
                <BarChart3 size={48} className="mx-auto mb-4" strokeWidth={1} style={{ color: '#1a2640' }} />
                <p className="font-bold" style={{ color: '#334155' }}>Sin conteos en el rango</p>
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1a2640' }}>
                <table className="w-full text-sm min-w-[900px]">
                  <thead>
                    <tr style={{ background: '#0a1020' }}>
                      {['CAT','CÓDIGO','PRODUCTO','UM','STOCK SIST.','DÍAS','TOTAL VAR.','PROM/DÍA','VALOR VAR.',''].map(h => (
                        <th key={h} className="px-3 py-3 text-left text-xs font-black uppercase tracking-widest whitespace-nowrap"
                          style={{ color: '#334155', borderBottom: '1px solid #0f1e2e' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {productos.map((p, i) => {
                      const isOpen = expandido === p.codigo
                      const cat = CAT_STYLE[p.categoria] ?? { color: '#6b7280', label: '?' }
                      const Icon = p.total_dif < -0.001 ? TrendingDown : p.total_dif > 0.001 ? TrendingUp : Minus
                      const color = p.total_dif < -0.001 ? '#ef4444' : p.total_dif > 0.001 ? '#10b981' : '#475569'
                      return (
                        <React.Fragment key={p.codigo}>
                          <tr style={{ background: i % 2 === 0 ? '#0d1525' : '#070b14', borderBottom: '1px solid #0f1e2e' }}
                            className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-3 py-3">
                              <span className="text-xs font-black px-1.5 py-0.5 rounded-md"
                                style={{ background: `${cat.color}15`, color: cat.color }}>{cat.label}</span>
                            </td>
                            <td className="px-3 py-3 font-mono text-xs" style={{ color: '#475569' }}>{p.codigo}</td>
                            <td className="px-3 py-3 max-w-[200px]">
                              <span className="text-xs font-semibold line-clamp-2" style={{ color: '#cbd5e1' }}>{p.nombre}</span>
                            </td>
                            <td className="px-3 py-3 text-xs font-mono" style={{ color: '#334155' }}>{p.unidad_medida}</td>
                            <td className="px-3 py-3 font-black font-mono" style={{ color: '#0ea5e9' }}>{p.stock_sistema}</td>
                            <td className="px-3 py-3 text-xs" style={{ color: '#475569' }}>{p.dias_contados}d</td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1.5">
                                <Icon size={13} style={{ color }} />
                                <span className="font-black text-sm" style={{ color }}>
                                  {p.total_dif > 0 ? '+' : ''}{Math.round(p.total_dif * 100) / 100}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-3 font-mono text-xs font-bold" style={{ color }}>
                              {p.prom_dif > 0 ? '+' : ''}{Math.round(p.prom_dif * 100) / 100}
                            </td>
                            <td className="px-3 py-3 text-xs font-bold" style={{ color }}>{fmtCOP(p.valor_dif)}</td>
                            <td className="px-3 py-3">
                              <button onClick={() => setExpandido(isOpen ? null : p.codigo)}
                                className="p-1.5 rounded-lg transition-all hover:bg-white/5"
                                style={{ color: '#475569' }}>
                                {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                            </td>
                          </tr>
                          {isOpen && (
                            <tr style={{ background: '#04080f', borderBottom: '2px solid #0f1e2e' }}>
                              <td colSpan={10} className="px-6 py-4">
                                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#334155' }}>
                                  Detalle por día
                                </p>
                                <div className="flex gap-2 flex-wrap">
                                  {p.conteos.map(c => {
                                    const d = c.diferencia
                                    const dc = d < -0.001 ? '#ef4444' : d > 0.001 ? '#10b981' : '#475569'
                                    return (
                                      <div key={c.fecha} className="rounded-xl p-3 text-center min-w-[80px]"
                                        style={{ background: d < -0.001 ? 'rgba(239,68,68,0.08)' : d > 0.001 ? 'rgba(16,185,129,0.08)' : '#0d1525', border: `1px solid ${d < -0.001 ? 'rgba(239,68,68,0.2)' : d > 0.001 ? 'rgba(16,185,129,0.2)' : '#1a2640'}` }}>
                                        <p className="text-xs mb-1" style={{ color: '#475569' }}>{c.fecha.slice(5)}</p>
                                        <p className="font-black text-sm font-mono" style={{ color: '#cbd5e1' }}>{c.conteo_fisico}</p>
                                        <p className="text-xs font-bold mt-0.5" style={{ color: dc }}>
                                          {d > 0 ? '+' : ''}{Math.round(d * 100) / 100}
                                        </p>
                                      </div>
                                    )
                                  })}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
