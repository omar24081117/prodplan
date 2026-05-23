'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, TrendingUp } from 'lucide-react'

/* ── Colores por cumplimiento (misma escala que dashboard) ─────────────── */
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
  return `rgb(${Math.round(a.r + (b.r - a.r) * t)},${Math.round(a.g + (b.g - a.g) * t)},${Math.round(a.b + (b.b - a.b) * t)})`
}
function borderColor(pct: number) {
  return pct >= 80 ? '#166534' : pct >= 60 ? '#3a5a10' : pct >= 40 ? '#6b4a08' : pct >= 20 ? '#7a3008' : '#7f1d1d'
}

/* ── Gauge por actividad ────────────────────────────────────────────────── */
function ActividadGauge({ producto, proceso, turno, meta, ejecutado, lote, sku }:
  { producto: string; proceso: string; turno: string; meta: number; ejecutado: number; lote: string | null; sku: string | null }) {
  const pct = meta > 0 ? Math.min(100, Math.round((ejecutado / meta) * 100)) : 0
  const r = 34, cx = 48, cy = 42
  const arcLen = Math.PI * r
  const dashLen = arcLen * pct / 100
  const color = gaugeColor(pct)
  const border = borderColor(pct)
  const a = Math.PI * (1 - pct / 100)
  const nx = cx + r * Math.cos(a), ny = cy - r * Math.sin(a)

  const turnoBg = turno === 'MAÑANA' ? '#78350f' : turno === 'TARDE' ? '#7c2d12' : '#1e3a5f'
  const turnoColor = turno === 'MAÑANA' ? '#fde68a' : turno === 'TARDE' ? '#fed7aa' : '#bfdbfe'
  const prod = producto.length > 22 ? producto.slice(0, 20) + '…' : producto

  return (
    <div className="flex flex-col rounded-xl overflow-hidden transition-all hover:brightness-110"
      style={{ background: '#1a3a1a', border: `1px solid ${border}` }}>

      {/* Cabecera proceso + turno */}
      <div className="flex items-center justify-between px-2.5 pt-2 pb-1">
        <span className="text-[10px] font-bold text-white tracking-wide">{proceso}</span>
        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
          style={{ background: turnoBg, color: turnoColor }}>{turno.slice(0, 3)}</span>
      </div>

      {/* Gauge SVG */}
      <svg viewBox="0 0 96 58" className="w-full px-1">
        {/* track */}
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`}
          fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="9" strokeLinecap="round" />
        {/* progress */}
        {pct > 0 && (
          <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`}
            fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
            strokeDasharray={`${dashLen} ${arcLen}`} />
        )}
        {/* needle */}
        <circle cx={nx} cy={ny} r="4" fill={color} />
        {/* % */}
        <text x={cx} y={cy + 2} textAnchor="middle" fill="white" fontSize="16" fontWeight="900"
          fontFamily="system-ui,sans-serif">{pct}%</text>
        {/* ejecutado / meta */}
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#6b9a60" fontSize="5.5">
          {ejecutado.toLocaleString()} / {meta.toLocaleString()}
        </text>
      </svg>

      {/* Descripción */}
      <div className="px-2.5 pb-2">
        <p className="text-white text-[10px] font-semibold leading-tight">{prod}</p>
        {sku && <p className="text-gray-500 text-[9px] font-mono">{sku}</p>}
        {lote && <p className="text-amber-400 text-[9px] font-mono">Lote: {lote}</p>}
      </div>
    </div>
  )
}

/* ── Tipos ───────────────────────────────────────────────────────────────── */
type Actividad = {
  id: string; sku: string | null; producto: string; proceso: string
  turno: string; cantidad: number; lote: string | null; personal_planeado: number | null
}
type Reporte = { hora: string; cantidad: number }

/* ── Página principal ───────────────────────────────────────────────────── */
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
    const acts: Actividad[] = await aRes.json()
    setActividades(Array.isArray(acts) ? acts : [])

    const reps: Record<string, Reporte[]> = {}
    await Promise.all((Array.isArray(acts) ? acts : []).map(async a => {
      const r = await fetch(`/api/reportes?actividad_id=${a.id}`)
      reps[a.id] = await r.json()
    }))
    setReportes(reps)
    setLoading(false)
  }, [fecha])

  useEffect(() => { cargar() }, [cargar])

  function ejecutadoAct(id: string) {
    return (reportes[id] || []).reduce((s, r) => s + r.cantidad, 0)
  }

  const procesos = [...new Set(actividades.map(a => a.proceso))].sort()
  const filtradas = filtroProceso ? actividades.filter(a => a.proceso === filtroProceso) : actividades

  /* KPIs globales */
  const totalMeta = actividades.reduce((s, a) => s + a.cantidad, 0)
  const totalEjec = actividades.reduce((s, a) => s + ejecutadoAct(a.id), 0)
  const pctGlobal = totalMeta > 0 ? Math.min(100, Math.round((totalEjec / totalMeta) * 100)) : 0
  const completas = actividades.filter(a => {
    const e = ejecutadoAct(a.id); return a.cantidad > 0 && e >= a.cantidad
  }).length

  return (
    <div className="max-w-6xl mx-auto">

      {/* ── Encabezado ── */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          <TrendingUp size={22} className="text-green-400" />
          <h1 className="text-2xl font-bold text-white">Actividades del Plan</h1>
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
        <div className="text-center py-16 text-gray-500">
          <p>No hay actividades para el {fecha}</p>
        </div>
      ) : (
        <>
          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Actividades', value: actividades.length, sub: 'en el plan', color: 'text-white' },
              { label: 'Completadas', value: completas, sub: `de ${actividades.length}`, color: 'text-emerald-400' },
              { label: 'Meta total', value: totalMeta.toLocaleString(), sub: 'unidades', color: 'text-white' },
              { label: 'Ejecutado', value: totalEjec.toLocaleString(), sub: `${pctGlobal}% cumplimiento`, color: gaugeColor(pctGlobal) },
            ].map(k => (
              <div key={k.label} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-widest">{k.label}</p>
                <p className="text-2xl font-black mt-0.5" style={{ color: k.color }}>{k.value}</p>
                <p className="text-gray-600 text-[10px] mt-0.5">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* ── Filtros proceso ── */}
          <div className="flex gap-2 flex-wrap mb-4">
            <button onClick={() => setFiltroProceso('')}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
              style={{ background: !filtroProceso ? '#2e6e20' : '#1e3a14', border: '1px solid #3a6228', color: !filtroProceso ? '#fff' : '#7aaa66' }}>
              Todos ({actividades.length})
            </button>
            {procesos.map(p => {
              const cnt = actividades.filter(a => a.proceso === p).length
              const ejPct = (() => {
                const acts = actividades.filter(a => a.proceso === p)
                const m = acts.reduce((s, a) => s + a.cantidad, 0)
                const e = acts.reduce((s, a) => s + ejecutadoAct(a.id), 0)
                return m > 0 ? Math.round((e / m) * 100) : 0
              })()
              return (
                <button key={p} onClick={() => setFiltroProceso(p)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
                  style={{ background: filtroProceso === p ? '#2e6e20' : '#1e3a14', border: '1px solid #3a6228', color: filtroProceso === p ? '#fff' : '#7aaa66' }}>
                  {p} ({cnt})
                  <span className="font-mono text-[10px]" style={{ color: gaugeColor(ejPct) }}>{ejPct}%</span>
                </button>
              )
            })}
          </div>

          {/* ── Grid de gauges ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {filtradas.map(a => (
              <ActividadGauge
                key={a.id}
                producto={a.producto}
                proceso={a.proceso}
                turno={a.turno}
                meta={a.cantidad}
                ejecutado={ejecutadoAct(a.id)}
                lote={a.lote}
                sku={a.sku}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
