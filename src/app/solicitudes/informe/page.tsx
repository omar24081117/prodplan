'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ClipboardList, Clock, CheckCircle2, XCircle, RefreshCw, Loader2, Play, X } from 'lucide-react'

type Estado = 'Pendiente' | 'En Trámite' | 'Finalizada' | 'Rechazada'

type SolicitudCompra = {
  id: string; numero: number; fecha: string; solicitante_nombre: string; area: string
  tipo_solicitud: string; descripcion: string; cantidad: string; unidad: string
  urgencia: string; estado: Estado
  observacion: string | null; gestionado_por: string | null; gestionado_en: string | null
}
type SolicitudMensajeria = {
  id: string; numero: number; fecha: string; solicitante_nombre: string; area: string
  destinatario: string; direccion: string; descripcion: string
  urgencia: string; estado: Estado
  observacion: string | null; gestionado_por: string | null; gestionado_en: string | null
}

const EST: Record<Estado, { bg: string; color: string; border: string }> = {
  Pendiente:    { bg: '#1c1400', color: '#fbbf24', border: '#854d0e' },
  'En Trámite': { bg: '#0c1a3d', color: '#60a5fa', border: '#1e3a8a' },
  Finalizada:   { bg: '#052e16', color: '#4ade80', border: '#166534' },
  Rechazada:    { bg: '#1a0505', color: '#f87171', border: '#7f1d1d' },
}

const SORT_ORDER: Record<Estado, number> = { Pendiente: 0, 'En Trámite': 1, Rechazada: 2, Finalizada: 3 }

function EstadoBadge({ estado }: { estado: Estado }) {
  const st = EST[estado]
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded whitespace-nowrap"
      style={{ background: st.bg, color: st.color }}>
      {estado === 'Finalizada' ? <CheckCircle2 size={10} /> :
       estado === 'En Trámite' ? <Play size={10} /> :
       estado === 'Rechazada'  ? <XCircle size={10} /> :
       <Clock size={10} />}
      {estado}
    </span>
  )
}

const FILTER_INPUT = {
  background: '#0a0f1a',
  border: '1px solid #1e293b',
  color: '#e2e8f0',
  borderRadius: 6,
  padding: '3px 6px',
  fontSize: 11,
  width: '100%',
  outline: 'none',
}
const FILTER_SELECT = { ...FILTER_INPUT, cursor: 'pointer' }

type FC = { id: string; fecha: string; sol: string; area: string; tipo: string; desc: string; urg: string; est: string }
type FM = { id: string; fecha: string; sol: string; area: string; dest: string; dir: string; desc: string; urg: string; est: string }

const FC0: FC = { id: '', fecha: '', sol: '', area: '', tipo: '', desc: '', urg: '', est: '' }
const FM0: FM = { id: '', fecha: '', sol: '', area: '', dest: '', dir: '', desc: '', urg: '', est: '' }

function match(val: string | number | null | undefined, q: string) {
  if (!q) return true
  return String(val ?? '').toLowerCase().includes(q.toLowerCase())
}

export default function InformeSolicitudesPage() {
  const router = useRouter()

  const [tab,        setTab]        = useState<'compras' | 'mensajeria'>('compras')
  const [compras,    setCompras]    = useState<SolicitudCompra[]>([])
  const [mensajeria, setMensajeria] = useState<SolicitudMensajeria[]>([])
  const [loading,    setLoading]    = useState(false)
  const [authOk,     setAuthOk]     = useState(false)
  const [fc,         setFc]         = useState<FC>(FC0)
  const [fm,         setFm]         = useState<FM>(FM0)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('solicitudes_user')
      if (saved) setAuthOk(true)
      else router.replace('/solicitudes')
    } catch { router.replace('/solicitudes') }
  }, [router])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [rc, rm] = await Promise.all([
        fetch('/api/solicitudes/compras').then(r => r.json()),
        fetch('/api/solicitudes/mensajeria').then(r => r.json()),
      ])
      if (Array.isArray(rc)) setCompras(rc)
      if (Array.isArray(rm)) setMensajeria(rm)
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { if (authOk) cargar() }, [authOk, cargar])

  /* ── drag scroll ── */
  const tableComprasRef    = useRef<HTMLDivElement>(null)
  const tableMensajeriaRef = useRef<HTMLDivElement>(null)
  const dragging  = useRef(false)
  const startX    = useRef(0)
  const scrollL   = useRef(0)
  const activeRef = useRef<HTMLDivElement | null>(null)

  function onDragStart(ref: React.RefObject<HTMLDivElement | null>) {
    return (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return
      dragging.current = true
      activeRef.current = ref.current
      startX.current = e.pageX
      scrollL.current = ref.current?.scrollLeft ?? 0
      if (ref.current) ref.current.style.cursor = 'grabbing'
    }
  }
  function onDragMove(e: React.MouseEvent) {
    if (!dragging.current || !activeRef.current) return
    e.preventDefault()
    activeRef.current.scrollLeft = scrollL.current - (e.pageX - startX.current)
  }
  function onDragEnd() {
    dragging.current = false
    if (activeRef.current) activeRef.current.style.cursor = 'grab'
    activeRef.current = null
  }

  if (!authOk) return null

  const sortFn = (a: { estado: Estado }, b: { estado: Estado }) =>
    (SORT_ORDER[a.estado] ?? 4) - (SORT_ORDER[b.estado] ?? 4)

  const listaCompras = compras.filter(s =>
    match(s.numero, fc.id) && match(s.fecha, fc.fecha) &&
    match(s.solicitante_nombre, fc.sol) && match(s.area, fc.area) &&
    match(s.tipo_solicitud, fc.tipo) && match(s.descripcion, fc.desc) &&
    (!fc.urg || s.urgencia === fc.urg) && (!fc.est || s.estado === fc.est)
  ).sort(sortFn)

  const listaMensajeria = mensajeria.filter(s =>
    match(s.numero, fm.id) && match(s.fecha, fm.fecha) &&
    match(s.solicitante_nombre, fm.sol) && match(s.area, fm.area) &&
    match(s.destinatario, fm.dest) && match(s.direccion, fm.dir) &&
    match(s.descripcion, fm.desc) &&
    (!fm.urg || s.urgencia === fm.urg) && (!fm.est || s.estado === fm.est)
  ).sort(sortFn)

  const count = (arr: { estado: Estado }[], e: Estado) => arr.filter(s => s.estado === e).length
  const totalPend   = count(compras, 'Pendiente')   + count(mensajeria, 'Pendiente')
  const totalTramit = count(compras, 'En Trámite')  + count(mensajeria, 'En Trámite')
  const totalFinal  = count(compras, 'Finalizada')  + count(mensajeria, 'Finalizada')
  const totalRech   = count(compras, 'Rechazada')   + count(mensajeria, 'Rechazada')

  const hasFilterC = Object.values(fc).some(v => v !== '')
  const hasFilterM = Object.values(fm).some(v => v !== '')

  return (
    <div className="min-h-screen bg-gray-950 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <button onClick={() => router.push('/solicitudes')} className="text-gray-500 hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <ClipboardList size={20} className="text-yellow-400" /> Estado de Solicitudes
          </h1>
          <button onClick={cargar} disabled={loading}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white disabled:opacity-50 transition-all"
            style={{ background: '#1f2937', border: '1px solid #374151' }}>
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Actualizar
          </button>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Pendientes',  value: totalPend,   est: 'Pendiente'   as Estado, icon: <Clock size={13} /> },
            { label: 'En Trámite',  value: totalTramit, est: 'En Trámite'  as Estado, icon: <Play size={13} /> },
            { label: 'Finalizadas', value: totalFinal,  est: 'Finalizada'  as Estado, icon: <CheckCircle2 size={13} /> },
            { label: 'Rechazadas',  value: totalRech,   est: 'Rechazada'   as Estado, icon: <XCircle size={13} /> },
          ].map(c => {
            const st = EST[c.est]
            return (
              <div key={c.label} className="rounded-xl p-4" style={{ background: st.bg, border: `1px solid ${st.border}` }}>
                <div className="flex items-center gap-1.5 mb-1" style={{ color: st.color }}>{c.icon}<span className="text-xs font-bold">{c.label}</span></div>
                <p className="text-2xl font-bold" style={{ color: st.color }}>{c.value}</p>
              </div>
            )
          })}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #1e293b' }}>
            {(['compras', 'mensajeria'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="px-4 py-2 text-xs font-bold transition-all"
                style={{
                  background: tab === t ? (t === 'compras' ? '#0e4f5c' : '#3b1c5c') : '#111827',
                  color:      tab === t ? (t === 'compras' ? '#22d3ee' : '#c084fc') : '#6b7280',
                }}>
                {t === 'compras' ? '🛒 Compras' : '📬 Mensajería'}
                <span className="ml-2 opacity-60">{t === 'compras' ? compras.length : mensajeria.length}</span>
              </button>
            ))}
          </div>
          {((tab === 'compras' && hasFilterC) || (tab === 'mensajeria' && hasFilterM)) && (
            <button onClick={() => tab === 'compras' ? setFc(FC0) : setFm(FM0)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 hover:text-red-300 transition-all"
              style={{ background: '#1a0505', border: '1px solid #7f1d1d' }}>
              <X size={11} /> Limpiar filtros
            </button>
          )}
          <span className="text-gray-600 text-xs ml-auto">
            {tab === 'compras' ? listaCompras.length : listaMensajeria.length} resultado{(tab === 'compras' ? listaCompras.length : listaMensajeria.length) !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Tabla Compras */}
        {tab === 'compras' && (
          <div className="rounded-xl overflow-hidden" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 size={22} className="text-cyan-400 animate-spin" /></div>
            ) : (
              <div ref={tableComprasRef} className="overflow-x-auto select-none" style={{ cursor: 'grab' }}
                onMouseDown={onDragStart(tableComprasRef)} onMouseMove={onDragMove}
                onMouseUp={onDragEnd} onMouseLeave={onDragEnd}>
                <table className="text-sm" style={{ minWidth: '100%', tableLayout: 'auto' }}>
                  <thead>
                    <tr style={{ background: '#020617', borderBottom: '1px solid #1e293b' }}>
                      {['ID', 'Fecha', 'Solicitante', 'Área', 'Tipo', 'Descripción', 'Cant.', 'Urgencia', 'Estado', 'Lo realizado / Gestor'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: '#64748b' }}>{h}</th>
                      ))}
                    </tr>
                    {/* Fila de filtros */}
                    <tr style={{ background: '#060d1a', borderBottom: '2px solid #1e293b' }}>
                      <td className="px-2 py-1.5">
                        <input style={FILTER_INPUT} placeholder="#" value={fc.id}
                          onMouseDown={e => e.stopPropagation()}
                          onChange={e => setFc(f => ({ ...f, id: e.target.value }))} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input style={FILTER_INPUT} placeholder="Fecha" value={fc.fecha}
                          onMouseDown={e => e.stopPropagation()}
                          onChange={e => setFc(f => ({ ...f, fecha: e.target.value }))} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input style={FILTER_INPUT} placeholder="Nombre" value={fc.sol}
                          onMouseDown={e => e.stopPropagation()}
                          onChange={e => setFc(f => ({ ...f, sol: e.target.value }))} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input style={FILTER_INPUT} placeholder="Área" value={fc.area}
                          onMouseDown={e => e.stopPropagation()}
                          onChange={e => setFc(f => ({ ...f, area: e.target.value }))} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input style={FILTER_INPUT} placeholder="Tipo" value={fc.tipo}
                          onMouseDown={e => e.stopPropagation()}
                          onChange={e => setFc(f => ({ ...f, tipo: e.target.value }))} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input style={{ ...FILTER_INPUT, minWidth: 140 }} placeholder="Descripción" value={fc.desc}
                          onMouseDown={e => e.stopPropagation()}
                          onChange={e => setFc(f => ({ ...f, desc: e.target.value }))} />
                      </td>
                      <td className="px-2 py-1.5" />
                      <td className="px-2 py-1.5">
                        <select style={FILTER_SELECT} value={fc.urg}
                          onMouseDown={e => e.stopPropagation()}
                          onChange={e => setFc(f => ({ ...f, urg: e.target.value }))}>
                          <option value="">Todas</option>
                          <option value="Normal">Normal</option>
                          <option value="Urgente">Urgente</option>
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <select style={FILTER_SELECT} value={fc.est}
                          onMouseDown={e => e.stopPropagation()}
                          onChange={e => setFc(f => ({ ...f, est: e.target.value }))}>
                          <option value="">Todos</option>
                          <option value="Pendiente">Pendiente</option>
                          <option value="En Trámite">En Trámite</option>
                          <option value="Finalizada">Finalizada</option>
                          <option value="Rechazada">Rechazada</option>
                        </select>
                      </td>
                      <td className="px-2 py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {listaCompras.length === 0 ? (
                      <tr><td colSpan={10} className="text-center text-gray-600 py-10 text-sm">Sin resultados</td></tr>
                    ) : listaCompras.map((s, i) => {
                      const dimmed = s.estado === 'Finalizada' || s.estado === 'Rechazada'
                      return (
                        <tr key={s.id} style={{ background: i % 2 === 0 ? '#0d1117' : '#0f172a', borderBottom: '1px solid #1e293b', opacity: dimmed ? 0.65 : 1 }}>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="font-mono text-sm font-bold px-2 py-0.5 rounded" style={{ background: '#1e293b', color: '#e2e8f0' }}>#{s.numero ?? '—'}</span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-400 font-mono text-xs whitespace-nowrap">{s.fecha}</td>
                          <td className="px-3 py-2.5 text-white font-medium whitespace-nowrap">{s.solicitante_nombre}</td>
                          <td className="px-3 py-2.5 text-gray-400 text-xs whitespace-nowrap">{s.area}</td>
                          <td className="px-3 py-2.5 text-cyan-400 text-xs font-semibold whitespace-nowrap">{s.tipo_solicitud}</td>
                          <td className="px-3 py-2.5 text-gray-200" style={{ minWidth: 220, whiteSpace: 'normal', wordBreak: 'break-word' }}>{s.descripcion}</td>
                          <td className="px-3 py-2.5 text-gray-300 whitespace-nowrap">{s.cantidad} {s.unidad}</td>
                          <td className="px-3 py-2.5">
                            {s.urgencia === 'Urgente'
                              ? <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: '#450a0a', color: '#fca5a5' }}>URGENTE</span>
                              : <span className="text-xs text-gray-600">Normal</span>}
                          </td>
                          <td className="px-3 py-2.5"><EstadoBadge estado={s.estado} /></td>
                          <td className="px-3 py-2.5" style={{ minWidth: 160 }}>
                            {s.observacion && <span className="block text-gray-300 text-xs" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{s.observacion}</span>}
                            {s.gestionado_por && <span className="block text-gray-600 text-xs mt-0.5">{s.gestionado_por}</span>}
                            {!s.observacion && !s.gestionado_por && <span className="text-gray-700 text-xs">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tabla Mensajería */}
        {tab === 'mensajeria' && (
          <div className="rounded-xl overflow-hidden" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 size={22} className="text-purple-400 animate-spin" /></div>
            ) : (
              <div ref={tableMensajeriaRef} className="overflow-x-auto select-none" style={{ cursor: 'grab' }}
                onMouseDown={onDragStart(tableMensajeriaRef)} onMouseMove={onDragMove}
                onMouseUp={onDragEnd} onMouseLeave={onDragEnd}>
                <table className="text-sm" style={{ minWidth: '100%', tableLayout: 'auto' }}>
                  <thead>
                    <tr style={{ background: '#020617', borderBottom: '1px solid #1e293b' }}>
                      {['ID', 'Fecha', 'Solicitante', 'Área', 'Destinatario', 'Dirección', 'Descripción', 'Urgencia', 'Estado', 'Lo realizado / Gestor'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: '#64748b' }}>{h}</th>
                      ))}
                    </tr>
                    {/* Fila de filtros */}
                    <tr style={{ background: '#0f0620', borderBottom: '2px solid #1e293b' }}>
                      <td className="px-2 py-1.5">
                        <input style={FILTER_INPUT} placeholder="#" value={fm.id}
                          onMouseDown={e => e.stopPropagation()}
                          onChange={e => setFm(f => ({ ...f, id: e.target.value }))} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input style={FILTER_INPUT} placeholder="Fecha" value={fm.fecha}
                          onMouseDown={e => e.stopPropagation()}
                          onChange={e => setFm(f => ({ ...f, fecha: e.target.value }))} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input style={FILTER_INPUT} placeholder="Nombre" value={fm.sol}
                          onMouseDown={e => e.stopPropagation()}
                          onChange={e => setFm(f => ({ ...f, sol: e.target.value }))} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input style={FILTER_INPUT} placeholder="Área" value={fm.area}
                          onMouseDown={e => e.stopPropagation()}
                          onChange={e => setFm(f => ({ ...f, area: e.target.value }))} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input style={FILTER_INPUT} placeholder="Destinatario" value={fm.dest}
                          onMouseDown={e => e.stopPropagation()}
                          onChange={e => setFm(f => ({ ...f, dest: e.target.value }))} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input style={FILTER_INPUT} placeholder="Dirección" value={fm.dir}
                          onMouseDown={e => e.stopPropagation()}
                          onChange={e => setFm(f => ({ ...f, dir: e.target.value }))} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input style={{ ...FILTER_INPUT, minWidth: 140 }} placeholder="Descripción" value={fm.desc}
                          onMouseDown={e => e.stopPropagation()}
                          onChange={e => setFm(f => ({ ...f, desc: e.target.value }))} />
                      </td>
                      <td className="px-2 py-1.5">
                        <select style={FILTER_SELECT} value={fm.urg}
                          onMouseDown={e => e.stopPropagation()}
                          onChange={e => setFm(f => ({ ...f, urg: e.target.value }))}>
                          <option value="">Todas</option>
                          <option value="Normal">Normal</option>
                          <option value="Urgente">Urgente</option>
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <select style={FILTER_SELECT} value={fm.est}
                          onMouseDown={e => e.stopPropagation()}
                          onChange={e => setFm(f => ({ ...f, est: e.target.value }))}>
                          <option value="">Todos</option>
                          <option value="Pendiente">Pendiente</option>
                          <option value="En Trámite">En Trámite</option>
                          <option value="Finalizada">Finalizada</option>
                          <option value="Rechazada">Rechazada</option>
                        </select>
                      </td>
                      <td className="px-2 py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {listaMensajeria.length === 0 ? (
                      <tr><td colSpan={10} className="text-center text-gray-600 py-10 text-sm">Sin resultados</td></tr>
                    ) : listaMensajeria.map((s, i) => {
                      const dimmed = s.estado === 'Finalizada' || s.estado === 'Rechazada'
                      return (
                        <tr key={s.id} style={{ background: i % 2 === 0 ? '#0d1117' : '#0f172a', borderBottom: '1px solid #1e293b', opacity: dimmed ? 0.65 : 1 }}>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="font-mono text-sm font-bold px-2 py-0.5 rounded" style={{ background: '#1e293b', color: '#e2e8f0' }}>#{s.numero ?? '—'}</span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-400 font-mono text-xs whitespace-nowrap">{s.fecha}</td>
                          <td className="px-3 py-2.5 text-white font-medium whitespace-nowrap">{s.solicitante_nombre}</td>
                          <td className="px-3 py-2.5 text-gray-400 text-xs whitespace-nowrap">{s.area}</td>
                          <td className="px-3 py-2.5 text-purple-300 font-medium whitespace-nowrap">{s.destinatario}</td>
                          <td className="px-3 py-2.5 text-gray-300 text-xs whitespace-nowrap">{s.direccion}</td>
                          <td className="px-3 py-2.5 text-gray-200" style={{ minWidth: 220, whiteSpace: 'normal', wordBreak: 'break-word' }}>{s.descripcion}</td>
                          <td className="px-3 py-2.5">
                            {s.urgencia === 'Urgente'
                              ? <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: '#450a0a', color: '#fca5a5' }}>URGENTE</span>
                              : <span className="text-xs text-gray-600">Normal</span>}
                          </td>
                          <td className="px-3 py-2.5"><EstadoBadge estado={s.estado} /></td>
                          <td className="px-3 py-2.5" style={{ minWidth: 160 }}>
                            {s.observacion && <span className="block text-gray-300 text-xs" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{s.observacion}</span>}
                            {s.gestionado_por && <span className="block text-gray-600 text-xs mt-0.5">{s.gestionado_por}</span>}
                            {!s.observacion && !s.gestionado_por && <span className="text-gray-700 text-xs">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
