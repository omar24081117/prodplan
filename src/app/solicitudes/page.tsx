'use client'

import { useRouter } from 'next/navigation'
import { ShoppingCart, Send, ArrowLeft } from 'lucide-react'

export default function SolicitudesPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => router.push('/')} className="text-gray-500 hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold text-white">Solicitudes</h1>
        </div>

        <div className="flex flex-col gap-4">
          <button onClick={() => router.push('/solicitudes/compras')}
            className="p-6 rounded-2xl text-left transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, #0e4f5c, #0f6674)', border: '1px solid #22b8cc' }}>
            <ShoppingCart size={28} className="text-cyan-300 mb-3" />
            <p className="text-white font-bold text-lg">Solicitudes de Compra</p>
            <p className="text-cyan-200/60 text-sm mt-1">Materiales, insumos y suministros internos</p>
          </button>

          <button onClick={() => router.push('/solicitudes/mensajeria')}
            className="p-6 rounded-2xl text-left transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, #3b1c5c, #4c2580)', border: '1px solid #9333ea' }}>
            <Send size={28} className="text-purple-300 mb-3" />
            <p className="text-white font-bold text-lg">Mensajería</p>
            <p className="text-purple-200/60 text-sm mt-1">Envíos, correspondencia y entregas externas</p>
          </button>
        </div>
      </div>
    </div>
  )
}
