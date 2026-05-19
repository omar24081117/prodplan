import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('archivo') as File | null
    if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]

    const rows: (string | number | null)[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      blankrows: false,
      raw: false,
    }) as (string | number | null)[][]

    if (rows.length < 1) {
      return NextResponse.json({ error: 'Archivo vacío' }, { status: 400 })
    }

    // Detectar si la primera fila es encabezado (contiene "PARO", "CAUSAL", "NOMBRE", etc.)
    const firstRow = String(rows[0][0] ?? '').toUpperCase().trim()
    const isHeader = ['PARO', 'CAUSAL', 'NOMBRE', 'DESCRIPCION', 'DESCRIPCIÓN'].some(h => firstRow.includes(h))
    const dataRows = isHeader ? rows.slice(1) : rows

    const nombres: string[] = []
    for (const row of dataRows) {
      const val = String(row[0] ?? '').trim().toUpperCase()
      if (val && val.length > 1) nombres.push(val)
    }

    if (nombres.length === 0) {
      return NextResponse.json({ error: 'No se encontraron causales en el archivo' }, { status: 400 })
    }

    const supabase = await createClient()

    // Obtener el orden máximo actual
    const { data: maxRow } = await supabase
      .from('causales_paro')
      .select('orden')
      .order('orden', { ascending: false })
      .limit(1)
      .maybeSingle()
    let nextOrden = (maxRow?.orden ?? -1) + 1

    const registros = nombres.map(nombre => ({ nombre, activo: true, orden: nextOrden++ }))

    const { data, error } = await supabase
      .from('causales_paro')
      .upsert(registros, { onConflict: 'nombre', ignoreDuplicates: false })
      .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({
      ok: true,
      total: data?.length ?? registros.length,
      causales: nombres,
    })
  } catch (err) {
    console.error('[causales-paro/import]', err)
    return NextResponse.json({ error: 'Error al procesar el archivo: ' + String(err) }, { status: 500 })
  }
}
