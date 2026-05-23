'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, TrendingUp, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

/* ── Color continuo rojo→verde ─────────────────────────────────────────── */
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
function borderColor(pct: number) {
  return pct >= 80 ? '#166534' : pct >= 60 ? '#3a5a10' : pct >= 40 ? '#6b4a08' : pct >= 20 ? '#7a3008' : '#7f1d1d'
}

/* ── Gauge por proceso ─────────────────────────────────────────────────── */
function GaugeMeter({ pct, proceso, meta, ejecutado }: { pct: number; proceso: string; meta: number; ejecutado: number }) {
  const r = 22, cx = 32, cy = 28
  const arcLen = Math.PI * r
  const dashLen = arcLen * Math.min(pct, 100) / 100
  const color = gaugeColor(pct)
  const border = borderColor(pct)
  const a = Math.PI * (1 - Math.min(pct, 100) / 100)
  const nx = cx + r * Math.cos(a), ny = cy - r * Math.sin(a)
  return (
    <div className="flex flex-col items-center rounded-xl px-1 pt-1 pb-1 hover:brightness-110 transition-all"
      style={{ background: '#1a3a1a', border: `1px solid ${border}` }}>
      <svg viewBox="0 0 64 50" className="w-full">
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`}
          fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="6" strokeLinecap="round" />
        {pct > 0 && (
          <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`}
            fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={`${dashLen} ${arcLen}`} />
        )}
        <circle cx={nx} cy={ny} r="3" fill={color} />
        <text x={cx} y={cy + 1} textAnchor="middle" fill="white" fontSize="11" fontWeight="900" fontFamily="system-ui,sans-serif">{pct}%</text>
        <text x={cx} y={cy + 11} textAnchor="middle" fill="#6b9a60" fontSize="4">{ejecutado.toLocaleString()} / {meta.toLocaleString()}</text>
        <text x={cx} y={cy + 20} textAnchor="middle" fill="#9ca3af" fontSize="4.5" fontWeight="700">{proceso}</text>
      </svg>
    </div>
  )
}

/* ── Tipos ─────────────────────────────────────────────────────────────── */
type Actividad = {
  id: string; sku: string | null; producto: string; proceso: string
  turno: string; cantidad: number; lote: string | null
  personal_planeado: number | null; origen: string | null
}
type Reporte = { hora: string; cantidad: number; tiempo_improductivo: number | null; observacion: string | null }
type SortField = 'proceso' | 'turno' | 'producto' | 'meta' | 'ejecutado' | 'pct'
type SortDir   = 'asc' | 'desc'

/* ── Página ─────────────────────────────────────────────────────────────── */
export default function ActividadesAdicionalesPage() {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const [fecha, setFecha]           = useState(hoy)
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [reportes, setReportes]     = useState<Record<string, Reporte[]>>({})
  const [loading, setLoading]       = useState(true)
  const [filtroProceso, setFiltroProceso] = useState('')
  const [sortField, setSortField]   = useState<SortField>('proceso')
  const [sortDir, setSortDir]       = useState<SortDir>('asc')
  const [expandida, setExpandida]   = useState<string | null>(null)
  const [soloManuales, setSoloManuales] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    const jRes = await fetch('/api/jornadas')
    const jornadas = await jRes.json()
    const jornada = jornadas.find((j: { fecha: string }) => j.fecha === fecha)
    if (!jornada) { setActividades([]); setReportes({}); setLoading(false); return }

    const aRes = await fetch(`/api/jornadas/${jornada.id}/actividades`)
    const all: Actividad[] = await aRes.json()
    const acts = Array.isArray(all) ? all : []
    setActividades(acts)

    const reps: Record<string, Reporte[]> = {}
    await Promise.all(acts.map(async a => {
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
  function fmtMin(min: number) {
    if (!min) return '—'
    const h = Math.floor(min / 60), m = min % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  function toggleSort(f: SortField) {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(f); setSortDir('asc') }
  }
  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown size={10} className="opacity-30" />
    return sortDir === 'asc' ? <ArrowUp size={10} className="text-green-400" /> : <ArrowDown size={10} className="text-green-400" />
  }

  // Filtro manual/todos
  const actsFiltradas = actividades.filter(a => soloManuales ? a.origen === 'manual' : true)

  // Filtro proceso
  const procesos = [...new Set(actsFiltradas.map(a => a.proceso))].sort()
  const actsVista = actsFiltradas.filter(a => !filtroProceso || a.proceso === filtroProceso)

  // Orden
  const actsSorted = actsVista.slice().sort((a, b) => {
    let va: string | number = '', vb: string | number = ''
    if (sortField === 'proceso')    { va = a.proceso;        vb = b.proceso }
    else if (sortField === 'turno') { va = a.turno;          vb = b.turno }
    else if (sortField === 'producto') { va = a.producto;    vb = b.producto }
    else if (sortField === 'meta')  { va = a.cantidad;       vb = b.cantidad }
    else if (sortField === 'ejecutado') { va = ejecutado(a.id); vb = ejecutado(b.id) }
    else if (sortField === 'pct')   {
      va = a.cantidad > 0 ? ejecutado(a.id) / a.cantidad : 0
      vb = b.cantidad > 0 ? ejecutado(b.id) / b.cantidad : 0
    }
    if (va < vb) return sortDir === 'asc' ? -1 : 1
    if (va > vb) return sortDir === 'asc' ?  1 : -1
    return 0
  })

  // Gauges por proceso
  const porProceso = procesos.map(p => {
    const acts = actsFiltradas.filter(a => a.proceso === p)
    const m = acts.reduce((s, a) => s + a.cantidad, 0)
    const e = acts.reduce((s, a) => s + ejecutado(a.id), 0)
    return { proceso: p, meta: m, ejecutado: e, pct: m > 0 ? Math.min(100, Math.round((e / m) * 100)) : 0 }
  })

  const totalMeta = actsFiltradas.reduce((s, a) => s + a.cantidad, 0)
  const totalEjec = actsFiltradas.reduce((s, a) => s + ejecutado(a.id), 0)
  const pctGlobal = totalMeta > 0 ? Math.min(100, Math.round((totalEjec / totalMeta) * 100)) : 0

  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* ── Encabezado ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <TrendingUp size={20} className="text-green-400" />
          <h1 className="text-2xl font-bold text-white">Actividades Adicionales</h1>
        </div>
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
        <button onClick={cargar} className="text-gray-400 hover:text-white px-3 py-2 bg-gray-800 rounded-lg">
          <RefreshCw size={14} />
        </button>
        {/* Toggle manual/todos */}
        <button onClick={() => setSoloManuales(v => !v)}
          className="text-xs px-3 py-2 rounded-lg font-semibold transition-colors"
          style={{ background: soloManuales ? '#2e6e20' : '#374151', border: `1px solid ${soloManuales ? '#5aaa40' : '#4b5563'}`, color: '#fff' }}>
          {soloManuales ? '✓ Solo manuales' : 'Todas las actividades'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 py-16">
          <div className="w-5 h-5 border-2 border-gray-600 border-t-green-500 rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Cargando...</p>
        </div>
      ) : actsFiltradas.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <TrendingUp size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-lg font-medium">Sin actividades para esta fecha</p>
        </div>
      ) : (
        <>
          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Actividades', value: actsFiltradas.length, sub: soloManuales ? 'manuales' : 'en el plan', rgb: '#ffffff' },
              { label: 'Completadas', value: actsFiltradas.filter(a => a.cantidad > 0 && ejecutado(a.id) >= a.cantidad).length, sub: `de ${actsFiltradas.length}`, rgb: '#10b981' },
              { label: 'Meta total',  value: totalMeta.toLocaleString(), sub: 'unidades', rgb: '#ffffff' },
              { label: 'Ejecutado',   value: totalEjec.toLocaleString(), sub: `${pctGlobal}% cumplimiento`, rgb: gaugeColor(pctGlobal) },
            ].map(k => (
              <div key={k.label} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-widest">{k.label}</p>
                <p className="text-2xl font-black mt-0.5" style={{ color: k.rgb }}>{k.value}</p>
                <p className="text-gray-600 text-[10px] mt-0.5">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* ── Gauges por proceso (igual que dashboard) ── */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-white font-semibold">Resumen por proceso</h2>
              <span className="text-gray-500 text-xs">{porProceso.length} procesos</span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-1.5 p-3">
              {porProceso.map(p => (
                <GaugeMeter key={p.proceso} pct={p.pct} proceso={p.proceso} meta={p.meta} ejecutado={p.ejecutado} />
              ))}
            </div>
          </div>

          {/* ── Chips filtro proceso ── */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setFiltroProceso('')}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold"
              style={{ background: !filtroProceso ? '#2e6e20' : '#1e3a14', border: '1px solid #3a6228', color: !filtroProceso ? '#fff' : '#7aaa66' }}>
              Todos ({actsFiltradas.length})
            </button>
            {procesos.map(p => {
              const cnt = actsFiltradas.filter(a => a.proceso === p).length
              return (
                <button key={p} onClick={() => setFiltroProceso(p)}
                  className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                  style={{ background: filtroProceso === p ? '#2e6e20' : '#1e3a14', border: '1px solid #3a6228', color: filtroProceso === p ? '#fff' : '#7aaa66' }}>
                  {p} ({cnt})
                </button>
              )
            })}
          </div>

          {/* ── Tabla detallada ── */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2a4e1c' }}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr style={{ background: '#1e3a14', borderBottom: '1px solid #2a4e1c' }}>
                    {([
                      { f: 'proceso'   as SortField, label: 'PROCESO',      align: 'left'   },
                      { f: 'turno'     as SortField, label: 'TURNO',        align: 'left'   },
                      { f: 'producto'  as SortField, label: 'DESCRIPCIÓN',  align: 'left'   },
                      { f: 'pct'       as SortField, label: 'AVANCE',       align: 'center' },
                      { f: 'meta'      as SortField, label: 'META',         align: 'right'  },
                      { f: 'ejecutado' as SortField, label: 'EJEC.',        align: 'right'  },
                    ] as const).map(col => (
                      <th key={col.f} className={`px-3 py-2.5 text-${col.align}`}>
                        <button onClick={() => toggleSort(col.f)}
                          className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide hover:text-white transition-colors"
                          style={{ color: '#6b9a60', marginLeft: col.align === 'right' ? 'auto' : undefined }}>
                          {col.label} <SortIcon field={col.f} />
                        </button>
                      </th>
                    ))}
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#6b9a60' }}>👷</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#c2783a' }}>⚠</th>
                    <th className="w-6" />
                  </tr>
                </thead>
                <tbody>
                  {actsSorted.map((a, i) => {
                    const ejec = ejecutado(a.id)
                    const pct  = a.cantidad > 0 ? Math.min(100, Math.round((ejec / a.cantidad) * 100)) : 0
                    const reps = reportes[a.id] || []
                    const tiempoImp = reps.reduce((s, r) => s + (r.tiempo_improductivo || 0), 0)
                    const abierta   = expandida === a.id
                    const bgRow     = abierta ? '#162e10' : i % 2 === 0 ? '#0d1a08' : '#0f1c0a'
                    const color     = gaugeColor(pct)

                    return (
                      <>
                        <tr key={a.id}
                          onClick={() => setExpandida(abierta ? null : a.id)}
                          className="cursor-pointer"
                          style={{ background: bgRow, borderBottom: abierta ? 'none' : '1px solid #111e0c' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#1a3414')}
                          onMouseLeave={e => (e.currentTarget.style.background = bgRow)}>

                          {/* Proceso */}
                          <td className="px-3 py-2">
                            <span className="text-white text-[11px] font-bold">{a.proceso}</span>
                            {a.origen === 'manual' && (
                              <span className="ml-1.5 text-[8px] px-1 py-0.5 rounded font-semibold" style={{ background: '#1e4a2e', color: '#4ade80' }}>+</span>
                            )}
                          </td>

                          {/* Turno */}
                          <td className="px-3 py-2">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                              a.turno === 'MAÑANA' ? 'bg-yellow-900/60 text-yellow-300' :
                              a.turno === 'TARDE'  ? 'bg-orange-900/60 text-orange-300' :
                                                     'bg-blue-900/60 text-blue-300'
                            }`}>{a.turno.slice(0, 3)}</span>
                          </td>

                          {/* Descripción */}
                          <td className="px-3 py-2 max-w-[220px]">
                            {a.sku && <span className="font-mono text-[9px] mr-1.5" style={{ color: '#4a6a40' }}>{a.sku}</span>}
                            <span className="text-white text-[11px]">{a.producto}</span>
                            {a.lote && <span className="text-amber-300 text-[9px] font-mono ml-1.5">· {a.lote}</span>}
                          </td>

                          {/* Avance */}
                          <td className="px-3 py-2 min-w-[110px]">
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1 rounded-full h-1.5" style={{ background: '#1e3414' }}>
                                <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                              </div>
                              <span className="text-[11px] font-black w-8 text-right" style={{ color }}>{pct}%</span>
                            </div>
                          </td>

                          {/* Meta */}
                          <td className="px-3 py-2 text-right text-[11px]" style={{ color: '#7aaa66' }}>{a.cantidad.toLocaleString()}</td>

                          {/* Ejecutado */}
                          <td className="px-3 py-2 text-right text-[11px] font-semibold text-blue-400">{ejec.toLocaleString()}</td>

                          {/* Personal */}
                          <td className="px-3 py-2 text-center text-[11px]" style={{ color: '#7aaa66' }}>{a.personal_planeado ?? '—'}</td>

                          {/* Improductivo */}
                          <td className="px-3 py-2 text-center">
                            {tiempoImp > 0
                              ? <span className="text-orange-400 text-[10px] font-semibold">{fmtMin(tiempoImp)}</span>
                              : <span style={{ color: '#1e3414' }}>—</span>}
                          </td>

                          {/* Toggle */}
                          <td className="px-2 py-2 text-center text-[10px]" style={{ color: '#4a7a40' }}>
                            {abierta ? '▲' : '▼'}
                          </td>
                        </tr>

                        {/* Detalle horas */}
                        {abierta && (
                          <tr key={`${a.id}-det`} style={{ background: '#091208', borderBottom: '1px solid #2a4e1c' }}>
                            <td colSpan={9} className="px-4 py-3">
                              {reps.length === 0 ? (
                                <p className="text-gray-600 text-xs">Sin registros de ejecución hora a hora</p>
                              ) : (
                                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-1">
                                  {reps.sort((x, y) => x.hora.localeCompare(y.hora)).map(h => (
                                    <div key={h.hora} className="rounded p-1.5 text-center"
                                      style={{ background: 'rgba(16,80,20,0.45)', border: '1px solid #2a6e20' }}>
                                      <div className="font-mono text-[8px]" style={{ color: '#5a8a50' }}>{h.hora.slice(0, 5)}</div>
                                      <div className="font-bold text-[11px] text-white mt-0.5">{h.cantidad.toLocaleString()}</div>
                                      {h.tiempo_improductivo ? (
                                        <div className="text-[8px] text-orange-400 font-semibold">{h.tiempo_improductivo}m⚠</div>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              )}
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
        </>
      )}
    </div>
  )
}
