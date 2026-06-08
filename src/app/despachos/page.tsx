'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Truck, ArrowLeft, Upload, Plus, X, Trash2, Search,
  Loader2, CheckCircle2, Clock, AlertTriangle, LogOut, User
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
  if (d.fecha_despacho) return 'DESPACHADO'
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

  // Filters
  const [filtroEstado, setFiltroEstado] = useState<'' | 'PENDIENTE' | 'VENCIDO' | 'DESPACHADO'>('')
  const [filtroLinea, setFiltroLinea]   = useState('')
  const [filtroEnvio, setFiltroEnvio]   = useState('')
  const [busqueda, setBusqueda]         = useState('')
  const [filtroOC, setFiltroOC]         = useState('')
  const [filtroDoc, setFiltroDoc]       = useState('')

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
  const pctCumpl    = total > 0 ? Math.round((despachados / total) * 100) : 0

  const lineas = Array.from(new Set(pedidos.map(p => p.linea).filter(Boolean))) as string[]

  const filtrados = pedidos.filter(p => {
    const estado = getEstado(p)
    if (filtroEstado && estado !== filtroEstado) return false
    if (filtroLinea && p.linea !== filtroLinea) return false
    if (filtroEnvio && p.tipo_envio !== filtroEnvio) return false
    if (filtroOC && !(p.oc ?? '').toLowerCase().includes(filtroOC.toLowerCase())) return false
    if (filtroDoc && !(p.documento ?? '').toLowerCase().includes(filtroDoc.toLowerCase())) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      const match = p.cliente.toLowerCase().includes(q) ||
        (p.oc ?? '').toLowerCase().includes(q) ||
        (p.documento ?? '').toLowerCase().includes(q)
      if (!match) return false
    }
    return true
  })

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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Total pedidos" value={total} color="#60a0df"
            icon={<Truck size={18} />} />
          <KpiCard label="Despachados" value={despachados} color="#4ade80"
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
                <tr style={{ background: '#0a1828', borderBottom: '1px solid #1a4060' }}>
                  {['ESTADO','LÍNEA','TIPO ENVÍO','CLIENTE','OC','DOC','F. SUBIDA','F. MÁX.','F. DESPACHO','FACTURA','ENTREGA','ALISTADO POR','GUÍA','PROVEEDOR','OBSERVACIONES',''].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
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
                        {p.alistado_por
                          ? <span className="text-xs text-orange-300 font-medium">{p.alistado_por}</span>
                          : <span className="text-gray-700 text-xs">—</span>}
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

                      {/* DELETE — solo Director */}
                      <td className="px-3 py-2 whitespace-nowrap">
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
      </div>

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
