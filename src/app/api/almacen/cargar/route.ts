import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

// Para texto general (categorías, nombres)
function normalizar(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

// Para detección de columnas: elimina puntos, guiones y espacios extra
// "U.M." → "um"  |  "Desc. item" → "desc item"  |  "Cant. existencia" → "cant existencia"
function normCol(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.\-_]/g, '').replace(/\s+/g, ' ').trim()
}

// Parsear números en formato colombiano: "$2.500,00" → 2500.00
function parsearNum(v: unknown): number {
  if (typeof v === 'number') return isNaN(v) ? 0 : v
  const s = String(v ?? '').replace(/\$/g, '').replace(/\s/g, '')
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(s)) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.'))
  }
  if (/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(s)) {
    return parseFloat(s.replace(/,/g, ''))
  }
  return parseFloat(s.replace(',', '.')) || 0
}

const MAP_CATEGORIA: Record<string, string> = {
  'materias primas':          'materia_prima',
  'materia prima':            'materia_prima',
  'materia_prima':            'materia_prima',
  'mp':                       'materia_prima',
  'insumo':                   'materia_prima',
  'insumos':                  'materia_prima',
  'materia':                  'materia_prima',
  'material de empaque':      'material_empaque',
  'material empaque':         'material_empaque',
  'material_empaque':         'material_empaque',
  'me':                       'material_empaque',
  'empaque':                  'material_empaque',
  'empaques':                 'material_empaque',
  'packaging':                'material_empaque',
  'producto terminado':       'producto_terminado',
  'productos terminados':     'producto_terminado',
  'producto_terminado':       'producto_terminado',
  'pt':                       'producto_terminado',
  'terminado':                'producto_terminado',
  'terminados':               'producto_terminado',
  'producto manufacturado':   'producto_terminado',
  'productos manufacturados': 'producto_terminado',
  'manufacturado':            'producto_terminado',
  'manufacturados':           'producto_terminado',
  'prod. manufacturado':      'producto_terminado',
  'prod manufacturado':       'producto_terminado',
  'producto elaborado':       'producto_terminado',
  'productos elaborados':     'producto_terminado',
}

const CATS_OMITIR = ['mano de obra', 'ajuste', 'mod', 'indirecto']

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

  if (rows.length === 0) return NextResponse.json({ error: 'Archivo vacío' }, { status: 400 })

  const headers = Object.keys(rows[0])
  function findCol(...keywords: string[]) {
    return headers.find(h => keywords.some(k => normCol(h).includes(k))) ?? null
  }

  const COL_CODIGO  = findCol('referencia', 'codigo', 'code', 'ref')
  const COL_NOMBRE  = findCol('desc item', 'descripcion', 'nombre', 'name', 'producto')
  const COL_BODEGA  = findCol('bodega', 'almacen', 'warehouse', 'ubicacion', 'loc')
  const COL_CAT     = findCol('tipo inventario', 'categoria', 'tipo', 'category', 'clase')
  const COL_UNIDAD  = findCol('um', 'unidad', 'unit', 'und')   // "U.M." → "um" ✓
  const COL_COSTO   = findCol('costo prom', 'costo', 'precio', 'cost', 'valor')
  const COL_STOCK   = findCol('cant existencia', 'existencia', 'cantidad', 'stock', 'disponible', 'cant')

  if (!COL_NOMBRE) return NextResponse.json({ error: 'No se encontró columna de descripción/nombre' }, { status: 400 })

  // Cada fila = un producto en una bodega específica
  const productos: Record<string, unknown>[] = []

  rows.forEach((row, i) => {
    const nombre = String(row[COL_NOMBRE!] ?? '').trim()
    if (!nombre) return

    const codigo  = COL_CODIGO ? String(row[COL_CODIGO] ?? '').trim() : `ITEM-${i + 1}`
    if (!codigo) return

    const catRaw  = COL_CAT ? normalizar(String(row[COL_CAT] ?? '')) : ''
    if (CATS_OMITIR.some(x => catRaw.includes(x))) return

    const categoria = MAP_CATEGORIA[catRaw] ?? 'materia_prima'
    const bodega    = COL_BODEGA ? String(row[COL_BODEGA] ?? '001').trim() || '001' : '001'
    const unidad    = COL_UNIDAD ? String(row[COL_UNIDAD] ?? 'UN').trim() : 'UN'
    const costo     = COL_COSTO ? parsearNum(row[COL_COSTO]) : 0
    const stock     = COL_STOCK ? parsearNum(row[COL_STOCK]) : 0

    productos.push({
      codigo,
      nombre,
      categoria,
      bodega,
      unidad_medida: unidad || 'UN',
      costo_unitario: Math.round(costo * 10000) / 10000,
      stock_sistema: Math.round(stock * 10000) / 10000,
      activo: true,
      updated_at: new Date().toISOString(),
    })
  })

  if (productos.length === 0) {
    return NextResponse.json({ error: 'Sin productos válidos para cargar' }, { status: 400 })
  }

  const supabase = await createClient()

  // Cargar en lotes de 500 para superar el límite de 1000 filas de Supabase
  const BATCH = 500
  let totalCargados = 0
  for (let i = 0; i < productos.length; i += BATCH) {
    const lote = productos.slice(i, i + BATCH)
    const { data: d, error } = await supabase
      .from('almacen_productos')
      .upsert(lote, { onConflict: 'codigo,bodega' })
      .select('id')
    if (error) return NextResponse.json({ error: `Lote ${Math.floor(i/BATCH)+1}: ${error.message}` }, { status: 500 })
    totalCargados += d?.length ?? lote.length
  }

  const bodegas = [...new Set(productos.map(p => p.bodega as string))].sort()

  return NextResponse.json({
    cargados: totalCargados,
    total_filas: rows.length,
    bodegas,
    mensaje: `${totalCargados} registros cargados en ${bodegas.length} bodega(s): ${bodegas.join(', ')}`,
  })
}
