'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Upload, CheckCircle, XCircle, GripVertical, Pencil, X, Check } from 'lucide-react'

type Causal = { id: string; nombre: string; activo: boolean; orden: number }

export default function CausalesParoPage() {
  const [causales, setCausales] = useState<Causal[]>([])
  const [loading, setLoading] = useState(true)
  const [nuevo, setNuevo] = useState('')
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')
  const [importResult, setImportResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => {
    setLoading(true)
    fetch('/api/causales-paro')
      .then(r => r.json())
      .then(d => { setCausales(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const agregar = async () => {
    if (!nuevo.trim() || saving) return
    setSaving(true)
    const r = await fetch('/api/causales-paro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nuevo.trim() }),
    })
    if (r.ok) { setNuevo(''); load() }
    setSaving(false)
  }

  const toggleActivo = async (c: Causal) => {
    await fetch(`/api/causales-paro/${c.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !c.activo }),
    })
    load()
  }

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar esta causal? No se puede deshacer.')) return
    await fetch(`/api/causales-paro/${id}`, { method: 'DELETE' })
    load()
  }

  const guardarEdit = async (id: string) => {
    if (!editVal.trim()) return
    await fetch(`/api/causales-paro/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: editVal }),
    })
    setEditId(null)
    load()
  }

  const importar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    const fd = new FormData()
    fd.append('archivo', file)
    const r = await fetch('/api/causales-paro/import', { method: 'POST', body: fd })
    const data = await r.json()
    if (data.ok) {
      setImportResult({ ok: true, msg: `${data.total} causales importadas correctamente` })
      load()
    } else {
      setImportResult({ ok: false, msg: data.error || 'Error al importar' })
    }
    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const activas = causales.filter(c => c.activo)
  const inactivas = causales.filter(c => !c.activo)

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-xl font-bold">Causales de Paro</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Lista de causas disponibles en el campo Observación de tiempos improductivos
          </p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importar} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-blue-900/50 border border-blue-700 text-blue-300 hover:bg-blue-800/60 disabled:opacity-50 transition-all"
          >
            <Upload size={15} />
            {importing ? 'Importando...' : 'Importar Excel'}
          </button>
        </div>
      </div>

      {importResult && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm mb-4 ${importResult.ok ? 'bg-green-900/40 border border-green-700 text-green-300' : 'bg-red-900/40 border border-red-700 text-red-300'}`}>
          {importResult.ok ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {importResult.msg}
          <button onClick={() => setImportResult(null)} className="ml-auto opacity-60 hover:opacity-100"><X size={14} /></button>
        </div>
      )}

      {/* Info formato Excel */}
      <div className="bg-blue-950/40 border border-blue-800/50 rounded-xl px-4 py-3 mb-5 text-xs text-blue-300">
        <strong>Formato Excel:</strong> Una columna con los nombres de las causales, empezando en la fila 1.
        La primera fila puede ser un encabezado (ej. &quot;PAROS UNIFICADOS&quot;) y se ignorará automáticamente.
      </div>

      {/* Agregar nuevo */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={nuevo}
          onChange={e => setNuevo(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && agregar()}
          placeholder="Nombre de la causal (ej. ALMUERZO)"
          className="flex-1 bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500"
        />
        <button
          onClick={agregar}
          disabled={!nuevo.trim() || saving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-green-900/50 border border-green-700 text-green-300 hover:bg-green-800/60 disabled:opacity-40 transition-all"
        >
          <Plus size={15} />
          Agregar
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-12">Cargando...</div>
      ) : (
        <>
          {/* Causales activas */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-gray-300 text-sm font-semibold">Activas ({activas.length})</span>
            </div>
            {activas.length === 0 ? (
              <div className="text-gray-600 text-sm text-center py-6 border border-dashed border-gray-800 rounded-xl">
                Sin causales activas. Agrega una o importa desde Excel.
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {activas.map(c => (
                  <div key={c.id} className="flex items-center gap-3 bg-gray-900/60 border border-gray-800 rounded-xl px-4 py-2.5 group">
                    <GripVertical size={14} className="text-gray-700 flex-shrink-0" />
                    {editId === c.id ? (
                      <>
                        <input
                          autoFocus
                          value={editVal}
                          onChange={e => setEditVal(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') guardarEdit(c.id); if (e.key === 'Escape') setEditId(null) }}
                          className="flex-1 bg-gray-800 border border-green-600 text-white rounded-lg px-3 py-1 text-sm focus:outline-none"
                        />
                        <button onClick={() => guardarEdit(c.id)} className="text-green-400 hover:text-green-300 p-1"><Check size={14} /></button>
                        <button onClick={() => setEditId(null)} className="text-gray-500 hover:text-gray-300 p-1"><X size={14} /></button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-white text-sm font-medium">{c.nombre}</span>
                        <button
                          onClick={() => { setEditId(c.id); setEditVal(c.nombre) }}
                          className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-blue-400 p-1 transition-opacity"
                          title="Editar"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => toggleActivo(c)}
                          className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-yellow-400 p-1 transition-opacity"
                          title="Desactivar"
                        >
                          <XCircle size={14} />
                        </button>
                        <button
                          onClick={() => eliminar(c.id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 p-1 transition-opacity"
                          title="Eliminar"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Causales inactivas */}
          {inactivas.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-gray-600" />
                <span className="text-gray-500 text-sm font-semibold">Inactivas ({inactivas.length})</span>
                <span className="text-gray-600 text-xs">(no aparecen en el dropdown)</span>
              </div>
              <div className="flex flex-col gap-1">
                {inactivas.map(c => (
                  <div key={c.id} className="flex items-center gap-3 bg-gray-900/30 border border-gray-800/50 rounded-xl px-4 py-2 group opacity-50">
                    <GripVertical size={14} className="text-gray-700 flex-shrink-0" />
                    <span className="flex-1 text-gray-500 text-sm line-through">{c.nombre}</span>
                    <button
                      onClick={() => toggleActivo(c)}
                      className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-green-400 p-1 transition-opacity"
                      title="Reactivar"
                    >
                      <CheckCircle size={14} />
                    </button>
                    <button
                      onClick={() => eliminar(c.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 p-1 transition-opacity"
                      title="Eliminar"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
