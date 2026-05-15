'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

const PROCESOS = ['Envasado', 'Etiquetado', 'Empaque', 'Pesaje', 'Mezclado', 'Control de calidad', 'Otro']
const TURNOS = ['MAÑANA', 'TARDE', 'NOCHE']

type Jornada = {
  id: string
  fecha: string
  semana: string | null
  personal_disponible: number
}

type Actividad = {
  id: string
  sku: string | null
  producto: string
  proceso: string
  turno: string
  personal_planeado: number | null
  cantidad: number
  lote: string | null
  notas: string | null
}

type Catalogo = { sku: string; nombre: string }

const FORM_VACIO = { sku: '', producto: '', proceso: 'Envasado', turno: 'MAÑANA', personal_planeado: '', cantidad: '', notas: '' }

export default function JornadaPage() {
  const { jornadaId } = useParams<{ jornadaId: string }>()
  const [jornada, setJornada] = useState<Jornada | null>(null)
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [catalogo, setCatalogo] = useState<Catalogo[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(FORM_VACIO)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [skuSearch, setSkuSearch] = useState('')

  const cargar = useCallback(async () => {
    const [jornadaRes, actRes, catRes] = await Promise.all([
      fetch(`/api/jornadas`),
      fetch(`/api/jornadas/${jornadaId}/actividades`),
      fetch(`/api/catalogo`),
    ])
    const jornadas = await jornadaRes.json()
    setJornada(jornadas.find((j: Jornada) => j.id === jornadaId) || null)
    setActividades(await actRes.json())
    setCatalogo(await catRes.json())
  }, [jornadaId])

  useEffect(() => { cargar() }, [cargar])

  const totalAsignado = actividades.reduce((s, a) => s + (a.personal_planeado || 0), 0)
  const libres = (jornada?.personal_disponible || 0) - totalAsignado

  const catalogoFiltrado = catalogo.filter(c =>
    skuSearch.length >= 2 &&
    (c.sku.includes(skuSearch) || c.nombre.toLowerCase().includes(skuSearch.toLowerCase()))
  ).slice(0, 5)

  function seleccionarProducto(item: Catalogo) {
    setForm(f => ({ ...f, sku: item.sku, producto: item.nombre }))
    setSkuSearch('')
  }

  function iniciarEdicion(a: Actividad) {
    setEditId(a.id)
    setForm({
      sku: a.sku || '',
      producto: a.producto,
      proceso: a.proceso,
      turno: a.turno,
      personal_planeado: a.personal_planeado?.toString() || '',
      cantidad: a.cantidad.toString(),
      notas: a.notas || '',
    })
    setShowForm(true)
  }

  function cancelar() {
    setShowForm(false)
    setEditId(null)
    setForm(FORM_VACIO)
    setSkuSearch('')
    setError('')
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const body = {
      sku: form.sku || null,
      producto: form.producto,
      proceso: form.proceso,
      turno: form.turno,
      personal_planeado: form.personal_planeado ? parseInt(form.personal_planeado) : null,
      cantidad: parseInt(form.cantidad),
      notas: form.notas || null,
    }

    const res = editId
      ? await fetch(`/api/actividades/${editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      : await fetch(`/api/jornadas/${jornadaId}/actividades`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Error al guardar')
    } else {
      cancelar()
      cargar()
    }
    setSaving(false)
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar esta actividad?')) return
    await fetch(`/api/actividades/${id}`, { method: 'DELETE' })
    cargar()
  }

  if (!jornada) return <p className="text-gray-400 p-6">Cargando...</p>

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/admin/planeacion" className="text-gray-400 hover:text-white text-sm">← Jornadas</Link>
      </div>

      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {new Date(jornada.fecha + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h1>
          {jornada.semana && <p className="text-gray-400 text-sm">{jornada.semana}</p>}
        </div>

        {/* Gauge personal */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-3 text-center min-w-[130px]">
          <p className="text-gray-400 text-xs">Personal libre</p>
          <p className={`text-3xl font-bold ${libres < 0 ? 'text-red-400' : libres === 0 ? 'text-yellow-400' : 'text-emerald-400'}`}>
            {libres}
          </p>
          <p className="text-gray-500 text-xs">{totalAsignado} / {jornada.personal_disponible} asignados</p>
        </div>
      </div>

      <button
        onClick={() => { setShowForm(true); setEditId(null); setForm(FORM_VACIO) }}
        className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg text-sm mb-5 transition-colors"
      >
        + Agregar actividad
      </button>

      {showForm && (
        <form onSubmit={guardar} className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-5 flex flex-col gap-3">
          <h2 className="text-white font-semibold">{editId ? 'Editar actividad' : 'Nueva actividad'}</h2>

          {/* Autocomplete SKU/Producto */}
          <div className="relative">
            <label className="text-gray-400 text-xs block mb-1">Buscar producto (SKU o nombre)</label>
            <input
              type="text"
              placeholder="Buscar en catálogo..."
              value={skuSearch}
              onChange={e => setSkuSearch(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            {catalogoFiltrado.length > 0 && (
              <div className="absolute z-10 w-full bg-gray-800 border border-gray-700 rounded-lg mt-1 overflow-hidden">
                {catalogoFiltrado.map(c => (
                  <button
                    key={c.sku}
                    type="button"
                    onClick={() => seleccionarProducto(c)}
                    className="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex gap-2"
                  >
                    <span className="text-gray-400">{c.sku}</span>
                    <span>{c.nombre}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 text-xs block mb-1">SKU</label>
              <input
                type="text"
                placeholder="Ej: 1001"
                value={form.sku}
                onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Producto *</label>
              <input
                type="text"
                required
                placeholder="Nombre del producto"
                value={form.producto}
                onChange={e => setForm(f => ({ ...f, producto: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Proceso *</label>
              <select
                required
                value={form.proceso}
                onChange={e => setForm(f => ({ ...f, proceso: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                {PROCESOS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Turno</label>
              <select
                value={form.turno}
                onChange={e => setForm(f => ({ ...f, turno: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                {TURNOS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Personal planeado</label>
              <input
                type="number"
                min={0}
                placeholder="Opcional"
                value={form.personal_planeado}
                onChange={e => setForm(f => ({ ...f, personal_planeado: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Cantidad meta *</label>
              <input
                type="number"
                required
                min={1}
                value={form.cantidad}
                onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-gray-400 text-xs block mb-1">Notas</label>
            <input
              type="text"
              placeholder="Observaciones opcionales"
              value={form.notas}
              onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button type="button" onClick={cancelar} className="text-gray-400 hover:text-white px-4 py-2 text-sm">Cancelar</button>
          </div>
        </form>
      )}

      {actividades.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No hay actividades planeadas para esta jornada</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {actividades.map(a => (
            <div key={a.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {a.sku && <span className="text-gray-500 text-xs font-mono">{a.sku}</span>}
                  <span className="text-white font-semibold truncate">{a.producto}</span>
                  <span className="bg-gray-800 text-gray-300 text-xs px-2 py-0.5 rounded">{a.proceso}</span>
                  <span className="bg-gray-800 text-gray-300 text-xs px-2 py-0.5 rounded">{a.turno}</span>
                </div>
                <div className="flex gap-3 mt-1 text-sm text-gray-400">
                  <span>Meta: <b className="text-white">{a.cantidad.toLocaleString()}</b></span>
                  {a.personal_planeado && <span>Personal: <b className="text-white">{a.personal_planeado}</b></span>}
                  {a.lote && <span>Lote: <b className="text-white">{a.lote}</b></span>}
                  {a.notas && <span className="truncate">{a.notas}</span>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => iniciarEdicion(a)} className="text-gray-400 hover:text-white text-sm px-2 py-1 rounded hover:bg-gray-800 transition-colors">✏️</button>
                <button onClick={() => eliminar(a.id)} className="text-gray-400 hover:text-red-400 text-sm px-2 py-1 rounded hover:bg-gray-800 transition-colors">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
