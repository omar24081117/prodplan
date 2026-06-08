'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Clock, CheckCircle2, Loader2, AlertTriangle, X, Settings, XCircle, Download, ChevronLeft, ChevronRight } from 'lucide-react'

type Registro = {
  cedula: string
  nombre: string
  hora_ingreso: string | null
  hora_salida: string | null
  turno: 'T1' | 'T2' | null
  entrada_norm: string | null
  salida_norm: string | null
  salida_efectiva: string | null
  minutos_extra: number
  horas_extra: number
  horas_recargo: number
  aprobado: boolean
  aprobado_por_nombre: string | null
  aprobado_en: string | null
  rechazado: boolean
  rechazado_por_nombre: string | null
  rechazado_en: string | null
}

// Override: horario corregido O horas extra directas para jornadas adicionales
type Override = {
  hora_ingreso: string
  salida_efectiva: string
  horas_extra_manual?: number  // Si se define, ignora el cálculo por horario
}

const toMins = (t: string) => {
  if (!t) return -1
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function calcConOverride(r: Registro, ov: Override) {
  // ── Modo jornada adicional: horas extra ingresadas directamente ──
  if (ov.horas_extra_manual !== undefined && ov.horas_extra_manual > 0) {
    const minExtra = Math.round(ov.horas_extra_manual * 60)
    return { minutos_extra: minExtra, horas_extra: ov.horas_extra_manual, horas_recargo: 0 }
  }

  // ── Modo normal: calcular desde salida efectiva vs salida norm ──
  const normTime = r.salida_norm
  if (!normTime) return { minutos_extra: 0, horas_extra: 0, horas_recargo: 0 }
  const salidaNormMins = toMins(normTime)
  const salidaEfMins   = toMins(ov.salida_efectiva)
  if (salidaEfMins < 0) return { minutos_extra: 0, horas_extra: 0, horas_recargo: 0 }

  const minExtra = Math.max(0, salidaEfMins - salidaNormMins)
  const hExtra   = Math.round((minExtra / 60) * 100) / 100

  let hRecargo = 0
  if (salidaEfMins >= 22 * 60 + 30) {
    hRecargo = Math.round((Math.max(0, salidaEfMins - 19 * 60) / 60) * 100) / 100
  }
  return { minutos_extra: minExtra, horas_extra: hExtra, horas_recargo: hRecargo }
}

function TurnoBadge({ turno }: { turno: 'T1' | 'T2' | null }) {
  if (!turno) return <span className="text-gray-600 text-xs">—</span>
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded ${turno === 'T1' ? 'bg-blue-900/50 text-blue-300' : 'bg-purple-900/50 text-purple-300'}`}>
      {turno}
    </span>
  )
}

/* ── Modal configurar horario ── */
function TurnoManualModal({
  registro, overrideActual, onClose, onGuardar,
}: {
  registro: Registro
  overrideActual?: Override
  onClose: () => void
  onGuardar: (cedula: string, ov: Override) => void
}) {
  const tieneManual = (overrideActual?.horas_extra_manual ?? 0) > 0
  const [modo,          setModo]          = useState<'horario' | 'adicional'>(tieneManual ? 'adicional' : 'horario')
  const [horaIngreso,   setHoraIngreso]   = useState(overrideActual?.hora_ingreso    ?? registro.hora_ingreso    ?? '')
  const [salidaEfec,    setSalidaEfec]    = useState(overrideActual?.salida_efectiva ?? registro.salida_efectiva ?? registro.hora_salida ?? '')
  const [hsExtManual,   setHsExtManual]   = useState(overrideActual?.horas_extra_manual?.toString() ?? '')

  const previewHorario = modo === 'horario' && salidaEfec && registro.salida_norm
    ? calcConOverride(registro, { hora_ingreso: horaIngreso, salida_efectiva: salidaEfec })
    : null
  const previewManual = modo === 'adicional' && hsExtManual
    ? { horas_extra: parseFloat(hsExtManual) || 0, minutos_extra: Math.round((parseFloat(hsExtManual) || 0) * 60), horas_recargo: 0 }
    : null
  const preview = previewHorario ?? previewManual

  function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (modo === 'adicional') {
      onGuardar(registro.cedula, {
        hora_ingreso: horaIngreso || registro.hora_ingreso || '',
        salida_efectiva: '',
        horas_extra_manual: parseFloat(hsExtManual) || 0,
      })
    } else {
      onGuardar(registro.cedula, { hora_ingreso: horaIngreso, salida_efectiva: salidaEfec })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ background: '#111827', border: '1px solid #374151' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <Settings size={16} className="text-sky-400" /> Configurar horario
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={16} /></button>
        </div>

        {/* Info empleado */}
        <div className="mb-4 p-3 rounded-lg" style={{ background: '#1f2937', border: '1px solid #374151' }}>
          <p className="text-white font-semibold text-sm">{registro.nombre}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs font-mono">
            <span className="text-gray-500">Entrada: <span className="text-sky-300">{registro.hora_ingreso ?? '—'}</span></span>
            <span className="text-gray-500">Salida: <span className="text-orange-300">{registro.hora_salida ?? '—'}</span></span>
            {registro.salida_norm && <span className="text-gray-500">S. norm: <span className="text-green-400">{registro.salida_norm}</span></span>}
          </div>
        </div>

        {/* Selector de modo */}
        <div className="flex gap-2 mb-4">
          {[
            { val: 'horario',   label: 'Corregir horario',     color: '#1d4ed8' },
            { val: 'adicional', label: '+ Jornada adicional',  color: '#b45309' },
          ].map(m => (
            <button key={m.val} type="button"
              onClick={() => setModo(m.val as 'horario' | 'adicional')}
              className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
              style={{
                background: modo === m.val ? m.color : '#1f2937',
                border: `1px solid ${modo === m.val ? m.color : '#374151'}`,
                color: modo === m.val ? 'white' : '#6b7280'
              }}>
              {m.label}
            </button>
          ))}
        </div>

        <form onSubmit={guardar} className="flex flex-col gap-3">
          {modo === 'horario' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Hora ingreso <span className="text-sky-400">(corregir)</span></label>
                <input type="time" required value={horaIngreso}
                  onChange={e => setHoraIngreso(e.target.value)}
                  className="w-full bg-gray-800 border border-sky-800 text-white rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-sky-400" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Salida efectiva <span className="text-orange-400">(cálculo)</span></label>
                <input type="time" required value={salidaEfec}
                  onChange={e => setSalidaEfec(e.target.value)}
                  className="w-full bg-gray-800 border border-orange-800 text-white rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-orange-400" />
              </div>
            </div>
          ) : (
            <div>
              <label className="text-xs text-gray-400 block mb-1">
                Horas extra <span className="text-amber-400">(jornada adicional no programada)</span>
              </label>
              <div className="flex items-center gap-2">
                <input type="number" step="0.25" min="0.25" max="24" required
                  placeholder="Ej: 8 o 4.5"
                  value={hsExtManual}
                  onChange={e => setHsExtManual(e.target.value)}
                  className="flex-1 bg-gray-800 border border-amber-700 text-white rounded-lg px-3 py-2.5 text-lg font-mono font-bold focus:outline-none focus:border-amber-400 text-center"
                />
                <span className="text-gray-400 text-sm font-semibold">horas</span>
              </div>
              <p className="text-gray-600 text-xs mt-1.5">
                Ingresa las horas trabajadas en el día adicional. El sistema las registra como horas extra directas.
              </p>
            </div>
          )}

          {/* Vista previa */}
          {preview && (
            <div className="rounded-lg p-3 text-xs" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
              <p className="text-gray-400 mb-1.5 font-semibold uppercase tracking-wide text-xs">Vista previa</p>
              <div className="flex gap-4">
                <div>
                  <p className="text-gray-500">Min extra</p>
                  <p className="font-bold" style={{ color: preview.minutos_extra > 0 ? '#fdba74' : '#475569' }}>{preview.minutos_extra} min</p>
                </div>
                <div>
                  <p className="text-gray-500">Hrs extra</p>
                  <p className="font-bold" style={{ color: preview.horas_extra > 0 ? '#fdba74' : '#475569' }}>{preview.horas_extra.toFixed(2)} h</p>
                </div>
                <div>
                  <p className="text-gray-500">Recargo noct.</p>
                  <p className="font-bold" style={{ color: preview.horas_recargo > 0 ? '#fca5a5' : '#475569' }}>{preview.horas_recargo.toFixed(2)} h</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
              style={{ background: '#1f2937', border: '1px solid #374151' }}>
              Cancelar
            </button>
            <button type="submit"
              className="flex-1 py-2 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1.5 transition-all hover:brightness-110"
              style={{
                background: modo === 'adicional' ? 'linear-gradient(135deg,#92400e,#b45309)' : 'linear-gradient(135deg,#1d4ed8,#2563eb)',
                border: `1px solid ${modo === 'adicional' ? '#d97706' : '#3b82f6'}`
              }}>
              <CheckCircle2 size={14} /> Aplicar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Modal aprobación ── */
function AprobacionModal({
  registro, fecha, onClose, onSuccess,
}: {
  registro: Registro; fecha: string
  onClose: () => void; onSuccess: (nombre: string) => void
}) {
  const [cedula, setCedula] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function aprobar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch('/api/horas-extra/aprobar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cedula_empleado: registro.cedula, fecha, cedula_aprobador: cedula.trim() }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || 'Error'); return }
    onSuccess(data.aprobado_por)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ background: '#111827', border: '1px solid #374151' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-400" /> Aprobar horas extra
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={16} /></button>
        </div>
        <div className="mb-4 p-3 rounded-lg bg-gray-800/50">
          <p className="text-white font-semibold text-sm">{registro.nombre}</p>
          <p className="text-gray-400 text-xs mt-0.5">
            {registro.minutos_extra} min extra
            {registro.horas_recargo > 0 && ` · ${registro.horas_recargo}h recargo nocturno`}
          </p>
        </div>
        <form onSubmit={aprobar} className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Cédula del aprobador</label>
            <input autoFocus type="text" inputMode="numeric" required
              placeholder="Supervisor · Analista · Director"
              value={cedula} onChange={e => { setCedula(e.target.value); setError('') }}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-green-500"
            />
            <p className="text-xs text-gray-600 mt-1">Roles autorizados: Supervisor, Analista, Director</p>
          </div>
          {error && <p className="text-red-400 text-xs flex items-center gap-1"><AlertTriangle size={12} />{error}</p>}
          <div className="flex gap-2 mt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
              style={{ background: '#1f2937', border: '1px solid #374151' }}>Cancelar</button>
            <button type="submit" disabled={loading || !cedula.trim()}
              className="flex-1 py-2 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#166534,#15803d)', border: '1px solid #4ade80' }}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Aprobar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Modal rechazo ── */
function RechazoModal({
  registro, fecha, onClose, onSuccess,
}: {
  registro: Registro; fecha: string
  onClose: () => void; onSuccess: (nombre: string) => void
}) {
  const [cedula, setCedula] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function rechazar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch('/api/horas-extra/rechazar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cedula_empleado: registro.cedula, fecha, cedula_aprobador: cedula.trim() }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || 'Error'); return }
    onSuccess(data.rechazado_por)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ background: '#111827', border: '1px solid #374151' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <XCircle size={16} className="text-red-400" /> Rechazar horas extra
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={16} /></button>
        </div>
        <div className="mb-4 p-3 rounded-lg" style={{ background: 'rgba(127,29,29,0.3)', border: '1px solid #7f1d1d' }}>
          <p className="text-white font-semibold text-sm">{registro.nombre}</p>
          <p className="text-gray-400 text-xs mt-0.5">
            {registro.minutos_extra} min extra
            {registro.horas_recargo > 0 && ` · ${registro.horas_recargo}h recargo nocturno`}
          </p>
        </div>
        <form onSubmit={rechazar} className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Cédula de quien rechaza</label>
            <input autoFocus type="text" inputMode="numeric" required
              placeholder="Supervisor · Analista · Director"
              value={cedula} onChange={e => { setCedula(e.target.value); setError('') }}
              className="w-full bg-gray-800 border border-red-800 text-white rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-red-500"
            />
            <p className="text-xs text-gray-600 mt-1">Roles autorizados: Supervisor, Analista, Director</p>
          </div>
          {error && <p className="text-red-400 text-xs flex items-center gap-1"><AlertTriangle size={12} />{error}</p>}
          <div className="flex gap-2 mt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
              style={{ background: '#1f2937', border: '1px solid #374151' }}>Cancelar</button>
            <button type="submit" disabled={loading || !cedula.trim()}
              className="flex-1 py-2 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#7f1d1d,#991b1b)', border: '1px solid #ef4444' }}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Rechazar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Page ── */
export default function HorasExtraPage() {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const [fecha, setFecha]             = useState(hoy)
  const [registros, setRegistros]     = useState<Registro[]>([])
  const [loading, setLoading]         = useState(false)
  const [modal, setModal]             = useState<Registro | null>(null)
  const [modalRechazo, setModalRechazo] = useState<Registro | null>(null)
  const [modalTurno, setModalTurno]   = useState<Registro | null>(null)
  const [overrides, setOverrides]     = useState<Record<string, Override>>({})
  const [exportando, setExportando]   = useState(false)
  const [modalExport, setModalExport] = useState(false)
  const hoyExport = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const [expDesde, setExpDesde]       = useState(hoyExport.slice(0, 7) + '-01')
  const [expHasta, setExpHasta]       = useState(hoyExport)
  const tablaRef = useRef<HTMLDivElement>(null)

  function scrollTabla(dir: 'left' | 'right') {
    if (!tablaRef.current) return
    tablaRef.current.scrollBy({ left: dir === 'right' ? 300 : -300, behavior: 'smooth' })
  }

  async function descargarExcel(e: React.FormEvent) {
    e.preventDefault()
    setExportando(true)
    try {
      const res = await fetch(`/api/horas-extra/exportar?fecha_inicio=${expDesde}&fecha_fin=${expHasta}`)
      if (!res.ok) { setExportando(false); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `horas-extra_${expDesde}_${expHasta}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      setModalExport(false)
    } finally {
      setExportando(false)
    }
  }

  const cargar = useCallback(async (f: string) => {
    setLoading(true)
    // Cargar asistencia y overrides guardados en paralelo
    const [resReg, resOv] = await Promise.all([
      fetch(`/api/horas-extra?fecha=${f}`),
      fetch(`/api/horas-extra/override?fecha=${f}`),
    ])
    const dataReg = await resReg.json()
    const dataOv  = resOv.ok ? await resOv.json() : []
    setRegistros(dataReg.registros ?? [])
    // Restaurar overrides guardados en BD
    const ovMap: Record<string, Override> = {}
    for (const ov of dataOv) {
      if (ov.hora_ingreso || ov.salida_efectiva || ov.horas_extra_manual) {
        ovMap[ov.cedula] = {
          hora_ingreso:      ov.hora_ingreso      ?? '',
          salida_efectiva:   ov.salida_efectiva   ?? '',
          horas_extra_manual: ov.horas_extra_manual ?? undefined,
        }
      }
    }
    setOverrides(ovMap)
    setLoading(false)
  }, [])

  useEffect(() => { cargar(fecha) }, [fecha, cargar])

  function onAprobado(cedula: string, nombre: string) {
    setRegistros(prev => prev.map(r =>
      r.cedula === cedula
        ? { ...r, aprobado: true, aprobado_por_nombre: nombre, aprobado_en: new Date().toISOString(), rechazado: false, rechazado_por_nombre: null, rechazado_en: null }
        : r
    ))
    setModal(null)
  }

  function onRechazado(cedula: string, nombre: string) {
    setRegistros(prev => prev.map(r =>
      r.cedula === cedula
        ? { ...r, rechazado: true, rechazado_por_nombre: nombre, rechazado_en: new Date().toISOString(), aprobado: false, aprobado_por_nombre: null, aprobado_en: null }
        : r
    ))
    setModalRechazo(null)
  }

  // Aplicar overrides a los registros
  const registrosEfectivos = registros.map(r => {
    const ov = overrides[r.cedula]
    if (!ov) return r
    const calc = calcConOverride(r, ov)
    return { ...r, hora_ingreso: ov.hora_ingreso, salida_efectiva: ov.salida_efectiva, ...calc }
  })

  // KPIs
  const conExtra      = registrosEfectivos.filter(r => r.minutos_extra > 0)
  const conRecargo    = registrosEfectivos.filter(r => r.horas_recargo > 0)
  const aprobados     = registrosEfectivos.filter(r => r.aprobado)
  const rechazados    = registrosEfectivos.filter(r => r.rechazado)
  const totalMinExtra = registrosEfectivos.reduce((s, r) => s + r.minutos_extra, 0)

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Clock size={22} className="text-yellow-400" /> Horas Extra
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Control de tiempo adicional y recargo nocturno</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setModalExport(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg,#14532d,#166534)', border: '1px solid #4ade80' }}>
            <Download size={14} /> Exportar Excel
          </button>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500"
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total registros', value: registros.length,                              color: '#60a5fa' },
          { label: 'Con horas extra', value: conExtra.length,                               color: '#facc15' },
          { label: 'Aprobados',       value: `${aprobados.length}/${conExtra.length}`,       color: '#4ade80' },
          { label: 'Rechazados',      value: rechazados.length,                             color: '#f87171' },
        ].map(k => (
          <div key={k.label} className="rounded-xl p-4" style={{ background: '#111827', border: '1px solid #1f2937' }}>
            <p className="text-xs text-gray-500 mb-1">{k.label}</p>
            <p className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Leyenda */}
      <div className="flex gap-4 mb-3 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
          T1 · Entrada 6:00 (±20 min) · Salida norm 15:30 · Margen 15:00-15:50
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
          T2 · Entrada 13:00 (±30 min) · Salida norm 22:30 · Margen 22:15-22:50
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
          Recargo nocturno si salida efectiva &gt; 22:30 (desde las 19:00)
        </span>
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
        <div className="relative">
          <p className="text-xs text-gray-600 mb-2">{registrosEfectivos.length} registros</p>
        <div ref={tablaRef} className="tabla-scroll rounded-xl overflow-x-auto" style={{ border: '1px solid #1e293b', background: '#0d1117' }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: '#020617', borderBottom: '2px solid #1e293b' }}>
                {[
                  ['NOMBRE','w-[14%]'],['CÉDULA','w-[9%]'],['TRN','w-[5%]'],
                  ['ENT.','w-[5%]'],['E.N.','w-[5%]'],['SAL.','w-[5%]'],
                  ['S.N.','w-[5%]'],['S.EFEC.','w-[6%]'],
                  ['MIN+','w-[6%]'],['HRS+','w-[6%]'],['REC.','w-[6%]'],
                  ['ESTADO','w-[9%]'],['ACCIÓN','w-[14%]'],
                ].map(([h, w]) => (
                  <th key={h} className={`px-2 py-2.5 text-left font-bold uppercase tracking-wide whitespace-nowrap ${w}`} style={{ color: '#64748b', fontSize: '0.65rem' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {registrosEfectivos.map((r, i) => {
                const tieneExtra = r.minutos_extra > 0
                const rowBg = r.aprobado
                  ? '#0a1f10'
                  : r.rechazado ? '#1a0505'
                  : tieneExtra ? '#1a1500'
                  : i % 2 === 0 ? '#0d1117' : '#0f172a'
                const borderColor = r.rechazado ? '#3a0a0a' : tieneExtra && !r.aprobado ? '#2a2000' : '#1e293b'

                return (
                  <tr key={r.cedula} style={{ background: rowBg, borderBottom: `1px solid ${borderColor}` }}>
                    {/* NOMBRE */}
                    <td className="px-2 py-2 text-white font-medium max-w-0">
                      <span className="block truncate" title={r.nombre}>{r.nombre}</span>
                    </td>

                    {/* CÉDULA */}
                    <td className="px-2 py-2 text-slate-500 font-mono">{r.cedula}</td>

                    {/* TURNO */}
                    <td className="px-2 py-2">
                      {overrides[r.cedula] ? (
                        <span className="font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(14,116,144,0.3)', color: '#67e8f9', fontSize:'0.6rem' }}>MAN</span>
                      ) : r.turno ? (
                        <span className={`font-bold px-1.5 py-0.5 rounded ${r.turno === 'T1' ? 'bg-blue-900/50 text-blue-300' : 'bg-purple-900/50 text-purple-300'}`}>{r.turno}</span>
                      ) : <span className="text-slate-700">—</span>}
                    </td>

                    {/* ENT. REAL */}
                    <td className="px-2 py-2 font-mono text-slate-300">{r.hora_ingreso ?? '—'}</td>

                    {/* E.N. */}
                    <td className="px-2 py-2 font-mono text-sky-400 font-semibold">{r.entrada_norm ?? '—'}</td>

                    {/* SAL. REAL */}
                    <td className="px-2 py-2 font-mono text-slate-400">{r.hora_salida ?? <span className="text-slate-700">—</span>}</td>

                    {/* S.N. */}
                    <td className="px-2 py-2 font-mono text-sky-400 font-semibold">{r.salida_norm ?? '—'}</td>

                    {/* S.EFEC. */}
                    <td className="px-2 py-2 font-mono">
                      {r.salida_efectiva
                        ? <span className="font-bold" style={{ color: r.minutos_extra > 0 ? '#f97316' : '#34d399' }}>{r.salida_efectiva}</span>
                        : <span className="text-slate-700">—</span>}
                    </td>

                    {/* MIN+ */}
                    <td className="px-2 py-2 text-center">
                      {r.minutos_extra > 0
                        ? <span className="inline-block px-1.5 py-0.5 rounded font-bold" style={{ background: '#451a03', color: '#fdba74' }}>{r.minutos_extra}</span>
                        : <span className="text-slate-700">—</span>}
                    </td>

                    {/* HRS+ */}
                    <td className="px-2 py-2 text-center">
                      {r.horas_extra > 0
                        ? <span className="inline-block px-1.5 py-0.5 rounded font-bold" style={{ background: '#451a03', color: '#fed7aa' }}>{r.horas_extra.toFixed(2)}</span>
                        : <span className="text-slate-700">—</span>}
                    </td>

                    {/* REC. */}
                    <td className="px-2 py-2 text-center">
                      {r.horas_recargo > 0
                        ? <span className="inline-block px-1.5 py-0.5 rounded font-bold" style={{ background: '#450a0a', color: '#fca5a5' }}>{r.horas_recargo.toFixed(2)}</span>
                        : <span className="text-slate-700">—</span>}
                    </td>

                    {/* ESTADO */}
                    <td className="px-2 py-2 whitespace-nowrap">
                      {!tieneExtra ? (
                        <span className="text-slate-700">Sin extra</span>
                      ) : r.aprobado ? (
                        <span className="flex items-center gap-1 font-semibold" style={{ color: '#4ade80' }}>
                          <CheckCircle2 size={10} /> Aprobado
                        </span>
                      ) : r.rechazado ? (
                        <span className="flex items-center gap-1 font-semibold" style={{ color: '#f87171' }}>
                          <XCircle size={10} /> Rechazado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: '#1c1400', color: '#fbbf24' }}>
                          <Clock size={9} /> Pendiente
                        </span>
                      )}
                    </td>

                    {/* ACCIÓN */}
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1 flex-wrap">
                        <button
                          onClick={() => setModalTurno(registros.find(x => x.cedula === r.cedula) ?? r)}
                          title="Configurar horario"
                          className="px-2 py-1 rounded font-semibold flex items-center gap-0.5 transition-all hover:brightness-125"
                          style={{ background: 'rgba(30,64,175,0.25)', border: '1px solid #1d4ed8', color: '#93c5fd', fontSize:'0.65rem' }}
                        >
                          <Settings size={9} /> Config
                        </button>
                        {tieneExtra && !r.aprobado && !r.rechazado && (
                          <>
                            <button onClick={() => setModal(r)}
                              className="px-2 py-1 rounded font-semibold transition-all hover:brightness-125"
                              style={{ background: '#14532d', border: '1px solid #166534', color: '#86efac', fontSize:'0.65rem' }}>
                              ✓ Apro
                            </button>
                            <button onClick={() => setModalRechazo(r)}
                              className="px-2 py-1 rounded font-semibold transition-all hover:brightness-125"
                              style={{ background: '#450a0a', border: '1px solid #7f1d1d', color: '#fca5a5', fontSize:'0.65rem' }}>
                              ✕ Rec
                            </button>
                          </>
                        )}
                        {(r.aprobado || r.rechazado) && tieneExtra && (
                          <button
                            onClick={() => r.aprobado ? setModal(r) : setModalRechazo(r)}
                            className="px-2 py-1 rounded font-semibold transition-all hover:brightness-125"
                            style={{ background: 'rgba(71,85,105,0.3)', border: '1px solid #475569', color: '#94a3b8', fontSize:'0.65rem' }}>
                            ↺ Cambiar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {/* Resumen recargo */}
      {!loading && conRecargo.length > 0 && (
        <div className="mt-4 rounded-xl p-4 flex items-start gap-3"
          style={{ background: 'rgba(90,40,0,0.2)', border: '1px solid rgba(251,146,60,0.3)' }}>
          <AlertTriangle size={16} className="text-orange-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-orange-300 font-semibold text-sm">
              {conRecargo.length} empleado{conRecargo.length > 1 ? 's' : ''} con recargo nocturno
            </p>
            <p className="text-orange-500/70 text-xs mt-0.5">
              Total: {conRecargo.reduce((s, r) => s + r.horas_recargo, 0).toFixed(2)}h (horas trabajadas después de las 19:00 con salida efectiva &gt;22:30)
            </p>
          </div>
        </div>
      )}

      {/* Modal configurar */}
      {modalTurno && (
        <TurnoManualModal
          registro={modalTurno}
          overrideActual={overrides[modalTurno.cedula]}
          onClose={() => setModalTurno(null)}
          onGuardar={async (cedula, ov) => {
            // 1. Actualizar estado local inmediatamente
            setOverrides(prev => ({ ...prev, [cedula]: ov }))
            setModalTurno(null)
            // 2. Persistir en BD para que sobreviva recargas
            await fetch('/api/horas-extra/override', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                cedula,
                fecha,
                hora_ingreso:       ov.hora_ingreso       || null,
                salida_efectiva:    ov.salida_efectiva    || null,
                horas_extra_manual: ov.horas_extra_manual ?? null,
              }),
            })
          }}
        />
      )}

      {/* Modal aprobación */}
      {modal && (
        <AprobacionModal registro={modal} fecha={fecha}
          onClose={() => setModal(null)}
          onSuccess={(nombre) => onAprobado(modal.cedula, nombre)}
        />
      )}

      {/* Modal rechazo */}
      {modalRechazo && (
        <RechazoModal registro={modalRechazo} fecha={fecha}
          onClose={() => setModalRechazo(null)}
          onSuccess={(nombre) => onRechazado(modalRechazo.cedula, nombre)}
        />
      )}

      {/* Modal exportar Excel */}
      {modalExport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
            style={{ background: '#111827', border: '1px solid #374151' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <Download size={16} className="text-green-400" /> Exportar a Excel
              </h3>
              <button onClick={() => setModalExport(false)} className="text-gray-500 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <p className="text-gray-400 text-xs mb-4">
              Descarga las horas extra <strong className="text-green-400">aprobadas</strong> y recargos nocturnos del personal operario. Incluye hoja de resumen por persona.
            </p>
            <form onSubmit={descargarExcel} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Desde</label>
                  <input type="date" required value={expDesde} max={expHasta}
                    onChange={e => setExpDesde(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Hasta</label>
                  <input type="date" required value={expHasta} min={expDesde}
                    onChange={e => setExpHasta(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setModalExport(false)}
                  className="flex-1 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
                  style={{ background: '#1f2937', border: '1px solid #374151' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={exportando}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all hover:brightness-110"
                  style={{ background: 'linear-gradient(135deg,#14532d,#166534)', border: '1px solid #4ade80' }}>
                  {exportando ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  {exportando ? 'Generando...' : 'Descargar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
