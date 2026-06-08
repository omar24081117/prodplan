import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const checks: Record<string, string> = {}

  // Check despachos table
  const { error: despErr } = await supabase.from('despachos').select('id').limit(1)
  checks.despachos_table = despErr
    ? (despErr.message.toLowerCase().includes('exist') ? 'MISSING' : `ERROR: ${despErr.message}`)
    : 'OK'

  // Check personal.rol column
  const { error: rolErr } = await supabase.from('personal').select('rol').limit(1)
  checks.personal_rol_column = rolErr
    ? (rolErr.message.includes('rol') ? 'MISSING' : `ERROR: ${rolErr.message}`)
    : 'OK'

  const allOk = Object.values(checks).every(v => v === 'OK')

  const sql = `-- Ejecutar en Supabase → SQL Editor → New query

create table if not exists public.despachos (
  id uuid primary key default gen_random_uuid(),
  linea text,
  cliente text not null,
  oc text,
  documento text,
  fecha_subida date,
  fecha_max_entrega date,
  fecha_despacho date,
  factura text,
  entrega_tipo text check (entrega_tipo in ('PARCIAL', 'COMPLETA')),
  guia text,
  proveedor_despacho text,
  observaciones text,
  created_at timestamptz not null default now()
);
alter table public.despachos enable row level security;
create policy "despachos_all" on public.despachos
  for all using (true) with check (true);

alter table public.personal add column if not exists rol text default 'Operario';
update public.personal set rol = 'Operario' where rol is null;`

  return NextResponse.json({
    status: allOk ? 'ready' : 'needs_setup',
    checks,
    sql_to_run: allOk ? null : sql,
  })
}
