// Carga personal administrativo desde Excel a la tabla personal
// Ejecutar: node scripts/cargar-personal-admin.mjs

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const SUPABASE_URL = 'https://wmxcumqecagjniakkpjp.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndteGN1bXFlY2Fnam5pYWtrcGpwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODg1NzA5OCwiZXhwIjoyMDk0NDMzMDk4fQ.gw4_FozqJcgys8r7YWuYXOM92eWcgd5xFtn5Wde4tDA'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const wb = XLSX.readFile('C:/Users/PT/Desktop/PERSONAL ADMINISTRATIVO.xlsx')
const ws = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })

const personas = rows
  .filter(r => r.length >= 2 && r[0] && r[1])
  .map(r => ({
    cedula:        String(r[0]).trim(),
    nombre:        String(r[1]).replace(/\s+/g, ' ').trim(),
    rol:           'Administrativo',
    tipo_contrato: 'Fijo',
    activo:        true,
  }))

console.log(`Personas a cargar: ${personas.length}`)
personas.forEach(p => console.log(`  ${p.cedula}  ${p.nombre}`))

const { error } = await supabase
  .from('personal')
  .upsert(personas, { onConflict: 'cedula' })

if (error) { console.error('\n✗ Error:', error.message); process.exit(1) }
console.log(`\n✅ ${personas.length} personas cargadas al listado de personal (rol: Administrativo)`)
