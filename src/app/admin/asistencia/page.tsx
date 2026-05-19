'use client'

import { useState, useEffect, useCallback } from 'react'
import { Clock, RefreshCw, AlertCircle } from 'lucide-react'

type Registro = { cedula: string; nombre: string; hora_ingreso: string; hora_salida: string | null }

function sumarHoras(hora: string, horas: number): string {
  const [h, m] = hora.split(':').map(Number)
  const totalMin = h * 60 + m + horas * 60
  const hh = Math.floor(totalMin / 60) % 24
  const mm = totalMin % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function horasTranscurridas(horaIngreso: string): number {
  const ahora = new Date()
  const horaActual = ahora.toLocaleTimeString('es-CO', {
    timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false,
  })
  const [hi, mi] = horaIngreso.split(':').map(Number)
  const [ha, ma] = horaActual.split(':').map(Number)
  let minActual = ha * 60 + ma
  const minIngreso = hi * 60 + mi
  if (minActual < minIngreso) minActual += 24 * 60 // cruce de medianoche
  return (minActual - minIngreso) / 60
}

export default function AsistenciaAdminPage() {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const [fecha, setFecha] = useState(hoy)
  const [registros, setRegistros] = useState<Registro[]>([])
  const [loading, setLoading] = useState(true)
  const [cerrandoAuto, setCerrandoAuto] = useState(false)
  const [resultadoCierre, setResultadoCierre] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/asistencia/lista?fecha=${fecha}`)
    const data = await res.json()
    setRegistros(data)
    setLoading(false)
  }, [fecha])

  useEffect(() => { cargar() }, [cargar])

  const enPlanta = registros.filter(r => !r.hora_salida)
  // Personas sin salida que ya llevan 12+ horas
  const con12h = enPlanta.filter(r => horasTranscurridas(r.hora_ingreso) >= 12)

  async function cerrarAutomatico() {
    setCerrandoAuto(true)
    setResultadoCierre(null)
    try {
      const res = await fetch('/api/asistencia/cierre-automatico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha }),
      })
      const data = await res.json()
      if (data.ok) {
        const msg = data.cerrados > 0
          ? `✓ ${data.cerrados} registro${data.cerrados > 1 ? 's' : ''} cerrado${data.cerrados > 1 ? 's' : ''} (ingreso + 12h)`
          : '✓ Sin registros que superen las 12 horas aún'
        setResultadoCierre(msg)
        cargar()
      } else {
        setResultadoCierre('❌ ' + (data.error || 'Error al cerrar'))
      }
    } catch {
      setResultadoCierre('❌ Error de conexión')
    }
    setCerrandoAuto(false)
  }

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
        <button onClick={cargar} className="text-gray-400 hover:text-white text-sm px-3 py-2 bg-gray-800 rounded-lg">
          <RefreshCw size={14} />
        </button>
      </div>

      {!loading && (
        <>
          <div className="flex gap-4 mb-4 flex-wrap">
            <div className="bg-emerald-900/30 border border-emerald-800 rounded-xl px-4 py-3">
              <p className="text-gray-400 text-xs">En planta</p>
              <p className="text-2xl font-bold text-emerald-400">{enPlanta.length}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
              <p className="text-gray-400 text-xs">Total registros</p>
              <p className="text-2xl font-bold text-white">{registros.length}</p>
            </div>
            <div className="bg-blue-900/30 border border-blue-800 rounded-xl px-4 py-3">
              <p className="text-gray-400 text-xs">Con salida</p>
              <p className="text-2xl font-bold text-blue-400">{registros.filter(r => r.hora_salida).length}</p>
            </div>
          </div>

          {/* Aviso cierre automático */}
          {enPlanta.length > 0 && (
            <div className={`mb-4 rounded-xl px-4 py-3 flex items-start gap-3 ${
              con12h.length > 0
                ? 'bg-orange-900/20 border border-orange-800/50'
                : 'bg-gray-800/40 border border-gray-700/50'
            }`}>
              <AlertCircle size={16} className={`mt-0.5 shrink-0 ${con12h.length > 0 ? 'text-orange-400' : 'text-gray-500'}`} />
              <div className="flex-1 min-w-0">
                {con12h.length > 0 ? (
                  <>
                    <p className="text-orange-300 text-sm font-semibold">
                      {con12h.length} persona{con12h.length > 1 ? 's' : ''} con más de 12h en planta sin registrar salida
                    </p>
                    <p className="text-orange-500 text-xs mt-0.5">
                      Se cerrará a las {con12h.map(r => `${r.nombre.split(' ')[0]} → ${sumarHoras(r.hora_ingreso, 12)}`).join(' · ')}
                    </p>
                  </>
                ) : (
                  <p className="text-gray-500 text-sm">
                    {enPlanta.length} persona{enPlanta.length > 1 ? 's' : ''} en planta — ninguna supera las 12h aún.
                    El sistema cerrará automáticamente a las 03:00 AM.
                  </p>
                )}
              </div>
              <button
                onClick={cerrarAutomatico}
                disabled={cerrandoAuto}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-800/50 text-orange-300 hover:bg-orange-700/50 disabled:opacity-50 transition-colors shrink-0"
              >
                <Clock size={13} />
                {cerrandoAuto ? 'Cerrando...' : 'Aplicar cierre'}
              </button>
            </div>
          )}

          {resultadoCierre && (
            <p className={`text-sm mb-4 px-3 py-2 rounded-lg ${resultadoCierre.startsWith('✓') ? 'text-green-400 bg-green-950/40' : 'text-red-400 bg-red-950/40'}`}>
              {resultadoCierre}
            </p>
          )}
        </>
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
                <th className="text-center text-gray-400 px-4 py-2.5 font-medium">Cierre auto</th>
              </tr>
            </thead>
            <tbody>
              {registros.map(r => {
                const cierreAuto = sumarHoras(r.hora_ingreso, 12)
                const pasaron = !r.hora_salida ? horasTranscurridas(r.hora_ingreso) : 0
                const superó12h = pasaron >= 12
                return (
                  <tr key={r.cedula} className={`border-b border-gray-800/50 hover:bg-gray-800/30 ${superó12h ? 'bg-orange-950/10' : ''}`}>
                    <td className="px-4 py-2.5 text-white">{r.nombre}</td>
                    <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">{r.cedula}</td>
                    <td className="px-4 py-2.5 text-center text-emerald-400 font-mono">{r.hora_ingreso}</td>
                    <td className="px-4 py-2.5 text-center font-mono">
                      {r.hora_salida
                        ? <span className="text-orange-400">{r.hora_salida}</span>
                        : <span className="text-gray-600">—</span>
                      }
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {r.hora_salida ? (
                        <span className="text-gray-700 text-xs">—</span>
                      ) : (
                        <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                          superó12h
                            ? 'bg-orange-900/40 text-orange-400 font-semibold'
                            : 'bg-gray-800 text-gray-500'
                        }`}>
                          {cierreAuto}
                          {superó12h && ' ⚠'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
