'use client'

import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

type KPIs = { meta: number; ejecutado: number; cumplimiento: number; personal_planeado: number; tiempo_improductivo: number }
type FilaProceso = { proceso: string; meta: number; ejecutado: number; cumplimiento: number }
type FilaDia = { fecha: string; meta: number; ejecutado: number; cumplimiento: number }
type HoraDetalle = { hora: string; cantidad: number | null; cumplimiento_hora: number | null; tiempo_improductivo: number | null; observacion: string | null }
type FilaActividad = {
  id: string; fecha: string; sku: string | null; producto: string; proceso: string
  turno: string; lote: string | null; meta: number; ejecutado: number
  personal_planeado: number | null; estandar_hora: number; cumplimiento: number
  tiempo_improductivo: number; horas: HoraDetalle[]
}
type DashboardData = {
  kpis: KPIs; por_proceso: FilaProceso[]; por_dia: FilaDia[]; por_actividad: FilaActividad[]
}

function gaugeColor(pct: number) {
  // Escala de color continua: rojo → naranja → amarillo → lima → verde
  const stops = [
    { p: 0,   r: 220, g: 38,  b: 38  }, // rojo
    { p: 20,  r: 234, g: 88,  b: 12  }, // naranja oscuro
    { p: 40,  r: 245, g: 158, b: 11  }, // ámbar
    { p: 60,  r: 202, g: 193, b: 0   }, // amarillo-lima
    { p: 75,  r: 132, g: 204, b: 22  }, // lima
    { p: 80,  r: 34,  g: 197, b: 94  }, // verde medio
    { p: 100, r: 16,  g: 185, b: 129 }, // esmeralda
  ]
  const clamped = Math.min(100, Math.max(0, pct))
  let a = stops[0], b = stops[stops.length - 1]
  for (let i = 0; i < stops.length - 1; i++) {
    if (clamped >= stops[i].p && clamped <= stops[i + 1].p) { a = stops[i]; b = stops[i + 1]; break }
  }
  const t = a.p === b.p ? 0 : (clamped - a.p) / (b.p - a.p)
  const ri = Math.round(a.r + (b.r - a.r) * t)
  const gi = Math.round(a.g + (b.g - a.g) * t)
  const bi = Math.round(a.b + (b.b - a.b) * t)
  return `rgb(${ri},${gi},${bi})`
}

function GaugeMeter({ pct, proceso, meta, ejecutado }: { pct: number; proceso: string; meta: number; ejecutado: number }) {
  const r = 22, cx = 32, cy = 28
  const arcLen = Math.PI * r
  const dashLen = arcLen * Math.min(pct, 100) / 100
  const color  = gaugeColor(pct)
  const track  = 'rgba(0,0,0,0.35)'
  const border = pct >= 80 ? '#166534' : pct >= 60 ? '#3a5a10' : pct >= 40 ? '#6b4a08' : pct >= 20 ? '#7a3008' : '#7f1d1d'
  const a = Math.PI * (1 - Math.min(pct, 100) / 100)
  const nx = cx + r * Math.cos(a), ny = cy - r * Math.sin(a)
  return (
    <div className="flex flex-col items-center rounded-lg px-1 pt-1 pb-1 hover:brightness-110 transition-all"
      style={{ background: '#2d5a2d', border: `1px solid ${border}` }}>
      <svg viewBox="0 0 64 50" className="w-full">
        {/* track */}
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`}
          fill="none" stroke={track} strokeWidth="6" strokeLinecap="round" />
        {/* progress */}
        {pct > 0 && (
          <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`}
            fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={`${dashLen} ${arcLen}`} />
        )}
        {/* needle */}
        <circle cx={nx} cy={ny} r="3" fill={color} />
        {/* % */}
        <text x={cx} y={cy + 1} textAnchor="middle" fill="white" fontSize="11" fontWeight="900" fontFamily="system-ui,sans-serif">{pct}%</text>
        {/* unidades */}
        <text x={cx} y={cy + 11} textAnchor="middle" fill="#6b9a60" fontSize="4">{ejecutado.toLocaleString()} / {meta.toLocaleString()}</text>
        {/* proceso */}
        <text x={cx} y={cy + 20} textAnchor="middle" fill="#9ca3af" fontSize="4.5" fontWeight="700">{proceso}</text>
      </svg>
    </div>
  )
}

function colorPct(pct: number) {
  return pct >= 80 ? 'text-emerald-400' : pct >= 60 ? 'text-lime-400' : pct >= 40 ? 'text-yellow-400' : pct >= 20 ? 'text-orange-400' : 'text-red-500'
}
function bgPct(pct: number) {
  return pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-lime-500' : pct >= 40 ? 'bg-yellow-500' : pct >= 20 ? 'bg-orange-500' : 'bg-red-600'
}
function borderPct(pct: number) {
  return pct >= 80 ? 'border-emerald-800/60' : pct >= 60 ? 'border-lime-800/60' : pct >= 40 ? 'border-yellow-800/60' : 'border-red-700'
}
function bgCardPct(pct: number) {
  return pct >= 80 ? 'bg-emerald-950/40' : pct >= 60 ? 'bg-lime-950/40' : pct >= 40 ? 'bg-yellow-950/40' : 'bg-red-950/60'
}
function labelPct(pct: number) {
  return pct >= 80 ? 'En meta' : pct >= 60 ? 'Cerca de meta' : pct >= 40 ? 'Por mejorar' : pct >= 20 ? 'Bajo meta' : 'Crítico'
}
function dotPct(pct: number) {
  return pct >= 80 ? '🟢' : pct >= 60 ? '🟡' : pct >= 40 ? '🟠' : '🔴'
}
function fmtMin(min: number) {
  if (min === 0) return '0 min'
  const h = Math.floor(min / 60), m = min % 60
  return h > 0 ? `${h}h ${m}m` : `${m} min`
}

export default function DashboardPage() {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const [modo, setModo] = useState<'dia' | 'rango'>('dia')
  const [fecha, setFecha] = useState(hoy)
  const [desde, setDesde] = useState(hoy)
  const [hasta, setHasta] = useState(hoy)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandida, setExpandida] = useState<string | null>(null)
  const [filtroProceso, setFiltroProceso] = useState('')
  type SortField = 'proceso' | 'turno' | 'producto' | 'cumplimiento' | 'meta' | 'ejecutado'
  type SortDir = 'asc' | 'desc'
  const [sortField, setSortField] = useState<SortField>('proceso')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }
  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown size={11} className="opacity-30" />
    return sortDir === 'asc' ? <ArrowUp size={11} className="text-green-400" /> : <ArrowDown size={11} className="text-green-400" />
  }

  const cargar = useCallback(async () => {
    setLoading(true)
    const params = modo === 'dia' ? `desde=${fecha}&hasta=${fecha}` : `desde=${desde}&hasta=${hasta}`
    const res = await fetch(`/api/dashboard?${params}`)
    const json = await res.json()
    setData(json)
    setLoading(false)
  }, [modo, fecha, desde, hasta])

  useEffect(() => { cargar() }, [cargar])

  const kpis = data?.kpis
  const pct = kpis?.cumplimiento ?? 0

  return (
    <div className="max-w-6xl mx-auto">

      {/* Controles */}
      <div className="flex items-center gap-3 mb-7 flex-wrap">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          <button onClick={() => setModo('dia')} className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${modo === 'dia' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>Por día</button>
          <button onClick={() => setModo('rango')} className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${modo === 'rango' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>Rango</button>
        </div>
        {modo === 'dia' ? (
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
        ) : (
          <div className="flex items-center gap-2">
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
            <span className="text-gray-500">—</span>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
          </div>
        )}
        <button onClick={cargar} className="text-gray-400 hover:text-white text-sm px-3 py-2 bg-gray-800 rounded-lg">↻</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-gray-400 text-sm">Cargando datos...</p>
          </div>
        </div>
      ) : !data ? (
        <p className="text-gray-400">No hay datos para el período seleccionado</p>
      ) : (
        <>
          {/* ── KPI INDICATORS ── */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-7">

            {/* Meta */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-[10px] font-semibold uppercase tracking-widest">Meta</span>
                <span className="text-2xl">📦</span>
              </div>
              <div>
                <p className="text-3xl font-black text-white leading-none">{kpis?.meta.toLocaleString()}</p>
                <p className="text-gray-500 text-xs mt-1">unidades planeadas</p>
              </div>
              <div className="h-0.5 w-full bg-gray-800 rounded-full" />
            </div>

            {/* Ejecutado */}
            <div className="bg-gray-900 border border-blue-900/50 rounded-2xl p-5 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-[10px] font-semibold uppercase tracking-widest">Ejecutado</span>
                <span className="text-2xl">✅</span>
              </div>
              <div>
                <p className="text-3xl font-black text-blue-400 leading-none">{kpis?.ejecutado.toLocaleString()}</p>
                <p className="text-gray-500 text-xs mt-1">unidades producidas</p>
              </div>
              <div className="h-1 w-full bg-gray-800 rounded-full">
                <div className="h-1 rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
            </div>

            {/* Cumplimiento — tarjeta protagonista */}
            <div className={`rounded-2xl p-5 flex flex-col justify-between gap-3 border ${bgCardPct(pct)} ${borderPct(pct)}`}>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-[10px] font-semibold uppercase tracking-widest">Cumplimiento</span>
                <span className="text-base">{dotPct(pct)}</span>
              </div>
              <div>
                <p className={`text-5xl font-black leading-none ${colorPct(pct)}`}>{pct}%</p>
                <p className={`text-xs mt-1.5 font-semibold ${colorPct(pct)}`}>{labelPct(pct)}</p>
              </div>
              <div className="h-1.5 w-full bg-black/30 rounded-full">
                <div className={`h-1.5 rounded-full transition-all ${bgPct(pct)}`} style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
            </div>

            {/* Personal */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-[10px] font-semibold uppercase tracking-widest">Personal</span>
                <span className="text-2xl">👷</span>
              </div>
              <div>
                <p className="text-3xl font-black text-white leading-none">{kpis?.personal_planeado.toLocaleString()}</p>
                <p className="text-gray-500 text-xs mt-1">operarios planeados</p>
              </div>
              <div className="h-0.5 w-full bg-gray-800 rounded-full" />
            </div>

            {/* Tiempo improductivo */}
            <div className={`rounded-2xl p-5 flex flex-col justify-between gap-3 border ${(kpis?.tiempo_improductivo ?? 0) > 0 ? 'bg-orange-950/30 border-orange-900/50' : 'bg-gray-900 border-gray-800'}`}>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-[10px] font-semibold uppercase tracking-widest">Improductivo</span>
                <span className="text-2xl">⚠️</span>
              </div>
              <div>
                <p className={`text-3xl font-black leading-none ${(kpis?.tiempo_improductivo ?? 0) > 0 ? 'text-orange-400' : 'text-gray-600'}`}>
                  {fmtMin(kpis?.tiempo_improductivo ?? 0)}
                </p>
                <p className="text-gray-500 text-xs mt-1">tiempo perdido</p>
              </div>
              <div className="h-0.5 w-full bg-gray-800 rounded-full" />
            </div>
          </div>

          {/* ── SEGUNDA FILA: Procesos + Gráfica ── */}
          <div className={`grid gap-4 mb-7 ${data.por_dia.length > 1 ? 'grid-cols-1 lg:grid-cols-[1fr_auto]' : 'grid-cols-1'}`}>

            {/* Por proceso — medidores */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
                <h2 className="text-white font-semibold">Resumen por proceso</h2>
                <span className="text-gray-500 text-xs">{data.por_proceso.length} procesos</span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 gap-1.5 p-2">
                {data.por_proceso.map(row => (
                  <GaugeMeter key={row.proceso} pct={row.cumplimiento} proceso={row.proceso} meta={row.meta} ejecutado={row.ejecutado} />
                ))}
              </div>
            </div>

            {/* Gráfica por día — solo si hay rango */}
            {data.por_dia.length > 1 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h2 className="text-white font-semibold mb-4">Cumplimiento diario (%)</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.por_dia} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis dataKey="fecha" tick={{ fill: '#6b7280', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: '#fff' }}
                      formatter={(v) => [`${v}%`, 'Cumplimiento']}
                    />
                    <Bar dataKey="cumplimiento" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      {data.por_dia.map((entry, i) => (
                        <Cell key={i} fill={entry.cumplimiento >= 90 ? '#10b981' : entry.cumplimiento >= 70 ? '#f59e0b' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ── TABLA DE ACTIVIDADES ── */}
          {data.por_actividad.length > 0 && (() => {
            const procesos = [...new Set(data.por_actividad.map(a => a.proceso))].sort()
            const filtradas = data.por_actividad
              .filter(a => !filtroProceso || a.proceso === filtroProceso)
              .slice()
              .sort((a, b) => {
                let va: string | number = '', vb: string | number = ''
                if (sortField === 'proceso')          { va = a.proceso;       vb = b.proceso }
                else if (sortField === 'turno')       { va = a.turno;         vb = b.turno }
                else if (sortField === 'producto')    { va = a.producto;      vb = b.producto }
                else if (sortField === 'meta')        { va = a.meta;          vb = b.meta }
                else if (sortField === 'ejecutado')   { va = a.ejecutado;     vb = b.ejecutado }
                else if (sortField === 'cumplimiento'){ va = a.cumplimiento;  vb = b.cumplimiento }
                if (va < vb) return sortDir === 'asc' ? -1 : 1
                if (va > vb) return sortDir === 'asc' ? 1 : -1
                return 0
              })

            return (
              <div>
                {/* ── Chips de filtro (igual que Soy Empleado) ── */}
                <div className="flex gap-2 flex-wrap mb-3">
                  <button
                    onClick={() => setFiltroProceso('')}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
                    style={{ background: !filtroProceso ? '#2e6e20' : '#1e3a14', border: '1px solid #3a6228', color: !filtroProceso ? '#fff' : '#6b9a60' }}>
                    Todos ({data.por_actividad.length})
                  </button>
                  {procesos.map(p => {
                    const cnt = data.por_actividad.filter(a => a.proceso === p).length
                    return (
                      <button key={p}
                        onClick={() => setFiltroProceso(p)}
                        className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
                        style={{ background: filtroProceso === p ? '#2e6e20' : '#1e3a14', border: '1px solid #3a6228', color: filtroProceso === p ? '#fff' : '#6b9a60' }}>
                        {p} ({cnt})
                      </button>
                    )
                  })}
                </div>

                {/* ── Tabla compacta ── */}
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2a4e1c' }}>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px]">
                      <thead>
                        <tr style={{ background: '#1e3a14', borderBottom: '1px solid #2a4e1c' }}>
                          {modo === 'rango' && (
                            <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#6b9a60' }}>Fecha</th>
                          )}
                          {([
                            { field: 'proceso' as SortField,       label: 'Proceso',    align: 'left'  },
                            { field: 'turno' as SortField,         label: 'Turno',      align: 'left'  },
                            { field: 'producto' as SortField,      label: 'Descripción',align: 'left'  },
                            { field: 'cumplimiento' as SortField,  label: 'Avance',     align: 'left'  },
                            { field: 'meta' as SortField,          label: 'Meta',       align: 'right' },
                            { field: 'ejecutado' as SortField,     label: 'Ejec.',      align: 'right' },
                          ] as const).map(col => (
                            <th key={col.field} className={`px-3 py-2 text-${col.align}`}>
                              <button onClick={() => toggleSort(col.field)}
                                className={`flex items-center gap-1 font-semibold text-[10px] uppercase tracking-wide hover:text-white transition-colors ${col.align === 'right' ? 'ml-auto' : ''}`}
                                style={{ color: '#6b9a60' }}>
                                {col.label} <SortIcon field={col.field} />
                              </button>
                            </th>
                          ))}
                          <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#6b9a60' }}>👷</th>
                          <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#c2783a' }}>⚠</th>
                          <th className="w-6 px-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {filtradas.map((a, i) => {
                          const abierta = expandida === a.id
                          const bgRow = abierta ? '#162e10' : i % 2 === 0 ? '#0d1a08' : '#0f1c0a'
                          return (
                            <>
                              <tr
                                key={a.id}
                                onClick={() => setExpandida(abierta ? null : a.id)}
                                className="cursor-pointer"
                                style={{ background: bgRow, borderBottom: abierta ? 'none' : '1px solid #111e0c' }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#1a3414')}
                                onMouseLeave={e => (e.currentTarget.style.background = bgRow)}
                              >
                                {modo === 'rango' && (
                                  <td className="px-3 py-1 text-[10px] whitespace-nowrap" style={{ color: '#5a8a50' }}>{a.fecha}</td>
                                )}
                                {/* Proceso */}
                                <td className="px-3 py-1">
                                  <span className="text-white text-[11px] font-semibold">{a.proceso}</span>
                                </td>
                                {/* Turno */}
                                <td className="px-3 py-1">
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                    a.turno === 'MAÑANA' ? 'bg-yellow-900/50 text-yellow-300' :
                                    a.turno === 'TARDE'  ? 'bg-orange-900/50 text-orange-300' :
                                                           'bg-blue-900/50 text-blue-300'
                                  }`}>{a.turno.slice(0, 3)}</span>
                                </td>
                                {/* Producto + Lote inline */}
                                <td className="px-3 py-1 max-w-[200px]">
                                  <div className="flex items-center gap-1 flex-wrap leading-none">
                                    {a.sku && <span className="font-mono text-[9px]" style={{ color: '#4a6a40' }}>{a.sku}</span>}
                                    <span className="text-white text-[11px]">{a.producto}</span>
                                    {a.lote && <span className="text-amber-300 text-[9px] font-mono ml-1">· {a.lote}</span>}
                                  </div>
                                </td>
                                {/* Avance — barra + % */}
                                <td className="px-3 py-1 min-w-[100px]">
                                  <div className="flex items-center gap-1.5">
                                    <div className="flex-1 rounded-full h-1" style={{ background: '#1e3414' }}>
                                      <div className={`h-1 rounded-full ${bgPct(a.cumplimiento)}`}
                                        style={{ width: `${Math.min(100, a.cumplimiento)}%` }} />
                                    </div>
                                    <span className={`text-[11px] font-black w-7 text-right ${colorPct(a.cumplimiento)}`}>{a.cumplimiento}%</span>
                                  </div>
                                </td>
                                {/* Meta */}
                                <td className="px-3 py-1 text-right text-[11px]" style={{ color: '#7aaa66' }}>{a.meta.toLocaleString()}</td>
                                {/* Ejecutado */}
                                <td className="px-3 py-1 text-right text-[11px] font-semibold text-blue-400">{a.ejecutado.toLocaleString()}</td>
                                {/* Personal */}
                                <td className="px-3 py-1 text-center text-[11px]" style={{ color: '#7aaa66' }}>{a.personal_planeado ?? '—'}</td>
                                {/* Improductivo */}
                                <td className="px-3 py-1 text-center">
                                  {a.tiempo_improductivo > 0
                                    ? <span className="text-orange-400 text-[10px] font-semibold">{fmtMin(a.tiempo_improductivo)}</span>
                                    : <span style={{ color: '#1e3414' }}>—</span>}
                                </td>
                                {/* Toggle */}
                                <td className="px-2 py-1 text-center text-[10px]" style={{ color: '#4a7a40' }}>
                                  {abierta ? '▲' : '▼'}
                                </td>
                              </tr>

                              {/* Detalle hora a hora — cards compactas */}
                              {abierta && (
                                <tr key={`${a.id}-det`} style={{ background: '#091208', borderBottom: '1px solid #2a4e1c' }}>
                                  <td colSpan={modo === 'rango' ? 10 : 9} className="px-3 py-2">
                                    <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-1">
                                      {a.horas.map(h => (
                                        <div key={h.hora}
                                          className="rounded p-1.5 text-center"
                                          style={{
                                            background: h.cantidad != null ? 'rgba(16,80,20,0.45)' : '#0f1c0a',
                                            border: h.cantidad != null ? '1px solid #2a6e20' : '1px solid #162e10',
                                          }}>
                                          <div className="font-mono text-[8px] leading-none" style={{ color: '#5a8a50' }}>{h.hora.slice(0, 5)}</div>
                                          <div className="font-bold text-[11px] text-white leading-tight mt-0.5">
                                            {h.cantidad != null ? h.cantidad.toLocaleString() : <span style={{ color: '#2a4a22' }}>—</span>}
                                          </div>
                                          {h.cumplimiento_hora != null && (
                                            <div className={`text-[8px] font-bold leading-none ${colorPct(h.cumplimiento_hora)}`}>{h.cumplimiento_hora}%</div>
                                          )}
                                          {h.tiempo_improductivo ? (
                                            <div className="text-[8px] text-orange-400 font-semibold leading-none" title={h.observacion || ''}>
                                              {h.tiempo_improductivo}m⚠
                                            </div>
                                          ) : null}
                                        </div>
                                      ))}
                                    </div>
                                    {/* Totales rápidos */}
                                    <div className="flex items-center gap-4 mt-1.5 pt-1.5" style={{ borderTop: '1px solid #1e3414' }}>
                                      <span className="text-[10px]" style={{ color: '#5a8a50' }}>
                                        Ejec: <span className="text-blue-400 font-bold">{a.ejecutado.toLocaleString()}</span>
                                      </span>
                                      <span className="text-[10px]" style={{ color: '#5a8a50' }}>
                                        Meta: <span className="text-white font-semibold">{a.meta.toLocaleString()}</span>
                                      </span>
                                      <span className="text-[10px]" style={{ color: '#5a8a50' }}>
                                        Estándar/h: <span className="text-white font-semibold">{a.estandar_hora.toLocaleString()}</span>
                                      </span>
                                      {a.tiempo_improductivo > 0 && (
                                        <span className="text-[10px]">
                                          ⚠ <span className="text-orange-400 font-bold">{fmtMin(a.tiempo_improductivo)}</span>
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}
