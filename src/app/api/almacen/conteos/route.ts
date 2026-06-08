import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Producto = {
  id: string; codigo: string; nombre: string; categoria: string; bodega: string
  unidad_medida: string; costo_unitario: number; stock_sistema: number; activo: boolean
}
type Conteo = {
  id: string; fecha: string; producto_id: string; stock_sistema: number
  conteo_fisico: number; diferencia: number; observacion: string | null
  contado_por_nombre: string | null
}

async function fetchAll<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: () => any,
  PAGE = 1000
): Promise<T[]> {
  let result: T[] = []
  let page = 0
  while (true) {
    const { data, error } = await query()
      .range(page * PAGE, (page + 1) * PAGE - 1)
    if (error || !data || data.length === 0) break
    result = result.concat(data as T[])
    if (data.length < PAGE) break
    page++
  }
  return result
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const fecha = searchParams.get('fecha')
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')

  const supabase = await createClient()

  if (fecha) {
    const productos = await fetchAll<Producto>(() =>
      supabase.from('almacen_productos').select('*').eq('activo', true).order('bodega').order('nombre')
    )

    const conteos = await fetchAll<Conteo>(() =>
      supabase.from('almacen_conteos').select('*').eq('fecha', fecha)
    )

    const conteoMap: Record<string, { conteo_fisico: number; diferencia: number; observacion: string; contado_por_nombre: string }> = {}
    for (const c of conteos) {
      conteoMap[c.producto_id] = {
        conteo_fisico: c.conteo_fisico,
        diferencia: c.diferencia,
        observacion: c.observacion ?? '',
        contado_por_nombre: c.contado_por_nombre ?? '',
      }
    }

    const resultado = productos.map(p => ({
      ...p,
      conteo: conteoMap[p.id] ?? null,
    }))

    return NextResponse.json({ fecha, productos: resultado })
  }

  if (desde && hasta) {
    const { data: conteos, error } = await supabase
      .from('almacen_conteos')
      .select('*, almacen_productos(codigo, nombre, categoria, unidad_medida, costo_unitario)')
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha')
      .order('almacen_productos(nombre)')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ desde, hasta, conteos })
  }

  return NextResponse.json({ error: 'Parámetros requeridos: fecha o desde+hasta' }, { status: 400 })
}

export async function POST(request: NextRequest) {
  const { fecha, conteos, usuario_cedula, usuario_nombre } = await request.json()
  if (!fecha || !Array.isArray(conteos)) {
    return NextResponse.json({ error: 'fecha y conteos requeridos' }, { status: 400 })
  }

  const supabase = await createClient()

  const ids = conteos.map((c: { producto_id: string }) => c.producto_id)
  const { data: productos } = await supabase
    .from('almacen_productos')
    .select('id, stock_sistema')
    .in('id', ids)

  const stockMap: Record<string, number> = {}
  for (const p of productos ?? []) stockMap[p.id] = p.stock_sistema

  const rows = conteos.map((c: { producto_id: string; conteo_fisico: number; observacion?: string }) => ({
    fecha,
    producto_id: c.producto_id,
    stock_sistema: stockMap[c.producto_id] ?? 0,
    conteo_fisico: c.conteo_fisico,
    contado_por_cedula: usuario_cedula ?? null,
    contado_por_nombre: usuario_nombre ?? null,
    observacion: c.observacion ?? null,
  }))

  // Guardar en lotes
  const BATCH = 500
  let guardados = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const { data, error } = await supabase
      .from('almacen_conteos')
      .upsert(rows.slice(i, i + BATCH), { onConflict: 'fecha,producto_id' })
      .select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    guardados += data?.length ?? 0
  }

  return NextResponse.json({ guardados })
}
