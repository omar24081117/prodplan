'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FileBarChart2, ChevronDown, ChevronRight, Download } from 'lucide-react'

type DetalleRow = {
  fecha: string
  hrsExtra: number
  hrsNoc: number
  recargo: number
  recargoDiurno: number
  estado: string
  aprobadoPor?: string
}
type PersonaRow = {
  cedula: string
  nombre: string
  contrato: string
  rol: string
  hrsExtra: number
  hrsNoc: number
  recargo: number
  recargoDiurno: number
  aprobadas: number
  pendientes: number
  rechazadas: number
  detalle: DetalleRow[]
}
type Totales = {
  hrsExtra: number; hrsNoc: number; recargo: number; recargoDiurno: number
  aprobadas: number; pendientes: number; rechazadas: number
}

const fmt = (n: number) => n.toFixed(2)
const estadoStyle = (e: string) =>
  e === 'Aprobado'  ? { bg: '#052e16', color: '#4ade80' } :
  e === 'Rechazado' ? { bg: '#1a0505', color: '#f87171' } :
                      { bg: '#1c1400', color: '#fbbf24' }

export default function InformeRangoPage() {
  const router = useRouter()
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const inicioMes = hoy.slice(0, 8) + '01'

  const [desde, setDesde]     = useState(inicioMes)
  const [hasta, setHasta]     = useState(hoy)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [totales, setTotales] = useState<Totales | null>(null)
  const [personas, setPersonas] = useState<PersonaRow[]>([])
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  async function cargar() {
    setLoading(true); setError(''); setTotales(null); setPersonas([])
    try {
      const res = await fetch(`/api/horas-extra/informe-rango?desde=${desde}&hasta=${hasta}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al cargar'); return }
      setTotales(data.totales)
      setPersonas(data.personas)
    } catch { setError('Error de conexión') }
    finally { setLoading(false) }
  }

  function toggleExpandir(cedula: string) {
    setExpandidos(prev => {
      const s = new Set(prev)
      s.has(cedula) ? s.delete(cedula) : s.add(cedula)
      return s
    })
  }

  function descargarCSV() {
    const filas: string[] = ['Nombre,Rol,Contrato,Cédula,Fecha,HRS+,HRS NOC,REC NOC,REC DIA,Estado,Aprobado por']
    for (const p of personas) {
      for (const d of p.detalle) {
        filas.push([p.nombre, p.rol, p.contrato, p.cedula, d.fecha, d.hrsExtra, d.hrsNoc, d.recargo, d.recargoDiurno, d.estado, d.aprobadoPor ?? ''].join(','))
      }
    }
    const blob = new Blob([filas.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `informe-he-${desde}-${hasta}.csv`
    a.click()
  }

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: '#0a0f0a' }}>
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <button onClick={() => router.push('/admin/horas-extra')} className="text-gray-500 hover:text-white">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <FileBarChart2 size={20} className="text-green-400" />
            Informe de Horas Extra por Rango
          </h1>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-end gap-3 mb-6 p-4 rounded-xl" style={{ background: '#111827', border: '1px solid #1e293b' }}>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Desde</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Hasta</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
          </div>
          <button onClick={cargar} disabled={loading}
            className="px-5 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50 transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, #166534, #15803d)', border: '1px solid #22c55e' }}>
            {loading ? 'Cargando...' : 'Generar informe'}
          </button>
          {personas.length > 0 && (
            <button onClick={descargarCSV}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-gray-300 hover:text-white transition-all"
              style={{ background: '#1f2937', border: '1px solid #374151' }}>
              <Download size={14} /> Exportar CSV
            </button>
          )}
        </div>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {/* Cards de totales */}
        {totales && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Total HRS+',   value: fmt(totales.hrsExtra),      color: '#f97316' },
                { label: 'Total HRS NOC', value: fmt(totales.hrsNoc),       color: '#818cf8' },
                { label: 'Total REC NOC', value: fmt(totales.recargo),      color: '#60a5fa' },
                { label: 'Total REC DIA', value: fmt(totales.recargoDiurno), color: '#34d399' },
              ].map(c => (
                <div key={c.label} className="rounded-xl p-4" style={{ background: '#111827', border: '1px solid #1e293b' }}>
                  <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                  <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</p>
                  <p className="text-xs text-gray-600">horas</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="rounded-xl p-4" style={{ background: '#052e16', border: '1px solid #166534' }}>
                <p className="text-xs text-green-600 mb-1">Días aprobados</p>
                <p className="text-2xl font-bold text-green-400">{totales.aprobadas}</p>
              </div>
              <div className="rounded-xl p-4" style={{ background: '#1c1400', border: '1px solid #854d0e' }}>
                <p className="text-xs text-yellow-600 mb-1">Días pendientes</p>
                <p className="text-2xl font-bold text-yellow-400">{totales.pendientes}</p>
              </div>
              <div className="rounded-xl p-4" style={{ background: '#1a0505', border: '1px solid #7f1d1d' }}>
                <p className="text-xs text-red-700 mb-1">Días rechazados</p>
                <p className="text-2xl font-bold text-red-400">{totales.rechazadas}</p>
              </div>
            </div>

            {/* Tabla por persona */}
            <p className="text-xs text-gray-500 mb-2">{personas.length} personas con horas registradas · Clic en fila para ver detalle por día</p>
            <div className="rounded-xl overflow-hidden" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
              {personas.length === 0 ? (
                <p className="text-center text-gray-600 py-12 text-sm">Sin registros en el rango seleccionado</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#020617', borderBottom: '2px solid #1e293b' }}>
                      {['', 'Nombre', 'Rol', 'Contrato', 'Cédula', 'Días', 'HRS+', 'HRS NOC', 'REC NOC', 'REC DÍA', 'Apro.', 'Pend.', 'Rech.'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide" style={{ color: '#64748b' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {personas.map((p, i) => {
                      const open = expandidos.has(p.cedula)
                      const dias = p.detalle.length
                      return (
                        <>
                          <tr key={p.cedula}
                            onClick={() => toggleExpandir(p.cedula)}
                            className="cursor-pointer hover:brightness-125 transition-all"
                            style={{ background: i % 2 === 0 ? '#0d1117' : '#0f172a', borderBottom: open ? 'none' : '1px solid #1e293b' }}>
                            <td className="px-3 py-2.5 text-gray-500">
                              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </td>
                            <td className="px-3 py-2.5 text-white font-semibold">{p.nombre}</td>
                            <td className="px-3 py-2.5">
                              <span className="px-2 py-0.5 rounded text-xs font-bold"
                                style={p.rol === 'Almacenista'
                                  ? { background: '#1e3a5f', color: '#60a5fa' }
                                  : p.rol === 'Supervisor'
                                  ? { background: '#3b1c5c', color: '#c084fc' }
                                  : { background: '#1a2a1a', color: '#86efac' }}>
                                {p.rol}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="px-2 py-0.5 rounded text-xs font-bold"
                                style={p.contrato === 'Temporal'
                                  ? { background: '#0c2a4a', color: '#60a5fa' }
                                  : { background: '#052e16', color: '#4ade80' }}>
                                {p.contrato}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-gray-500 font-mono text-xs">{p.cedula}</td>
                            <td className="px-3 py-2.5 text-gray-300">{dias}</td>
                            <td className="px-3 py-2.5 font-bold" style={{ color: '#f97316' }}>{fmt(p.hrsExtra)}</td>
                            <td className="px-3 py-2.5 font-bold" style={{ color: '#818cf8' }}>{fmt(p.hrsNoc)}</td>
                            <td className="px-3 py-2.5 font-bold" style={{ color: '#60a5fa' }}>{fmt(p.recargo)}</td>
                            <td className="px-3 py-2.5 font-bold" style={{ color: '#34d399' }}>{fmt(p.recargoDiurno)}</td>
                            <td className="px-3 py-2.5 text-green-400 font-bold">{p.aprobadas}</td>
                            <td className="px-3 py-2.5 text-yellow-400">{p.pendientes}</td>
                            <td className="px-3 py-2.5 text-red-400">{p.rechazadas}</td>
                          </tr>
                          {open && (
                            <tr key={`${p.cedula}-det`} style={{ background: '#080d08', borderBottom: '2px solid #1e293b' }}>
                              <td colSpan={12} className="px-6 py-3">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr>
                                      {['Fecha', 'HRS+', 'HRS NOC', 'REC NOC', 'REC DÍA', 'Estado', 'Aprobado por'].map(h => (
                                        <th key={h} className="px-2 py-1 text-left font-bold uppercase tracking-wide" style={{ color: '#475569' }}>{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {p.detalle.map(d => {
                                      const s = estadoStyle(d.estado)
                                      return (
                                        <tr key={d.fecha} style={{ borderBottom: '1px solid #1e293b' }}>
                                          <td className="px-2 py-1.5 text-gray-400 font-mono">{d.fecha}</td>
                                          <td className="px-2 py-1.5 font-bold" style={{ color: '#f97316' }}>{d.hrsExtra > 0 ? fmt(d.hrsExtra) : '—'}</td>
                                          <td className="px-2 py-1.5" style={{ color: '#818cf8' }}>{d.hrsNoc > 0 ? fmt(d.hrsNoc) : '—'}</td>
                                          <td className="px-2 py-1.5" style={{ color: '#60a5fa' }}>{d.recargo > 0 ? fmt(d.recargo) : '—'}</td>
                                          <td className="px-2 py-1.5" style={{ color: '#34d399' }}>{d.recargoDiurno > 0 ? fmt(d.recargoDiurno) : '—'}</td>
                                          <td className="px-2 py-1.5">
                                            <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: s.bg, color: s.color }}>{d.estado}</span>
                                          </td>
                                          <td className="px-2 py-1.5 text-gray-500">{d.aprobadoPor ?? '—'}</td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {!totales && !loading && (
          <div className="text-center py-20 text-gray-700">
            <FileBarChart2 size={48} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm">Selecciona un rango de fechas y presiona <span className="text-white">Generar informe</span></p>
          </div>
        )}
      </div>
    </div>
  )
}
