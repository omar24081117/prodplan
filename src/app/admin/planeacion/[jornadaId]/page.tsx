'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { FileSpreadsheet, Plus, Trash2, Pencil, Check, X, Upload, Download, ChevronDown, Clock } from 'lucide-react'

function formatHoras(horas: number): string {
  if (!isFinite(horas) || horas <= 0) return '—'
  const h = Math.floor(horas)
  const m = Math.round((horas - h) * 60)
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

const PROCESOS = [
  'FABRICAR', 'REPROCESAR', 'PRUEBAS', 'EMPACAR', 'ENVOLVER',
  'ENVASAR', 'CODIFICAR', 'ETIQUETAR', 'ACONDICIONAR', 'TROQUELAR',
  'TERMOENCOGIDO', 'ENSAMBLAR', 'TRASLADAR', 'ASEO', 'LAVAR',
  'PRESTAMO', 'SOPLAR ENV',
]
const TURNOS = ['MAÑANA', 'TARDE', 'NOCHE']
const UNIDADES = ['UND', 'CAJA', 'KG', 'TINA', 'PLEGA', 'LT', 'FRASCO', 'BOLSA', 'OTRO']

type Jornada = {
  id: string; fecha: string; semana: string | null; personal_disponible: number
}
type Actividad = {
  id: string; sku: string | null; producto: string; proceso: string; turno: string
  personal_planeado: number | null; cantidad: number; unidad: string | null
  lote: string | null; notas: string | null; estandar: number | null; origen: string | null
}
type BaseProceso = { estandar: number; proceso: string; unidad: string | null }
type ActImport = {
  sku: string | null; producto: string; proceso: string; turno: string
  personal_planeado: number | null; cantidad: number; unidad: string | null
  lote: string | null; notas: string | null
}
type Catalogo = { sku: string; nombre: string }

export default function JornadaPage() {
  const { jornadaId } = useParams<{ jornadaId: string }>()
  const [jornada, setJornada] = useState<Jornada | null>(null)
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [catalogo, setCatalogo] = useState<Catalogo[]>([])

  // Modo
  const [modo, setModo] = useState<'none' | 'excel' | 'individual'>('none')

  // Preview masivo
  const [preview, setPreview] = useState<ActImport[]>([])
  const [importando, setImportando] = useState(false)
  const [importError, setImportError] = useState('')
  const [guardandoMasivo, setGuardandoMasivo] = useState(false)
  const [resultadoMasivo, setResultadoMasivo] = useState('')

  // Formulario individual (nueva actividad)
  const [form, setForm] = useState<Record<string, string>>({
    sku: '', producto: '', proceso: 'ENVASAR', turno: 'MAÑANA',
    personal_planeado: '', cantidad: '', unidad: 'UND', lote: '', notas: '',
  })
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [skuSearch, setSkuSearch] = useState('')
  const [baseInfo, setBaseInfo] = useState<BaseProceso | null>(null)
  const [loadingBase, setLoadingBase] = useState(false)

  // Modal de edición rápida por fila
  const [modalEdit, setModalEdit] = useState<Actividad | null>(null)
  const [modalForm, setModalForm] = useState<Record<string, string>>({})
  const [modalSaving, setModalSaving] = useState(false)
  const [modalError, setModalError] = useState('')

  const excelRef = useRef<HTMLInputElement>(null)

  const cargar = useCallback(async () => {
    const [jRes, aRes, cRes] = await Promise.all([
      fetch('/api/jornadas'),
      fetch(`/api/jornadas/${jornadaId}/actividades`),
      fetch('/api/catalogo'),
    ])
    const jornadas = await jRes.json()
    setJornada(jornadas.find((j: Jornada) => j.id === jornadaId) || null)
    const acts = await aRes.json()
    setActividades(Array.isArray(acts) ? acts : [])
    const cat = await cRes.json()
    setCatalogo(Array.isArray(cat) ? cat : [])
  }, [jornadaId])

  useEffect(() => { cargar() }, [cargar])

  // Auto-lookup estándar cuando cambia SKU o proceso
  useEffect(() => {
    const sku = form.sku?.trim()
    const proceso = form.proceso
    if (!sku || !proceso) { setBaseInfo(null); return }
    setLoadingBase(true)
    fetch(`/api/base-procesos?sku=${encodeURIComponent(sku)}&proceso=${encodeURIComponent(proceso)}`)
      .then(r => r.json())
      .then(data => setBaseInfo(data && data.estandar ? data : null))
      .catch(() => setBaseInfo(null))
      .finally(() => setLoadingBase(false))
  }, [form.sku, form.proceso])

  const totalAsignado = actividades.reduce((s, a) => s + (a.personal_planeado || 0), 0)
  const libres = (jornada?.personal_disponible || 0) - totalAsignado

  const catalogoFiltrado = catalogo.filter(c =>
    skuSearch.length >= 2 &&
    (c.sku.includes(skuSearch) || c.nombre.toLowerCase().includes(skuSearch.toLowerCase()))
  ).slice(0, 6)

  // ─── DESCARGAR PLANTILLA ─────────────────────────────────────────────────────
  async function descargarPlantilla() {
    const XLSX = await import('xlsx')
    const headers = ['PROCESO', 'TRIP', 'TURNO', 'REF', 'DESCRIPCION', 'LOTE', 'UND DE MEDIDA', 'META']
    const ejemplos = [
      ['ENVASAR', 7, 'MAÑANA', '10001', 'NAT CREM HUME COCO GUAY X 1LT', 'JL9081-2624', 'UND', 6000],
      ['EMPACAR', 2, 'MAÑANA', '10001', 'NAT CREM HUME COCO GUAY X 1LT', 'JL9081-2624', 'CAJA', 500],
      ['ETIQUETAR', 8, 'MAÑANA', '10005', 'NAT JABO LIQU COCO GUAY X 1LT', 'JL9081-2624', 'UND', 6000],
      ['FABRICAR', 2, 'TARDE', '9081', 'BLK JABON LIQ COC GUAY', '', 'TINA', 30],
    ]
    const ws = XLSX.utils.aoa_to_sheet([headers, ...ejemplos])

    // Anchos de columna
    ws['!cols'] = [
      { wch: 15 }, { wch: 6 }, { wch: 8 }, { wch: 8 },
      { wch: 35 }, { wch: 14 }, { wch: 14 }, { wch: 8 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Planeacion')

    const fecha = jornada ? jornada.fecha : 'plantilla'
    XLSX.writeFile(wb, `planeacion_${fecha}.xlsx`)
  }

  // ─── SUBIR EXCEL ─────────────────────────────────────────────────────────────
  async function handleExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportando(true)
    setImportError('')
    setPreview([])
    try {
      const fd = new FormData()
      fd.append('archivo', file)
      const res = await fetch('/api/planeacion/import-excel', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setImportError(data.error || 'Error al procesar archivo'); return }
      setPreview(data.actividades || [])
      if ((data.actividades || []).length === 0) setImportError('No se encontraron actividades en el archivo')
    } catch { setImportError('Error de conexión') }
    finally { setImportando(false); if (excelRef.current) excelRef.current.value = '' }
  }

  // ─── GUARDAR MASIVO ──────────────────────────────────────────────────────────
  async function guardarMasivo() {
    setGuardandoMasivo(true)
    setResultadoMasivo('')
    try {
      const res = await fetch(`/api/jornadas/${jornadaId}/actividades`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actividades: preview }),
      })
      const data = await res.json()
      if (!res.ok) { setResultadoMasivo('❌ ' + (data.error || 'Error al guardar')); return }
      setResultadoMasivo(`✓ ${data.count} actividades guardadas`)
      setPreview([])
      setModo('none')
      cargar()
    } catch { setResultadoMasivo('❌ Error de conexión') }
    finally { setGuardandoMasivo(false) }
  }

  // ─── FORM INDIVIDUAL ─────────────────────────────────────────────────────────
  function iniciarEdicion(a: Actividad) {
    setEditId(a.id)
    setForm({
      sku: a.sku ?? '',
      producto: a.producto,
      proceso: a.proceso,
      turno: a.turno,
      personal_planeado: a.personal_planeado?.toString() ?? '',
      cantidad: a.cantidad.toString(),
      unidad: a.unidad ?? 'UND',
      lote: a.lote ?? '',
      notas: a.notas ?? '',
    })
    setModo('individual')
    setSkuSearch('')
    setFormError('')
  }

  function cancelarForm() {
    setModo('none')
    setEditId(null)
    setForm({ sku: '', producto: '', proceso: 'ENVASAR', turno: 'MAÑANA', personal_planeado: '', cantidad: '', unidad: 'UND', lote: '', notas: '' })
    setSkuSearch('')
    setFormError('')
  }

  async function guardarIndividual(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    // unidad se guarda como prefijo [UND] en notas (la columna no existe en BD)
    // estandar tampoco existe como columna; el GET lo enriquece desde base_procesos
    const unidad = form.unidad || ''
    const notasBase = form.notas || ''
    const notasConUnidad = unidad ? (notasBase ? `[${unidad}] ${notasBase}` : `[${unidad}]`) : (notasBase || null)
    const body = {
      sku: form.sku || null,
      producto: form.producto,
      proceso: form.proceso,
      turno: form.turno,
      personal_planeado: form.personal_planeado ? parseInt(form.personal_planeado) : null,
      cantidad: parseInt(form.cantidad),
      lote: form.lote || null,
      notas: notasConUnidad,
    }
    const res = editId
      ? await fetch(`/api/actividades/${editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      : await fetch(`/api/jornadas/${jornadaId}/actividades`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    if (!res.ok) { setFormError(data.error || 'Error al guardar') }
    else { cancelarForm(); cargar() }
    setSaving(false)
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar esta actividad?')) return
    await fetch(`/api/actividades/${id}`, { method: 'DELETE' })
    cargar()
  }

  async function toggleAdicional(a: Actividad) {
    const nuevoOrigen = a.origen === 'manual' ? 'excel' : 'manual'
    await fetch(`/api/actividades/${a.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origen: nuevoOrigen }),
    })
    cargar()
  }

  function abrirModalEdit(a: Actividad) {
    setModalEdit(a)
    // Si unidad no existe como columna, puede estar guardada como prefijo [UND] en notas
    let notas = a.notas ?? ''
    let unidad = a.unidad ?? ''
    if (!unidad) {
      const m = notas.match(/^\[([^\]]+)\]\s*(.*)$/)
      if (m) { unidad = m[1]; notas = m[2] }
    }
    setModalForm({
      sku: a.sku ?? '',
      producto: a.producto,
      proceso: a.proceso,
      turno: a.turno,
      personal_planeado: a.personal_planeado?.toString() ?? '',
      cantidad: a.cantidad.toString(),
      unidad: unidad || 'UND',
      lote: a.lote ?? '',
      notas,
    })
    setModalError('')
  }

  async function guardarModalEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!modalEdit) return
    setModalSaving(true)
    setModalError('')
    // unidad se guarda como prefijo [UND] en notas si la columna no existe en la BD
    const unidad = modalForm.unidad || ''
    const notasBase = modalForm.notas || ''
    const notasConUnidad = unidad ? (notasBase ? `[${unidad}] ${notasBase}` : `[${unidad}]`) : (notasBase || null)
    const body = {
      sku: modalForm.sku || null,
      producto: modalForm.producto,
      proceso: modalForm.proceso,
      turno: modalForm.turno,
      personal_planeado: modalForm.personal_planeado ? parseInt(modalForm.personal_planeado) : null,
      cantidad: parseInt(modalForm.cantidad),
      lote: modalForm.lote || null,
      notas: notasConUnidad,
    }
    const res = await fetch(`/api/actividades/${modalEdit.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) { setModalError(data.error || 'Error al guardar') }
    else { setModalEdit(null); cargar() }
    setModalSaving(false)
  }

  function updatePreview(i: number, field: string, value: string | number | null) {
    setPreview(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }
  function removePreview(i: number) {
    setPreview(prev => prev.filter((_, idx) => idx !== i))
  }

  if (!jornada) return <p className="text-gray-400 p-6">Cargando...</p>

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* ── Encabezado ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/planeacion" className="text-gray-500 hover:text-gray-300 text-sm">← Jornadas</Link>
          <h1 className="text-2xl font-bold text-white mt-1">
            {jornada.fecha ? new Date(jornada.fecha.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }) : '—'}
          </h1>
          {jornada.semana && <p className="text-gray-400 text-sm">{jornada.semana}</p>}
        </div>
        <div className="rounded-xl px-5 py-3 text-center min-w-[130px]" style={{ background: '#1e3a14', border: '1px solid #3a6228' }}>
          <p className="text-gray-400 text-xs">Personal libre</p>
          <p className={`text-3xl font-bold ${libres < 0 ? 'text-red-400' : libres === 0 ? 'text-yellow-400' : 'text-emerald-400'}`}>{libres}</p>
          <p className="text-gray-500 text-xs">{totalAsignado} / {jornada.personal_disponible} asignados</p>
        </div>
      </div>

      {/* ── Acciones ── */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Descargar plantilla */}
        <button onClick={descargarPlantilla}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-gray-300 hover:text-white transition-all hover:scale-[1.02]"
          style={{ background: '#1e3a14', border: '1px solid #3a6228' }}>
          <Download size={16} className="text-green-400" /> Descargar plantilla
        </button>

        {/* Subir Excel */}
        <button onClick={() => excelRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white transition-all hover:scale-[1.02]"
          style={{ background: 'linear-gradient(135deg,#1e5c6e,#1e7890)', border: '1px solid #30a0cc' }}>
          <Upload size={16} /> Subir Excel
        </button>
        <input ref={excelRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleExcel} className="hidden" />

        <div className="w-px h-6 bg-gray-700 mx-1" />

        {/* Agregar individual */}
        <button
          onClick={() => { setModo(modo === 'individual' && !editId ? 'none' : 'individual'); setEditId(null); setForm({ sku: '', producto: '', proceso: 'ENVASAR', turno: 'MAÑANA', personal_planeado: '', cantidad: '', unidad: 'UND', lote: '', notas: '' }); setFormError('') }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-gray-300 hover:text-white transition-all"
          style={{ background: '#1e3a14', border: '1px solid #3a6228' }}>
          <Plus size={16} /> Agregar individual
        </button>
      </div>

      {/* ── Estado importando ── */}
      {importando && (
        <div className="rounded-2xl p-6 text-center" style={{ background: '#162e10', border: '1px solid #3a6228' }}>
          <div className="inline-block w-7 h-7 border-4 border-green-400 border-t-transparent rounded-full animate-spin mb-2" />
          <p className="text-gray-300 text-sm">Procesando archivo...</p>
        </div>
      )}
      {importError && !importando && (
        <div className="rounded-xl px-4 py-3 text-red-400 text-sm" style={{ background: '#2a0a0a', border: '1px solid #6a2020' }}>
          {importError}
        </div>
      )}

      {/* ── Preview tabla ── */}
      {preview.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-white font-bold text-lg">{preview.length} actividades listas para guardar</h2>
              <p className="text-gray-400 text-sm">Revisa y edita si es necesario antes de confirmar.</p>
            </div>
            <div className="flex gap-3 items-center flex-wrap">
              {resultadoMasivo && (
                <span className={resultadoMasivo.startsWith('✓') ? 'text-green-400 text-sm' : 'text-red-400 text-sm'}>
                  {resultadoMasivo}
                </span>
              )}
              <button onClick={() => { setPreview([]); setResultadoMasivo('') }}
                className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors">
                <X size={14} /> Cancelar
              </button>
              <button onClick={guardarMasivo} disabled={guardandoMasivo}
                className="flex items-center gap-2 text-white font-bold px-5 py-2.5 rounded-xl disabled:opacity-50 transition-all hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg,#2e6e20,#3d8830)', border: '1px solid #5aaa40' }}>
                {guardandoMasivo ? 'Guardando...' : <><Check size={16} /> Guardar {preview.length} actividades</>}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #3a6228' }}>
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr style={{ background: '#1e3a14' }}>
                  {['PROCESO', 'TRIP', 'TURNO', 'REF', 'DESCRIPCIÓN', 'LOTE', 'UND', 'META', ''].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-gray-400 font-semibold text-xs whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#162e10' : '#1a3412', borderBottom: '1px solid #2a4e1c' }}>
                    <td className="px-2 py-1.5">
                      <select value={row.proceso} onChange={e => updatePreview(i, 'proceso', e.target.value)}
                        className="bg-gray-800 border border-gray-700 text-white rounded px-2 py-1 text-xs focus:outline-none w-full">
                        {PROCESOS.map(p => <option key={p}>{p}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" min={0} value={row.personal_planeado ?? ''}
                        onChange={e => updatePreview(i, 'personal_planeado', e.target.value ? parseInt(e.target.value) : null)}
                        className="bg-gray-800 border border-gray-700 text-white rounded px-2 py-1 text-xs focus:outline-none w-14 text-center" />
                    </td>
                    <td className="px-2 py-1.5">
                      <select value={row.turno} onChange={e => updatePreview(i, 'turno', e.target.value)}
                        className="bg-gray-800 border border-gray-700 text-white rounded px-2 py-1 text-xs focus:outline-none">
                        {TURNOS.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={row.sku ?? ''} onChange={e => updatePreview(i, 'sku', e.target.value || null)}
                        className="bg-gray-800 border border-gray-700 text-white rounded px-2 py-1 text-xs focus:outline-none w-20" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={row.producto} onChange={e => updatePreview(i, 'producto', e.target.value)}
                        className="bg-gray-800 border border-gray-700 text-white rounded px-2 py-1 text-xs focus:outline-none w-52" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={row.lote ?? ''} onChange={e => updatePreview(i, 'lote', e.target.value || null)}
                        placeholder="Opcional"
                        className="bg-gray-800 border border-gray-700 text-white rounded px-2 py-1 text-xs focus:outline-none w-24 placeholder-gray-600" />
                    </td>
                    <td className="px-2 py-1.5">
                      <select value={row.unidad ?? ''} onChange={e => updatePreview(i, 'unidad', e.target.value || null)}
                        className="bg-gray-800 border border-gray-700 text-white rounded px-2 py-1 text-xs focus:outline-none">
                        <option value="">—</option>
                        {UNIDADES.map(u => <option key={u}>{u}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" min={0} value={row.cantidad}
                        onChange={e => updatePreview(i, 'cantidad', parseInt(e.target.value) || 0)}
                        className="bg-gray-800 border border-gray-700 text-white rounded px-2 py-1 text-xs focus:outline-none w-20 text-right" />
                    </td>
                    <td className="px-2 py-1.5">
                      <button onClick={() => removePreview(i)}
                        className="text-gray-500 hover:text-red-400 transition-colors p-1 rounded">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Formulario individual ── */}
      {modo === 'individual' && (
        <form onSubmit={guardarIndividual} className="rounded-2xl p-5 space-y-4"
          style={{ background: '#1e3a14', border: '1px solid #3a6228' }}>
          <h2 className="text-white font-semibold text-lg">{editId ? 'Editar actividad' : 'Nueva actividad'}</h2>

          {/* Buscador catálogo */}
          <div className="relative">
            <label className="text-gray-400 text-xs block mb-1">Buscar producto (SKU o nombre)</label>
            <input type="text" placeholder="Escribe para buscar en catálogo..." value={skuSearch}
              onChange={e => setSkuSearch(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
            {catalogoFiltrado.length > 0 && (
              <div className="absolute z-20 w-full bg-gray-800 border border-gray-700 rounded-xl mt-1 overflow-hidden shadow-xl">
                {catalogoFiltrado.map(c => (
                  <button key={c.sku} type="button"
                    onClick={() => { setForm(f => ({ ...f, sku: c.sku, producto: c.nombre })); setSkuSearch('') }}
                    className="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex gap-3">
                    <span className="text-gray-400 font-mono">{c.sku}</span>
                    <span>{c.nombre}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <div className="col-span-2 lg:col-span-2">
              <label className="text-gray-400 text-xs block mb-1">Descripción *</label>
              <input required value={form.producto} onChange={e => setForm(f => ({ ...f, producto: e.target.value }))}
                placeholder="Nombre del producto"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">REF / SKU</label>
              <input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                placeholder="Ej: 10001"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Proceso *</label>
              <div className="relative">
                <select required value={form.proceso} onChange={e => setForm(f => ({ ...f, proceso: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500 appearance-none">
                  {PROCESOS.map(p => <option key={p}>{p}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Turno</label>
              <div className="relative">
                <select value={form.turno} onChange={e => setForm(f => ({ ...f, turno: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500 appearance-none">
                  {TURNOS.map(t => <option key={t}>{t}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">TRIP (personal)</label>
              <input type="number" min={0} value={form.personal_planeado}
                onChange={e => setForm(f => ({ ...f, personal_planeado: e.target.value }))}
                placeholder="Opcional"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">META *</label>
              <input required type="number" min={1} value={form.cantidad}
                onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">UND de medida</label>
              <div className="relative">
                <select value={form.unidad} onChange={e => setForm(f => ({ ...f, unidad: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500 appearance-none">
                  <option value="">—</option>
                  {UNIDADES.map(u => <option key={u}>{u}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Lote <span className="text-gray-600">(opcional)</span></label>
              <input value={form.lote} onChange={e => setForm(f => ({ ...f, lote: e.target.value }))}
                placeholder="Se asigna en ejecución"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500 placeholder-gray-600" />
            </div>
            <div className="col-span-2">
              <label className="text-gray-400 text-xs block mb-1">Notas</label>
              <input value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                placeholder="Observaciones opcionales"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
            </div>
          </div>

          {/* Banner tiempo estimado */}
          {(() => {
            const cant = parseInt(form.cantidad) || 0
            const trip = parseInt(form.personal_planeado) || 0
            if (!baseInfo || cant <= 0) return null
            const efectivTrip = trip > 0 ? trip : 1
            const horas = cant / (baseInfo.estandar * efectivTrip)
            return (
              <div className="rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap"
                style={{ background: '#0e1a0a', border: '1px solid #3a6228' }}>
                <Clock size={15} className="text-green-400 shrink-0" />
                <div className="text-sm">
                  <span className="text-gray-400">Estándar: </span>
                  <span className="text-white font-semibold">{baseInfo.estandar.toLocaleString('es-CO')} und/h·p</span>
                  <span className="text-gray-500 mx-2">·</span>
                  <span className="text-gray-400">TRIP: </span>
                  <span className={`font-semibold ${trip > 0 ? 'text-white' : 'text-yellow-400'}`}>
                    {trip > 0 ? trip : '1 (sin asignar)'}
                  </span>
                  <span className="text-gray-500 mx-2">·</span>
                  <span className="text-gray-400">Tiempo estimado: </span>
                  <span className="text-emerald-400 font-bold text-base">{formatHoras(horas)}</span>
                </div>
                {loadingBase && <span className="text-gray-500 text-xs">buscando...</span>}
              </div>
            )
          })()}

          {formError && <p className="text-red-400 text-sm">{formError}</p>}

          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="text-white font-semibold px-5 py-2.5 rounded-xl disabled:opacity-50 transition-all hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg,#2e6e20,#3d8830)', border: '1px solid #5aaa40' }}>
              {saving ? 'Guardando...' : editId ? 'Actualizar' : 'Agregar actividad'}
            </button>
            <button type="button" onClick={cancelarForm}
              className="text-gray-400 hover:text-white px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors text-sm">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* ── Lista de actividades ── */}
      <div>
        <h2 className="text-gray-400 font-semibold text-xs mb-3 uppercase tracking-widest">
          Actividades planeadas · {actividades.length}
        </h2>

        {actividades.length === 0 ? (
          <div className="text-center py-14 text-gray-600 rounded-xl" style={{ border: '1px dashed #2a4e1c' }}>
            <FileSpreadsheet size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">Sin actividades. Descarga la plantilla, llénala y sube el Excel.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #3a6228' }}>
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr style={{ background: '#1e3a14' }}>
                  {['PROCESO', 'TRIP', 'TURNO', 'REF', 'DESCRIPCIÓN', 'LOTE', 'UND', 'META', 'T.ESTIMADO', '+ADIC', ''].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-gray-400 font-semibold text-xs whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {actividades.map((a, i) => {
                  const tiempoH = a.estandar && a.estandar > 0
                    ? a.cantidad / (a.estandar * (a.personal_planeado || 1))
                    : null
                  return (
                  <tr key={a.id} style={{ background: i % 2 === 0 ? '#162e10' : '#1a3412', borderBottom: '1px solid #2a4e1c' }}>
                    <td className="px-3 py-2 text-white font-medium whitespace-nowrap">{a.proceso}</td>
                    <td className="px-3 py-2 text-center text-gray-300">{a.personal_planeado ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                        a.turno === 'MAÑANA' ? 'bg-yellow-900 text-yellow-300' :
                        a.turno === 'TARDE'  ? 'bg-orange-900 text-orange-300' :
                                               'bg-blue-900 text-blue-300'
                      }`}>{a.turno}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-400 font-mono text-xs">{a.sku ?? '—'}</td>
                    <td className="px-3 py-2 text-white max-w-[220px] truncate">{a.producto}</td>
                    <td className="px-3 py-2 text-xs">
                      {a.lote
                        ? <span className="text-gray-300">{a.lote}</span>
                        : <span className="text-gray-600 italic">pendiente</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-300 text-xs">{a.unidad ?? '—'}</td>
                    <td className="px-3 py-2 text-white font-bold text-right">{a.cantidad.toLocaleString()}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {tiempoH !== null ? (
                        <span className="flex items-center gap-1 text-emerald-400 font-semibold text-xs">
                          <Clock size={10} className="shrink-0" />
                          {formatHoras(tiempoH)}
                        </span>
                      ) : (
                        <span className="text-gray-600 text-xs">sin est.</span>
                      )}
                    </td>
                    {/* Adicional toggle */}
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => toggleAdicional(a)}
                        title={a.origen === 'manual' ? 'Marcada como adicional — clic para quitar' : 'Marcar como actividad adicional'}
                        className="text-xs px-2 py-1 rounded-lg font-bold transition-colors border"
                        style={a.origen === 'manual'
                          ? { background: '#1e4a2e', color: '#4ade80', borderColor: '#166534' }
                          : { background: '#1e3a14', color: '#4b5563', borderColor: '#2a4e1c' }}>
                        {a.origen === 'manual' ? '✓ +' : '+'}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button onClick={() => abrirModalEdit(a)} title="Editar actividad"
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-colors bg-yellow-900/40 text-yellow-400 hover:bg-yellow-800/60 border border-yellow-800/50">
                          <Pencil size={11} /> Editar
                        </button>
                        <button onClick={() => eliminar(a.id)} title="Eliminar actividad"
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-colors bg-red-900/40 text-red-400 hover:bg-red-800/60 border border-red-800/50">
                          <Trash2 size={11} /> Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal editar actividad ── */}
      {modalEdit && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={e => { if (e.target === e.currentTarget) setModalEdit(null) }}>
          <form onSubmit={guardarModalEdit}
            className="rounded-2xl p-6 w-full max-w-2xl space-y-4 shadow-2xl"
            style={{ background: '#1a3412', border: '1px solid #3a6228' }}>

            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">Editar actividad</h2>
              <button type="button" onClick={() => setModalEdit(null)} className="text-gray-400 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* Descripción */}
              <div className="col-span-2 sm:col-span-2">
                <label className="text-gray-400 text-xs block mb-1">Descripción *</label>
                <input required value={modalForm.producto}
                  onChange={e => setModalForm(f => ({ ...f, producto: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
              </div>
              {/* REF/SKU */}
              <div>
                <label className="text-gray-400 text-xs block mb-1">REF / SKU</label>
                <input value={modalForm.sku}
                  onChange={e => setModalForm(f => ({ ...f, sku: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
              </div>
              {/* Proceso */}
              <div>
                <label className="text-gray-400 text-xs block mb-1">Proceso *</label>
                <div className="relative">
                  <select required value={modalForm.proceso}
                    onChange={e => setModalForm(f => ({ ...f, proceso: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500 appearance-none">
                    {PROCESOS.map(p => <option key={p}>{p}</option>)}
                  </select>
                  <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
              {/* Turno */}
              <div>
                <label className="text-gray-400 text-xs block mb-1">Turno</label>
                <div className="relative">
                  <select value={modalForm.turno}
                    onChange={e => setModalForm(f => ({ ...f, turno: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500 appearance-none">
                    {TURNOS.map(t => <option key={t}>{t}</option>)}
                  </select>
                  <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
              {/* TRIP */}
              <div>
                <label className="text-gray-400 text-xs block mb-1">TRIP (personal)</label>
                <input type="number" min={0} value={modalForm.personal_planeado}
                  onChange={e => setModalForm(f => ({ ...f, personal_planeado: e.target.value }))}
                  placeholder="Opcional"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
              </div>
              {/* META */}
              <div>
                <label className="text-gray-400 text-xs block mb-1">META *</label>
                <input required type="number" min={1} value={modalForm.cantidad}
                  onChange={e => setModalForm(f => ({ ...f, cantidad: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
              </div>
              {/* Unidad */}
              <div>
                <label className="text-gray-400 text-xs block mb-1">UND de medida</label>
                <div className="relative">
                  <select value={modalForm.unidad}
                    onChange={e => setModalForm(f => ({ ...f, unidad: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500 appearance-none">
                    <option value="">—</option>
                    {UNIDADES.map(u => <option key={u}>{u}</option>)}
                  </select>
                  <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
              {/* Lote */}
              <div>
                <label className="text-gray-400 text-xs block mb-1">Lote</label>
                <input value={modalForm.lote}
                  onChange={e => setModalForm(f => ({ ...f, lote: e.target.value }))}
                  placeholder="Opcional"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500 placeholder-gray-600" />
              </div>
              {/* Notas */}
              <div className="col-span-2 sm:col-span-3">
                <label className="text-gray-400 text-xs block mb-1">Notas</label>
                <input value={modalForm.notas}
                  onChange={e => setModalForm(f => ({ ...f, notas: e.target.value }))}
                  placeholder="Observaciones opcionales"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
              </div>
            </div>

            {modalError && <p className="text-red-400 text-sm">{modalError}</p>}

            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={modalSaving}
                className="text-white font-semibold px-6 py-2.5 rounded-xl disabled:opacity-50 transition-all hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg,#2e6e20,#3d8830)', border: '1px solid #5aaa40' }}>
                {modalSaving ? 'Guardando...' : <span className="flex items-center gap-2"><Check size={15} /> Guardar cambios</span>}
              </button>
              <button type="button" onClick={() => setModalEdit(null)}
                className="text-gray-400 hover:text-white px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors text-sm">
                Cancelar
              </button>
              <div className="flex-1" />
              <button type="button" onClick={() => { setModalEdit(null); eliminar(modalEdit.id) }}
                className="flex items-center gap-1.5 text-red-400 hover:text-red-300 px-3 py-2 rounded-xl hover:bg-red-950/40 text-sm transition-colors">
                <Trash2 size={14} /> Eliminar actividad
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
