'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Trash2, Pencil, Check, X, ChevronDown, Search, BookOpen, Upload, FileSpreadsheet } from 'lucide-react'

const PROCESOS = [
  'FABRICAR', 'TROQUELAR', 'SOPLAR ENV', 'ETIQUETAR', 'ENVASAR',
  'EMPACAR', 'LAVAR', 'ACONDICIONAR', 'PESAJE', 'MEZCLADO', 'CONTROL CALIDAD', 'OTRO',
]
const UNIDADES = ['UND', 'CAJA', 'KG', 'TINA', 'PLEGA', 'LT', 'FRASCO', 'BOLSA', 'OTRO']

type Catalogo = { id: string; sku: string; nombre: string }
type BaseProceso = {
  id: string
  catalogo_id: string
  proceso: string
  estandar: number
  unidad: string | null
  descripcion: string | null
  catalogo: { id: string; sku: string; nombre: string } | null
}

type FormState = {
  catalogo_id: string
  proceso: string
  estandar: string
  unidad: string
  descripcion: string
}

const emptyForm: FormState = {
  catalogo_id: '',
  proceso: 'ENVASAR',
  estandar: '',
  unidad: 'UND',
  descripcion: '',
}

export default function BaseProcesosPage() {
  const [catalogo, setCatalogo] = useState<Catalogo[]>([])
  const [registros, setRegistros] = useState<BaseProceso[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroProducto, setFiltroProducto] = useState<string>('') // catalogo_id
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [skuSearch, setSkuSearch] = useState('')
  const [productoSeleccionado, setProductoSeleccionado] = useState<Catalogo | null>(null)
  const [importando, setImportando] = useState(false)
  const [importResult, setImportResult] = useState<{ ok?: boolean; total?: number; productosNuevos?: number; procesosEncontrados?: string[]; error?: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const cargar = useCallback(async () => {
    const [catRes, bpRes] = await Promise.all([
      fetch('/api/catalogo'),
      fetch('/api/base-procesos'),
    ])
    const cat = await catRes.json()
    const bp = await bpRes.json()
    setCatalogo(Array.isArray(cat) ? cat : [])
    setRegistros(Array.isArray(bp) ? bp : [])
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const catalogoFiltrado = catalogo.filter(c =>
    skuSearch.length >= 2 &&
    (c.sku.toLowerCase().includes(skuSearch.toLowerCase()) ||
      c.nombre.toLowerCase().includes(skuSearch.toLowerCase()))
  ).slice(0, 8)

  // Registros filtrados
  const registrosFiltrados = registros.filter(r => {
    const matchProducto = !filtroProducto || r.catalogo_id === filtroProducto
    const matchBusqueda = !busqueda || (
      r.proceso.toLowerCase().includes(busqueda.toLowerCase()) ||
      r.catalogo?.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      r.catalogo?.sku.includes(busqueda)
    )
    return matchProducto && matchBusqueda
  })

  // Productos que ya tienen al menos un proceso definido
  const productosConBase = Array.from(new Set(registros.map(r => r.catalogo_id)))
    .map(id => catalogo.find(c => c.id === id))
    .filter(Boolean) as Catalogo[]

  function abrirNuevo() {
    setEditId(null)
    setForm(emptyForm)
    setProductoSeleccionado(null)
    setSkuSearch('')
    setError('')
    setShowForm(true)
  }

  function abrirEdicion(r: BaseProceso) {
    setEditId(r.id)
    setForm({
      catalogo_id: r.catalogo_id,
      proceso: r.proceso,
      estandar: r.estandar.toString(),
      unidad: r.unidad ?? 'UND',
      descripcion: r.descripcion ?? '',
    })
    setProductoSeleccionado(r.catalogo ?? null)
    setSkuSearch('')
    setError('')
    setShowForm(true)
  }

  function cancelar() {
    setShowForm(false)
    setEditId(null)
    setForm(emptyForm)
    setProductoSeleccionado(null)
    setError('')
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.catalogo_id) { setError('Selecciona un producto'); return }
    if (!form.estandar || parseFloat(form.estandar) <= 0) { setError('El estándar debe ser mayor a 0'); return }
    setSaving(true)
    setError('')

    const body = {
      catalogo_id: form.catalogo_id,
      proceso: form.proceso,
      estandar: parseFloat(form.estandar),
      unidad: form.unidad || null,
      descripcion: form.descripcion || null,
    }

    const res = editId
      ? await fetch(`/api/base-procesos/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      : await fetch('/api/base-procesos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

    const data = await res.json()
    if (!res.ok) setError(data.error || 'Error al guardar')
    else { cancelar(); cargar() }
    setSaving(false)
  }

  async function eliminar(id: string, proceso: string) {
    if (!confirm(`¿Eliminar el estándar para "${proceso}"?`)) return
    await fetch(`/api/base-procesos/${id}`, { method: 'DELETE' })
    cargar()
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportando(true)
    setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('archivo', file)
      const res = await fetch('/api/base-procesos/import', { method: 'POST', body: fd })
      const data = await res.json()
      setImportResult(data)
      if (res.ok) cargar()
    } catch {
      setImportResult({ error: 'Error de conexión al importar' })
    } finally {
      setImportando(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function formatHoras(estandar: number): string {
    if (estandar <= 0) return '—'
    return `${estandar.toLocaleString('es-CO')} und/h·persona`
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen size={22} className="text-green-400" />
            Base de Procesos
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Estándares de producción por producto y proceso · {registros.length} definidos
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Importar Excel */}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importando}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white transition-all hover:scale-[1.02] disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#1e5c6e,#1e7890)', border: '1px solid #30a0cc' }}
          >
            {importando
              ? <><span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Importando...</>
              : <><Upload size={15} /> Importar Excel</>
            }
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />

          <button
            onClick={abrirNuevo}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white transition-all hover:scale-[1.02]"
            style={{ background: 'linear-gradient(135deg,#2e6e20,#3d8830)', border: '1px solid #5aaa40' }}
          >
            <Plus size={16} /> Nuevo estándar
          </button>
        </div>
      </div>

      {/* Resultado importación */}
      {importResult && (
        <div className={`rounded-xl px-4 py-3 text-sm flex items-start gap-3 ${importResult.ok ? 'text-emerald-300' : 'text-red-400'}`}
          style={{ background: importResult.ok ? '#0d2a1a' : '#2a0a0a', border: `1px solid ${importResult.ok ? '#2a6e3a' : '#6a2020'}` }}>
          <FileSpreadsheet size={18} className="shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            {importResult.ok ? (
              <>
                <p className="font-semibold">✓ {importResult.total} estándares importados correctamente</p>
                {(importResult.productosNuevos ?? 0) > 0 && (
                  <p className="text-emerald-400/70 text-xs">{importResult.productosNuevos} productos nuevos agregados al catálogo</p>
                )}
                {importResult.procesosEncontrados && (
                  <p className="text-emerald-400/70 text-xs">Procesos: {importResult.procesosEncontrados.join(', ')}</p>
                )}
              </>
            ) : (
              <p>{importResult.error}</p>
            )}
          </div>
          <button onClick={() => setImportResult(null)} className="ml-auto text-current opacity-50 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Formulario */}
      {showForm && (
        <form onSubmit={guardar} className="rounded-2xl p-5 space-y-4"
          style={{ background: '#162e10', border: '1px solid #3a6228' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold text-lg">
              {editId ? 'Editar estándar' : 'Nuevo estándar de proceso'}
            </h2>
            <button type="button" onClick={cancelar} className="text-gray-500 hover:text-white">
              <X size={18} />
            </button>
          </div>

          {/* Buscador producto */}
          <div className="relative">
            <label className="text-gray-400 text-xs block mb-1">Producto *</label>
            {productoSeleccionado ? (
              <div className="flex items-center justify-between bg-gray-800 border border-green-700 rounded-xl px-3 py-2.5">
                <div>
                  <span className="text-gray-400 font-mono text-xs mr-2">{productoSeleccionado.sku}</span>
                  <span className="text-white text-sm">{productoSeleccionado.nombre}</span>
                </div>
                <button type="button" onClick={() => { setProductoSeleccionado(null); setForm(f => ({ ...f, catalogo_id: '' })) }}
                  className="text-gray-500 hover:text-red-400 ml-2">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Buscar por SKU o nombre..."
                    value={skuSearch}
                    onChange={e => setSkuSearch(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-green-500"
                  />
                </div>
                {catalogoFiltrado.length > 0 && (
                  <div className="absolute z-20 w-full bg-gray-800 border border-gray-700 rounded-xl mt-1 overflow-hidden shadow-xl">
                    {catalogoFiltrado.map(c => (
                      <button key={c.id} type="button"
                        onClick={() => {
                          setProductoSeleccionado(c)
                          setForm(f => ({ ...f, catalogo_id: c.id }))
                          setSkuSearch('')
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex gap-3">
                        <span className="text-gray-400 font-mono text-xs">{c.sku}</span>
                        <span className="truncate">{c.nombre}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Proceso */}
            <div>
              <label className="text-gray-400 text-xs block mb-1">Proceso *</label>
              <div className="relative">
                <select required value={form.proceso}
                  onChange={e => setForm(f => ({ ...f, proceso: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500 appearance-none">
                  {PROCESOS.map(p => <option key={p}>{p}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Estándar */}
            <div>
              <label className="text-gray-400 text-xs block mb-1">
                Estándar <span className="text-gray-500">(und/h·persona)</span>
              </label>
              <input required type="number" min={0.1} step={0.1}
                value={form.estandar}
                onChange={e => setForm(f => ({ ...f, estandar: e.target.value }))}
                placeholder="Ej: 1500"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
            </div>

            {/* Unidad */}
            <div>
              <label className="text-gray-400 text-xs block mb-1">Unidad de medida</label>
              <div className="relative">
                <select value={form.unidad}
                  onChange={e => setForm(f => ({ ...f, unidad: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500 appearance-none">
                  {UNIDADES.map(u => <option key={u}>{u}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Descripción */}
            <div>
              <label className="text-gray-400 text-xs block mb-1">Descripción <span className="text-gray-600">(opcional)</span></label>
              <input value={form.descripcion}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="Observaciones"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 text-white font-semibold px-5 py-2.5 rounded-xl disabled:opacity-50 transition-all hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg,#2e6e20,#3d8830)', border: '1px solid #5aaa40' }}>
              <Check size={15} /> {saving ? 'Guardando...' : editId ? 'Actualizar' : 'Guardar estándar'}
            </button>
            <button type="button" onClick={cancelar}
              className="text-gray-400 hover:text-white px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors text-sm">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar proceso o producto..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-green-500"
          />
        </div>

        {/* Filtro por producto */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFiltroProducto('')}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              !filtroProducto
                ? 'text-white' : 'text-gray-400 hover:text-white'
            }`}
            style={!filtroProducto ? { background: '#2e6e20', border: '1px solid #5aaa40' } : { background: '#1e3a14', border: '1px solid #2a4e1c' }}
          >
            Todos
          </button>
          {productosConBase.map(p => (
            <button
              key={p.id}
              onClick={() => setFiltroProducto(p.id === filtroProducto ? '' : p.id)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                filtroProducto === p.id
                  ? 'text-white' : 'text-gray-400 hover:text-white'
              }`}
              style={filtroProducto === p.id
                ? { background: '#2e6e20', border: '1px solid #5aaa40' }
                : { background: '#1e3a14', border: '1px solid #2a4e1c' }}
            >
              {p.sku}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      {registrosFiltrados.length === 0 ? (
        <div className="text-center py-16 rounded-xl" style={{ border: '1px dashed #2a4e1c' }}>
          <BookOpen size={32} className="mx-auto mb-3 text-gray-600" />
          <p className="text-gray-500 text-sm">
            {registros.length === 0
              ? 'Aún no hay estándares definidos. Crea el primero con el botón de arriba.'
              : 'No hay registros que coincidan con el filtro.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #3a6228' }}>
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr style={{ background: '#1e3a14' }}>
                {['REF', 'PRODUCTO', 'PROCESO', 'ESTÁNDAR', 'UND', 'DESCRIPCIÓN', ''].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-gray-400 font-semibold text-xs whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {registrosFiltrados.map((r, i) => (
                <tr key={r.id} style={{ background: i % 2 === 0 ? '#111a0d' : '#152010', borderBottom: '1px solid #2a4e1c' }}>
                  <td className="px-3 py-2 text-gray-400 font-mono text-xs whitespace-nowrap">
                    {r.catalogo?.sku ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-white max-w-[180px] truncate">
                    {r.catalogo?.nombre ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-white font-semibold text-xs bg-gray-700 px-2 py-0.5 rounded">
                      {r.proceso}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-emerald-400 font-bold text-sm">
                      {r.estandar.toLocaleString('es-CO')}
                    </span>
                    <span className="text-gray-500 text-xs ml-1">und/h·p</span>
                  </td>
                  <td className="px-3 py-2 text-gray-300 text-xs">{r.unidad ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-400 text-xs max-w-[160px] truncate">
                    {r.descripcion ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => abrirEdicion(r)} title="Editar"
                        className="text-gray-500 hover:text-yellow-400 p-1 rounded hover:bg-gray-800 transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => eliminar(r.id, r.proceso)} title="Eliminar"
                        className="text-gray-500 hover:text-red-400 p-1 rounded hover:bg-gray-800 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Info estándar */}
      <div className="rounded-xl p-4 text-xs text-gray-500 space-y-1" style={{ background: '#0e1a0a', border: '1px solid #1e3a14' }}>
        <p className="text-gray-400 font-semibold mb-1">¿Cómo funciona?</p>
        <p>• <strong className="text-gray-300">Estándar</strong>: unidades producidas por hora por persona en condiciones normales.</p>
        <p>• <strong className="text-gray-300">Tiempo estimado</strong> = META ÷ (Estándar × TRIP). Si no hay TRIP asignado, se usa TRIP = 1.</p>
        <p>• <strong className="text-gray-300">TRIP</strong>: número de personas asignadas a la actividad en la planeación.</p>
        <p>• El tiempo estimado se calcula automáticamente al planear y al asignar personal en ejecución.</p>
        <div className="mt-2 pt-2 border-t border-gray-800 space-y-1">
          <p className="text-gray-400 font-semibold">Formato Excel para importar:</p>
          <p>• El archivo debe tener <strong className="text-gray-300">encabezados de proceso</strong> (ej: ENVASADO/TROQUELADO, ETIQUETADO) y debajo columnas <strong className="text-gray-300">UND/H · UND/D · UND/M</strong>.</p>
          <p>• Solo se importa la columna <strong className="text-gray-300">UND/H</strong> de cada proceso.</p>
          <p>• La primera columna debe ser <strong className="text-gray-300">Referencia</strong> (SKU) y la segunda <strong className="text-gray-300">Desc. Item</strong>.</p>
          <p>• Los productos no encontrados en el catálogo se agregan automáticamente.</p>
        </div>
      </div>
    </div>
  )
}
