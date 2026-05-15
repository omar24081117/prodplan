'use client'

import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

type KPIs = {
  meta: number
  ejecutado: number
  cumplimiento: number
  personal_planeado: number
}

type FilaProceso = {
  proceso: string
  meta: number
  ejecutado: number
  cumplimiento: number
}

type FilaDia = {
  fecha: string
  meta: number
  ejecutado: number
  cumplimiento: number
}

type DashboardData = {
  kpis: KPIs
  por_proceso: FilaProceso[]
  por_dia: FilaDia[]
}

export default function DashboardPage() {
  const hoy = new Date().toLocaleDateString('en-CA')
  const [modo, setModo] = useState<'dia' | 'rango'>('dia')
  const [fecha, setFecha] = useState(hoy)
  const [desde, setDesde] = useState(hoy)
  const [hasta, setHasta] = useState(hoy)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    const params = modo === 'dia'
      ? `desde=${fecha}&hasta=${fecha}`
      : `desde=${desde}&hasta=${hasta}`
    const res = await fetch(`/api/dashboard?${params}`)
    const json = await res.json()
    setData(json)
    setLoading(false)
  }, [modo, fecha, desde, hasta])

  useEffect(() => { cargar() }, [cargar])

  const kpis = data?.kpis
  const pct = kpis?.cumplimiento ?? 0

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6 flex-wrap">
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
            <span className="text-gray-400 text-sm">—</span>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
          </div>
        )}
        <button onClick={cargar} className="text-gray-400 hover:text-white text-sm px-3 py-2 bg-gray-800 rounded-lg">↻</button>
      </div>

      {loading ? (
        <p className="text-gray-400">Cargando datos...</p>
      ) : !data ? (
        <p className="text-gray-400">No hay datos para el período seleccionado</p>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Meta total', value: kpis?.meta.toLocaleString() ?? '—', color: 'text-white' },
              { label: 'Ejecutado', value: kpis?.ejecutado.toLocaleString() ?? '—', color: 'text-blue-400' },
              { label: 'Cumplimiento', value: `${pct}%`, color: pct >= 90 ? 'text-emerald-400' : pct >= 70 ? 'text-yellow-400' : 'text-red-400' },
              { label: 'Personal planeado', value: kpis?.personal_planeado.toLocaleString() ?? '—', color: 'text-white' },
            ].map(k => (
              <div key={k.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-gray-400 text-xs mb-1">{k.label}</p>
                <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Gráfica por día (solo en modo rango o si hay varios días) */}
          {data.por_dia.length > 1 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
              <h2 className="text-white font-semibold mb-4">Cumplimiento por día (%)</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.por_dia} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="fecha" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                    labelStyle={{ color: '#fff' }}
                    formatter={(v) => [`${v}%`, 'Cumplimiento']}
                  />
                  <Bar dataKey="cumplimiento" radius={[4, 4, 0, 0]}>
                    {data.por_dia.map((entry, i) => (
                      <Cell key={i} fill={entry.cumplimiento >= 90 ? '#10b981' : entry.cumplimiento >= 70 ? '#f59e0b' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabla por proceso */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-6">
            <h2 className="text-white font-semibold p-4 border-b border-gray-800">Por proceso</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-gray-400 px-4 py-2.5 font-medium">Proceso</th>
                  <th className="text-right text-gray-400 px-4 py-2.5 font-medium">Meta</th>
                  <th className="text-right text-gray-400 px-4 py-2.5 font-medium">Ejecutado</th>
                  <th className="text-right text-gray-400 px-4 py-2.5 font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {data.por_proceso.map(row => (
                  <tr key={row.proceso} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-2.5 text-white">{row.proceso}</td>
                    <td className="px-4 py-2.5 text-gray-300 text-right">{row.meta.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-blue-400 font-medium">{row.ejecutado.toLocaleString()}</td>
                    <td className={`px-4 py-2.5 text-right font-bold ${row.cumplimiento >= 90 ? 'text-emerald-400' : row.cumplimiento >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {row.cumplimiento}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
