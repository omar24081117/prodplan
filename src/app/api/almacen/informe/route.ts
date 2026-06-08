import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
function fmtFecha(f: string) { const [y,m,d]=f.split('-'); return `${d} ${MESES[parseInt(m)-1]} ${y}` }

const CAT_LABEL: Record<string, string> = {
  materia_prima:      'Materias Primas',
  material_empaque:   'Material de Empaque',
  producto_terminado: 'Productos Manufacturados',
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const desde  = searchParams.get('desde')
  const hasta  = searchParams.get('hasta')
  const exportar = searchParams.get('exportar') === 'true'

  if (!desde || !hasta) return NextResponse.json({ error: 'desde y hasta requeridos' }, { status: 400 })

  const supabase = await createClient()

  type ConteoRow = {
    fecha: string; conteo_fisico: number; diferencia: number; stock_sistema: number
    almacen_productos: { id: string; codigo: string; nombre: string; categoria: string; unidad_medida: string; costo_unitario: number; stock_sistema: number } | null
  }

  // Paginar conteos (puede haber más de 1000)
  const PAGE = 1000
  let conteos: ConteoRow[] = []
  let page = 0
  while (true) {
    const { data, error } = await supabase
      .from('almacen_conteos')
      .select('*, almacen_productos(id, codigo, nombre, categoria, unidad_medida, costo_unitario, stock_sistema)')
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha')
      .range(page * PAGE, (page + 1) * PAGE - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) break
    conteos = conteos.concat(data as ConteoRow[])
    if (data.length < PAGE) break
    page++
  }

  // Agrupar por producto
  type ProdInfo = {
    codigo: string; nombre: string; categoria: string
    unidad_medida: string; costo_unitario: number; stock_sistema: number
    conteos: { fecha: string; conteo_fisico: number; diferencia: number; stock_sistema: number }[]
  }

  const productoMap: Record<string, ProdInfo> = {}
  for (const c of conteos ?? []) {
    const p = c.almacen_productos
    if (!p) continue
    if (!productoMap[p.id]) {
      productoMap[p.id] = { ...p, conteos: [] }
    }
    productoMap[p.id].conteos.push({
      fecha: c.fecha,
      conteo_fisico: c.conteo_fisico,
      diferencia: c.diferencia,
      stock_sistema: c.stock_sistema,
    })
  }

  const productos = Object.values(productoMap).map(p => {
    const difs = p.conteos.map(c => c.diferencia)
    const total_dif = difs.reduce((s, d) => s + d, 0)
    const prom_dif  = difs.length ? total_dif / difs.length : 0
    const valor_dif = total_dif * p.costo_unitario
    return { ...p, total_dif, prom_dif, valor_dif, dias_contados: difs.length }
  }).sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre))

  if (!exportar) return NextResponse.json({ desde, hasta, productos })

  // ──── Exportar a Excel ────
  const wb = XLSX.utils.book_new()

  // Hoja Resumen
  const resumen = productos.map(p => ({
    'CATEGORÍA':       CAT_LABEL[p.categoria] ?? p.categoria,
    'CÓDIGO':          p.codigo,
    'PRODUCTO':        p.nombre,
    'UNIDAD':          p.unidad_medida,
    'STOCK SISTEMA':   p.stock_sistema,
    'DÍAS CONTADOS':   p.dias_contados,
    'TOTAL VARIACIÓN': Math.round(p.total_dif * 10000) / 10000,
    'PROM. VARIACIÓN': Math.round(p.prom_dif * 10000) / 10000,
    'COSTO UNIT.':     p.costo_unitario,
    'VALOR VARIACIÓN': Math.round(p.valor_dif * 100) / 100,
  }))
  const wsRes = XLSX.utils.json_to_sheet(resumen)
  wsRes['!cols'] = [{ wch:22 },{ wch:12 },{ wch:32 },{ wch:8 },{ wch:14 },{ wch:14 },{ wch:16 },{ wch:16 },{ wch:14 },{ wch:16 }]
  XLSX.utils.book_append_sheet(wb, wsRes, 'Resumen')

  // Hoja Detalle
  const detalle: Record<string,string|number>[] = []
  for (const p of productos) {
    for (const c of p.conteos) {
      detalle.push({
        'FECHA':           fmtFecha(c.fecha),
        'CATEGORÍA':       CAT_LABEL[p.categoria] ?? p.categoria,
        'CÓDIGO':          p.codigo,
        'PRODUCTO':        p.nombre,
        'UNIDAD':          p.unidad_medida,
        'STOCK SISTEMA':   c.stock_sistema,
        'CONTEO FÍSICO':   c.conteo_fisico,
        'DIFERENCIA':      c.diferencia,
        'COSTO UNIT.':     p.costo_unitario,
        'VALOR VARIACIÓN': Math.round(c.diferencia * p.costo_unitario * 100) / 100,
      })
    }
  }
  const wsDet = XLSX.utils.json_to_sheet(detalle)
  wsDet['!cols'] = [{ wch:20 },{ wch:22 },{ wch:12 },{ wch:32 },{ wch:8 },{ wch:14 },{ wch:14 },{ wch:12 },{ wch:14 },{ wch:16 }]
  XLSX.utils.book_append_sheet(wb, wsDet, 'Detalle Diario')

  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
  const nombre = `informe-almacen_${desde}_${hasta}.xlsx`
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombre}"`,
    },
  })
}
