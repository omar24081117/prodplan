import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const TZ = 'America/Bogota'

function getTurno(): string {
  const hour = parseInt(new Date().toLocaleString('en-US', { timeZone: TZ, hour: 'numeric', hour12: false }))
  if (hour >= 6 && hour < 14) return 'MAÑANA'
  if (hour >= 14 && hour < 22) return 'TARDE'
  return 'NOCHE'
}

function getHoraLocal(): string {
  return new Date().toLocaleTimeString('es-CO', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })
}

function getFechaLocal(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ })
}

export async function POST(request: NextRequest) {
  const { cedula, tipo } = await request.json()

  if (!cedula || !tipo) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
  }

  const supabase = await createClient()

  // Verificar que la cédula existe en personal
  const { data: persona, error: personaError } = await supabase
    .from('personal')
    .select('cedula, nombre')
    .eq('cedula', cedula)
    .eq('activo', true)
    .single()

  if (personaError || !persona) {
    return NextResponse.json({ error: 'Cédula no registrada' }, { status: 404 })
  }

  const fecha = getFechaLocal()
  const hora = getHoraLocal()
  const turno = getTurno()

  if (tipo === 'entrada') {
    const { data: existente } = await supabase
      .from('asistencia')
      .select('id, hora_ingreso')
      .eq('cedula', cedula)
      .eq('fecha', fecha)
      .single()

    if (existente) {
      return NextResponse.json(
        { error: `Ya registraste entrada hoy a las ${existente.hora_ingreso}` },
        { status: 409 }
      )
    }

    const { error } = await supabase.from('asistencia').insert({
      cedula: persona.cedula,
      nombre: persona.nombre,
      fecha,
      turno,
      hora_ingreso: hora,
    })

    if (error) {
      return NextResponse.json({ error: 'Error al registrar entrada' }, { status: 500 })
    }

    return NextResponse.json({ nombre: persona.nombre, hora, tipo: 'entrada', turno })
  }

  if (tipo === 'salida') {
    const { data: registro } = await supabase
      .from('asistencia')
      .select('id, hora_salida')
      .eq('cedula', cedula)
      .eq('fecha', fecha)
      .single()

    if (!registro) {
      return NextResponse.json({ error: 'No tienes entrada registrada hoy' }, { status: 404 })
    }

    if (registro.hora_salida) {
      return NextResponse.json(
        { error: `Ya registraste salida hoy a las ${registro.hora_salida}` },
        { status: 409 }
      )
    }

    const { error } = await supabase
      .from('asistencia')
      .update({ hora_salida: hora })
      .eq('id', registro.id)

    if (error) {
      return NextResponse.json({ error: 'Error al registrar salida' }, { status: 500 })
    }

    return NextResponse.json({ nombre: persona.nombre, hora, tipo: 'salida' })
  }

  return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
}
