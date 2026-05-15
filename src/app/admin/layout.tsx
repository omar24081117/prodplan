import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/?error=admin_required')

  async function logout() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <nav className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="text-white font-bold text-lg">PRODPLAN</span>
          <div className="hidden sm:flex items-center gap-4 text-sm">
            <Link href="/admin" className="text-gray-400 hover:text-white transition-colors">Dashboard</Link>
            <Link href="/admin/planeacion" className="text-gray-400 hover:text-white transition-colors">Planeación</Link>
            <Link href="/admin/ejecucion" className="text-gray-400 hover:text-white transition-colors">Ejecución</Link>
            <Link href="/admin/asistencia" className="text-gray-400 hover:text-white transition-colors">Asistencia</Link>
            <Link href="/admin/catalogo" className="text-gray-400 hover:text-white transition-colors">Catálogo</Link>
            <Link href="/admin/personal" className="text-gray-400 hover:text-white transition-colors">Personal</Link>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/config" className="text-gray-400 hover:text-white text-sm transition-colors">⚙️ Config</Link>
          <form action={logout}>
            <button type="submit" className="text-gray-400 hover:text-red-400 text-sm transition-colors">Salir</button>
          </form>
        </div>
      </nav>
      <div className="flex-1 p-4 sm:p-6">
        {children}
      </div>
    </div>
  )
}
