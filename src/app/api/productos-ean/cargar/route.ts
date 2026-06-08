import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.\-_]/g, '').replace(/\s+/g, ' ').trim()
}

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
  if (!rows.length) return NextResponse.json({ error: 'Archivo vacío' }, { status: 400 })

  const headers = Object.keys(rows[0])
  const findCol = (...kw: string[]) => headers.find(h => kw.some(k => norm(h).includes(k))) ?? null

  const COL_REF  = findCol('ref', 'referencia', 'codigo', 'code')
  const COL_DESC = findCol('desc', 'nombre', 'name', 'producto')
  const COL_TIPO = findCol('tipo', 'type', 'categoria', 'familia')
  const COL_EAN  = findCol('ean', 'barcode', 'codigo de barra', 'ean13')

  if (!COL_REF || !COL_DESC) {
    return NextResponse.json({ error: 'No se encontraron columnas REF y DESCRIPCION' }, { status: 400 })
  }

  const raw = rows.map(r => ({
    referencia:  String(r[COL_REF!] ?? '').trim(),
    descripcion: String(r[COL_DESC!] ?? '').trim(),
    tipo:        COL_TIPO ? String(r[COL_TIPO] ?? '').trim() || null : null,
    ean13:       COL_EAN  ? String(r[COL_EAN]  ?? '').trim() || null : null,
    activo: true,
  })).filter(p => p.referencia && p.descripcion)

  // Deduplicar por referencia (última fila gana)
  const dedupMap = new Map<string, typeof raw[0]>()
  for (const p of raw) dedupMap.set(p.referencia, p)
  const productos = [...dedupMap.values()]

  if (!productos.length) return NextResponse.json({ error: 'Sin filas válidas' }, { status: 400 })

  const supabase = await createClient()
  const BATCH = 500
  let total = 0
  for (let i = 0; i < productos.length; i += BATCH) {
    const { data, error } = await supabase
      .from('productos_ean')
      .upsert(productos.slice(i, i + BATCH), { onConflict: 'referencia' })
      .select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    total += data?.length ?? 0
  }

  return NextResponse.json({ cargados: total, total_filas: rows.length })
}
