'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingCart, ArrowLeft, Plus, Clock, CheckCircle2, XCircle, Search, Lock, X, Loader2, Play, Flag } from 'lucide-react'

const TIPOS_SOLICITUD = [
  'MANTENIMIENTO', 'PAPELERIA Y ASEO', 'INVESTIGACION',
  'REFRIGERIO', 'INSUMOS CALIDAD', 'INSUMOS PRODUCCION',
] as const
type TipoSolicitud = typeof TIPOS_SOLICITUD[number]

type Estado = 'Pendiente' | 'En Trámite' | 'Finalizada' | 'Rechazada'

type Solicitud = {
  id: string; created_at: string; fecha: string
  solicitante_nombre: string; area: string
  tipo_solicitud: string; descripcion: string
  cantidad: string; unidad: string; urgencia: 'Normal' | 'Urgente'
  estado: Estado; observacion: string | null; gestionado_por: string | null
}

const EST: Record<Estado, { bg: string; color: string; border: string }> = {
  Pendiente:   { bg: '#1c1400', color: '#fbbf24', border: '#854d0e' },
  'En Trámite': { bg: '#0c1a3d', color: '#60a5fa', border: '#1e3a8a' },
  Finalizada:  { bg: '#052e16', color: '#4ade80', border: '#166534' },
  Rechazada:   { bg: '#1a0505', color: '#f87171', border: '#7f1d1d' },
}

const SORT_ORDER: Record<Estado, number> = { Pendiente: 0, 'En Trámite': 1, Rechazada: 2, Finalizada: 3 }

type AccionTipo = 'En Trámite' | 'Finalizada' | 'Rechazada'

export default function SolicitudesComprasPage() {
  const router = useRouter()

  const [authOk,       setAuthOk]       = useState(false)
  const [gestor,       setGestor]       = useState<{ nombre: string } | null>(null)
  const [solicitudes,  setSolicitudes]  = useState<Solicitud[]>([])
  const [loadingSols,  setLoadingSols]  = useState(false)
  const [personal,     setPersonal]     = useState<string[]>([])

  const [modalGestion, setModalGestion] = useState(false)
  const [cedulaInput,  setCedulaInput]  = useState('')
  const [errorGestion, setErrorGestion] = useState('')
  const [loadingAuth,  setLoadingAuth]  = useState(false)

  const [modalNueva, setModalNueva] = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [errorForm,  setErrorForm]  = useState('')
  const [form, setForm] = useState({
    solicitante_nombre: '', area: '',
    tipo_solicitud: '' as TipoSolicitud | '',
    descripcion: '', cantidad: '', unidad: '',
    urgencia: 'Normal' as 'Normal' | 'Urgente',
  })

  const [accionId,     setAccionId]     = useState<string | null>(null)
  const [accionTipo,   setAccionTipo]   = useState<AccionTipo | null>(null)
  const [accionObs,    setAccionObs]    = useState('')
  const [savingAccion, setSavingAccion] = useState(false)

  const [busqueda,     setBusqueda]     = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'Todos' | Estado>('Todos')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('solicitudes_user')
      if (saved) setAuthOk(true)
      else router.replace('/solicitudes')
    } catch { router.replace('/solicitudes') }
  }, [router])

  useEffect(() => {
    fetch('/api/personal').then(r => r.json()).then(data => {
      if (Array.isArray(data))
        setPersonal((data as { nombre: string; activo: boolean }[]).filter(p => p.activo).map(p => p.nombre).sort())
    }).catch(() => {})
  }, [])

  async function cargarSolicitudes() {
    setLoadingSols(true)
    try {
      const data = await fetch('/api/solicitudes/compras').then(r => r.json())
      if (Array.isArray(data)) setSolicitudes(data)
    } catch {}
    finally { setLoadingSols(false) }
  }

  useEffect(() => { if (gestor) cargarSolicitudes() }, [gestor])

  async function intentarGestion(e: React.FormEvent) {
    e.preventDefault()
    setLoadingAuth(true); setErrorGestion('')
    try {
      const res  = await fetch('/api/solicitudes/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula: cedulaInput.trim(), modulo: 'compras' }),
      })
      const data = await res.json()
      if (!res.ok)              { setErrorGestion(data.error || 'Error'); return }
      if (!data.puedeGestionar) { setErrorGestion('No tienes acceso a la gestión de compras'); return }
      setGestor({ nombre: data.nombre })
      setModalGestion(false); setCedulaInput('')
    } catch { setErrorGestion('Error de conexión') }
    finally { setLoadingAuth(false) }
  }

  async function enviarSolicitud(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setErrorForm('')
    try {
      const res = await fetch('/api/solicitudes/compras', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setErrorForm(data.error || 'Error al guardar'); return }
      setModalNueva(false)
      setForm({ solicitante_nombre: '', area: '', tipo_solicitud: '', descripcion: '', cantidad: '', unidad: '', urgencia: 'Normal' })
      if (gestor) cargarSolicitudes()
    } catch { setErrorForm('Error de conexión') }
    finally { setSaving(false) }
  }

  async function ejecutarAccion() {
    if (!accionId || !accionTipo || !gestor) return
    setSavingAccion(true)
    try {
      const res = await fetch(`/api/solicitudes/compras/${accionId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: accionTipo, observacion: accionObs, gestionado_por: gestor.nombre }),
      })
      if (res.ok) { setAccionId(null); setAccionTipo(null); setAccionObs(''); cargarSolicitudes() }
    } catch {}
    finally { setSavingAccion(false) }
  }

  const filtradas = solicitudes
    .filter(s => {
      const ok1 = s.descripcion.toLowerCase().includes(busqueda.toLowerCase()) || s.solicitante_nombre.toLowerCase().includes(busqueda.toLowerCase())
      const ok2 = filtroEstado === 'Todos' || s.estado === filtroEstado
      return ok1 && ok2
    })
    .sort((a, b) => (SORT_ORDER[a.estado] ?? 4) - (SORT_ORDER[b.estado] ?? 4))

  if (!authOk) return null

  const ESTADOS_FILTRO: Array<'Todos' | Estado> = ['Todos', 'Pendiente', 'En Trámite', 'Finalizada', 'Rechazada']

  return (
    <div className="min-h-screen bg-gray-950 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <button onClick={() => router.push('/solicitudes')} className="text-gray-500 hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <ShoppingCart size={20} className="text-cyan-400" /> Solicitudes de Compra
          </h1>
          <div className="ml-auto flex items-center gap-2">
            {!gestor ? (
              <button onClick={() => setModalGestion(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition-all"
                style={{ background: '#1f2937', border: '1px solid #374151' }}>
                <Lock size={13} /> Gestión
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-cyan-400 font-medium">{gestor.nombre}</span>
                <button onClick={() => setGestor(null)} className="text-xs text-gray-600 hover:text-gray-400 px-2 py-1 rounded"
                  style={{ background: '#1f2937', border: '1px solid #374151' }}>
                  Salir
                </button>
              </div>
            )}
            <button onClick={() => setModalNueva(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:brightness-110"
              style={{ background: 'linear-gradient(135deg, #0e4f5c, #0f6674)', border: '1px solid #22b8cc' }}>
              <Plus size={14} /> Nueva Solicitud
            </button>
          </div>
        </div>

        {/* Gestión mode */}
        {gestor && (
          <>
            <div className="flex gap-2 mb-4 flex-wrap">
              <div className="flex items-center gap-2 flex-1 min-w-[180px] rounded-lg px-3 py-2"
                style={{ background: '#111827', border: '1px solid #1e293b' }}>
                <Search size={13} className="text-gray-500" />
                <input type="text" placeholder="Buscar descripción o solicitante..."
                  value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  className="flex-1 bg-transparent text-white text-sm focus:outline-none" />
              </div>
              {ESTADOS_FILTRO.map(est => {
                const st     = est !== 'Todos' ? EST[est] : null
                const active = filtroEstado === est
                return (
                  <button key={est} onClick={() => setFiltroEstado(est)}
                    className="px-3 py-2 rounded-lg text-xs font-bold transition-all"
                    style={{
                      background: active ? (st?.bg ?? '#1f2937') : '#111827',
                      color:      active ? (st?.color ?? '#e5e7eb') : '#6b7280',
                      border:     `1px solid ${active ? (st?.border ?? '#374151') : '#1f2937'}`,
                    }}>
                    {est}
                  </button>
                )
              })}
            </div>

            {loadingSols ? (
              <div className="flex justify-center py-12"><Loader2 size={24} className="text-cyan-400 animate-spin" /></div>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
                {filtradas.length === 0 ? (
                  <p className="text-center text-gray-600 py-12 text-sm">No hay solicitudes</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: '#020617', borderBottom: '2px solid #1e293b' }}>
                          {['ID', 'Fecha', 'Solicitante', 'Área', 'Tipo', 'Descripción', 'Cant.', 'Urgencia', 'Estado', 'Acciones'].map(h => (
                            <th key={h} className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: '#64748b' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filtradas.map((s, i) => {
                          const st       = EST[s.estado]
                          const isAccion = accionId === s.id
                          const dimmed   = s.estado === 'Finalizada' || s.estado === 'Rechazada'
                          return (
                            <>
                              <tr key={s.id}
                                style={{
                                  background:   i % 2 === 0 ? '#0d1117' : '#0f172a',
                                  borderBottom: isAccion ? 'none' : '1px solid #1e293b',
                                  opacity:      dimmed ? 0.6 : 1,
                                }}>
                                <td className="px-3 py-2.5 whitespace-nowrap">
                                  <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: '#1e293b', color: '#94a3b8' }}>
                                    #{s.id.slice(0, 8).toUpperCase()}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 text-gray-400 font-mono text-xs whitespace-nowrap">{s.fecha}</td>
                                <td className="px-3 py-2.5 text-white font-medium whitespace-nowrap">{s.solicitante_nombre}</td>
                                <td className="px-3 py-2.5 text-gray-400 text-xs whitespace-nowrap">{s.area}</td>
                                <td className="px-3 py-2.5 text-cyan-400 text-xs font-semibold whitespace-nowrap">{s.tipo_solicitud}</td>
                                <td className="px-3 py-2.5 text-gray-200 max-w-[160px]">
                                  <span className="block truncate" title={s.descripcion}>{s.descripcion}</span>
                                </td>
                                <td className="px-3 py-2.5 text-gray-300 whitespace-nowrap">{s.cantidad} {s.unidad}</td>
                                <td className="px-3 py-2.5">
                                  {s.urgencia === 'Urgente'
                                    ? <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: '#450a0a', color: '#fca5a5' }}>URGENTE</span>
                                    : <span className="text-xs text-gray-600">Normal</span>}
                                </td>
                                <td className="px-3 py-2.5">
                                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded whitespace-nowrap"
                                    style={{ background: st.bg, color: st.color }}>
                                    {s.estado === 'Finalizada'  ? <CheckCircle2 size={10} /> :
                                     s.estado === 'En Trámite'  ? <Play size={10} /> :
                                     s.estado === 'Rechazada'   ? <XCircle size={10} /> :
                                     <Clock size={10} />}
                                    {s.estado}
                                  </span>
                                  {s.gestionado_por && <span className="block text-gray-600 text-xs mt-0.5">{s.gestionado_por}</span>}
                                  {s.observacion && <span className="block text-gray-500 text-xs mt-0.5 max-w-[140px] truncate" title={s.observacion}>{s.observacion}</span>}
                                </td>
                                <td className="px-3 py-2.5 whitespace-nowrap">
                                  {s.estado === 'Pendiente' && (
                                    <div className="flex gap-1">
                                      <button onClick={() => { setAccionId(s.id); setAccionTipo('En Trámite'); setAccionObs('') }}
                                        className="px-2 py-1 rounded text-xs font-bold transition-all hover:brightness-110"
                                        style={{ background: '#0c1a3d', color: '#60a5fa', border: '1px solid #1e3a8a' }}>
                                        Iniciar
                                      </button>
                                      <button onClick={() => { setAccionId(s.id); setAccionTipo('Rechazada'); setAccionObs('') }}
                                        className="px-2 py-1 rounded text-xs font-bold transition-all hover:brightness-110"
                                        style={{ background: '#1a0505', color: '#f87171', border: '1px solid #7f1d1d' }}>
                                        Rechazar
                                      </button>
                                    </div>
                                  )}
                                  {s.estado === 'En Trámite' && (
                                    <button onClick={() => { setAccionId(s.id); setAccionTipo('Finalizada'); setAccionObs('') }}
                                      className="px-2 py-1 rounded text-xs font-bold transition-all hover:brightness-110 flex items-center gap-1"
                                      style={{ background: '#052e16', color: '#4ade80', border: '1px solid #166534' }}>
                                      <Flag size={10} /> Finalizar
                                    </button>
                                  )}
                                </td>
                              </tr>
                              {isAccion && (
                                <tr key={`${s.id}-acc`} style={{ background: '#080d08', borderBottom: '2px solid #1e293b' }}>
                                  <td colSpan={10} className="px-4 py-3">
                                    <div className="flex items-start gap-3 flex-wrap">
                                      <span className="text-xs font-bold mt-1.5 whitespace-nowrap"
                                        style={{ color: accionTipo === 'Finalizada' ? '#4ade80' : accionTipo === 'En Trámite' ? '#60a5fa' : '#f87171' }}>
                                        {accionTipo === 'En Trámite' ? '▶ Iniciar trámite' : accionTipo === 'Finalizada' ? '✓ Finalizar solicitud' : '✕ Rechazar solicitud'}
                                      </span>
                                      <div className="flex-1 min-w-[200px]">
                                        <input type="text" autoFocus
                                          placeholder={accionTipo === 'Finalizada' ? 'Descripción de lo realizado (obligatorio)' : 'Descripción de la acción (opcional)'}
                                          value={accionObs}
                                          onChange={e => setAccionObs(e.target.value)}
                                          className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-cyan-500" />
                                      </div>
                                      <button onClick={ejecutarAccion}
                                        disabled={savingAccion || (accionTipo === 'Finalizada' && !accionObs.trim())}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-40 flex items-center gap-1"
                                        style={{ background: accionTipo === 'En Trámite' ? '#1e3a8a' : accionTipo === 'Finalizada' ? '#166534' : '#7f1d1d' }}>
                                        {savingAccion && <Loader2 size={12} className="animate-spin" />}
                                        Confirmar
                                      </button>
                                      <button onClick={() => { setAccionId(null); setAccionTipo(null) }} className="text-gray-600 hover:text-gray-400 mt-1">
                                        <X size={14} />
                                      </button>
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
                )}
              </div>
            )}
          </>
        )}

        {!gestor && (
          <div className="text-center py-20 text-gray-600">
            <ShoppingCart size={52} className="mx-auto mb-4 opacity-15" />
            <p className="text-sm text-gray-500">Usa <span className="text-white font-semibold">+ Nueva Solicitud</span> para registrar tu pedido.</p>
            <p className="text-xs mt-1 text-gray-700">El seguimiento lo gestiona Abastecimiento.</p>
          </div>
        )}
      </div>

      {/* Modal Gestión auth */}
      {modalGestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-xs rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #374151' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Lock size={16} className="text-cyan-400" />
                <h3 className="text-white font-bold text-base">Acceso de Gestión</h3>
              </div>
              <button onClick={() => { setModalGestion(false); setCedulaInput(''); setErrorGestion('') }} className="text-gray-500 hover:text-white"><X size={16} /></button>
            </div>
            <p className="text-gray-500 text-xs mb-4">Director · Gerencia · Abastecimiento</p>
            <form onSubmit={intentarGestion} className="flex flex-col gap-3">
              <input type="text" inputMode="numeric" placeholder="Ingresa tu cédula"
                value={cedulaInput} autoFocus onChange={e => setCedulaInput(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500" />
              {errorGestion && <p className="text-red-400 text-xs text-center">{errorGestion}</p>}
              <button type="submit" disabled={loadingAuth || !cedulaInput.trim()}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #0e4f5c, #0f6674)', border: '1px solid #22b8cc' }}>
                {loadingAuth && <Loader2 size={14} className="animate-spin" />}
                Ingresar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nueva Solicitud */}
      {modalNueva && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #374151' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <ShoppingCart size={16} className="text-cyan-400" /> Nueva Solicitud de Compra
              </h3>
              <button onClick={() => setModalNueva(false)} className="text-gray-500 hover:text-white"><X size={16} /></button>
            </div>
            <form onSubmit={enviarSolicitud} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Solicitante *</label>
                  {personal.length > 0 ? (
                    <select required value={form.solicitante_nombre}
                      onChange={e => setForm(f => ({ ...f, solicitante_nombre: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 cursor-pointer">
                      <option value="">— seleccionar —</option>
                      {personal.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  ) : (
                    <input required value={form.solicitante_nombre} onChange={e => setForm(f => ({ ...f, solicitante_nombre: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500" />
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Área *</label>
                  <input required value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Tipo de solicitud *</label>
                <select required value={form.tipo_solicitud}
                  onChange={e => setForm(f => ({ ...f, tipo_solicitud: e.target.value as TipoSolicitud }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 cursor-pointer">
                  <option value="">— seleccionar tipo —</option>
                  {TIPOS_SOLICITUD.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Descripción del artículo *</label>
                <textarea required rows={2} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 resize-none" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Cantidad *</label>
                  <input required type="number" min="1" value={form.cantidad} onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Unidad *</label>
                  <input required value={form.unidad} placeholder="unidades, kg..." onChange={e => setForm(f => ({ ...f, unidad: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Urgencia</label>
                  <select value={form.urgencia} onChange={e => setForm(f => ({ ...f, urgencia: e.target.value as 'Normal' | 'Urgente' }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none cursor-pointer">
                    <option value="Normal">Normal</option>
                    <option value="Urgente">Urgente</option>
                  </select>
                </div>
              </div>
              {errorForm && <p className="text-red-400 text-xs">{errorForm}</p>}
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={() => setModalNueva(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white"
                  style={{ background: '#1f2937', border: '1px solid #374151' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #0e4f5c, #0f6674)', border: '1px solid #22b8cc' }}>
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Enviar Solicitud
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
