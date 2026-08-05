'use client'

import { useRouter } from 'next/navigation'
import { ShoppingCart, MessageSquare, ArrowLeft } from 'lucide-react'
import LeafBackground from '@/components/LeafBackground'

export default function SolicitudesPage() {
  const router = useRouter()

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center p-6 gap-6"
      style={{ background: '#d4e8b8' }}>
      <LeafBackground />

      <div className="relative z-10 text-center mb-2">
        <h1 className="text-3xl font-bold text-white tracking-wide">Solicitudes y Mensajería</h1>
        <p className="text-gray-400 text-sm mt-1">Selecciona un módulo para continuar</p>
      </div>

      <div className="relative z-10 w-full max-w-sm flex flex-col gap-4">

        {/* Solicitudes de Compra */}
        <button
          onClick={() => router.push('/solicitudes/compras')}
          className="w-full rounded-2xl p-6 flex items-center justify-between transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #0e4f5c, #0f6674)', border: '1px solid #22b8cc', boxShadow: '0 4px 20px rgba(34,184,204,0.25)' }}>
          <div className="text-left">
            <p className="text-white font-bold text-xl">Solicitudes de Compra</p>
            <p className="text-cyan-200/70 text-sm mt-0.5">Solicita materiales e insumos</p>
          </div>
          <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <ShoppingCart size={36} strokeWidth={1.5} className="text-white" />
          </div>
        </button>

        {/* Mensajería */}
        <button
          onClick={() => router.push('/solicitudes/mensajeria')}
          className="w-full rounded-2xl p-6 flex items-center justify-between transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #1a3a5c, #1e4d6e)', border: '1px solid #3a8abf', boxShadow: '0 4px 20px rgba(30,120,180,0.25)' }}>
          <div className="text-left">
            <p className="text-white font-bold text-xl">Mensajería</p>
            <p className="text-blue-200/70 text-sm mt-0.5">Comunicación interna del equipo</p>
          </div>
          <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <MessageSquare size={36} strokeWidth={1.5} className="text-white" />
          </div>
        </button>

        <button onClick={() => router.push('/')}
          className="flex items-center justify-center gap-2 text-gray-400 hover:text-white text-sm transition-colors mt-2">
          <ArrowLeft size={14} /> Volver al inicio
        </button>
      </div>
    </main>
  )
}
