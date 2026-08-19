'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FileBarChart2, BarChart2, Loader2, Clock, CheckCircle2, XCircle } from 'lucide-react'

type Override = {
  hora_ingreso: string
  salida_efectiva: string
  horas_extra_manual?: number
  horas_nocturnas_manual?: number
  recargo_nocturno_manual?: number
  recargo_diurno_manual?: number
}

type Registro = {
  cedula: string
  nombre: string
  rol: string | null
  hora_ingreso: string | null
  hora_salida: string | null
  turno: 'T1' | 'T2' | null
  entrada_norm: string | null
  salida_norm: string | null
  salida_efectiva: string | null
  minutos_extra: number
  horas_extra: number
  horas_recargo: number
  dia_libre: boolean
  aprobado: boolean
  aprobado_por_nombre: string | null
  rechazado: boolean
  rechazado_por_nombre: string | null
}

function calcConOverride(r: Registro, ov: Override) {
  const tieneManualDiurno   = ov.horas_extra_manual != null
  const tieneManualNocturno = (ov.horas_nocturnas_manual ?? 0) > 0
  if (tieneManualDiurno || tieneManualNocturno) {
    return {
      minutos_extra: Math.round((ov.horas_extra_manual ?? 0) * 60),
      horas_extra:   ov.horas_extra_manual ?? 0,
      horas_recargo: ov.recargo_nocturno_manual ?? 0,
    }
  }
  if (!r.salida_norm) return { minutos_extra: 0, horas_extra: 0, horas_recargo: 0 }
  const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const normMins = toMins(r.salida_norm)
  const efMins   = toMins(ov.salida_efectiva)
  if (efMins < 0) return { minutos_extra: 0, horas_extra: 0, horas_recargo: 0 }
  const minExtra = Math.max(0, efMins - normMins)
  const hExtra   = Math.round((minExtra / 60) * 100) / 100
  const hRecargo = efMins >= 22 * 60 + 30 ? Math.round((Math.max(0, efMins - 19 * 60) / 60) * 100) / 100 : 0
  return { minutos_extra: minExtra, horas_extra: hExtra, horas_recargo: hRecargo }
}

export default function RRHHHorasExtraPage() {
  const router = useRouter()
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const [fecha, setFecha]       = useState(hoy)
  const [registros, setRegistros] = useState<Registro[]>([])
  const [overrides, setOverrides] = useState<Record<string, Override>>({})
  const [loading, setLoading]   = useState(true)

  // Export modal
  const [modalExp,      setModalExp]      = useState(false)
  const [expDesde,      setExpDesde]      = useState(hoy.slice(0, 7) + '-01')
  const [expHasta,      setExpHasta]      = useState(hoy)
  const [descargando,   setDescargando]   = useState(false)
  const [descargandoT,  setDescargandoT]  = useState(false)

  const cargar = useCallback(async (f: string) => {
    setLoading(true)
    const [resReg, resOv] = await Promise.all([
      fetch(`/api/horas-extra?fecha=${f}`),
      fetch(`/api/horas-extra/override?fecha=${f}`),
    ])
    const dataReg = await resReg.json()
    const dataOv  = resOv.ok ? await resOv.json() : []

    setRegistros(dataReg.registros ?? [])

    const ovMap: Record<string, Override> = {}
    for (const ov of dataOv) {
      if (ov.hora_ingreso || ov.salida_efectiva || ov.horas_extra_manual != null || ov.horas_nocturnas_manual) {
        ovMap[ov.cedula] = {
          hora_ingreso:            ov.hora_ingreso            ?? '',
          salida_efectiva:         ov.salida_efectiva         ?? '',
          horas_extra_manual:      ov.horas_extra_manual      ?? undefined,
          horas_nocturnas_manual:  ov.horas_nocturnas_manual  ?? undefined,
          recargo_nocturno_manual: ov.recargo_nocturno_manual ?? undefined,
          recargo_diurno_manual:   ov.recargo_diurno_manual   ?? undefined,
        }
      }
    }
    setOverrides(ovMap)
    setLoading(false)
  }, [])

  useEffect(() => { cargar(fecha) }, [fecha, cargar])

  const registrosEfectivos = registros.map(r => {
    const ov = overrides[r.cedula]
    if (!ov) return r
    const calc = calcConOverride(r, ov)
    return { ...r, hora_ingreso: ov.hora_ingreso, salida_efectiva: ov.salida_efectiva, ...calc }
  })

  async function descargarReporte(contrato: 'Fijo' | 'Temporal') {
    const setLoad = contrato === 'Fijo' ? setDescargando : setDescargandoT
    setLoad(true)
    try {
      const res = await fetch(`/api/horas-extra/reporte?fecha_inicio=${expDesde}&fecha_fin=${expHasta}&contrato=${contrato}`)
      if (!res.ok) { alert('Error al generar reporte'); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `horas-extra-${contrato.toLowerCase()}_${expDesde}_${expHasta}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      setModalExp(false)
    } finally {
      setLoad(false)
    }
  }

  const conExtra  = registrosEfectivos.filter(r => r.horas_extra > 0 || (overrides[r.cedula]?.horas_nocturnas_manual ?? 0) > 0)
  const aprobados = registrosEfectivos.filter(r => r.aprobado)

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Clock size={22} className="text-yellow-400" /> Horas Extra
          </h1>
          <p className="text-gray-500 text-xs mt-0.5">Vista de solo lectura — sin modificaciones</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/rrhh/horas-extra/informe')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg,#0c4a6e,#0369a1)', border: '1px solid #38bdf8' }}>
            <BarChart2 size={14} /> Informe
          </button>
          <button onClick={() => setModalExp(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg,#14532d,#166534)', border: '1px solid #4ade80' }}>
            <FileBarChart2 size={14} /> Reporte Excel
          </button>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500" />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total registros', value: registros.length,  color: '#94a3b8', bg: '#0f172a', border: '#1e293b' },
          { label: 'Con horas extra', value: conExtra.length,   color: '#fbbf24', bg: '#1c1400', border: '#854d0e' },
          { label: 'Aprobados',       value: `${aprobados.length}/${conExtra.length}`, color: '#4ade80', bg: '#052e16', border: '#166534' },
          { label: 'Rechazados',      value: registrosEfectivos.filter(r => r.rechazado).length, color: '#f87171', bg: '#1a0505', border: '#7f1d1d' },
        ].map(k => (
          <div key={k.label} className="rounded-xl p-4" style={{ background: k.bg, border: `1px solid ${k.border}` }}>
            <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: k.color }}>{k.label}</p>
            <p className="text-3xl font-black" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-yellow-400" />
        </div>
      ) : registros.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <Clock size={40} strokeWidth={1} className="mx-auto mb-3" />
          <p className="text-sm">No hay registros de asistencia para esta fecha.</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid #1e293b', background: '#0d1117' }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: '#020617', borderBottom: '2px solid #1e293b' }}>
                {[
                  ['NOMBRE','w-[14%]'],['CÉDULA','w-[8%]'],['TRN','w-[5%]'],
                  ['ENT.','w-[5%]'],['E.N.','w-[5%]'],['SAL.','w-[5%]'],['S.N.','w-[5%]'],
                  ['S.EFEC.','w-[7%]'],['MIN+','w-[6%]'],['HRS+','w-[6%]'],
                  ['HRS NOC.','w-[7%]'],['REC.','w-[6%]'],['REC.D.','w-[6%]'],['ESTADO','w-[10%]'],
                ].map(([h, w]) => (
                  <th key={h} className={`px-2 py-2.5 text-left font-bold uppercase tracking-wide whitespace-nowrap ${w}`}
                    style={{ color: '#64748b', fontSize: '0.65rem' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {registrosEfectivos.map((r, i) => {
                const tieneNocturnas = (overrides[r.cedula]?.horas_nocturnas_manual ?? 0) > 0
                const tieneExtra     = r.minutos_extra > 0 || tieneNocturnas
                const rowBg = r.aprobado ? '#0a1f10' : r.rechazado ? '#1a0505' : tieneExtra ? '#1a1500' : i % 2 === 0 ? '#0d1117' : '#0f172a'

                return (
                  <tr key={r.cedula} style={{ background: rowBg, borderBottom: '1px solid #1e293b' }}>
                    <td className="px-2 py-2 text-white font-medium max-w-0">
                      <span className="block truncate" title={r.nombre}>{r.nombre}</span>
                    </td>
                    <td className="px-2 py-2 text-slate-500 font-mono">{r.cedula}</td>
                    <td className="px-2 py-2">
                      {r.dia_libre
                        ? <span className="font-bold px-1.5 py-0.5 rounded text-[9px]" style={{ background: 'rgba(234,179,8,0.2)', color: '#fbbf24' }}>LIBRE</span>
                        : overrides[r.cedula]
                          ? <span className="font-bold px-1.5 py-0.5 rounded text-[9px]" style={{ background: 'rgba(14,116,144,0.3)', color: '#67e8f9' }}>MAN</span>
                          : r.turno
                            ? <span className={`font-bold px-1.5 py-0.5 rounded text-[9px] ${r.turno === 'T1' ? 'bg-blue-900/50 text-blue-300' : 'bg-purple-900/50 text-purple-300'}`}>{r.turno}</span>
                            : <span className="text-slate-700">—</span>}
                    </td>
                    <td className="px-2 py-2 font-mono text-slate-300">{r.hora_ingreso ?? '—'}</td>
                    <td className="px-2 py-2 font-mono text-sky-400 font-semibold">{r.entrada_norm ?? '—'}</td>
                    <td className="px-2 py-2 font-mono text-slate-400">{r.hora_salida ?? <span className="text-slate-700">—</span>}</td>
                    <td className="px-2 py-2 font-mono text-sky-400 font-semibold">{r.salida_norm ?? '—'}</td>
                    <td className="px-2 py-2 font-mono">
                      {r.salida_efectiva
                        ? <span className="font-bold" style={{ color: r.minutos_extra > 0 ? '#f97316' : '#34d399' }}>{r.salida_efectiva}</span>
                        : <span className="text-slate-700">—</span>}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {r.minutos_extra > 0
                        ? <span className="inline-block px-1.5 py-0.5 rounded font-bold" style={{ background: '#451a03', color: '#fdba74' }}>{r.minutos_extra}</span>
                        : <span className="text-slate-700">—</span>}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {r.horas_extra > 0
                        ? <span className="inline-block px-1.5 py-0.5 rounded font-bold" style={{ background: '#451a03', color: '#fed7aa' }}>{r.horas_extra.toFixed(2)}</span>
                        : <span className="text-slate-700">—</span>}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {tieneNocturnas
                        ? <span className="inline-block px-1.5 py-0.5 rounded font-bold" style={{ background: '#1e1040', color: '#c4b5fd' }}>
                            {overrides[r.cedula]!.horas_nocturnas_manual!.toFixed(2)}
                          </span>
                        : <span className="text-slate-700">—</span>}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {r.horas_recargo > 0
                        ? <span className="inline-block px-1.5 py-0.5 rounded font-bold" style={{ background: '#450a0a', color: '#fca5a5' }}>{r.horas_recargo.toFixed(2)}</span>
                        : <span className="text-slate-700">—</span>}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {(overrides[r.cedula]?.recargo_diurno_manual ?? 0) > 0
                        ? <span className="inline-block px-1.5 py-0.5 rounded font-bold" style={{ background: '#422006', color: '#fde68a' }}>
                            {overrides[r.cedula]!.recargo_diurno_manual!.toFixed(2)}
                          </span>
                        : <span className="text-slate-700">—</span>}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {!tieneExtra
                        ? <span className="text-slate-700">Sin extra</span>
                        : r.aprobado
                          ? <span className="flex items-center gap-1 font-semibold text-green-400"><CheckCircle2 size={10} /> Aprobado</span>
                          : r.rechazado
                            ? <span className="flex items-center gap-1 font-semibold text-red-400"><XCircle size={10} /> Rechazado</span>
                            : <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-yellow-400" style={{ background: '#1c1400' }}>
                                <Clock size={9} /> Pendiente
                              </span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal exportar */}
      {modalExp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #374151' }}>
            <h3 className="text-white font-bold text-base mb-4 flex items-center gap-2">
              <FileBarChart2 size={16} className="text-green-400" /> Descargar Reporte Excel
            </h3>
            <div className="flex flex-col gap-3 mb-5">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Desde</label>
                <input type="date" value={expDesde} onChange={e => setExpDesde(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm font-mono focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Hasta</label>
                <input type="date" value={expHasta} onChange={e => setExpHasta(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm font-mono focus:outline-none" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => descargarReporte('Fijo')} disabled={descargando || descargandoT}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all hover:brightness-110"
                style={{ background: 'linear-gradient(135deg,#14532d,#166534)', border: '1px solid #4ade80' }}>
                <FileBarChart2 size={14} />
                {descargando ? 'Descargando...' : 'Personal Fijo'}
              </button>
              <button onClick={() => descargarReporte('Temporal')} disabled={descargando || descargandoT}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all hover:brightness-110"
                style={{ background: 'linear-gradient(135deg,#1e3a5c,#1e4d7a)', border: '1px solid #3a8abf' }}>
                <FileBarChart2 size={14} />
                {descargandoT ? 'Descargando...' : 'Personal Temporal'}
              </button>
              <button onClick={() => setModalExp(false)}
                className="w-full py-2 rounded-xl text-sm text-gray-500 hover:text-white transition-all"
                style={{ background: '#1f2937', border: '1px solid #374151' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
