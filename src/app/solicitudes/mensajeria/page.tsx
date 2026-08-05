'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, ArrowLeft, Send, User } from 'lucide-react'

type Mensaje = {
  id: string
  autor: string
  area: string
  texto: string
  hora: string
  propio?: boolean
}

const MENSAJES_EJEMPLO: Mensaje[] = [
  { id: '1', autor: 'Juan Pérez', area: 'Producción', texto: '¿Alguien sabe si ya llegó el pedido de empaques?', hora: '08:14' },
  { id: '2', autor: 'María López', area: 'Almacén', texto: 'Sí, llegó ayer tarde. Están en la bodega zona B.', hora: '08:22' },
  { id: '3', autor: 'Carlos Ríos', area: 'Producción', texto: 'Perfecto, gracias. Lo pasamos a planta en la tarde.', hora: '08:35' },
  { id: '4', autor: 'Rosa Supervisor', area: 'Supervisión', texto: 'Buenos días equipo. Recuerden el turno 2 empieza a las 13:00 hoy.', hora: '09:01' },
]

export default function MensajeriaPage() {
  const router = useRouter()
  const [mensajes, setMensajes] = useState<Mensaje[]>(MENSAJES_EJEMPLO)
  const [texto, setTexto]       = useState('')
  const [nombre, setNombre]     = useState('')
  const [area, setArea]         = useState('')
  const [configurado, setConfigurado] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    const ahora = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Bogota' })
    setMensajes(prev => [...prev, {
      id: Date.now().toString(),
      autor: nombre,
      area,
      texto: texto.trim(),
      hora: ahora,
      propio: true,
    }])
    setTexto('')
  }

  if (!configurado) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #374151' }}>
          <div className="flex items-center gap-2 mb-5">
            <MessageSquare size={18} className="text-blue-400" />
            <h2 className="text-white font-bold text-base">Identificarte para chatear</h2>
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Tu nombre *</label>
              <input autoFocus value={nombre} onChange={e => setNombre(e.target.value)}
                placeholder="Nombre completo"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Área / Cargo *</label>
              <input value={area} onChange={e => setArea(e.target.value)}
                placeholder="Producción, Almacén..."
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <button
              onClick={() => { if (nombre.trim() && area.trim()) setConfigurado(true) }}
              disabled={!nombre.trim() || !area.trim()}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 mt-1"
              style={{ background: 'linear-gradient(135deg, #1a3a5c, #1e4d6e)' }}>
              Entrar al chat
            </button>
            <button onClick={() => router.push('/solicitudes')}
              className="text-gray-600 hover:text-gray-400 text-xs text-center">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col" style={{ maxHeight: '100dvh' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800" style={{ background: '#0d1117' }}>
        <button onClick={() => router.push('/solicitudes')} className="text-gray-500 hover:text-white">
          <ArrowLeft size={18} />
        </button>
        <MessageSquare size={18} className="text-blue-400" />
        <h1 className="text-white font-bold text-base">Mensajería Interna</h1>
        <span className="ml-auto text-xs text-gray-600">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 mr-1.5 animate-pulse" />
          En línea como <span className="text-gray-400">{nombre}</span>
        </span>
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3" style={{ background: '#0a0f0a' }}>
        {mensajes.map(m => (
          <div key={m.id} className={`flex gap-3 ${m.propio ? 'flex-row-reverse' : ''}`}>
            <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold"
              style={{ background: m.propio ? '#0e4f5c' : '#1a3a5c', color: m.propio ? '#67e8f9' : '#93c5fd' }}>
              {m.autor.charAt(0).toUpperCase()}
            </div>
            <div className={`flex flex-col gap-0.5 max-w-[70%] ${m.propio ? 'items-end' : ''}`}>
              <div className="flex items-center gap-2">
                {!m.propio && <span className="text-xs font-semibold text-blue-300">{m.autor}</span>}
                <span className="text-xs text-gray-600">{m.area}</span>
                <span className="text-xs text-gray-700">{m.hora}</span>
              </div>
              <div className="px-3 py-2 rounded-xl text-sm text-white leading-relaxed"
                style={{ background: m.propio ? '#0e4f5c' : '#1e2936', border: `1px solid ${m.propio ? '#22b8cc22' : '#1e3a5f'}` }}>
                {m.texto}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={enviar}
        className="flex items-center gap-3 px-4 py-3 border-t border-gray-800"
        style={{ background: '#0d1117' }}>
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{ background: '#0e4f5c', color: '#67e8f9' }}>
          <User size={12} />
        </div>
        <input
          type="text"
          placeholder="Escribe un mensaje..."
          value={texto}
          onChange={e => setTexto(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
        />
        <button type="submit" disabled={!texto.trim()}
          className="p-2.5 rounded-xl transition-all disabled:opacity-40 hover:brightness-110"
          style={{ background: 'linear-gradient(135deg, #1a3a5c, #1e4d6e)', border: '1px solid #3a8abf' }}>
          <Send size={16} className="text-white" />
        </button>
      </form>
    </div>
  )
}
