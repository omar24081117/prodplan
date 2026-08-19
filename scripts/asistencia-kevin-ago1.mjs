// Genera asistencia manual para Kevin Ballesteros el 2026-08-01: 06:00 – 15:30
// Ejecutar: node scripts/asistencia-kevin-ago1.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://wmxcumqecagjniakkpjp.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndteGN1bXFlY2Fnam5pYWtrcGpwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODg1NzA5OCwiZXhwIjoyMDk0NDMzMDk4fQ.gw4_FozqJcgys8r7YWuYXOM92eWcgd5xFtn5Wde4tDA'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const CEDULA = '1006103804'
const FECHA  = '2026-08-01'

// Verificar si ya existe registro ese día
const { data: existente } = await supabase
  .from('asistencia')
  .select('*')
  .eq('cedula', CEDULA)
  .eq('fecha', FECHA)
  .maybeSingle()

if (existente) {
  console.log('Registro existente:', existente)
  console.log('\nActualizando hora_ingreso y hora_salida...')
  const { error } = await supabase
    .from('asistencia')
    .update({ hora_ingreso: '06:00', hora_salida: '15:30' })
    .eq('cedula', CEDULA)
    .eq('fecha', FECHA)
  if (error) { console.error('✗ Error:', error.message); process.exit(1) }
  console.log('✅ Actualizado: Kevin Ballesteros | 2026-08-01 | 06:00 → 15:30')
} else {
  const { error } = await supabase
    .from('asistencia')
    .insert({
      cedula:       CEDULA,
      nombre:       'Kevin esteban Ballesteros',
      fecha:        FECHA,
      hora_ingreso: '06:00',
      hora_salida:  '15:30',
    })
  if (error) { console.error('✗ Error:', error.message); process.exit(1) }
  console.log('✅ Insertado: Kevin Ballesteros | 2026-08-01 | 06:00 → 15:30')
}
