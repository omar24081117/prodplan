import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Leaf, LayoutDashboard, CalendarDays, Play, ClipboardCheck, BookOpen, Users, UserCog, Settings, LogOut } from 'lucide-react'

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
          <Link href="/admin" className="flex items-center gap-2">
            <Leaf size={22} strokeWidth={1.5} className="text-green-400" />
            <span className="text-white font-bold text-lg tracking-wide">PRODPLAN</span>
          </Link>
          <div className="hidden sm:flex items-center gap-1 text-sm">
            {[
              { href: '/admin', icon: <LayoutDashboard size={14} />, label: 'Dashboard' },
              { href: '/admin/planeacion', icon: <CalendarDays size={14} />, label: 'Planeación' },
              { href: '/admin/ejecucion', icon: <Play size={14} />, label: 'Ejecución' },
              { href: '/admin/asistencia', icon: <ClipboardCheck size={14} />, label: 'Asistencia' },
              { href: '/admin/catalogo', icon: <BookOpen size={14} />, label: 'Catálogo' },
              { href: '/admin/personal', icon: <Users size={14} />, label: 'Personal' },
              { href: '/admin/usuarios', icon: <UserCog size={14} />, label: 'Usuarios' },
            ].map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-1.5 text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/config" className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors">
            <Settings size={14} />
            <span className="hidden sm:inline">Config</span>
          </Link>
          <form action={logout}>
            <button type="submit" className="flex items-center gap-1.5 text-gray-400 hover:text-red-400 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors">
              <LogOut size={14} />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </form>
        </div>
      </nav>
      <div className="flex-1 p-4 sm:p-6">
        {children}
      </div>
    </div>
  )
}
