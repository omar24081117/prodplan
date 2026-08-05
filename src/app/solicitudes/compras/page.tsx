'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingCart, ArrowLeft, Plus, Clock, CheckCircle2, XCircle, Search } from 'lucide-react'

type EstadoSolicitud = 'Pendiente' | 'Aprobada' | 'Rechazada'

type Solicitud = {
  id: string
  fecha: string
  solicitante: string
  area: string
  descripcion: string
  cantidad: string
  unidad: string
  urgencia: 'Normal' | 'Urgente'
  estado: EstadoSolicitud
  observacion?: string
}

const ESTADO_COLOR: Record<EstadoSolicitud, { bg: string; color: string; icon: React.ReactNode }> = {
  Pendiente:  { bg: '#1c1400', color: '#fbbf24', icon: <Clock size={10} /> },
  Aprobada:   { bg: '#052e16', color: '#4ade80', icon: <CheckCircle2 size={10} /> },
  Rechazada:  { bg: '#1a0505', color: '#f87171', icon: <XCircle size={10} /> },
}

// Datos de ejemplo — en producción vendrán de la base de datos
const SOLICITUDES_EJEMPLO: Solicitud[] = [
  { id: '001', fecha: '2026-08-04', solicitante: 'Juan Pérez', area: 'Producción', descripcion: 'Guantes de nitrilo talla M', cantidad: '100', unidad: 'unidades', urgencia: 'Normal', estado: 'Pendiente' },
  { id: '002', fecha: '2026-08-03', solicitante: 'María López', area: 'Almacén', descripcion: 'Cinta de embalaje transparente', cantidad: '24', unidad: 'rollos', urgencia: 'Urgente', estado: 'Aprobada', observacion: 'Aprobado por Gerencia' },
  { id: '003', fecha: '2026-08-02', solicitante: 'Carlos Ríos', area: 'Producción', descripcion: 'Bolsas plásticas 25x35', cantidad: '500', unidad: 'unidades', urgencia: 'Normal', estado: 'Rechazada', observacion: 'Stock disponible en almacén' },
]

export default function SolicitudesComprasPage() {
  const router = useRouter()
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

  const [solicitudes, setSolicitudes] = useState<Solicitud[]>(SOLICITUDES_EJEMPLO)
  const [busqueda, setBusqueda]       = useState('')
  const [modalNueva, setModalNueva]   = useState(false)
  const [filtroEstado, setFiltroEstado] = useState<EstadoSolicitud | 'Todos'>('Todos')

  const [form, setForm] = useState({
    solicitante: '', area: '', descripcion: '',
    cantidad: '', unidad: '', urgencia: 'Normal' as 'Normal' | 'Urgente',
  })

  function crearSolicitud(e: React.FormEvent) {
    e.preventDefault()
    const nueva: Solicitud = {
      id:    String(Date.now()),
      fecha: hoy,
      ...form,
      estado: 'Pendiente',
    }
    setSolicitudes(prev => [nueva, ...prev])
    setModalNueva(false)
    setForm({ solicitante: '', area: '', descripcion: '', cantidad: '', unidad: '', urgencia: 'Normal' })
  }

  const filtradas = solicitudes.filter(s => {
    const matchBusq  = s.descripcion.toLowerCase().includes(busqueda.toLowerCase()) || s.solicitante.toLowerCase().includes(busqueda.toLowerCase())
    const matchEstado = filtroEstado === 'Todos' || s.estado === filtroEstado
    return matchBusq && matchEstado
  })

  return (
    <div className="min-h-screen bg-gray-950 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <button onClick={() => router.push('/solicitudes')}
            className="text-gray-500 hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShoppingCart size={22} className="text-cyan-400" /> Solicitudes de Compra
          </h1>
          <button onClick={() => setModalNueva(true)}
            className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, #0e4f5c, #0f6674)', border: '1px solid #22b8cc' }}>
            <Plus size={14} /> Nueva Solicitud
          </button>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
            <Search size={13} className="text-gray-500" />
            <input type="text" placeholder="Buscar solicitud o solicitante..."
              value={busqueda} onChange={e => setBusqueda(e.target.value)}
              className="flex-1 bg-transparent text-white text-sm focus:outline-none" />
          </div>
          {(['Todos', 'Pendiente', 'Aprobada', 'Rechazada'] as const).map(e => (
            <button key={e} onClick={() => setFiltroEstado(e)}
              className="px-3 py-2 rounded-lg text-xs font-bold transition-all"
              style={{
                background: filtroEstado === e ? (e === 'Aprobada' ? '#052e16' : e === 'Rechazada' ? '#1a0505' : e === 'Pendiente' ? '#1c1400' : '#1f2937') : '#111827',
                color: filtroEstado === e ? (e === 'Aprobada' ? '#4ade80' : e === 'Rechazada' ? '#f87171' : e === 'Pendiente' ? '#fbbf24' : '#e5e7eb') : '#6b7280',
                border: '1px solid ' + (filtroEstado === e ? (e === 'Aprobada' ? '#166534' : e === 'Rechazada' ? '#7f1d1d' : e === 'Pendiente' ? '#854d0e' : '#374151') : '#1f2937'),
              }}>
              {e}
            </button>
          ))}
        </div>

        {/* Tabla */}
        <div className="rounded-xl overflow-hidden" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
          {filtradas.length === 0 ? (
            <p className="text-center text-gray-600 py-12 text-sm">No hay solicitudes</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#020617', borderBottom: '2px solid #1e293b' }}>
                  {['#','Fecha','Solicitante','Área','Descripción','Cant.','Urgencia','Estado'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide" style={{ color: '#64748b' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtradas.map((s, i) => {
                  const est = ESTADO_COLOR[s.estado]
                  return (
                    <tr key={s.id} style={{ background: i % 2 === 0 ? '#0d1117' : '#0f172a', borderBottom: '1px solid #1e293b' }}>
                      <td className="px-3 py-2.5 text-gray-600 font-mono text-xs">{s.id}</td>
                      <td className="px-3 py-2.5 text-gray-400 font-mono text-xs whitespace-nowrap">{s.fecha}</td>
                      <td className="px-3 py-2.5 text-white font-medium">{s.solicitante}</td>
                      <td className="px-3 py-2.5 text-gray-400">{s.area}</td>
                      <td className="px-3 py-2.5 text-gray-200 max-w-[200px]">
                        <span className="block truncate" title={s.descripcion}>{s.descripcion}</span>
                        {s.observacion && <span className="text-gray-600 text-xs block truncate">{s.observacion}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-gray-300 whitespace-nowrap">{s.cantidad} {s.unidad}</td>
                      <td className="px-3 py-2.5">
                        {s.urgencia === 'Urgente'
                          ? <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: '#450a0a', color: '#fca5a5' }}>URGENTE</span>
                          : <span className="text-xs text-gray-600">Normal</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded"
                          style={{ background: est.bg, color: est.color }}>
                          {est.icon} {s.estado}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal nueva solicitud */}
        {modalNueva && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-md rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #374151' }}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-bold text-base flex items-center gap-2">
                  <ShoppingCart size={16} className="text-cyan-400" /> Nueva Solicitud de Compra
                </h3>
                <button onClick={() => setModalNueva(false)} className="text-gray-500 hover:text-white">✕</button>
              </div>
              <form onSubmit={crearSolicitud} className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Solicitante *</label>
                    <input required value={form.solicitante} onChange={e => setForm(f => ({ ...f, solicitante: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Área *</label>
                    <input required value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500" />
                  </div>
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
                <div className="flex gap-2 mt-2">
                  <button type="button" onClick={() => setModalNueva(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white"
                    style={{ background: '#1f2937', border: '1px solid #374151' }}>
                    Cancelar
                  </button>
                  <button type="submit"
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #0e4f5c, #0f6674)' }}>
                    Enviar Solicitud
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
