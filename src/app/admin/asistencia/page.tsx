'use client'

import { useState, useEffect, useCallback } from 'react'

type Registro = { cedula: string; nombre: string; hora_ingreso: string; hora_salida: string | null }

export default function AsistenciaAdminPage() {
  const hoy = new Date().toLocaleDateString('en-CA')
  const [fecha, setFecha] = useState(hoy)
  const [registros, setRegistros] = useState<Registro[]>([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/asistencia/lista?fecha=${fecha}`)
    const data = await res.json()
    setRegistros(data)
    setLoading(false)
  }, [fecha])

  useEffect(() => { cargar() }, [cargar])

  const enPlanta = registros.filter(r => !r.hora_salida)

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold text-white">Asistencia</h1>
        <input
          type="date"
          value={fecha}
          onChange={e => setFecha(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
        />
        <button onClick={cargar} className="text-gray-400 hover:text-white text-sm px-3 py-2 bg-gray-800 rounded-lg">↻</button>
      </div>

      {!loading && (
        <div className="flex gap-4 mb-4">
          <div className="bg-emerald-900/30 border border-emerald-800 rounded-xl px-4 py-3">
            <p className="text-gray-400 text-xs">En planta</p>
            <p className="text-2xl font-bold text-emerald-400">{enPlanta.length}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
            <p className="text-gray-400 text-xs">Total registros</p>
            <p className="text-2xl font-bold text-white">{registros.length}</p>
          </div>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <p className="text-center text-gray-500 py-8 text-sm">Cargando...</p>
        ) : registros.length === 0 ? (
          <p className="text-center text-gray-500 py-8 text-sm">No hay asistencia para esta fecha</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-gray-400 px-4 py-2.5 font-medium">Nombre</th>
                <th className="text-left text-gray-400 px-4 py-2.5 font-medium">Cédula</th>
                <th className="text-center text-gray-400 px-4 py-2.5 font-medium">Entrada</th>
                <th className="text-center text-gray-400 px-4 py-2.5 font-medium">Salida</th>
              </tr>
            </thead>
            <tbody>
              {registros.map(r => (
                <tr key={r.cedula} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-2.5 text-white">{r.nombre}</td>
                  <td className="px-4 py-2.5 text-gray-400 font-mono">{r.cedula}</td>
                  <td className="px-4 py-2.5 text-center text-emerald-400 font-mono">{r.hora_ingreso}</td>
                  <td className="px-4 py-2.5 text-center font-mono">
                    {r.hora_salida
                      ? <span className="text-orange-400">{r.hora_salida}</span>
                      : <span className="text-gray-600">—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
