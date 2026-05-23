'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, TrendingUp } from 'lucide-react'

/* ── Colores por cumplimiento ─────────────────────────────────────────── */
function gaugeColor(pct: number) {
  const stops = [
    { p: 0,   r: 220, g: 38,  b: 38  },
    { p: 20,  r: 234, g: 88,  b: 12  },
    { p: 40,  r: 245, g: 158, b: 11  },
    { p: 60,  r: 202, g: 193, b: 0   },
    { p: 75,  r: 132, g: 204, b: 22  },
    { p: 80,  r: 34,  g: 197, b: 94  },
    { p: 100, r: 16,  g: 185, b: 129 },
  ]
  const c = Math.min(100, Math.max(0, pct))
  let a = stops[0], b = stops[stops.length - 1]
  for (let i = 0; i < stops.length - 1; i++) {
    if (c >= stops[i].p && c <= stops[i + 1].p) { a = stops[i]; b = stops[i + 1]; break }
  }
  const t = a.p === b.p ? 0 : (c - a.p) / (b.p - a.p)
  return `rgb(${Math.round(a.r+(b.r-a.r)*t)},${Math.round(a.g+(b.g-a.g)*t)},${Math.round(a.b+(b.b-a.b)*t)})`
}

/* ── Gauge ────────────────────────────────────────────────────────────── */
function GaugeMeter({ pct, label, sublabel, ejecutado, meta }: {
  pct: number; label: string; sublabel: string; ejecutado: number; meta: number
}) {
  const r = 28, cx = 40, cy = 38
  const arcLen = Math.PI * r
  const dashLen = arcLen * Math.min(pct, 100) / 100
  const color  = gaugeColor(pct)
  const track  = 'rgba(0,0,0,0.35)'
  const border = pct >= 80 ? '#166534' : pct >= 60 ? '#3a5a10' : pct >= 40 ? '#6b4a08' : pct >= 20 ? '#7a3008' : '#7f1d1d'
  const a = Math.PI * (1 - Math.min(pct, 100) / 100)
  const nx = cx + r * Math.cos(a), ny = cy - r * Math.sin(a)

  return (
    <div className="flex flex-col items-center rounded-xl px-1 pt-1 pb-1.5 hover:brightness-110 transition-all"
      style={{ background: '#1a3a1a', border: `1px solid ${border}` }}>
      <svg viewBox="0 0 80 56" className="w-full">
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`}
          fill="none" stroke={track} strokeWidth="8" strokeLinecap="round" />
        {pct > 0 && (
          <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`}
            fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${dashLen} ${arcLen}`} />
        )}
        <circle cx={nx} cy={ny} r="4" fill={color} />
        <text x={cx} y={cy + 1} textAnchor="middle" fill="white" fontSize="14" fontWeight="900"
          fontFamily="system-ui,sans-serif">{pct}%</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="#6b9a60" fontSize="5">
          {ejecutado.toLocaleString()} / {meta.toLocaleString()}
        </text>
        {/* proceso */}
        <text x={cx} y={cy + 21} textAnchor="middle" fill="#9ca3af" fontSize="5" fontWeight="700">{sublabel}</text>
      </svg>
      {/* nombre actividad */}
      <p className="text-white text-[9px] font-semibold text-center leading-tight px-1 mt-0.5">{label}</p>
    </div>
  )
}

/* ── Tipos ──────────────────────────────────────────────────────────────── */
type Actividad = {
  id: string; sku: string | null; producto: string; proceso: string
  turno: string; cantidad: number; lote: string | null
  personal_planeado: number | null; origen: string | null
}
type Reporte = { hora: string; cantidad: number }

/* ── Página ─────────────────────────────────────────────────────────────── */
export default function ActividadesAdicionalesPage() {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const [fecha, setFecha] = useState(hoy)
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [reportes, setReportes] = useState<Record<string, Reporte[]>>({})
  const [loading, setLoading] = useState(true)
  const [filtroProceso, setFiltroProceso] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    const jRes = await fetch('/api/jornadas')
    const jornadas = await jRes.json()
    const jornada = jornadas.find((j: { fecha: string }) => j.fecha === fecha)
    if (!jornada) { setActividades([]); setReportes({}); setLoading(false); return }

    const aRes = await fetch(`/api/jornadas/${jornada.id}/actividades`)
    const all: Actividad[] = await aRes.json()
    // Solo actividades ingresadas manualmente
    const manuales = Array.isArray(all) ? all.filter(a => a.origen === 'manual') : []
    setActividades(manuales)

    const reps: Record<string, Reporte[]> = {}
    await Promise.all(manuales.map(async a => {
      const r = await fetch(`/api/reportes?actividad_id=${a.id}`)
      reps[a.id] = await r.json()
    }))
    setReportes(reps)
    setLoading(false)
  }, [fecha])

  useEffect(() => { cargar() }, [cargar])

  function ejecutado(id: string) {
    return (reportes[id] || []).reduce((s, r) => s + r.cantidad, 0)
  }

  const procesos = [...new Set(actividades.map(a => a.proceso))].sort()
  const filtradas = filtroProceso ? actividades.filter(a => a.proceso === filtroProceso) : actividades

  const totalMeta = actividades.reduce((s, a) => s + a.cantidad, 0)
  const totalEjec = actividades.reduce((s, a) => s + ejecutado(a.id), 0)
  const pctGlobal = totalMeta > 0 ? Math.min(100, Math.round((totalEjec / totalMeta) * 100)) : 0
  const completas = actividades.filter(a => a.cantidad > 0 && ejecutado(a.id) >= a.cantidad).length

  return (
    <div className="max-w-6xl mx-auto">

      {/* Encabezado */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          <TrendingUp size={20} className="text-green-400" />
          <h1 className="text-2xl font-bold text-white">Actividades Adicionales</h1>
        </div>
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
        <button onClick={cargar} className="text-gray-400 hover:text-white px-3 py-2 bg-gray-800 rounded-lg">
          <RefreshCw size={14} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 py-16">
          <div className="w-5 h-5 border-2 border-gray-600 border-t-green-500 rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Cargando...</p>
        </div>
      ) : actividades.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <TrendingUp size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-lg font-medium">Sin actividades adicionales</p>
          <p className="text-sm mt-1">Las actividades agregadas individualmente desde Planeación aparecerán aquí</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Actividades adicionales', value: actividades.length, sub: 'ingresadas manualmente', rgb: '#ffffff' },
              { label: 'Completadas',  value: completas, sub: `de ${actividades.length}`, rgb: '#10b981' },
              { label: 'Meta total',   value: totalMeta.toLocaleString(), sub: 'unidades', rgb: '#ffffff' },
              { label: 'Ejecutado',    value: totalEjec.toLocaleString(), sub: `${pctGlobal}% cumplimiento`, rgb: gaugeColor(pctGlobal) },
            ].map(k => (
              <div key={k.label} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-widest">{k.label}</p>
                <p className="text-2xl font-black mt-0.5" style={{ color: k.rgb }}>{k.value}</p>
                <p className="text-gray-600 text-[10px] mt-0.5">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Filtros proceso */}
          {procesos.length > 1 && (
            <div className="flex gap-2 flex-wrap mb-4">
              <button onClick={() => setFiltroProceso('')}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                style={{ background: !filtroProceso ? '#2e6e20' : '#1e3a14', border: '1px solid #3a6228', color: !filtroProceso ? '#fff' : '#7aaa66' }}>
                Todos ({actividades.length})
              </button>
              {procesos.map(p => (
                <button key={p} onClick={() => setFiltroProceso(p)}
                  className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                  style={{ background: filtroProceso === p ? '#2e6e20' : '#1e3a14', border: '1px solid #3a6228', color: filtroProceso === p ? '#fff' : '#7aaa66' }}>
                  {p} ({actividades.filter(a => a.proceso === p).length})
                </button>
              ))}
            </div>
          )}

          {/* Grid gauges — igual que resumen por proceso del dashboard */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-white font-semibold">Resumen por actividad adicional</h2>
              <span className="text-gray-500 text-xs">{filtradas.length} actividades</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 p-3">
              {filtradas.map(a => {
                const ejec = ejecutado(a.id)
                const pct  = a.cantidad > 0 ? Math.min(100, Math.round((ejec / a.cantidad) * 100)) : 0
                const prod = a.producto.length > 18 ? a.producto.slice(0, 16) + '…' : a.producto
                return (
                  <GaugeMeter
                    key={a.id}
                    pct={pct}
                    label={prod}
                    sublabel={a.proceso}
                    ejecutado={ejec}
                    meta={a.cantidad}
                  />
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
