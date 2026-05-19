import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada' }, { status: 500 })
  }

  const formData = await request.formData()
  const file = formData.get('foto') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No se recibió imagen' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp'

  const message = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `Extrae la tabla de planeación de producción de esta imagen.
Las columnas pueden llamarse: PROCESO, TRIP (personal planeado), TURNO, REF o SKU, DESCRIPCION o PRODUCTO, LOTE, UND DE MEDIDA o UNIDAD, META o CANTIDAD.

Devuelve SOLO un JSON válido con un array de objetos con estas claves exactas:
[{
  "sku": "valor de REF o null",
  "producto": "valor de DESCRIPCION/PRODUCTO",
  "proceso": "valor de PROCESO",
  "turno": "MAÑANA, TARDE o NOCHE",
  "personal_planeado": número de TRIP o null,
  "cantidad": número de META/CANTIDAD,
  "unidad": "valor de UND DE MEDIDA o null",
  "lote": "valor de LOTE o null si está vacío",
  "notas": null
}]

Si algún campo no aparece o está vacío en la imagen, usa null. No añadas texto adicional, solo el JSON.`,
          },
        ],
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No se encontró JSON en la respuesta')
    const actividades = JSON.parse(jsonMatch[0])
    return NextResponse.json({ actividades })
  } catch {
    return NextResponse.json({ error: 'No se pudo leer la planeación de la imagen', raw: text }, { status: 422 })
  }
}
