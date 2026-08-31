'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Truck, ArrowLeft, Upload, Plus, X, Trash2, Search,
  Loader2, CheckCircle2, Clock, AlertTriangle, LogOut, User, Package
} from 'lucide-react'
import * as XLSX from 'xlsx'

/* ─────────────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────────── */
type Despacho = {
  id: string
  linea: string | null
  tipo_envio: 'Normal' | 'Premium' | null
  cliente: string
  oc: string | null
  documento: string | null
  fecha_subida: string | null
  fecha_max_entrega: string | null
  fecha_despacho: string | null
  factura: string | null
  entrega_tipo: string | null
  guia: string | null
  proveedor_despacho: string | null
  observaciones: string | null
  alistado_por: string | null
  fecha_alistamiento: string | null
  created_at: string
}

type Estado = 'DESPACHADO' | 'VENCIDO' | 'PENDIENTE'

type PickingItem = {
  id: string
  referencia: string | null
  ean13: string | null
  descripcion: string | null
  cantidad: number
  usuario_nombre: string | null
  created_at: string
}

/* ─────────────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────────────── */
function excelSerialToIso(serial: number | string | null | undefined): string | null {
  if (serial == null || serial === '') return null
  const n = typeof serial === 'string' ? parseFloat(serial) : serial
  if (isNaN(n)) return null
  return new Date((n - 25569) * 86400 * 1000).toISOString().split('T')[0]
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const hoyBogota = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

function getEstado(d: Despacho): Estado {
  if (d.fecha_despacho && d.entrega_tipo !== 'PARCIAL') return 'DESPACHADO'
  const today = hoyBogota()
  if (d.fecha_max_entrega && d.fecha_max_entrega < today) return 'VENCIDO'
  return 'PENDIENTE'
}

const LINEAS = ['Retail', 'Institucional', 'Hoteles', 'Maquila', 'Web o Plataforma'] as const

const LINEA_BADGE: Record<string, { bg: string; color: string }> = {
  'Retail':          { bg: 'rgba(30,80,180,0.3)',   color: '#60a5fa' },
  'Institucional':   { bg: 'rgba(20,120,80,0.3)',   color: '#34d399' },
  'Hoteles':         { bg: 'rgba(180,80,20,0.3)',   color: '#fb923c' },
  'Maquila':         { bg: 'rgba(100,30,180,0.3)',  color: '#c084fc' },
  'Web o Plataforma':{ bg: 'rgba(20,100,160,0.3)',  color: '#38bdf8' },
}

function lineaBadge(linea: string | null) {
  if (!linea) return { bg: 'rgba(75,85,99,0.3)', color: '#9ca3af', text: '—' }
  const badge = LINEA_BADGE[linea] ?? { bg: 'rgba(75,85,99,0.3)', color: '#9ca3af' }
  return { ...badge, text: linea }
}

/* ─────────────────────────────────────────────────────────────────────────
   KPI Card
───────────────────────────────────────────────────────────────────────── */
function KpiCard({
  label, value, color, icon
}: { label: string; value: number | string; color: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4 flex items-center gap-3"
      style={{ background: '#0f2035', border: '1px solid #1a4060' }}>
      <div className="p-2 rounded-lg" style={{ background: `${color}22` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-bold" style={{ color }}>{value}</p>
        <p className="text-xs text-gray-400 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   Inline editable cell
───────────────────────────────────────────────────────────────────────── */
function EditCell({
  value, onSave, type = 'text', placeholder = '—', options, className = '', disabled = false
}: {
  value: string | null
  onSave: (val: string | null) => Promise<void>
  type?: 'text' | 'date' | 'select' | 'textarea'
  placeholder?: string
  options?: string[]
  className?: string
  disabled?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLInputElement & HTMLSelectElement & HTMLTextAreaElement>(null)

  useEffect(() => { setDraft(value ?? '') }, [value])
  useEffect(() => { if (editing) ref.current?.focus() }, [editing])

  async function commit() {
    const v = draft.trim() === '' ? null : draft.trim()
    if (v === (value ?? null)) { setEditing(false); return }
    setSaving(true)
    await onSave(v)
    setSaving(false)
    setEditing(false)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && type !== 'textarea') commit()
    if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false) }
  }

  if (saving) return (
    <span className="flex items-center gap-1 text-blue-400 text-xs">
      <Loader2 size={11} className="animate-spin" /> guardando
    </span>
  )

  if (!editing) {
    const display = type === 'date' ? fmtDate(value) : (value || placeholder)
    return (
      <span
        onClick={() => { if (!disabled) setEditing(true) }}
        title={disabled ? undefined : 'Clic para editar'}
        className={`transition-colors ${disabled ? 'cursor-default' : 'cursor-pointer hover:text-blue-300'} ${!value ? 'text-gray-600' : 'text-gray-200'} ${className}`}
      >
        {display}
      </span>
    )
  }

  const base = 'bg-gray-900 border border-blue-500 text-white rounded text-xs px-1 py-0.5 focus:outline-none'

  if (type === 'select' && options) return (
    <select
      ref={ref as React.RefObject<HTMLSelectElement>}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      className={`${base} ${className}`}
    >
      <option value="">— seleccionar —</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )

  if (type === 'textarea') return (
    <textarea
      ref={ref as React.RefObject<HTMLTextAreaElement>}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={handleKey}
      rows={2}
      className={`${base} w-full resize-none ${className}`}
    />
  )

  return (
    <input
      ref={ref as React.RefObject<HTMLInputElement>}
      type={type}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={handleKey}
      className={`${base} ${className}`}
    />
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   Chart: Despachados por día
───────────────────────────────────────────────────────────────────────── */
function BarChartDia({ days, byDay }: { days: string[]; byDay: Record<string, number> }) {
  const [hov, setHov] = useState<{ idx: number; cx: number; cy: number } | null>(null)
  const CW = 700, CH = 200, ML = 40, MR = 12, MT = 24, MB = 36
  const PW = CW - ML - MR, PH = CH - MT - MB
  const maxVal   = Math.max(...days.map(d => byDay[d] ?? 0), 1)
  // Cap bar width so a single bar never fills the whole chart
  const rawGap   = PW / Math.max(days.length, 1)
  const barW     = Math.min(36, Math.max(3, rawGap - 3))
  const gap      = days.length === 1 ? PW : rawGap   // center single bar
  const every    = days.length <= 14 ? 1 : days.length <= 31 ? 3 : days.length <= 62 ? 7 : 14
  const gridVs   = [0.25, 0.5, 0.75, 1].map(f => Math.ceil(f * maxVal))
  return (
    <div className="relative select-none">
      <svg width="100%" viewBox={`0 0 ${CW} ${CH}`} style={{ overflow: 'visible' }}>
        {/* Grid */}
        {gridVs.map(v => { const y = MT + PH - (v / maxVal) * PH; return (
          <g key={v}>
            <line x1={ML} y1={y} x2={CW - MR} y2={y} stroke="#e2e8f0" strokeWidth="1" />
            <text x={ML - 5} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="10">{v}</text>
          </g>
        )})}
        {/* Bars */}
        {days.map((day, i) => {
          const val = byDay[day] ?? 0
          const x   = days.length === 1
            ? ML + (PW - barW) / 2
            : ML + i * gap + (gap - barW) / 2
          const bh  = val === 0 ? 2 : Math.max(4, (val / maxVal) * PH)
          const y   = MT + PH - bh
          const isH = hov?.idx === i
          return (
            <g key={day}
              onMouseEnter={e => setHov({ idx: i, cx: e.clientX, cy: e.clientY })}
              onMouseLeave={() => setHov(null)}>
              <rect x={x} y={y} width={barW} height={bh} rx={Math.min(4, barW / 2)}
                fill={isH ? '#16a34a' : '#22c55e'} opacity={val === 0 ? 0.15 : 1}
                style={{ cursor: val > 0 ? 'pointer' : 'default', transition: 'fill 0.1s' }} />
              {/* Value above bar */}
              {val > 0 && (
                <text x={x + barW / 2} y={y - 4} textAnchor="middle" fill="#15803d" fontSize="11" fontWeight="700">{val}</text>
              )}
            </g>
          )
        })}
        {/* X-axis labels */}
        {days.map((day, i) => {
          if (i % every !== 0 && days.length !== 1) return null
          const x = days.length === 1
            ? ML + PW / 2
            : ML + i * gap + gap / 2
          const [, m, d] = day.split('-')
          return <text key={day} x={x} y={CH - 4} textAnchor="middle" fill="#64748b" fontSize="10">{`${d}/${m}`}</text>
        })}
        {/* Axes */}
        <line x1={ML} y1={MT} x2={ML} y2={MT + PH} stroke="#e2e8f0" strokeWidth="1" />
        <line x1={ML} y1={MT + PH} x2={CW - MR} y2={MT + PH} stroke="#e2e8f0" strokeWidth="1" />
      </svg>
      {hov !== null && (() => {
        const day = days[hov.idx]; const val = byDay[day] ?? 0
        const [yr, m, d] = day.split('-')
        return (
          <div className="fixed z-50 pointer-events-none rounded-lg px-3 py-2 text-xs shadow-lg"
            style={{ left: hov.cx + 14, top: hov.cy - 8, transform: 'translateY(-100%)',
              background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', minWidth: 130 }}>
            <p className="font-bold text-green-400 mb-0.5">{val} despacho{val !== 1 ? 's' : ''}</p>
            <p className="text-slate-400">{d}/{m}/{yr}</p>
          </div>
        )
      })()}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   Chart: Pedidos por cliente (horizontal stacked bars)
───────────────────────────────────────────────────────────────────────── */
type ClientRow = { cliente: string; total: number; despachado: number; pendiente: number; vencido: number }
function ClienteBarChart({ data }: { data: ClientRow[] }) {
  const [hov, setHov] = useState<{ i: number; cx: number; cy: number } | null>(null)
  const CW = 700, PL = 155, PR = 36, PT = 6, rowH = 22
  const CH = PT + data.length * rowH + 8
  const barAreaW = CW - PL - PR
  const maxTotal = Math.max(...data.map(r => r.total), 1)
  return (
    <div className="relative select-none">
      <div className="flex gap-4 mb-2 text-xs">
        {([['#16a34a','Despachado'],['#dc2626','Vencido'],['#ca8a04','Pendiente']] as [string,string][]).map(([c,l]) => (
          <div key={l} className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm" style={{ background: c }} />
            <span className="text-slate-500">{l}</span>
          </div>
        ))}
      </div>
      <svg width="100%" viewBox={`0 0 ${CW} ${CH}`} style={{ overflow: 'visible' }}>
        {data.map((row, i) => {
          const y   = PT + i * rowH
          const tot = (row.total / maxTotal) * barAreaW
          const dW  = row.total > 0 ? (row.despachado / row.total) * tot : 0
          const vW  = row.total > 0 ? (row.vencido / row.total) * tot : 0
          const pW  = row.total > 0 ? (row.pendiente / row.total) * tot : 0
          const isH = hov?.i === i
          const lbl = row.cliente.length > 22 ? row.cliente.slice(0, 22) + '…' : row.cliente
          return (
            <g key={row.cliente}
              onMouseEnter={e => setHov({ i, cx: e.clientX, cy: e.clientY })}
              onMouseLeave={() => setHov(null)} style={{ cursor: 'pointer' }}>
              <rect x={0} y={y} width={CW} height={rowH - 2} fill={isH ? '#f1f5f9' : 'transparent'} rx={3} />
              <text x={PL - 6} y={y + rowH / 2 + 3.5} textAnchor="end" fontSize="10"
                fill={isH ? '#1e293b' : '#64748b'}>{lbl}</text>
              {dW > 0 && <rect x={PL} y={y + 4} width={dW} height={rowH - 10} rx={3} fill="#16a34a" />}
              {vW > 0 && <rect x={PL + dW} y={y + 4} width={vW} height={rowH - 10}
                rx={dW === 0 ? 3 : 0} fill="#dc2626" />}
              {pW > 0 && <rect x={PL + dW + vW} y={y + 4} width={pW} height={rowH - 10}
                rx={dW === 0 && vW === 0 ? 3 : 0} fill="#ca8a04" />}
              <text x={PL + tot + 5} y={y + rowH / 2 + 3.5} fontSize="10" fill="#94a3b8">{row.total}</text>
            </g>
          )
        })}
      </svg>
      {hov !== null && (() => {
        const r = data[hov.i]
        return (
          <div className="fixed z-50 pointer-events-none rounded-lg px-3 py-2 text-xs shadow-lg"
            style={{ left: hov.cx + 14, top: hov.cy - 8, transform: 'translateY(-100%)',
              background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', minWidth: 165 }}>
            <p className="font-bold text-white mb-1.5 leading-tight">{r.cliente}</p>
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between gap-4"><span className="text-green-400">Despachado</span><span className="font-semibold">{r.despachado}</span></div>
              <div className="flex justify-between gap-4"><span className="text-red-400">Vencido</span><span className="font-semibold">{r.vencido}</span></div>
              <div className="flex justify-between gap-4"><span className="text-yellow-300">Pendiente</span><span className="font-semibold">{r.pendiente}</span></div>
              <div className="flex justify-between gap-4 border-t mt-1 pt-1" style={{ borderColor: '#334155' }}>
                <span className="text-slate-400">Total</span><span className="font-bold">{r.total}</span>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   Page
───────────────────────────────────────────────────────────────────────── */
type Sesion = { cedula: string; nombre: string; rol: string }

/* ── Botón Drive con estado ── */
function DriveIconBtn({ doc }: { doc: string }) {
  const [estado, setEstado] = React.useState<'idle' | 'loading' | 'no_encontrado'>('idle')

  async function abrir() {
    setEstado('loading')
    try {
      const res  = await fetch(`/api/picking/drive-link?doc=${encodeURIComponent(doc)}`)
      const data = await res.json()
      if (data?.tipo === 'archivo') {
        window.open(data.url, '_blank')
        setEstado('idle')
      } else {
        setEstado('no_encontrado')
        setTimeout(() => setEstado('idle'), 3000)
      }
    } catch {
      setEstado('no_encontrado')
      setTimeout(() => setEstado('idle'), 3000)
    }
  }

  if (estado === 'no_encontrado') {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
        style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)', whiteSpace: 'nowrap' }}>
        Sin documento
      </span>
    )
  }

  return (
    <button title="Abrir en Drive" onClick={abrir} disabled={estado === 'loading'}
      className="flex-shrink-0 p-1 rounded transition-all hover:scale-110 disabled:opacity-50"
      style={{ color: estado === 'loading' ? '#94a3b8' : '#4285f4' }}>
      {estado === 'loading'
        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><circle cx="12" cy="12" r="10" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
        : <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z"/></svg>}
    </button>
  )
}

export default function DespachosPage() {
  const router = useRouter()

  // ── Auth state ───────────────────────────────────────────────────────────
  const [sesion, setSesion]       = useState<Sesion | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [cedula, setCedula]       = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  const [pedidos, setPedidos]     = useState<Despacho[]>([])
  const [loading, setLoading]     = useState(true)
  const [importing, setImporting] = useState(false)
  const [showForm, setShowForm]   = useState(false)
  const [deleting, setDeleting]   = useState<string | null>(null)
  const [revertId, setRevertId]   = useState<string | null>(null)

  // Filters
  const [filtroEstado, setFiltroEstado] = useState<'' | 'PENDIENTE' | 'VENCIDO' | 'DESPACHADO'>('')
  const [filtroLinea, setFiltroLinea]   = useState('')
  const [filtroEnvio, setFiltroEnvio]   = useState('')
  const [busqueda, setBusqueda]         = useState('')
  const [filtroOC, setFiltroOC]         = useState('')
  const [filtroDoc, setFiltroDoc]       = useState('')
  const [filtroCliente, setFiltroCliente]         = useState('')
  const [filtroFechaSubida, setFiltroFechaSubida] = useState('')
  const [filtroFechaMax, setFiltroFechaMax]       = useState('')
  const [filtroFechaDesp, setFiltroFechaDesp]     = useState('')
  const [filtroFactura, setFiltroFactura]         = useState('')
  const [filtroEntrega, setFiltroEntrega]         = useState('')
  const [filtroAlistado, setFiltroAlistado]       = useState('')
  const [filtroGuia, setFiltroGuia]               = useState('')
  const [filtroProveedor, setFiltroProveedor]     = useState('')

  // ── Indicadores ────────────────────────────────────────────────────────────
  const [vistaTab, setVistaTab]   = useState<'lista' | 'indicadores'>('lista')
  const [indDesde, setIndDesde]   = useState(() => {
    const t = hoyBogota()
    const d = new Date(t + 'T00:00:00'); d.setDate(d.getDate() - 29)
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  })
  const [indHasta, setIndHasta]   = useState(hoyBogota)
  const [indCliente, setIndCliente] = useState('')
  const [indLinea, setIndLinea]   = useState('')

  // Modal picking
  const [modalPicking, setModalPicking]   = useState<Despacho | null>(null)
  const [pickingItems, setPickingItems]   = useState<PickingItem[]>([])
  const [loadingPicking, setLoadingPicking] = useState(false)

  async function verPicking(despacho: Despacho) {
    setModalPicking(despacho)
    setPickingItems([])
    setLoadingPicking(true)
    try {
      const res = await fetch(`/api/picking?despacho_id=${despacho.id}`)
      if (res.ok) setPickingItems(await res.json())
    } finally {
      setLoadingPicking(false)
    }
  }

  // Add form
  const [form, setForm] = useState({
    linea: '', tipo_envio: '', cliente: '', oc: '', documento: '',
    fecha_subida: '', fecha_max_entrega: ''
  })
  const [formSaving, setFormSaving] = useState(false)
  const [formError, setFormError]   = useState('')
  const [tableError, setTableError] = useState('')

  const fileRef    = useRef<HTMLInputElement>(null)
  const tableRef   = useRef<HTMLDivElement>(null)
  const topBarRef  = useRef<HTMLDivElement>(null)
  const dragging   = useRef(false)
  const dragStartX = useRef(0)
  const dragScroll = useRef(0)
  const [tableScrollW, setTableScrollW] = useState(1800)

  // Sincronizar scrollbar superior ↔ tabla
  function onTableScroll() {
    if (topBarRef.current && tableRef.current)
      topBarRef.current.scrollLeft = tableRef.current.scrollLeft
  }
  function onTopScroll() {
    if (tableRef.current && topBarRef.current)
      tableRef.current.scrollLeft = topBarRef.current.scrollLeft
  }

  // Drag-to-scroll con mouse
  function onDragStart(e: React.MouseEvent<HTMLDivElement>) {
    const t = e.target as HTMLElement
    if (['INPUT','SELECT','TEXTAREA','BUTTON'].includes(t.tagName)) return
    dragging.current = true
    dragStartX.current = e.clientX
    dragScroll.current = tableRef.current?.scrollLeft ?? 0
    if (tableRef.current) tableRef.current.style.cursor = 'grabbing'
  }
  function onDragMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!dragging.current || !tableRef.current) return
    e.preventDefault()
    tableRef.current.scrollLeft = dragScroll.current - (e.clientX - dragStartX.current)
    if (topBarRef.current) topBarRef.current.scrollLeft = tableRef.current.scrollLeft
  }
  function onDragEnd() {
    dragging.current = false
    if (tableRef.current) tableRef.current.style.cursor = 'grab'
  }

  /* ── ResizeObserver: sync top scrollbar width ── */
  useEffect(() => {
    if (!tableRef.current) return
    const ro = new ResizeObserver(() => {
      if (tableRef.current) setTableScrollW(tableRef.current.scrollWidth)
    })
    ro.observe(tableRef.current)
    return () => ro.disconnect()
  }, [])

  /* ── Auth ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    fetch('/api/auth/despachos/sesion')
      .then(r => r.json())
      .then(d => { setSesion(d.sesion ?? null); setAuthChecked(true) })
      .catch(() => { setSesion(null); setAuthChecked(true) })
  }, [])

  async function identificarse(e: React.FormEvent) {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError('')
    const res = await fetch('/api/auth/despachos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cedula }),
    })
    const data = await res.json()
    if (!res.ok) {
      setAuthError(data.error || 'Error al identificarse')
    } else {
      setSesion({ cedula, nombre: data.nombre, rol: data.rol })
    }
    setAuthLoading(false)
  }

  async function cerrarSesion() {
    await fetch('/api/auth/despachos', { method: 'DELETE' })
    setSesion(null)
    setCedula('')
    setPedidos([])
  }

  /* ── Load ─────────────────────────────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true)
    setTableError('')
    try {
      const res = await fetch('/api/despachos')
      if (res.ok) {
        setPedidos(await res.json())
      } else {
        const err = await res.json().catch(() => ({}))
        if (err.error?.includes('does not exist') || err.error?.includes('relation')) {
          setTableError('setup')
        } else {
          setTableError(err.error || 'Error al cargar despachos')
        }
      }
    } catch {
      setTableError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (sesion) load()
  }, [sesion, load])

  /* ── Inline save ──────────────────────────────────────────────────────── */
  async function saveField(id: string, field: string, value: string | null) {
    await fetch(`/api/despachos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value })
    })
    setPedidos(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  /* ── Delete ───────────────────────────────────────────────────────────── */
  async function eliminar(id: string, cliente: string) {
    if (!confirm(`¿Eliminar pedido de ${cliente}? Esta acción no se puede deshacer.`)) return
    setDeleting(id)
    await fetch(`/api/despachos/${id}`, { method: 'DELETE' })
    setPedidos(prev => prev.filter(p => p.id !== id))
    setDeleting(null)
  }

  async function revertirPendiente(id: string) {
    await fetch(`/api/despachos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha_despacho: null, entrega_tipo: null })
    })
    setPedidos(prev => prev.map(p => p.id === id ? { ...p, fecha_despacho: null, entrega_tipo: null } : p))
    setRevertId(null)
  }

  /* ── Excel import ─────────────────────────────────────────────────────── */
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const ws = wb.Sheets['BASE PEDIDOS']
      if (!ws) { alert('No se encontró la hoja "BASE PEDIDOS"'); setImporting(false); return }

      // Read all as raw (to get serial dates)
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })

      // Row 2 (index 2) is the header
      const header = (rows[2] ?? []) as string[]
      const colIdx: Record<string, number> = {}
      header.forEach((h, i) => { if (h) colIdx[String(h).trim()] = i })

      const payload: Partial<Despacho>[] = []
      for (let r = 3; r < rows.length; r++) {
        const row = rows[r] as (string | number | null)[]
        const cliente = row[colIdx['CLIENTE']]
        if (!cliente) continue
        payload.push({
          linea:            row[colIdx['LÍNEA']] != null ? String(row[colIdx['LÍNEA']]) : null,
          cliente:          String(cliente),
          oc:               row[colIdx['OC']] != null ? String(row[colIdx['OC']]) : null,
          documento:        row[colIdx['DOCUMENTO']] != null ? String(row[colIdx['DOCUMENTO']]) : null,
          fecha_subida:     excelSerialToIso(row[colIdx['F. SUBIDA']] as number | null),
          fecha_max_entrega: excelSerialToIso(row[colIdx['F. MÁX. ENTREGA']] as number | null),
        })
      }

      if (payload.length === 0) { alert('No se encontraron filas válidas'); setImporting(false); return }

      const res = await fetch('/api/despachos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const err = await res.json()
        alert(`Error al importar: ${err.error}`)
      } else {
        await load()
        alert(`${payload.length} pedidos importados correctamente`)
      }
    } catch (err) {
      alert(`Error al procesar el archivo: ${String(err)}`)
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  /* ── Manual add ───────────────────────────────────────────────────────── */
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.cliente.trim()) { setFormError('El cliente es obligatorio'); return }
    if (!form.fecha_max_entrega) { setFormError('La fecha máx. entrega es obligatoria'); return }
    setFormSaving(true)
    setFormError('')
    const res = await fetch('/api/despachos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        linea: form.linea || null,
        tipo_envio: form.tipo_envio || null,
        cliente: form.cliente.trim(),
        oc: form.oc || null,
        documento: form.documento || null,
        fecha_subida: form.fecha_subida || null,
        fecha_max_entrega: form.fecha_max_entrega,
      })
    })
    if (!res.ok) {
      const err = await res.json()
      setFormError(err.error || 'Error al guardar')
    } else {
      const nuevo = await res.json()
      setPedidos(prev => [...prev, nuevo as Despacho].sort((a, b) =>
        (a.fecha_max_entrega ?? '').localeCompare(b.fecha_max_entrega ?? '')
      ))
      setForm({ linea: '', tipo_envio: '', cliente: '', oc: '', documento: '', fecha_subida: '', fecha_max_entrega: '' })
      setShowForm(false)
    }
    setFormSaving(false)
  }

  /* ── Permisos ────────────────────────────────────────────────────────── */
  const esDirector   = sesion?.rol === 'Director'
  const puedeEditar  = ['Director','Almacenista'].includes(sesion?.rol ?? '')
  const puedeAgregar = ['Director','Comercial','Almacenista','Gerencia'].includes(sesion?.rol ?? '')

  /* ── Filter & KPIs ────────────────────────────────────────────────────── */
  const today = hoyBogota()

  const total       = pedidos.length
  const despachados = pedidos.filter(p => p.fecha_despacho).length
  const vencidos    = pedidos.filter(p => !p.fecha_despacho && p.fecha_max_entrega && p.fecha_max_entrega < today).length
  const pendientes  = total - despachados - vencidos
  const alistados   = pedidos.filter(p => p.alistado_por && !p.fecha_despacho).length
  const pctCumpl    = total > 0 ? Math.round((despachados / total) * 100) : 0

  const lineas = Array.from(new Set(pedidos.map(p => p.linea).filter(Boolean))) as string[]

  const estadoOrder: Record<string, number> = { VENCIDO: 0, PENDIENTE: 1, DESPACHADO: 2 }

  const filtrados = pedidos
    .filter(p => {
      const estado = getEstado(p)
      if (filtroEstado && estado !== filtroEstado) return false
      if (filtroLinea && p.linea !== filtroLinea) return false
      if (filtroEnvio && p.tipo_envio !== filtroEnvio) return false
      if (filtroOC && !(p.oc ?? '').toLowerCase().includes(filtroOC.toLowerCase())) return false
      if (filtroDoc && !(p.documento ?? '').toLowerCase().includes(filtroDoc.toLowerCase())) return false
      if (filtroCliente && !p.cliente.toLowerCase().includes(filtroCliente.toLowerCase())) return false
      if (filtroFechaSubida && !fmtDate(p.fecha_subida).toLowerCase().includes(filtroFechaSubida.toLowerCase())) return false
      if (filtroFechaMax && !fmtDate(p.fecha_max_entrega).toLowerCase().includes(filtroFechaMax.toLowerCase())) return false
      if (filtroFechaDesp && !fmtDate(p.fecha_despacho).toLowerCase().includes(filtroFechaDesp.toLowerCase())) return false
      if (filtroFactura && !(p.factura ?? '').toLowerCase().includes(filtroFactura.toLowerCase())) return false
      if (filtroEntrega && p.entrega_tipo !== filtroEntrega) return false
      if (filtroAlistado && !(p.alistado_por ?? '').toLowerCase().includes(filtroAlistado.toLowerCase())) return false
      if (filtroGuia && !(p.guia ?? '').toLowerCase().includes(filtroGuia.toLowerCase())) return false
      if (filtroProveedor && !(p.proveedor_despacho ?? '').toLowerCase().includes(filtroProveedor.toLowerCase())) return false
      if (busqueda) {
        const q = busqueda.toLowerCase()
        const match = p.cliente.toLowerCase().includes(q) ||
          (p.oc ?? '').toLowerCase().includes(q) ||
          (p.documento ?? '').toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    })
    .sort((a, b) => {
      const eA = getEstado(a), eB = getEstado(b)
      const oA = estadoOrder[eA] ?? 99, oB = estadoOrder[eB] ?? 99
      if (oA !== oB) return oA - oB
      return (a.fecha_max_entrega ?? '').localeCompare(b.fecha_max_entrega ?? '')
    })

  /* ── Indicadores computations ──────────────────────────────────────────── */
  const despachEnRango = useMemo(() =>
    pedidos.filter(p =>
      p.fecha_despacho && p.fecha_despacho >= indDesde && p.fecha_despacho <= indHasta &&
      (!indCliente || p.cliente.toLowerCase().includes(indCliente.toLowerCase())) &&
      (!indLinea || p.linea === indLinea)
    ), [pedidos, indDesde, indHasta, indCliente, indLinea])

  const pedidosEnRango = useMemo(() =>
    pedidos.filter(p => {
      const ref = p.fecha_subida || p.fecha_max_entrega
      if (!ref || ref < indDesde || ref > indHasta) return false
      if (indCliente && !p.cliente.toLowerCase().includes(indCliente.toLowerCase())) return false
      if (indLinea && p.linea !== indLinea) return false
      return true
    }), [pedidos, indDesde, indHasta, indCliente, indLinea])

  const despachByDay = useMemo(() => {
    const map: Record<string, number> = {}
    despachEnRango.forEach(p => { if (p.fecha_despacho) map[p.fecha_despacho] = (map[p.fecha_despacho] ?? 0) + 1 })
    return map
  }, [despachEnRango])

  const daysInRange = useMemo(() => {
    const days: string[] = []
    if (!indDesde || !indHasta || indDesde > indHasta) return days
    const cur = new Date(indDesde + 'T00:00:00'), end = new Date(indHasta + 'T00:00:00')
    while (cur <= end) {
      days.push(`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`)
      cur.setDate(cur.getDate() + 1)
    }
    return days
  }, [indDesde, indHasta])

  const porCliente: ClientRow[] = useMemo(() => {
    const map: Record<string, ClientRow> = {}
    pedidosEnRango.forEach(p => {
      const est = getEstado(p)
      if (!map[p.cliente]) map[p.cliente] = { cliente: p.cliente, total: 0, despachado: 0, pendiente: 0, vencido: 0 }
      map[p.cliente].total++
      if (est === 'DESPACHADO') map[p.cliente].despachado++
      else if (est === 'VENCIDO') map[p.cliente].vencido++
      else map[p.cliente].pendiente++
    })
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 15)
  }, [pedidosEnRango])

  const indTotal       = pedidosEnRango.length
  const indDespachados = pedidosEnRango.filter(p => p.fecha_despacho).length
  const indVencidos    = pedidosEnRango.filter(p => !p.fecha_despacho && p.fecha_max_entrega && p.fecha_max_entrega < today).length
  const indPendientes  = indTotal - indDespachados - indVencidos
  const indPct         = indTotal > 0 ? Math.round((indDespachados / indTotal) * 100) : 0

  /* ── Render ───────────────────────────────────────────────────────────── */

  // Verificando sesión
  if (!authChecked) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: '#0d1a2a' }}>
        <Loader2 size={32} className="animate-spin text-blue-400" />
      </main>
    )
  }

  // Sin sesión → pantalla de identificación
  if (!sesion) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4"
        style={{ background: '#0d1a2a', color: '#e2e8f0' }}>
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="p-4 rounded-2xl" style={{ background: '#0f2035', border: '1px solid #1a4060' }}>
              <Truck size={36} strokeWidth={1.5} className="text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Control de Despachos</h1>
            <p className="text-sm text-gray-500 text-center">Ingresa tu cédula para acceder</p>
          </div>

          <form onSubmit={identificarse} className="flex flex-col gap-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">Cédula</label>
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                required
                value={cedula}
                onChange={e => setCedula(e.target.value)}
                placeholder="Número de cédula"
                className="w-full text-white text-lg font-mono rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ background: '#0f2035', border: '1px solid #1a4060' }}
              />
            </div>

            {authError && (
              <div className="rounded-lg px-4 py-3 text-sm text-red-300"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading || !cedula.trim()}
              className="w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: '#1a4060', border: '1px solid #3a7abf' }}
            >
              {authLoading ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Ingresar'}
            </button>
          </form>

          {/* Botón Alistamiento */}
          <button
            onClick={() => router.push('/despachos/alistamiento')}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all mt-2 hover:brightness-110"
            style={{ background: 'rgba(146,64,14,0.2)', border: '1px solid rgba(180,83,9,0.5)', color: '#fb923c' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"/>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
            Alistamiento de Pedidos
          </button>

          <p className="text-center text-xs text-gray-600 mt-4">
            Roles con acceso: Director · Gerencia · Analista · Comercial · Almacenista
          </p>

          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1.5 text-gray-600 hover:text-gray-400 text-sm mx-auto mt-6 transition-colors"
          >
            <ArrowLeft size={14} /> Volver al inicio
          </button>
        </div>
      </main>
    )
  }

  if (tableError === 'setup') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: '#0d1a2a', color: '#e2e8f0' }}>
        <div className="max-w-xl w-full">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => router.push('/')} className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800">
              <ArrowLeft size={20} />
            </button>
            <Truck size={22} className="text-blue-400" />
            <h1 className="text-xl font-bold">Control de Despachos</h1>
          </div>
          <div className="rounded-xl p-5 mb-4" style={{ background: '#1a0f0f', border: '1px solid #7f1d1d' }}>
            <p className="text-red-400 font-semibold mb-2">⚠ La tabla de despachos aún no existe en la base de datos</p>
            <p className="text-gray-400 text-sm mb-4">
              Ve a <strong className="text-white">Supabase → SQL Editor → New query</strong> y ejecuta el siguiente SQL:
            </p>
            <pre className="text-xs text-green-300 bg-black/50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{`create table if not exists public.despachos (
  id uuid primary key default gen_random_uuid(),
  linea text,
  cliente text not null,
  oc text,
  documento text,
  fecha_subida date,
  fecha_max_entrega date,
  fecha_despacho date,
  factura text,
  entrega_tipo text check (entrega_tipo in ('PARCIAL', 'COMPLETA')),
  guia text,
  proveedor_despacho text,
  observaciones text,
  created_at timestamptz not null default now()
);
alter table public.despachos enable row level security;
create policy "despachos_all" on public.despachos
  for all using (true) with check (true);

alter table public.personal
  add column if not exists rol text default 'Operario';
update public.personal set rol = 'Operario' where rol is null;`}</pre>
          </div>
          <button onClick={() => load()} className="text-sm px-4 py-2 rounded-lg"
            style={{ background: '#1a4060', border: '1px solid #3a7abf', color: '#60a0df' }}>
            Reintentar
          </button>
        </div>
      </main>
    )
  }

  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ background: '#0d1a2a', color: '#e2e8f0' }}
    >
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3"
        style={{ borderBottom: '1px solid #1a4060' }}>
        <button
          onClick={() => router.push('/')}
          className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <Truck size={22} strokeWidth={1.5} className="text-blue-400" />
          <h1 className="text-xl font-bold text-white tracking-wide">Control de Despachos</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Usuario activo */}
          {sesion && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ background: '#0f2035', border: '1px solid #1a4060' }}>
              <User size={13} className="text-blue-400" />
              <span className="text-xs text-gray-300">{sesion.nombre}</span>
              <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                style={{ background: '#1a4060', color: '#60a0df' }}>
                {sesion.rol}
              </span>
            </div>
          )}
          <button
            onClick={cerrarSesion}
            title="Cerrar sesión"
            className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {/* Import Excel */}
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFile}
          />
          {esDirector && (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              style={{ background: '#1a4060', border: '1px solid #3a7abf', color: '#60a0df' }}
            >
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {importing ? 'Importando…' : 'Importar Excel'}
            </button>
          )}
          {puedeAgregar && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: '#0f3020', border: '1px solid #2a7040', color: '#4ade80' }}
            >
              <Plus size={14} />
              Agregar
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 px-4 py-4 flex flex-col gap-4">

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <KpiCard label="Total pedidos" value={total} color="#60a0df"
            icon={<Truck size={18} />} />
          <KpiCard label="Despachados" value={despachados} color="#4ade80"
            icon={<CheckCircle2 size={18} />} />
          <KpiCard label="Alistados" value={alistados} color="#fb923c"
            icon={<CheckCircle2 size={18} />} />
          <KpiCard label="Pendientes" value={pendientes} color="#facc15"
            icon={<Clock size={18} />} />
          <KpiCard label="Vencidos" value={vencidos} color="#f87171"
            icon={<AlertTriangle size={18} />} />
        </div>

        {/* % Cumplimiento */}
        {total > 0 && (
          <div className="rounded-xl px-4 py-3 flex items-center gap-3"
            style={{ background: '#0f2035', border: '1px solid #1a4060' }}>
            <span className="text-sm text-gray-400 whitespace-nowrap">% Cumplimiento</span>
            <div className="flex-1 h-2 rounded-full" style={{ background: '#1a3050' }}>
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  width: `${pctCumpl}%`,
                  background: pctCumpl >= 80 ? '#4ade80' : pctCumpl >= 50 ? '#facc15' : '#f87171'
                }}
              />
            </div>
            <span className="text-sm font-bold"
              style={{ color: pctCumpl >= 80 ? '#4ade80' : pctCumpl >= 50 ? '#facc15' : '#f87171' }}>
              {pctCumpl}%
            </span>
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex" style={{ borderBottom: '1px solid #1a4060' }}>
          {(['lista', 'indicadores'] as const).map(t => (
            <button key={t} onClick={() => setVistaTab(t)}
              className="px-5 py-2.5 text-sm font-medium transition-all"
              style={{
                color: vistaTab === t ? '#60a0df' : '#4a6a8a',
                borderBottom: vistaTab === t ? '2px solid #60a0df' : '2px solid transparent',
                marginBottom: '-1px',
                background: 'transparent',
              }}>
              {t === 'lista' ? '📋 Lista de Pedidos' : '📊 Indicadores'}
            </button>
          ))}
        </div>

        {vistaTab === 'lista' && <>
        {/* ── Filters ── */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Estado chips */}
          {(['', 'PENDIENTE', 'VENCIDO', 'DESPACHADO'] as const).map(e => {
            const labels: Record<string, string> = { '': 'Todos', PENDIENTE: 'Pendientes', VENCIDO: 'Vencidos', DESPACHADO: 'Despachados' }
            const colors: Record<string, string> = { '': '#60a0df', PENDIENTE: '#facc15', VENCIDO: '#f87171', DESPACHADO: '#4ade80' }
            const active = filtroEstado === e
            return (
              <button key={e} onClick={() => setFiltroEstado(e)}
                className="text-xs px-3 py-1.5 rounded-full font-medium transition-all"
                style={{
                  background: active ? `${colors[e]}22` : '#0f2035',
                  border: `1px solid ${active ? colors[e] : '#1a4060'}`,
                  color: active ? colors[e] : '#6b8aab'
                }}>
                {labels[e]}
              </button>
            )
          })}

          {/* Línea filter */}
          <select
            value={filtroLinea}
            onChange={e => setFiltroLinea(e.target.value)}
            className="text-xs px-2 py-1.5 rounded-lg focus:outline-none cursor-pointer"
            style={{ background: '#0f2035', border: '1px solid #1a4060', color: '#9ca3af' }}
          >
            <option value="">Todas las líneas</option>
            {LINEAS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>

          {/* Tipo de envío filter */}
          <div className="flex gap-1.5">
            {[['','Todos'],['Normal','Normal'],['Premium','⭐ Premium']].map(([v,l]) => (
              <button key={v} onClick={() => setFiltroEnvio(v)}
                className="text-xs px-3 py-1.5 rounded-full font-medium transition-all"
                style={{
                  background: filtroEnvio === v ? (v === 'Premium' ? 'rgba(234,179,8,0.2)' : v === 'Normal' ? 'rgba(96,165,250,0.2)' : 'rgba(96,160,223,0.2)') : '#0f2035',
                  border: `1px solid ${filtroEnvio === v ? (v === 'Premium' ? '#ca8a04' : v === 'Normal' ? '#3b82f6' : '#1a4060') : '#1a4060'}`,
                  color: filtroEnvio === v ? (v === 'Premium' ? '#fde047' : v === 'Normal' ? '#93c5fd' : '#60a0df') : '#6b8aab'
                }}>{l}</button>
            ))}
          </div>

          {/* OC filter */}
          <div className="flex items-center gap-1.5 rounded-lg px-2 py-1.5"
            style={{ background: '#0f2035', border: '1px solid #1a4060' }}>
            <Search size={12} className="text-gray-500" />
            <input
              type="text"
              placeholder="Filtrar OC…"
              value={filtroOC}
              onChange={e => setFiltroOC(e.target.value)}
              className="bg-transparent text-xs text-gray-200 placeholder-gray-600 focus:outline-none w-28"
            />
            {filtroOC && (
              <button onClick={() => setFiltroOC('')} className="text-gray-600 hover:text-gray-400">
                <X size={11} />
              </button>
            )}
          </div>

          {/* DOC filter */}
          <div className="flex items-center gap-1.5 rounded-lg px-2 py-1.5"
            style={{ background: '#0f2035', border: '1px solid #1a4060' }}>
            <Search size={12} className="text-gray-500" />
            <input
              type="text"
              placeholder="Filtrar DOC…"
              value={filtroDoc}
              onChange={e => setFiltroDoc(e.target.value)}
              className="bg-transparent text-xs text-gray-200 placeholder-gray-600 focus:outline-none w-28"
            />
            {filtroDoc && (
              <button onClick={() => setFiltroDoc('')} className="text-gray-600 hover:text-gray-400">
                <X size={11} />
              </button>
            )}
          </div>

          {/* Search cliente */}
          <div className="flex items-center gap-1.5 ml-auto rounded-lg px-2 py-1.5"
            style={{ background: '#0f2035', border: '1px solid #1a4060' }}>
            <Search size={13} className="text-gray-500" />
            <input
              type="text"
              placeholder="Buscar cliente…"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="bg-transparent text-xs text-gray-200 placeholder-gray-600 focus:outline-none w-36"
            />
            {busqueda && (
              <button onClick={() => setBusqueda('')} className="text-gray-600 hover:text-gray-400">
                <X size={11} />
              </button>
            )}
          </div>

          {/* Limpiar todos los filtros */}
          {(filtroEstado || filtroLinea || filtroEnvio || filtroOC || filtroDoc || busqueda ||
            filtroCliente || filtroFechaSubida || filtroFechaMax || filtroFechaDesp ||
            filtroFactura || filtroEntrega || filtroAlistado || filtroGuia || filtroProveedor) && (
            <button
              onClick={() => {
                setFiltroEstado(''); setFiltroLinea(''); setFiltroEnvio('')
                setFiltroOC(''); setFiltroDoc(''); setBusqueda('')
                setFiltroCliente(''); setFiltroFechaSubida(''); setFiltroFechaMax(''); setFiltroFechaDesp('')
                setFiltroFactura(''); setFiltroEntrega(''); setFiltroAlistado(''); setFiltroGuia(''); setFiltroProveedor('')
              }}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors hover:brightness-125"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
              <X size={11} /> Limpiar filtros
            </button>
          )}
        </div>

        {/* ── Table ── */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={32} className="animate-spin text-blue-400" />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-600 py-16">
            <Truck size={40} strokeWidth={1} />
            <p className="text-sm">{pedidos.length === 0 ? 'No hay pedidos. Importa un Excel o agrega uno manualmente.' : 'Sin resultados para los filtros aplicados.'}</p>
          </div>
        ) : (
          <div className="flex flex-col">
          {/* Scrollbar superior sincronizado */}
          <div ref={topBarRef} className="tabla-scroll overflow-x-scroll rounded-t-xl"
            style={{ height: '14px', background: '#0a1525', borderTop: '1px solid #1a4060', borderLeft: '1px solid #1a4060', borderRight: '1px solid #1a4060' }}
            onScroll={onTopScroll}>
            <div style={{ width: tableScrollW, height: '1px' }} />
          </div>

          {/* Tabla — arrastrable con mouse */}
          <div ref={tableRef}
            className="tabla-scroll overflow-x-scroll rounded-b-xl select-none"
            style={{ border: '1px solid #1a4060', borderTop: 'none', cursor: 'grab' }}
            onScroll={onTableScroll}
            onMouseDown={onDragStart}
            onMouseMove={onDragMove}
            onMouseUp={onDragEnd}
            onMouseLeave={onDragEnd}>
            <table className="w-full text-xs min-w-[1200px]">
              <thead>
                <tr style={{ background: '#0a1828', borderBottom: '1px solid #132030' }}>
                  {['ESTADO','LÍNEA','TIPO ENVÍO','CLIENTE','OC','DOC','F. SUBIDA','F. MÁX.','F. DESPACHO','FACTURA','ENTREGA','ALISTADO POR','GUÍA','PROVEEDOR','OBSERVACIONES',''].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
                {/* ── Filter row ── */}
                <tr style={{ background: '#07111e', borderBottom: '1px solid #1a4060' }}>
                  {/* ESTADO */}
                  <th className="px-2 py-1.5">
                    <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as typeof filtroEstado)}
                      className="w-full text-xs rounded px-1 py-0.5 focus:outline-none cursor-pointer"
                      style={{ background: '#0d1e30', border: '1px solid #1a3050', color: filtroEstado ? '#facc15' : '#4b6a8a', minWidth: 80 }}>
                      <option value="">Todos</option>
                      <option value="VENCIDO">VENCIDO</option>
                      <option value="PENDIENTE">PENDIENTE</option>
                      <option value="DESPACHADO">DESPACHADO</option>
                    </select>
                  </th>
                  {/* LÍNEA */}
                  <th className="px-2 py-1.5">
                    <select value={filtroLinea} onChange={e => setFiltroLinea(e.target.value)}
                      className="w-full text-xs rounded px-1 py-0.5 focus:outline-none cursor-pointer"
                      style={{ background: '#0d1e30', border: '1px solid #1a3050', color: filtroLinea ? '#60a5fa' : '#4b6a8a', minWidth: 90 }}>
                      <option value="">Todas</option>
                      {LINEAS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </th>
                  {/* TIPO ENVÍO */}
                  <th className="px-2 py-1.5">
                    <select value={filtroEnvio} onChange={e => setFiltroEnvio(e.target.value)}
                      className="w-full text-xs rounded px-1 py-0.5 focus:outline-none cursor-pointer"
                      style={{ background: '#0d1e30', border: '1px solid #1a3050', color: filtroEnvio ? '#60a5fa' : '#4b6a8a', minWidth: 70 }}>
                      <option value="">Todos</option>
                      <option value="Normal">Normal</option>
                      <option value="Premium">Premium</option>
                    </select>
                  </th>
                  {/* CLIENTE */}
                  <th className="px-2 py-1.5">
                    <input type="text" value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)}
                      placeholder="Filtrar…" className="w-full text-xs rounded px-1 py-0.5 focus:outline-none"
                      style={{ background: '#0d1e30', border: `1px solid ${filtroCliente ? '#3a7abf' : '#1a3050'}`, color: '#e2e8f0', minWidth: 100 }} />
                  </th>
                  {/* OC */}
                  <th className="px-2 py-1.5">
                    <input type="text" value={filtroOC} onChange={e => setFiltroOC(e.target.value)}
                      placeholder="Filtrar…" className="w-full text-xs rounded px-1 py-0.5 focus:outline-none"
                      style={{ background: '#0d1e30', border: `1px solid ${filtroOC ? '#3a7abf' : '#1a3050'}`, color: '#e2e8f0', minWidth: 70 }} />
                  </th>
                  {/* DOC */}
                  <th className="px-2 py-1.5">
                    <input type="text" value={filtroDoc} onChange={e => setFiltroDoc(e.target.value)}
                      placeholder="Filtrar…" className="w-full text-xs rounded px-1 py-0.5 focus:outline-none"
                      style={{ background: '#0d1e30', border: `1px solid ${filtroDoc ? '#3a7abf' : '#1a3050'}`, color: '#e2e8f0', minWidth: 70 }} />
                  </th>
                  {/* F. SUBIDA */}
                  <th className="px-2 py-1.5">
                    <input type="text" value={filtroFechaSubida} onChange={e => setFiltroFechaSubida(e.target.value)}
                      placeholder="dd/mm" className="w-full text-xs rounded px-1 py-0.5 focus:outline-none"
                      style={{ background: '#0d1e30', border: `1px solid ${filtroFechaSubida ? '#3a7abf' : '#1a3050'}`, color: '#e2e8f0', minWidth: 60 }} />
                  </th>
                  {/* F. MÁX. */}
                  <th className="px-2 py-1.5">
                    <input type="text" value={filtroFechaMax} onChange={e => setFiltroFechaMax(e.target.value)}
                      placeholder="dd/mm" className="w-full text-xs rounded px-1 py-0.5 focus:outline-none"
                      style={{ background: '#0d1e30', border: `1px solid ${filtroFechaMax ? '#3a7abf' : '#1a3050'}`, color: '#e2e8f0', minWidth: 60 }} />
                  </th>
                  {/* F. DESPACHO */}
                  <th className="px-2 py-1.5">
                    <input type="text" value={filtroFechaDesp} onChange={e => setFiltroFechaDesp(e.target.value)}
                      placeholder="dd/mm" className="w-full text-xs rounded px-1 py-0.5 focus:outline-none"
                      style={{ background: '#0d1e30', border: `1px solid ${filtroFechaDesp ? '#3a7abf' : '#1a3050'}`, color: '#e2e8f0', minWidth: 60 }} />
                  </th>
                  {/* FACTURA */}
                  <th className="px-2 py-1.5">
                    <input type="text" value={filtroFactura} onChange={e => setFiltroFactura(e.target.value)}
                      placeholder="Filtrar…" className="w-full text-xs rounded px-1 py-0.5 focus:outline-none"
                      style={{ background: '#0d1e30', border: `1px solid ${filtroFactura ? '#3a7abf' : '#1a3050'}`, color: '#e2e8f0', minWidth: 70 }} />
                  </th>
                  {/* ENTREGA */}
                  <th className="px-2 py-1.5">
                    <select value={filtroEntrega} onChange={e => setFiltroEntrega(e.target.value)}
                      className="w-full text-xs rounded px-1 py-0.5 focus:outline-none cursor-pointer"
                      style={{ background: '#0d1e30', border: '1px solid #1a3050', color: filtroEntrega ? '#60a5fa' : '#4b6a8a', minWidth: 70 }}>
                      <option value="">Todos</option>
                      <option value="PARCIAL">PARCIAL</option>
                      <option value="COMPLETA">COMPLETA</option>
                    </select>
                  </th>
                  {/* ALISTADO POR */}
                  <th className="px-2 py-1.5">
                    <input type="text" value={filtroAlistado} onChange={e => setFiltroAlistado(e.target.value)}
                      placeholder="Filtrar…" className="w-full text-xs rounded px-1 py-0.5 focus:outline-none"
                      style={{ background: '#0d1e30', border: `1px solid ${filtroAlistado ? '#3a7abf' : '#1a3050'}`, color: '#e2e8f0', minWidth: 80 }} />
                  </th>
                  {/* GUÍA */}
                  <th className="px-2 py-1.5">
                    <input type="text" value={filtroGuia} onChange={e => setFiltroGuia(e.target.value)}
                      placeholder="Filtrar…" className="w-full text-xs rounded px-1 py-0.5 focus:outline-none"
                      style={{ background: '#0d1e30', border: `1px solid ${filtroGuia ? '#3a7abf' : '#1a3050'}`, color: '#e2e8f0', minWidth: 70 }} />
                  </th>
                  {/* PROVEEDOR */}
                  <th className="px-2 py-1.5">
                    <input type="text" value={filtroProveedor} onChange={e => setFiltroProveedor(e.target.value)}
                      placeholder="Filtrar…" className="w-full text-xs rounded px-1 py-0.5 focus:outline-none"
                      style={{ background: '#0d1e30', border: `1px solid ${filtroProveedor ? '#3a7abf' : '#1a3050'}`, color: '#e2e8f0', minWidth: 80 }} />
                  </th>
                  {/* OBSERVACIONES */}
                  <th className="px-2 py-1.5" colSpan={2} />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p, i) => {
                  const estado = getEstado(p)
                  const rowBg = estado === 'DESPACHADO'
                    ? 'rgba(16,60,30,0.35)'
                    : estado === 'VENCIDO'
                    ? 'rgba(80,10,10,0.35)'
                    : i % 2 === 0 ? '#0f2035' : '#0d1a2a'
                  const lb = lineaBadge(p.linea)

                  return (
                    <tr key={p.id} style={{ background: rowBg, borderBottom: '1px solid #0f1e30' }}>
                      {/* ESTADO */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                          style={{
                            background: estado === 'DESPACHADO' ? 'rgba(34,197,94,0.2)'
                              : estado === 'VENCIDO' ? 'rgba(239,68,68,0.2)'
                              : 'rgba(250,204,21,0.2)',
                            color: estado === 'DESPACHADO' ? '#4ade80'
                              : estado === 'VENCIDO' ? '#f87171'
                              : '#facc15'
                          }}>
                          {estado}
                        </span>
                      </td>

                      {/* LÍNEA — inline editable */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <EditCell
                          value={p.linea}
                          type="select"
                          options={[...LINEAS]}
                          onSave={v => saveField(p.id, 'linea', v)}
                          placeholder="—"
                          disabled={!puedeEditar}
                        />
                      </td>

                      {/* TIPO ENVÍO */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        {puedeEditar ? (
                          <EditCell
                            value={p.tipo_envio}
                            type="select"
                            options={['Normal', 'Premium']}
                            onSave={v => saveField(p.id, 'tipo_envio', v)}
                            placeholder="—"
                            disabled={false}
                          />
                        ) : p.tipo_envio ? (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={p.tipo_envio === 'Premium'
                              ? { background: 'rgba(234,179,8,0.15)', color: '#fde047', border: '1px solid rgba(202,138,4,0.4)' }
                              : { background: 'rgba(59,130,246,0.15)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.3)' }}>
                            {p.tipo_envio === 'Premium' ? '⭐ Premium' : p.tipo_envio}
                          </span>
                        ) : <span className="text-gray-600 text-xs">—</span>}
                      </td>

                      {/* CLIENTE */}
                      <td className="px-3 py-2 whitespace-nowrap max-w-[180px] truncate">
                        <EditCell
                          value={p.cliente}
                          onSave={v => saveField(p.id, 'cliente', v)}
                          placeholder="—"
                          className="font-semibold w-40"
                          disabled={!puedeEditar}
                        />
                      </td>

                      {/* OC */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <EditCell
                          value={p.oc}
                          onSave={v => saveField(p.id, 'oc', v)}
                          placeholder="—"
                          className="font-mono w-24"
                          disabled={!puedeEditar}
                        />
                      </td>

                      {/* DOC — clic abre en Drive */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <EditCell
                            value={p.documento}
                            onSave={v => saveField(p.id, 'documento', v)}
                            placeholder="—"
                            className="font-mono w-20"
                            disabled={!puedeEditar}
                          />
                          {p.documento && <DriveIconBtn doc={p.documento} />}
                        </div>
                      </td>

                      {/* F. SUBIDA */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <EditCell
                          value={p.fecha_subida}
                          type="date"
                          onSave={v => saveField(p.id, 'fecha_subida', v)}
                          disabled={!puedeEditar}
                        />
                      </td>

                      {/* F. MÁX */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <EditCell
                          value={p.fecha_max_entrega}
                          type="date"
                          onSave={v => saveField(p.id, 'fecha_max_entrega', v)}
                          className={estado === 'VENCIDO' ? 'text-red-400' : ''}
                          disabled={!puedeEditar}
                        />
                      </td>

                      {/* F. DESPACHO — editable */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <EditCell
                          value={p.fecha_despacho}
                          type="date"
                          onSave={v => saveField(p.id, 'fecha_despacho', v)}
                          disabled={!puedeEditar}
                        />
                      </td>

                      {/* FACTURA */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <EditCell
                          value={p.factura}
                          onSave={v => saveField(p.id, 'factura', v)}
                          placeholder="—"
                          className="w-24"
                          disabled={!puedeEditar}
                        />
                      </td>

                      {/* ENTREGA */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <EditCell
                          value={p.entrega_tipo}
                          type="select"
                          options={['PARCIAL', 'COMPLETA']}
                          onSave={v => saveField(p.id, 'entrega_tipo', v)}
                          disabled={!puedeEditar}
                        />
                      </td>

                      {/* ALISTADO POR */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        {p.alistado_por ? (
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => verPicking(p)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold transition-all hover:brightness-125 active:scale-95"
                              style={{
                                background: 'rgba(16,185,129,0.12)',
                                border: '1px solid rgba(16,185,129,0.35)',
                                color: '#34d399',
                                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)',
                                cursor: 'pointer',
                              }}>
                              <Package size={10} /> ✓ ALISTADO
                            </button>
                            <span className="text-orange-300 text-xs leading-tight">{p.alistado_por}</span>
                            {p.fecha_alistamiento && (
                              <span className="text-gray-500 text-xs leading-tight">{fmtDate(p.fecha_alistamiento)}</span>
                            )}
                          </div>
                        ) : <span className="text-gray-700 text-xs">—</span>}
                      </td>

                      {/* GUÍA */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <EditCell
                          value={p.guia}
                          onSave={v => saveField(p.id, 'guia', v)}
                          placeholder="—"
                          className="w-24"
                          disabled={!puedeEditar}
                        />
                      </td>

                      {/* PROVEEDOR */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <EditCell
                          value={p.proveedor_despacho}
                          onSave={v => saveField(p.id, 'proveedor_despacho', v)}
                          placeholder="—"
                          className="w-28"
                          disabled={!puedeEditar}
                        />
                      </td>

                      {/* OBSERVACIONES */}
                      <td className="px-3 py-2 max-w-[160px]">
                        <EditCell
                          value={p.observaciones}
                          type="textarea"
                          onSave={v => saveField(p.id, 'observaciones', v)}
                          placeholder="—"
                          className="w-36"
                          disabled={!puedeEditar}
                        />
                      </td>

                      {/* ACCIONES — Revertir + Eliminar */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {/* Revertir a Pendiente — solo cuando DESPACHADO y puedeEditar */}
                          {puedeEditar && estado === 'DESPACHADO' && (
                            revertId === p.id ? (
                              <div className="flex items-center gap-1 bg-orange-950/60 border border-orange-700/50 rounded px-1.5 py-0.5">
                                <span className="text-orange-300 text-xs">¿Revertir?</span>
                                <button
                                  onClick={() => revertirPendiente(p.id)}
                                  className="text-xs text-orange-200 font-semibold hover:text-white px-1"
                                >Sí</button>
                                <button
                                  onClick={() => setRevertId(null)}
                                  className="text-xs text-gray-500 hover:text-gray-300 px-0.5"
                                >✕</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setRevertId(p.id)}
                                className="p-1 rounded text-gray-600 hover:text-orange-400 hover:bg-orange-900/20 transition-colors"
                                title="Revertir a Pendiente (quita fecha de despacho)"
                              >
                                <ArrowLeft size={14} />
                              </button>
                            )
                          )}
                          {esDirector && (
                            deleting === p.id ? (
                              <Loader2 size={14} className="animate-spin text-red-400" />
                            ) : (
                              <button
                                onClick={() => eliminar(p.id, p.cliente)}
                                className="p-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                                title="Eliminar pedido"
                              >
                                <Trash2 size={14} />
                              </button>
                            )
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

        {/* Row count */}
        {!loading && filtrados.length > 0 && (
          <p className="text-xs text-gray-600 text-right">
            {filtrados.length} de {total} pedidos
          </p>
        )}
        </>}

        {/* ── Indicadores ── */}
        {vistaTab === 'indicadores' && (
          <div className="flex flex-col gap-4 rounded-xl p-4" style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}>
            {/* Filtros período */}
            <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg"
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <span className="text-xs text-slate-500 font-medium">Período:</span>
              <div className="flex items-center gap-1.5">
                <input type="date" value={indDesde} onChange={e => setIndDesde(e.target.value)}
                  className="text-xs rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#334155' }} />
                <span className="text-slate-400 text-xs">—</span>
                <input type="date" value={indHasta} onChange={e => setIndHasta(e.target.value)}
                  className="text-xs rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#334155' }} />
              </div>
              {([['7d','7d'],['30d','30d'],['90d','3m'],['ytd','Este año']] as [string,string][]).map(([k,l]) => (
                <button key={k} onClick={() => {
                  const t = hoyBogota()
                  const d = new Date(t + 'T00:00:00')
                  if (k === '7d') d.setDate(d.getDate() - 6)
                  else if (k === '30d') d.setDate(d.getDate() - 29)
                  else if (k === '90d') d.setDate(d.getDate() - 89)
                  else d.setMonth(0, 1)
                  const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
                  setIndDesde(ds); setIndHasta(t)
                }}
                  className="text-xs px-2.5 py-1 rounded-md font-medium transition-colors hover:bg-blue-50 hover:text-blue-600"
                  style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#64748b' }}>
                  {l}
                </button>
              ))}
              <div className="flex items-center gap-1.5 rounded-md px-2 py-1"
                style={{ background: '#fff', border: '1px solid #cbd5e1' }}>
                <Search size={11} className="text-slate-400" />
                <input type="text" placeholder="Cliente…" value={indCliente}
                  onChange={e => setIndCliente(e.target.value)}
                  className="bg-transparent text-xs text-slate-700 placeholder-slate-400 focus:outline-none w-24" />
                {indCliente && <button onClick={() => setIndCliente('')} className="text-slate-400 hover:text-slate-600"><X size={11} /></button>}
              </div>
              <select value={indLinea} onChange={e => setIndLinea(e.target.value)}
                className="text-xs rounded-md px-2 py-1 focus:outline-none cursor-pointer"
                style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#64748b' }}>
                <option value="">Todas las líneas</option>
                {LINEAS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            {/* KPIs del período */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {([
                { label: 'Pedidos', value: indTotal,       color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
                { label: 'Despachados', value: indDespachados, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
                { label: 'Pendientes', value: indPendientes,  color: '#ca8a04', bg: '#fffbeb', border: '#fde68a' },
                { label: 'Vencidos',   value: indVencidos,    color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
                { label: 'Cumplimiento', value: `${indPct}%`,
                  color: indPct >= 80 ? '#16a34a' : indPct >= 50 ? '#ca8a04' : '#dc2626',
                  bg: indPct >= 80 ? '#f0fdf4' : indPct >= 50 ? '#fffbeb' : '#fef2f2',
                  border: indPct >= 80 ? '#bbf7d0' : indPct >= 50 ? '#fde68a' : '#fecaca' },
              ] as {label:string;value:number|string;color:string;bg:string;border:string}[]).map(k => (
                <div key={k.label} className="rounded-lg p-3 flex flex-col"
                  style={{ background: k.bg, border: `1px solid ${k.border}` }}>
                  <span className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</span>
                  <span className="text-xs text-slate-500 mt-0.5">{k.label}</span>
                </div>
              ))}
            </div>

            {/* Barra cumplimiento */}
            {indTotal > 0 && (
              <div className="rounded-lg px-4 py-2.5 flex items-center gap-3"
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <span className="text-xs text-slate-500 whitespace-nowrap font-medium">% Cumplimiento</span>
                <div className="flex-1 h-1.5 rounded-full" style={{ background: '#e2e8f0' }}>
                  <div className="h-1.5 rounded-full transition-all" style={{
                    width: `${indPct}%`,
                    background: indPct >= 80 ? '#16a34a' : indPct >= 50 ? '#ca8a04' : '#dc2626'
                  }} />
                </div>
                <span className="text-sm font-bold"
                  style={{ color: indPct >= 80 ? '#16a34a' : indPct >= 50 ? '#ca8a04' : '#dc2626' }}>{indPct}%</span>
              </div>
            )}

            {/* Gráfica: Despachados por día */}
            <div className="rounded-lg p-4" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <h3 className="text-sm font-semibold text-slate-700 mb-0.5">Despachados por día</h3>
              <p className="text-xs text-slate-400 mb-3">
                {despachEnRango.length} despacho{despachEnRango.length !== 1 ? 's' : ''} · {daysInRange.length} día{daysInRange.length !== 1 ? 's' : ''}
              </p>
              {daysInRange.length === 0
                ? <p className="text-slate-400 text-sm text-center py-8">Selecciona un rango de fechas válido</p>
                : <BarChartDia days={daysInRange} byDay={despachByDay} />
              }
            </div>

            {/* Gráfica: Pedidos por cliente */}
            <div className="rounded-lg p-4" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <h3 className="text-sm font-semibold text-slate-700 mb-0.5">Pedidos por cliente</h3>
              <p className="text-xs text-slate-400 mb-3">
                Top {porCliente.length} clientes · barras apiladas por estado
              </p>
              {porCliente.length === 0
                ? <p className="text-slate-400 text-sm text-center py-8">Sin datos para el período seleccionado</p>
                : <ClienteBarChart data={porCliente} />
              }
            </div>
          </div>
        )}
      </div>

      {/* ── Modal picking ── */}
      {modalPicking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[80vh]"
            style={{ background: '#0f2035', border: '1px solid #1a4060' }}>

            {/* Header */}
            <div className="flex items-start justify-between p-5 pb-3"
              style={{ borderBottom: '1px solid #1a4060' }}>
              <div>
                <h3 className="text-white font-bold text-base flex items-center gap-2">
                  <Package size={16} className="text-orange-400" />
                  Detalle de Alistamiento
                </h3>
                <p className="text-gray-400 text-xs mt-1">
                  <span className="text-white font-semibold">{modalPicking.cliente}</span>
                  {modalPicking.oc && <span className="ml-2 text-gray-500">OC {modalPicking.oc}</span>}
                  {modalPicking.documento && <span className="ml-2 text-gray-500">· DOC {modalPicking.documento}</span>}
                </p>
                <div className="flex items-center gap-3 mt-1.5 text-xs">
                  <span className="text-orange-300">Alistado por: <strong>{modalPicking.alistado_por}</strong></span>
                  {modalPicking.fecha_alistamiento && (
                    <span className="text-gray-500">{fmtDate(modalPicking.fecha_alistamiento)}</span>
                  )}
                  {modalPicking.entrega_tipo && (
                    <span className="px-1.5 py-0.5 rounded font-semibold"
                      style={{ background: 'rgba(59,130,246,0.15)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.3)' }}>
                      {modalPicking.entrega_tipo}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setModalPicking(null)} className="text-gray-500 hover:text-white mt-0.5">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 pt-3">
              {loadingPicking ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-orange-400" />
                </div>
              ) : pickingItems.length === 0 ? (
                <div className="text-center py-12 text-gray-600">
                  <Package size={36} strokeWidth={1} className="mx-auto mb-3" />
                  <p className="text-sm">Sin registros de picking escaneado.</p>
                  <p className="text-xs mt-1">El pedido fue alistado desde el formulario sin escaneo de productos.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-500 mb-3">{pickingItems.length} ítem{pickingItems.length !== 1 ? 's' : ''} escaneados</p>
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1a3050' }}>
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ background: '#07111e', borderBottom: '1px solid #1a3050' }}>
                          {['REFERENCIA', 'EAN', 'DESCRIPCIÓN', 'CANT.', 'ESCANEADO POR'].map(h => (
                            <th key={h} className="px-3 py-2 text-left font-bold uppercase tracking-wide whitespace-nowrap"
                              style={{ color: '#4b6a8a', fontSize: '0.65rem' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pickingItems.map((item, i) => (
                          <tr key={item.id} style={{ background: i % 2 === 0 ? '#0f2035' : '#0d1a2a', borderBottom: '1px solid #0f1e30' }}>
                            <td className="px-3 py-2 font-mono text-sky-300">{item.referencia ?? '—'}</td>
                            <td className="px-3 py-2 font-mono text-gray-500">{item.ean13 ?? '—'}</td>
                            <td className="px-3 py-2 text-white max-w-[220px] truncate" title={item.descripcion ?? ''}>{item.descripcion ?? '—'}</td>
                            <td className="px-3 py-2 text-center">
                              <span className="inline-block px-2 py-0.5 rounded font-bold"
                                style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c' }}>
                                {item.cantidad}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-400">{item.usuario_nombre ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Totales */}
                  <div className="mt-3 flex justify-end">
                    <span className="text-xs text-gray-400">
                      Total unidades: <strong className="text-white">
                        {pickingItems.reduce((s, i) => s + i.cantidad, 0)}
                      </strong>
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="px-5 pb-4">
              <button onClick={() => setModalPicking(null)}
                className="w-full py-2 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
                style={{ background: '#0d1a2a', border: '1px solid #1a4060' }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add form modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
            style={{ background: '#0f2035', border: '1px solid #1a4060' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-bold text-lg flex items-center gap-2">
                <Plus size={18} className="text-blue-400" />
                Agregar Pedido
              </h2>
              <button onClick={() => setShowForm(false)}
                className="text-gray-500 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAdd} className="flex flex-col gap-3">
              {/* LÍNEA + TIPO ENVÍO */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-400">LÍNEA</label>
                  <select
                    value={form.linea}
                    onChange={e => setForm(prev => ({ ...prev, linea: e.target.value }))}
                    className="bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                  >
                    <option value="">— Seleccionar —</option>
                    {LINEAS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-400">TIPO DE ENVÍO</label>
                  <select
                    value={form.tipo_envio}
                    onChange={e => setForm(prev => ({ ...prev, tipo_envio: e.target.value }))}
                    className="bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                  >
                    <option value="">— Seleccionar —</option>
                    <option value="Normal">Normal</option>
                    <option value="Premium">⭐ Premium</option>
                  </select>
                </div>
              </div>

              {/* CLIENTE, OC, DOCUMENTO */}
              {[
                { key: 'cliente', label: 'CLIENTE *', req: true },
                { key: 'oc', label: 'OC', req: false },
                { key: 'documento', label: 'DOCUMENTO', req: false },
              ].map(f => (
                <div key={f.key} className="flex flex-col gap-1">
                  <label className="text-xs text-gray-400">{f.label}</label>
                  <input
                    type="text"
                    required={f.req}
                    value={form[f.key as keyof typeof form]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              ))}
              <div className="flex gap-3">
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-xs text-gray-400">F. SUBIDA</label>
                  <input
                    type="date"
                    value={form.fecha_subida}
                    onChange={e => setForm(prev => ({ ...prev, fecha_subida: e.target.value }))}
                    className="bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-xs text-gray-400">F. MÁX. ENTREGA *</label>
                  <input
                    type="date"
                    required
                    value={form.fecha_max_entrega}
                    onChange={e => setForm(prev => ({ ...prev, fecha_max_entrega: e.target.value }))}
                    className="bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              {formError && <p className="text-red-400 text-sm">{formError}</p>}

              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
                  style={{ background: '#1a2a3a', border: '1px solid #1a4060' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:brightness-110 disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #1a4a7a, #1e5d9a)', border: '1px solid #3a7abf', color: '#fff' }}
                >
                  {formSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {formSaving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
