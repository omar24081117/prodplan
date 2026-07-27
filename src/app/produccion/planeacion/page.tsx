'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Upload, Loader2, X, AlertTriangle, Package,
  BarChart2, Calendar, ListChecks, RefreshCw, Construction, Trash2, MessageSquare, Download, Truck, Plus
} from 'lucide-react'
import * as XLSX from 'xlsx'

/* ──────────────────────────────────────────────────────────────────────────
   Types
────────────────────────────────────────────────────────────────────────── */
type InventarioPT = {
  id: string
  referencia: string
  descripcion: string | null
  bodega: string | null
  um: string | null
  existencia: number
  tipo: string | null
  fecha_ultima: string | null
  semana_actualizacion: string | null  // ISO Monday date — existencia es válida a partir de esta semana
}

type PlanEntry = {
  referencia: string
  semana_inicio: string
  pedido: number
  produccion: number
}

type Actividad = {
  id: string
  referencia: string
  descripcion_producto: string | null
  actividad: string
  sub_referencia: string | null
  orden: number
}

/* ──────────────────────────────────────────────────────────────────────────
   Week helpers
────────────────────────────────────────────────────────────────────────── */
function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function toISO(d: Date): string {
  // Use local date parts to avoid UTC timezone shift
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function isoToDate(s: string): Date {
  const [y, m, day] = s.split('-').map(Number)
  return new Date(y, m - 1, day)
}

function fmtShortDate(iso: string): string {
  const d = isoToDate(iso)
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function getMonthLabel(iso: string): string {
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const d = isoToDate(iso)
  return `${meses[d.getMonth()]} ${d.getFullYear()}`
}

function generateSemanas(): string[] {
  // All Mondays of the current year (Jan → Dec)
  const year = new Date().getFullYear()
  const semanas: string[] = []
  // Find the first Monday of the year (or last Monday of Dec prior)
  const jan1 = new Date(year, 0, 1)
  let monday = getMonday(jan1)
  // If that Monday is in the previous year, advance one week
  if (monday.getFullYear() < year) monday = new Date(monday.getTime() + 7 * 86400 * 1000)
  while (monday.getFullYear() === year) {
    semanas.push(toISO(monday))
    monday = new Date(monday.getTime() + 7 * 86400 * 1000)
  }
  return semanas
}

const FC_WINDOW = 10
const DM_WINDOW = 10
// Computed once at module load — deterministic (same year, same result)
const _ALL_SEMANAS = generateSemanas()
const _HOY_LUNES   = toISO(getMonday(new Date()))
const _DEFAULT_FC_OFFSET = Math.max(0, Math.min(
  _ALL_SEMANAS.indexOf(_HOY_LUNES) > 0 ? _ALL_SEMANAS.indexOf(_HOY_LUNES) - 1 : 0,
  _ALL_SEMANAS.length - FC_WINDOW
))

/* ──────────────────────────────────────────────────────────────────────────
   SQL Banner
────────────────────────────────────────────────────────────────────────── */
const SQL_SETUP = `-- Ejecutar en Supabase SQL Editor:
create table if not exists public.inventario_pt (
  id uuid primary key default gen_random_uuid(),
  referencia text not null unique,
  descripcion text, bodega text, um text default 'UND',
  existencia numeric default 0, tipo text default 'PT',
  fecha_ultima date, updated_at timestamptz default now()
);
alter table public.inventario_pt enable row level security;
create policy "inv_pt_all" on public.inventario_pt for all using (true) with check (true);
alter table public.inventario_pt add column if not exists semana_actualizacion date;

create table if not exists public.plan_semanal (
  id uuid primary key default gen_random_uuid(),
  referencia text not null, semana_inicio date not null,
  pedido numeric default 0, produccion numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(referencia, semana_inicio)
);
alter table public.plan_semanal enable row level security;
create policy "plan_sem_all" on public.plan_semanal for all using (true) with check (true);

create table if not exists public.plan_actividades_base (
  id uuid primary key default gen_random_uuid(),
  referencia text not null, descripcion_producto text,
  actividad text not null, sub_referencia text, orden integer default 0,
  created_at timestamptz default now()
);
alter table public.plan_actividades_base enable row level security;
create policy "plan_act_all" on public.plan_actividades_base for all using (true) with check (true);

create table if not exists public.plan_diario (
  id uuid primary key default gen_random_uuid(),
  referencia text not null, actividad text not null default '',
  fecha date not null, cantidad numeric default 0,
  updated_at timestamptz default now(),
  unique(referencia, actividad, fecha)
);
alter table public.plan_diario enable row level security;
create policy "plan_diario_all" on public.plan_diario for all using (true) with check (true);

create table if not exists public.plan_demanda_diaria (
  id uuid primary key default gen_random_uuid(),
  referencia text not null, fecha date not null,
  pedido numeric default 0, updated_at timestamptz default now(),
  unique(referencia, fecha)
);
alter table public.plan_demanda_diaria enable row level security;
create policy "plan_demanda_all" on public.plan_demanda_diaria for all using (true) with check (true);

create table if not exists public.plan_comentarios (
  referencia text not null, semana_inicio date not null,
  texto text not null, autor text,
  updated_at timestamptz default now(),
  primary key (referencia, semana_inicio)
);
alter table public.plan_comentarios enable row level security;
create policy "plan_com_all" on public.plan_comentarios for all using (true) with check (true);

create table if not exists public.despachos_almacen (
  id uuid primary key default gen_random_uuid(),
  referencia text not null,
  descripcion text,
  cantidad numeric not null,
  fecha date not null,
  semana_inicio date not null,
  creado_en timestamptz default now()
);
alter table public.despachos_almacen enable row level security;
create policy "despachos_all" on public.despachos_almacen for all using (true) with check (true);`

/* ──────────────────────────────────────────────────────────────────────────
   Actividades table — memoized so modal state changes don't re-render it
────────────────────────────────────────────────────────────────────────── */
const ActividadesTabla = React.memo(function ActividadesTabla({
  refsAct,
  actPorRef,
  filtroAct,
  onEditRef,
}: {
  refsAct: string[]
  actPorRef: Record<string, Actividad[]>
  filtroAct: string
  onEditRef?: (ref: string) => void
}) {
  if (refsAct.length === 0) return null
  return (
    <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: '1px solid #b7ddb7' }}>
      <table className="w-full text-xs">
        <thead>
          <tr style={{ background: '#c8e6c9', borderBottom: '2px solid #a3c9a3' }}>
            {['REF','PRODUCTO','ACTIVIDAD','REF INSUMO',''].map(h => (
              <th key={h} className="px-4 py-3 text-left font-bold uppercase tracking-wider"
                style={{ color: '#1a4a1a', fontSize: '0.65rem' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {refsAct.filter(ref => {
            if (!filtroAct) return true
            const q = filtroAct.toLowerCase()
            const acts = actPorRef[ref]
            return ref.toLowerCase().includes(q) || (acts[0]?.descripcion_producto ?? '').toLowerCase().includes(q)
          }).flatMap((ref, ri) => {
            const acts = actPorRef[ref]
            const rowBg = ri % 2 === 0 ? '#ffffff' : '#f0faf0'
            return acts.map((a, ai) => (
              <tr key={a.id} style={{ background: rowBg, borderBottom: '1px solid #d4edda' }}>
                <td className="px-4 py-2.5 font-mono font-bold" style={{ color: '#0d6a3a', minWidth: 80 }}>
                  {ai === 0 ? ref : ''}
                </td>
                <td className="px-4 py-2.5 font-medium" style={{ color: '#1a3a1a', maxWidth: 300 }}>
                  {ai === 0 ? (a.descripcion_producto ?? ref) : ''}
                </td>
                <td className="px-4 py-2.5">
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{
                      background: a.actividad.toLowerCase().includes('fabr') ? '#dbeafe'
                        : a.actividad.toLowerCase().includes('etiq') ? '#ede9fe'
                        : a.actividad.toLowerCase().includes('envas') ? '#fef9c3'
                        : '#dcfce7',
                      color: a.actividad.toLowerCase().includes('fabr') ? '#1d4ed8'
                        : a.actividad.toLowerCase().includes('etiq') ? '#7c3aed'
                        : a.actividad.toLowerCase().includes('envas') ? '#854d0e'
                        : '#166534',
                    }}>
                    {a.actividad}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono" style={{ color: '#4b6a4b' }}>
                  {a.sub_referencia ?? <span style={{ color: '#c0c0c0' }}>—</span>}
                </td>
                <td className="px-2 py-2.5 text-right" style={{ minWidth: 40 }}>
                  {ai === 0 && onEditRef && (
                    <button
                      onClick={() => onEditRef(ref)}
                      title="Editar / agregar actividades"
                      className="px-2 py-0.5 rounded text-xs font-bold hover:brightness-95 transition-all"
                      style={{ background: '#d4edda', border: '1px solid #a3c9a3', color: '#166534' }}>
                      + act.
                    </button>
                  )}
                </td>
              </tr>
            ))
          })}
        </tbody>
      </table>
    </div>
  )
})

/* ──────────────────────────────────────────────────────────────────────────
   Modal — Agregar Producto (isolated to avoid re-rendering the main table)
────────────────────────────────────────────────────────────────────────── */
function ModalAgregarProducto({
  onClose,
  onSave,
  initialRef = '',
  initialDesc = '',
  initialActs = [{ actividad: '', subRef: '' }],
}: {
  onClose: () => void
  onSave: (ref: string, desc: string, acts: { actividad: string; subRef: string }[]) => Promise<void>
  initialRef?: string
  initialDesc?: string
  initialActs?: { actividad: string; subRef: string }[]
}) {
  const [formRef,      setFormRef]      = useState(initialRef)
  const [formProducto, setFormProducto] = useState(initialDesc)
  const [formActivs,   setFormActivs]   = useState<{ actividad: string; subRef: string }[]>(initialActs)
  const [saving,       setSaving]       = useState(false)

  const isExisting = initialRef !== ''

  async function handleSave() {
    const ref  = formRef.trim()
    const desc = formProducto.trim()
    const acts = formActivs.filter(a => a.actividad.trim())
    if (!ref || !desc || acts.length === 0) return
    setSaving(true)
    await onSave(ref, desc, acts)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)', zIndex: 9999 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rounded-2xl p-6 w-full max-w-lg shadow-2xl overflow-y-auto"
        style={{ background: '#f0faf0', border: '1px solid #b7ddb7', maxHeight: '90vh', zIndex: 10000, position: 'relative' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base" style={{ color: '#1a4a1a' }}>
            {isExisting ? `Actividades · ${initialRef}` : 'Agregar Producto y Actividades'}
          </h3>
          <button onClick={onClose} style={{ color: '#6b9c6b' }}><X size={18} /></button>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs font-semibold" style={{ color: '#1a4a1a' }}>REF Producto</label>
              <input value={formRef} onChange={e => setFormRef(e.target.value)} placeholder="Ej: 10000"
                readOnly={isExisting}
                className="rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ background: isExisting ? '#e8f5e8' : '#fff', border: '1px solid #a3c9a3', color: '#1a4a1a' }} />
            </div>
            <div className="flex flex-col gap-1 flex-[2]">
              <label className="text-xs font-semibold" style={{ color: '#1a4a1a' }}>Nombre del Producto</label>
              <input value={formProducto} onChange={e => setFormProducto(e.target.value)} placeholder="Ej: NAT CREM HUME COCO X 300 ML"
                className="rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ background: '#fff', border: '1px solid #a3c9a3', color: '#1a4a1a' }} />
            </div>
          </div>
          <div className="mt-1">
            <label className="text-xs font-semibold mb-2 block" style={{ color: '#1a4a1a' }}>Actividades</label>
            <div className="flex flex-col gap-2">
              {formActivs.map((fa, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input value={fa.actividad} onChange={e => {
                    const arr = [...formActivs]; arr[i] = { ...arr[i], actividad: e.target.value }; setFormActivs(arr)
                  }} placeholder={`Actividad ${i + 1} (ej: Fabricación)`}
                    className="rounded-lg px-3 py-2 text-sm focus:outline-none flex-[2]"
                    style={{ background: '#fff', border: '1px solid #a3c9a3', color: '#1a4a1a' }} />
                  <input value={fa.subRef} onChange={e => {
                    const arr = [...formActivs]; arr[i] = { ...arr[i], subRef: e.target.value }; setFormActivs(arr)
                  }} placeholder="REF Insumo (opcional)"
                    className="rounded-lg px-3 py-2 text-sm focus:outline-none flex-1"
                    style={{ background: '#fff', border: '1px solid #a3c9a3', color: '#1a4a1a' }} />
                  {formActivs.length > 1 && (
                    <button onClick={() => setFormActivs(formActivs.filter((_, j) => j !== i))}
                      className="text-red-400 hover:text-red-600"><X size={14} /></button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setFormActivs([...formActivs, { actividad: '', subRef: '' }])}
              className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: '#d4edda', border: '1px solid #a3c9a3', color: '#166534' }}>
              + Agregar actividad
            </button>
          </div>
          <div className="flex gap-2 mt-2 justify-end">
            <button onClick={onClose}
              className="text-xs px-4 py-2 rounded-lg"
              style={{ background: '#fff', border: '1px solid #a3c9a3', color: '#6b9c6b' }}>
              Cancelar
            </button>
            <button onClick={handleSave}
              disabled={saving || !formRef.trim() || !formProducto.trim() || !formActivs.some(a => a.actividad.trim())}
              className="text-xs px-4 py-2 rounded-lg font-semibold disabled:opacity-40 flex items-center gap-1.5"
              style={{ background: 'linear-gradient(135deg,#14532d,#166534)', border: '1px solid #4ade80', color: 'white' }}>
              {saving ? <Loader2 size={12} className="animate-spin" /> : null}
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
   Main Page
────────────────────────────────────────────────────────────────────────── */
export default function PlaneacionPage() {
  const router = useRouter()
  const [tab, setTab] = useState(0)
  const [showSql, setShowSql] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [authOk, setAuthOk]   = useState(false)
  const [perfil, setPerfil]   = useState<'comercial' | 'produccion'>('produccion')

  // Auth guard — verificar clave de Planeación
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (sessionStorage.getItem('planeacion_auth') === '1') {
        const p = sessionStorage.getItem('planeacion_perfil')
        const esComercial = p === 'comercial'
        setPerfil(esComercial ? 'comercial' : 'produccion')
        if (esComercial) setTab(0)  // comercial → FORECAST
        else             setTab(1)  // produccion → Demanda
        setAuthOk(true)
      } else {
        router.replace('/produccion')
      }
    }
  }, [router])

  // ── Inventario ──────────────────────────────────────────────────────────
  const [inventario, setInventario]     = useState<InventarioPT[]>([])
  const [loadingInv, setLoadingInv]     = useState(false)
  const [uploadingInv, setUploadingInv] = useState(false)
  const [filtroInv, setFiltroInv]       = useState('')
  const fileInvRef = useRef<HTMLInputElement>(null)

  // ── Plan Semanal ────────────────────────────────────────────────────────
  const [planData, setPlanData]         = useState<Record<string, { pedido: number; produccion: number }>>({})
  const [loadingPlan, setLoadingPlan]   = useState(false)
  const [savingCell, setSavingCell]     = useState<string | null>(null)
  const [uploadingFc, setUploadingFc]   = useState(false)
  const [fcImportMsg, setFcImportMsg]   = useState('')
  const [filtroFc, setFiltroFc]         = useState('')
  const semanas = _ALL_SEMANAS
  const [fcOffset, setFcOffset] = useState(_DEFAULT_FC_OFFSET)
  const [dmOffset, setDmOffset] = useState(_DEFAULT_FC_OFFSET)
  const semanasVis   = useMemo(() => semanas.slice(fcOffset, fcOffset + FC_WINDOW), [fcOffset])
  const semanasVisDm = useMemo(() => semanas.slice(dmOffset, dmOffset + DM_WINDOW), [dmOffset])
  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileFcRef   = useRef<HTMLInputElement>(null)

  // ── Plan Mensual ────────────────────────────────────────────────────────
  const [mesFiltro, setMesFiltro] = useState(() => getMonthLabel(toISO(new Date())))
  const [pmExportMenu, setPmExportMenu] = useState(false)

  // ── Actividades ─────────────────────────────────────────────────────────
  const [actividades, setActividades]     = useState<Actividad[]>([])
  const [loadingAct, setLoadingAct]       = useState(false)
  const [uploadingAct, setUploadingAct]   = useState(false)
  const [borrandoAct, setBorrandoAct]     = useState(false)
  const [filtroAct, setFiltroAct]         = useState('')
  const fileActRef = useRef<HTMLInputElement>(null)
  // Modal agregar producto manual
  const [modalAddAct, setModalAddAct]     = useState<{ ref: string; desc: string; acts: { actividad: string; subRef: string }[] } | null>(null)

  // ── Plan Diario (tab 4) ─────────────────────────────────────────────────
  const hoyLunes = toISO(getMonday(new Date()))
  const fcIdxAct = semanas.indexOf(hoyLunes)
  const [semDiario, setSemDiario]         = useState(hoyLunes)
  const [filtroDiario, setFiltroDiario]   = useState('')
  const [diaFiltro, setDiaFiltro]         = useState<string | null>(null)
  const [planDiario, setPlanDiario]       = useState<Record<string,number>>({})
  const [loadingDiario, setLoadingDiario] = useState(false)
  const saveDiarioTimers                  = useRef<Record<string,ReturnType<typeof setTimeout>>>({})

  // ── Demanda Pedido (tab 5) ──────────────────────────────────────────────
  const [semDemanda, setSemDemanda]       = useState(hoyLunes)
  const [filtroDemanda, setFiltroDemanda] = useState('')
  const [demandaOverride, setDemandaOverride]   = useState<Record<string,number>>({})         // ref|fecha → pedido
  const [demandaProdOv,   setDemandaProdOv]     = useState<Record<string,number|null>>({})    // ref|fecha → prod override (null=restaurar)
  const [loadingDemanda, setLoadingDemanda]     = useState(false)
  const saveDemandaTimers                 = useRef<Record<string,ReturnType<typeof setTimeout>>>({})

  // ── Comentarios ────────────────────────────────────────────────────────
  const [comentarios, setComentarios]     = useState<Record<string, {texto: string; autor?: string}>>({})
  const [commentModal, setCommentModal]   = useState<{key: string; ref: string; semana: string; semLabel: string} | null>(null)
  const [commentDraft, setCommentDraft]   = useState('')
  const [commentAuthor, setCommentAuthor] = useState('')
  const [savingComment, setSavingComment] = useState(false)

  // ── Despachos (Entregas al Almacén) ────────────────────────────────────
  type Despacho = { id: string; referencia: string; descripcion: string | null; cantidad: number; fecha: string; semana_inicio: string; creado_en: string }
  const [despachos, setDespachos]           = useState<Despacho[]>([])
  const [loadingDespachos, setLoadingDesp]  = useState(false)
  const [savingDespacho, setSavingDesp]     = useState(false)
  const [modalDesp, setModalDesp]           = useState<{ ref: string; desc: string } | null>(null)
  const [despRef, setDespRef]               = useState('')
  const [despCantidad, setDespCantidad]     = useState('')
  const [despFecha, setDespFecha]           = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }))

  /* ── Load data ─────────────────────────────────────────────────────────── */
  const cargarInventario = useCallback(async () => {
    setLoadingInv(true)
    setErrorMsg('')
    const res = await fetch('/api/planeacion/inventario')
    if (res.ok) {
      setInventario(await res.json())
    } else {
      const e = await res.json().catch(() => ({}))
      const msg = e.error || 'Error al cargar'
      if (msg.includes('schema cache') || msg.includes('does not exist')) {
        setShowSql(true)
        setErrorMsg('Las tablas no existen aún en Supabase. Ejecuta el SQL de configuración que aparece arriba.')
      } else {
        setErrorMsg(msg)
      }
    }
    setLoadingInv(false)
  }, [])

  const cargarPlan = useCallback(async () => {
    setLoadingPlan(true)
    const desde = semanas[0]
    const hasta = semanas[semanas.length - 1]
    const [resPlan, resCom] = await Promise.all([
      fetch(`/api/planeacion/plan-semanal?desde=${desde}&hasta=${hasta}`),
      fetch(`/api/planeacion/comentarios?desde=${desde}&hasta=${hasta}`),
    ])
    if (resPlan.ok) {
      const rows: PlanEntry[] = await resPlan.json()
      const map: Record<string, { pedido: number; produccion: number }> = {}
      for (const r of rows) {
        map[`${r.referencia}_${r.semana_inicio}`] = { pedido: r.pedido, produccion: r.produccion }
      }
      setPlanData(map)
    }
    if (resCom.ok) {
      const rows: { referencia: string; semana_inicio: string; texto: string; autor?: string }[] = await resCom.json()
      const map: Record<string, {texto: string; autor?: string}> = {}
      for (const r of rows) map[`${r.referencia}_${r.semana_inicio}`] = { texto: r.texto, autor: r.autor }
      setComentarios(map)
    }
    setLoadingPlan(false)
  }, [])

  async function guardarProductoManual(
    ref: string,
    desc: string,
    acts: { actividad: string; subRef: string }[],
  ) {
    const payload = acts.map((a, i) => ({
      referencia: ref,
      descripcion_producto: desc,
      actividad: a.actividad.trim(),
      sub_referencia: a.subRef.trim() || null,
      orden: i,
    }))
    const res = await fetch('/api/planeacion/actividades', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      setModalAddAct(null)
      await cargarActividades()
    } else {
      const e = await res.json().catch(() => ({}))
      setErrorMsg(e.error || 'Error al guardar')
    }
  }

  const cargarActividades = useCallback(async () => {
    setLoadingAct(true)
    const res = await fetch('/api/planeacion/actividades')
    if (res.ok) setActividades(await res.json())
    setLoadingAct(false)
  }, [])

  const cargarDespachos = useCallback(async () => {
    setLoadingDesp(true)
    const res = await fetch('/api/planeacion/despachos')
    if (res.ok) setDespachos(await res.json())
    setLoadingDesp(false)
  }, [])

  useEffect(() => { cargarInventario() }, [cargarInventario])
  useEffect(() => { if (tab === 0 || tab === 1 || tab === 2 || tab === 3) cargarPlan() }, [tab, cargarPlan])
  useEffect(() => { if (tab === 2 || tab === 6) cargarActividades() }, [tab, cargarActividades])
  useEffect(() => { if (tab === 1 || tab === 4) cargarDespachos() }, [tab, cargarDespachos])
  useEffect(() => { if (tab === 0 || tab === 1 || tab === 3) cargarDemanda() }, [tab])
  // Scroll to current week once data finishes loading (avoids scroll reset on re-render)
  useEffect(() => {
    if (tab === 0 && !loadingPlan) setTimeout(fcScrollToToday, 0)
  }, [tab, loadingPlan]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (tab === 1 && !loadingDemanda) setTimeout(dmScrollToToday, 0)
  }, [tab, loadingDemanda]) // eslint-disable-line react-hooks/exhaustive-deps
  // Jump to current month on Plan Mensual
  useEffect(() => {
    if (tab === 3) setMesFiltro(getMonthLabel(toISO(new Date())))
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  // Helpers semana diario
  function getDias(mondayISO: string): string[] {
    const d = isoToDate(mondayISO)
    return Array.from({length: 6}, (_, i) => toISO(new Date(d.getTime() + i * 86400 * 1000)))
  }
  const DIAS_CORTOS = ['Lun','Mar','Mié','Jue','Vie','Sáb']
  function diaCorto(iso: string) {
    const d = isoToDate(iso)
    const dow = d.getDay()
    return DIAS_CORTOS[dow === 0 ? 6 : dow - 1] ?? ''
  }
  function fmtDMM(iso: string) {
    const [,m,d] = iso.split('-')
    return `${parseInt(d)}/${parseInt(m)}`
  }
  function prevSem(iso: string) {
    const d = isoToDate(iso); d.setDate(d.getDate()-7); return toISO(d)
  }
  function nextSem(iso: string) {
    const d = isoToDate(iso); d.setDate(d.getDate()+7); return toISO(d)
  }

  async function cargarPlanDiario(monday: string) {
    setLoadingDiario(true)
    const dias = getDias(monday)
    const res = await fetch(`/api/planeacion/plan-diario?desde=${dias[0]}&hasta=${dias[5]}`)
    if (res.ok) {
      const rows: {referencia:string; actividad:string; fecha:string; cantidad:number}[] = await res.json()
      const map: Record<string,number> = {}
      rows.forEach(r => { map[`${r.referencia}|${r.actividad}|${r.fecha}`] = r.cantidad })
      setPlanDiario(map)
    }
    setLoadingDiario(false)
  }

  function saveDiario(ref: string, actividad: string, fecha: string, val: number) {
    const key = `${ref}|${actividad}|${fecha}`
    setPlanDiario(prev => ({...prev, [key]: val}))
    if (saveDiarioTimers.current[key]) clearTimeout(saveDiarioTimers.current[key])
    saveDiarioTimers.current[key] = setTimeout(() => {
      fetch('/api/planeacion/plan-diario', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({referencia: ref, actividad, fecha, cantidad: val}),
      })
    }, 700)
  }

  async function cargarDemanda() {
    setLoadingDemanda(true)
    const desde = semanas[0]
    const hasta  = semanas[semanas.length - 1]
    const res = await fetch(`/api/planeacion/demanda-diaria?desde=${desde}&hasta=${hasta}`)
    if (res.ok) {
      const rows: {referencia:string;fecha:string;pedido:number}[] = await res.json()
      const map: Record<string,number> = {}
      const prodOv: Record<string,number|null> = {}
      rows.forEach(r => {
        if (r.referencia.startsWith('PROD:')) {
          // PROD override almacenado con prefijo
          const ref = r.referencia.slice(5)
          prodOv[`${ref}|${r.fecha}`] = r.pedido
        } else {
          map[`${r.referencia}|${r.fecha}`] = r.pedido
        }
      })
      setDemandaOverride(map)
      setDemandaProdOv(prodOv)
    }
    setLoadingDemanda(false)
  }

  function saveDemandaPedido(ref: string, fecha: string, val: number) {
    const key = `${ref}|${fecha}`
    setDemandaOverride(prev => ({...prev, [key]: val}))
    if (saveDemandaTimers.current[key]) clearTimeout(saveDemandaTimers.current[key])
    saveDemandaTimers.current[key] = setTimeout(() => {
      fetch('/api/planeacion/demanda-diaria', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({referencia: ref, fecha, pedido: val}),
      })
    }, 700)
  }

  function saveProdDemandaOv(ref: string, fecha: string, val: string) {
    const key = `${ref}|${fecha}`
    if (val === '') {
      setDemandaProdOv(prev => { const n = {...prev}; delete n[key]; return n })
      fetch('/api/planeacion/demanda-diaria', {
        method: 'DELETE', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ referencia: `PROD:${ref}`, fecha }),
      })
    } else {
      const num = Number(val) || 0
      setDemandaProdOv(prev => ({ ...prev, [key]: num }))
      fetch('/api/planeacion/demanda-diaria', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ referencia: `PROD:${ref}`, fecha, pedido: num }),
      })
    }
  }

  useEffect(() => { if (tab === 2) cargarPlanDiario(semDiario) }, [tab, semDiario])

  /* ── Excel import — Inventario ─────────────────────────────────────────── */
  async function handleInvExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setUploadingInv(true)
    try {
      const buf = await file.arrayBuffer()
      const wb  = XLSX.read(buf, { type: 'array', cellDates: true })
      const ws  = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })

      const payload = rows.map((r) => {
        const ref = r['Referencia'] ?? r['referencia'] ?? r['REF'] ?? r['Ref']
        if (!ref) return null

        // Parse existencia — may be formatted with dots as thousands separator
        const rawExi = r['Existencia'] ?? r['existencia'] ?? r['EXISTENCIA'] ?? 0
        const existencia = typeof rawExi === 'number'
          ? rawExi
          : parseFloat(String(rawExi).replace(/\./g, '').replace(',', '.')) || 0

        // Parse date — find any column whose name contains "fecha" (case-insensitive)
        let fecha_ultima: string | null = null
        const fechaKey = Object.keys(r).find(k => k.toLowerCase().includes('fecha'))
        const rawFecha = fechaKey ? r[fechaKey] : null
        if (rawFecha instanceof Date) {
          fecha_ultima = toISO(rawFecha)
        } else if (typeof rawFecha === 'number' && rawFecha > 0) {
          // Excel serial date → JS Date
          fecha_ultima = toISO(new Date((rawFecha - 25569) * 86400 * 1000))
        } else if (typeof rawFecha === 'string' && rawFecha.trim()) {
          const s = rawFecha.trim()
          if (s.includes('/')) {
            // DD/MM/YYYY
            const parts = s.split('/')
            if (parts.length === 3) {
              const [d, m, y] = parts
              fecha_ultima = `${y.padStart(4,'0')}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
            }
          } else if (s.includes('-')) {
            fecha_ultima = s.slice(0, 10)
          }
        }

        // Parse semana_actualizacion — column containing "semana" (case-insensitive)
        let semana_actualizacion: string | null = null
        const semKey = Object.keys(r).find(k => k.toLowerCase().includes('semana'))
        const rawSem = semKey ? r[semKey] : null

        // Helper: Monday of ISO week W of year Y
        const mondayOfWeek = (w: number, y: number): Date => {
          const jan4 = new Date(y, 0, 4)
          const w1Mon = new Date(jan4)
          w1Mon.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7))
          const result = new Date(w1Mon)
          result.setDate(w1Mon.getDate() + (w - 1) * 7)
          return result
        }
        // Year derived from fecha_ultima (already parsed above), fallback to current year
        const yearRef = fecha_ultima ? parseInt(fecha_ultima.slice(0, 4)) : new Date().getFullYear()

        if (rawSem instanceof Date) {
          const d = new Date(rawSem); d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
          semana_actualizacion = toISO(d)
        } else if (typeof rawSem === 'number' && rawSem > 0) {
          if (rawSem <= 53) {
            // It's a week number (e.g. 26), not an Excel serial
            semana_actualizacion = toISO(mondayOfWeek(rawSem, yearRef))
          } else {
            // Excel serial date
            const d = new Date((rawSem - 25569) * 86400 * 1000); d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
            semana_actualizacion = toISO(d)
          }
        } else if (typeof rawSem === 'string' && rawSem.trim()) {
          const s = rawSem.trim()
          const asNum = parseInt(s)
          if (!isNaN(asNum) && asNum <= 53 && String(asNum) === s.trim()) {
            // Plain week number string like "26"
            semana_actualizacion = toISO(mondayOfWeek(asNum, yearRef))
          } else if (s.includes('/')) {
            const [dd, mm, yyyy] = s.split('/')
            const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd)); d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
            semana_actualizacion = toISO(d)
          } else if (s.includes('-') && s.length >= 10) {
            const d = new Date(s.slice(0, 10)); d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
            semana_actualizacion = toISO(d)
          }
        }

        return {
          referencia:   String(ref).trim(),
          descripcion:  String(r['Desc. item'] ?? r['Descripcion'] ?? r['DESCRIPCION'] ?? r['descripcion'] ?? '').trim() || null,
          bodega:       r['Bodega'] != null ? String(r['Bodega']) : null,
          um:           r['U.M.'] != null   ? String(r['U.M.'])   : 'UND',
          existencia,
          tipo:         'PT',
          fecha_ultima,
          semana_actualizacion,
        }
      }).filter(Boolean)

      if (payload.length === 0) { setErrorMsg('No se encontraron filas válidas en el Excel. Revisa el formato.'); return }

      const res = await fetch('/api/planeacion/inventario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        const msg = e.error || 'Error al importar'
        if (msg.includes('schema cache') || msg.includes('does not exist')) {
          setShowSql(true)
          setErrorMsg('Las tablas no existen aún. Ejecuta el SQL de configuración (botón arriba) en Supabase y vuelve a intentarlo.')
        } else {
          setErrorMsg(msg)
        }
        return
      }
      setErrorMsg('')
      await cargarInventario()
    } catch (err) {
      setErrorMsg(`Error al procesar el Excel: ${String(err)}`)
    } finally {
      setUploadingInv(false)
      if (fileInvRef.current) fileInvRef.current.value = ''
    }
  }

  /* ── Excel import — Actividades ────────────────────────────────────────── */
  async function handleActExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setUploadingAct(true)
    try {
      const buf = await file.arrayBuffer()
      const wb  = XLSX.read(buf, { type: 'array' })
      const ws  = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })

      // Read as raw arrays to handle merged/multi-row headers
      const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })

      // Skip header rows: find where data starts (after the row containing "REF")
      let dataStart = 1 // default: skip 1 row
      for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
        const c0 = String(rawRows[i][0] ?? '').trim().toUpperCase()
        const c1 = String(rawRows[i][1] ?? '').trim().toUpperCase()
        if (c0 === 'REF' || c0 === 'REFERENCIA' || c1 === 'REF' || c1 === 'REFERENCIA') {
          dataStart = i + 1
          break
        }
      }

      // Heuristic: product rows have DESCRIPCIÓN in ALL CAPS; activity rows are title case
      const isMostlyCaps = (s: string) => {
        const letters = s.replace(/[^a-záéíóúA-ZÁÉÍÓÚ]/g, '')
        if (letters.length < 3) return false
        return (letters.replace(/[^A-ZÁÉÍÓÚ]/g, '').length / letters.length) > 0.55
      }

      let currentRef = ''
      let currentDesc = ''
      const payload: Array<{
        referencia: string; descripcion_producto: string | null
        actividad: string; sub_referencia: string | null; orden: number
      }> = []

      for (let i = dataStart; i < rawRows.length; i++) {
        const row  = rawRows[i]
        const col0 = row[0] // REF column (product ref or insumo ref)
        const col1 = row[1] // DESCRIPCIÓN column (product name or activity name)
        if (!col1 || String(col1).trim() === '') continue

        const desc   = String(col1).trim()
        const refVal = col0 != null ? String(col0).trim() : ''

        if (isMostlyCaps(desc)) {
          // Product header row
          currentRef  = refVal || desc
          currentDesc = desc
        } else {
          // Activity row — inherits currentRef
          if (!currentRef) continue
          payload.push({
            referencia:           currentRef,
            descripcion_producto: currentDesc || null,
            actividad:            desc,
            sub_referencia:       refVal && refVal !== currentRef ? refVal : null,
            orden:                i,
          })
        }
      }

      if (payload.length === 0) {
        setErrorMsg('Sin actividades válidas. Verifica que las filas de producto estén en MAYÚSCULAS y las actividades en minúsculas/título.')
        return
      }

      const res = await fetch('/api/planeacion/actividades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        const msg = e.error || 'Error'
        if (msg.includes('schema cache') || msg.includes('does not exist')) {
          setShowSql(true)
          setErrorMsg('Las tablas no existen aún. Ejecuta el SQL de configuración primero.')
        } else {
          setErrorMsg(msg)
        }
        return
      }
      setErrorMsg('')
      await cargarActividades()
    } catch (err) {
      setErrorMsg(`Error: ${String(err)}`)
    } finally {
      setUploadingAct(false)
      if (fileActRef.current) fileActRef.current.value = ''
    }
  }

  /* ── Plan Semanal — edit cell ──────────────────────────────────────────── */
  function updateCell(ref: string, semana: string, field: 'pedido' | 'produccion', value: string) {
    const num = parseFloat(value.replace(',', '.')) || 0
    const key = `${ref}_${semana}`

    // Capture BOTH field values NOW (before async state update) to avoid stale closure
    const current = planData[key] ?? { pedido: 0, produccion: 0 }
    const newPedido     = field === 'pedido'     ? num : current.pedido
    const newProduccion = field === 'produccion' ? num : current.produccion

    setPlanData(prev => ({
      ...prev,
      [key]: { pedido: newPedido, produccion: newProduccion }
    }))

    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSavingCell(`${key}_${field}`)
      await fetch('/api/planeacion/plan-semanal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referencia:    ref,
          semana_inicio: semana,
          pedido:        newPedido,
          produccion:    newProduccion,
        }),
      })
      setSavingCell(null)
    }, 800)
  }

  /* ── FORECAST — importar PEDIDO desde Excel ───────────────────────────── */
  async function handleForecastExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFc(true)
    setFcImportMsg('')
    setErrorMsg('')
    try {
      const ab = await file.arrayBuffer()
      const wb = XLSX.read(ab)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

      // 1. Find the row that has "SEMANA X" headers
      let headerRowIdx = -1
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i] as unknown[]
        if (row.some(c => typeof c === 'string' && /SEMANA\s*\d+/i.test(c as string))) {
          headerRowIdx = i
          break
        }
      }
      if (headerRowIdx < 0) {
        setErrorMsg('No se encontró fila con encabezados "SEMANA XX" en el Excel.')
        return
      }

      const headerRow = rows[headerRowIdx] as unknown[]
      const dateRow   = (rows[headerRowIdx + 1] ?? []) as unknown[]

      // 2. Build colIndex → ISO semana mapping
      const mondayOfWeek = (w: number, y: number): Date => {
        const jan4 = new Date(y, 0, 4)
        const w1Mon = new Date(jan4)
        w1Mon.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7))
        const r = new Date(w1Mon)
        r.setDate(w1Mon.getDate() + (w - 1) * 7)
        return r
      }
      const roundToMonday = (d: Date): Date => {
        const copy = new Date(d)
        copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7))
        return copy
      }

      const colToSemana: Record<number, string> = {}
      for (let c = 0; c < headerRow.length; c++) {
        const cell = headerRow[c]
        if (typeof cell !== 'string') continue
        const match = (cell as string).match(/SEMANA\s*(\d+)/i)
        if (!match) continue
        const weekNum = parseInt(match[1])

        let semanaISO: string | null = null
        const dateCell = dateRow[c]

        if (typeof dateCell === 'number' && dateCell > 1000) {
          // Excel serial date — extract in UTC to avoid timezone shift (Colombia = UTC-5)
          const utc = new Date((dateCell - 25569) * 86400 * 1000)
          const d = roundToMonday(new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate()))
          semanaISO = toISO(d)
        } else if (typeof dateCell === 'string') {
          const parts = (dateCell as string).split('/')
          if (parts.length >= 2) {
            const dd = parseInt(parts[0])
            const mm = parseInt(parts[1])
            const yy = parts.length >= 3 ? parseInt(parts[2]) : new Date().getFullYear()
            semanaISO = toISO(roundToMonday(new Date(yy, mm - 1, dd)))
          }
        }

        if (!semanaISO) {
          semanaISO = toISO(mondayOfWeek(weekNum, new Date().getFullYear()))
        }

        if (semanas.includes(semanaISO)) {
          colToSemana[c] = semanaISO
        }
      }

      if (Object.keys(colToSemana).length === 0) {
        setErrorMsg('No se encontraron semanas válidas en el Excel (verifica que los encabezados digan "SEMANA XX").')
        return
      }

      // 3. Collect valid REF references from inventario
      const validRefs = new Set(inventario.map(p => p.referencia))

      // 4. Parse data rows — any row where col 0 is a numeric REF
      const payload: { referencia: string; semana_inicio: string; pedido: number }[] = []
      for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const row = rows[i] as unknown[]
        const refCell = row[0]
        if (refCell === null || refCell === undefined) continue
        const refStr = String(refCell).trim()
        if (!refStr || isNaN(Number(refStr))) continue
        if (!validRefs.has(refStr)) continue

        for (const [colStr, semanaISO] of Object.entries(colToSemana)) {
          const val = row[parseInt(colStr)]
          if (val === null || val === undefined) continue
          const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'))
          if (isNaN(n) || n <= 0) continue
          payload.push({ referencia: refStr, semana_inicio: semanaISO, pedido: n })
        }
      }

      if (payload.length === 0) {
        setErrorMsg('No se encontraron valores válidos (valores positivos con REF reconocida).')
        return
      }

      // 5. Bulk upsert via PATCH
      const res = await fetch('/api/planeacion/plan-semanal', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        setErrorMsg(e.error || 'Error al guardar')
        return
      }

      // 6. Optimistic update in local state
      setPlanData(prev => {
        const next = { ...prev }
        for (const { referencia, semana_inicio, pedido } of payload) {
          const key = `${referencia}_${semana_inicio}`
          next[key] = { pedido, produccion: prev[key]?.produccion ?? 0 }
        }
        return next
      })

      const semCount = Object.keys(colToSemana).length
      setFcImportMsg(`${payload.length} celdas PEDIDO importadas — ${payload.length / semCount | 0} productos en ${semCount} semanas`)
    } catch (err) {
      setErrorMsg(`Error al leer Excel: ${String(err)}`)
    } finally {
      setUploadingFc(false)
      if (fileFcRef.current) fileFcRef.current.value = ''
    }
  }

  /* ── Column tooltips ───────────────────────────────────────────────────── */
  const COL_TIPS: Record<string, string> = {
    'PEDIDO':     'Proyección de pedido semanal. Se puede ingresar manualmente o importar desde Excel. Se descuenta del saldo acumulado.',
    'PROD':       'Producción planificada para la semana. Se ingresa manualmente. Se suma al saldo acumulado.',
    'SALDO':      'Saldo acumulado = Existencia inicial + PROD acumulado − PEDIDO acumulado. En rojo cuando el inventario es insuficiente.',
    'PROYECTADO': 'Demanda proyectada tomada del FORECAST (columna PEDIDO). Solo lectura. Se usa automáticamente si no hay un PEDIDO real ingresado.',
  }

  async function guardarComentario() {
    if (!commentModal) return
    setSavingComment(true)
    const { ref, semana } = commentModal
    if (!commentDraft.trim()) {
      await fetch(`/api/planeacion/comentarios?referencia=${ref}&semana_inicio=${semana}`, { method: 'DELETE' })
      setComentarios(prev => { const n = {...prev}; delete n[commentModal.key]; return n })
    } else {
      await fetch('/api/planeacion/comentarios', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referencia: ref, semana_inicio: semana, texto: commentDraft.trim(), autor: commentAuthor.trim() || undefined }),
      })
      setComentarios(prev => ({ ...prev, [commentModal.key]: { texto: commentDraft.trim(), autor: commentAuthor.trim() || undefined } }))
    }
    setSavingComment(false)
    setCommentModal(null)
  }

  /* ── Saldo calculation ──────────────────────────────────────────────────── */
  function getSaldos(ref: string): (number | null)[] {
    const inv = inventario.find(p => p.referencia === ref)
    const semAct = inv?.semana_actualizacion ?? null

    if (!semAct) {
      // Sin semana de actualización: balance arranca desde existencia en la semana 1
      let prev = inv?.existencia ?? 0
      return semanas.map(s => {
        const key = `${ref}_${s}`
        const { pedido = 0, produccion = 0 } = planData[key] ?? {}
        prev = prev + produccion - pedido
        return prev
      })
    }

    // Pre-sumar pedido y producción de semanas ANTES de semana_actualizacion
    // para que queden descontados del inventario inicial
    let prePedido = 0, preProd = 0
    for (const s of semanas) {
      if (s >= semAct) break
      const key = `${ref}_${s}`
      prePedido += planData[key]?.pedido     ?? 0
      preProd   += planData[key]?.produccion ?? 0
    }

    let prev: number | null = null
    return semanas.map(s => {
      if (s < semAct) return null
      if (prev === null) {
        // Balance inicial = existencia - demanda previa + producción previa
        prev = (inv?.existencia ?? 0) + preProd - prePedido
      }
      const key = `${ref}_${s}`
      const { pedido = 0, produccion = 0 } = planData[key] ?? {}
      prev = prev + produccion - pedido
      return prev
    })
  }

  /* ── Productos list ─────────────────────────────────────────────────────── */
  const productos = useMemo(() =>
    inventario.filter(p =>
      !filtroInv || p.referencia.includes(filtroInv) ||
      (p.descripcion ?? '').toLowerCase().includes(filtroInv.toLowerCase())
    ), [inventario, filtroInv])

  /* ── Plan Mensual ────────────────────────────────────────────────────────── */
  const mesesDisponibles = useMemo(() =>
    [...new Set(semanas.map(s => getMonthLabel(s)))], [semanas])

  const semanasPorMes = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const s of semanas) {
      const mes = getMonthLabel(s)
      if (!map[mes]) map[mes] = []
      map[mes].push(s)
    }
    return map
  }, [semanas])

  const mesActivo = mesFiltro || mesesDisponibles[0] || ''
  const semanasDelMes = semanasPorMes[mesActivo] ?? []

  function exportarPlanMensual(mesesExport: string[]) {
    const wb = XLSX.utils.book_new()
    // Build flat rows: header row + data rows
    const headerRow1: string[] = ['REF', 'PRODUCTO']
    const headerRow2: string[] = ['', '']
    for (const mes of mesesExport) {
      const semsM = semanasPorMes[mes] ?? []
      for (const s of semsM) {
        const d = isoToDate(s)
        const label = `SEM ${getISOWeek(d)} ${fmtShortDate(s)}`
        headerRow1.push(label, label)
        headerRow2.push('PROY', 'PED')
      }
      headerRow1.push(`PROY MES ${mes}`, `PED MES ${mes}`)
      headerRow2.push('', '')
    }
    headerRow1.push('TOTAL PROY', 'TOTAL PED')
    headerRow2.push('', '')

    const rows: (string | number)[][] = [headerRow1, headerRow2]

    for (const prod of inventario) {
      const row: (string | number)[] = [prod.referencia, prod.descripcion ?? '']
      let totalProy = 0, totalPed = 0
      for (const mes of mesesExport) {
        const semsM = semanasPorMes[mes] ?? []
        let proyMes = 0, pedMes = 0
        for (const s of semsM) {
          const proy = planData[`${prod.referencia}_${s}`]?.pedido ?? 0
          const ped  = demandaOverride[`${prod.referencia}|${s}`] ?? 0
          row.push(proy || '', ped || '')
          proyMes += proy; pedMes += ped
        }
        row.push(proyMes || '', pedMes || '')
        totalProy += proyMes; totalPed += pedMes
      }
      row.push(totalProy || '', totalPed || '')
      rows.push(row)
    }

    const ws = XLSX.utils.aoa_to_sheet(rows)
    // Auto column widths
    ws['!cols'] = rows[0].map((_, ci) => ({ wch: ci < 2 ? (ci === 0 ? 10 : 32) : 10 }))
    XLSX.utils.book_append_sheet(wb, ws, 'Plan Mensual')
    const periodo = mesesExport.length === 1 ? mesesExport[0] : `${mesesExport[0]}-${mesesExport[mesesExport.length-1]}`
    XLSX.writeFile(wb, `Plan_Mensual_${periodo.replace(/ /g,'_')}.xlsx`)
  }

  /* ── Actividades grouped by ref ─────────────────────────────────────────── */
  const actPorRef = useMemo(() => {
    const map: Record<string, Actividad[]> = {}
    for (const a of actividades) {
      if (!map[a.referencia]) map[a.referencia] = []
      map[a.referencia].push(a)
    }
    return map
  }, [actividades])

  // despMap: total despachado por ref+semana — usado en SALDO Demanda
  const despMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const d of despachos) {
      const key = `${d.referencia}_${d.semana_inicio}`
      map[key] = (map[key] ?? 0) + d.cantidad
    }
    return map
  }, [despachos])

  const refsAct = useMemo(() =>
    Object.keys(actPorRef).filter(r =>
      !filtroAct || r.includes(filtroAct) ||
      (actPorRef[r][0]?.descripcion_producto ?? '').toLowerCase().includes(filtroAct.toLowerCase())
    ), [actPorRef, filtroAct])

  /* ── Despachos helpers ──────────────────────────────────────────────────── */
  const despSemLabel = despFecha
    ? `Sem ${getISOWeek(isoToDate(toISO(getMonday(new Date(despFecha + 'T12:00:00')))))} · ${toISO(getMonday(new Date(despFecha + 'T12:00:00')))}`
    : '—'

  async function guardarDespacho() {
    if (!despRef || !despCantidad) return
    setSavingDesp(true)
    const semanaDesp = toISO(getMonday(new Date(despFecha + 'T12:00:00')))
    const invItem = inventario.find(p => p.referencia === despRef)
    const res = await fetch('/api/planeacion/despachos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referencia: despRef,
        descripcion: invItem?.descripcion ?? null,
        cantidad: Number(despCantidad),
        fecha: despFecha,
        semana_inicio: semanaDesp,
      }),
    })
    if (res.ok) {
      setModalDesp(null)
      setDespRef('')
      setDespCantidad('')
      await Promise.all([cargarDespachos(), cargarInventario()])
    } else {
      const e = await res.json().catch(() => ({}))
      setErrorMsg(e.error || 'Error al guardar')
    }
    setSavingDesp(false)
  }

  /* ─────────────────────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────────────────────── */
  // comercial → solo FORECAST  |  produccion → todo
  const TABS = [
    { label: 'FORECAST',    icon: <BarChart2 size={14} />, ocultarComercial: false },
    { label: 'Demanda',     icon: <Calendar size={14} />,  ocultarComercial: true  },
    { label: 'Plan Diario', icon: <BarChart2 size={14} />, ocultarComercial: true  },
    { label: 'Plan Mensual',icon: <Calendar size={14} />,  ocultarComercial: true  },
    { label: 'Entregas',    icon: <Truck size={14} />,     ocultarComercial: true  },
  ]

  // FORECAST scroll — drag-to-scroll
  const fcScrollRef  = useRef<HTMLDivElement>(null)
  const fcDragging   = useRef(false)
  const fcDragX      = useRef(0)
  const fcScrollX    = useRef(0)
  function fcMouseDown(e: React.MouseEvent) {
    fcDragging.current = true
    fcDragX.current    = e.clientX
    fcScrollX.current  = fcScrollRef.current?.scrollLeft ?? 0
  }
  function fcMouseMove(e: React.MouseEvent) {
    if (!fcDragging.current || !fcScrollRef.current) return
    fcScrollRef.current.scrollLeft = fcScrollX.current - (e.clientX - fcDragX.current)
  }
  function fcMouseUp()    { fcDragging.current = false }
  function fcMouseLeave() { fcDragging.current = false }
  function fcScroll(dir: number) {
    setFcOffset(prev => Math.max(0, Math.min(prev + dir * 2, semanas.length - FC_WINDOW)))
  }
  function fcScrollToToday() {
    const idx = semanas.indexOf(hoyLunes)
    if (idx < 0) return
    setFcOffset(Math.max(0, Math.min(idx - 1, semanas.length - FC_WINDOW)))
  }

  // Plan Mensual scroll — drag-to-scroll
  const pmScrollRef  = useRef<HTMLDivElement>(null)
  const pmDragging   = useRef(false)
  const pmDragX      = useRef(0)
  const pmScrollX    = useRef(0)
  function pmMouseDown(e: React.MouseEvent) { pmDragging.current = true; pmDragX.current = e.clientX; pmScrollX.current = pmScrollRef.current?.scrollLeft ?? 0 }
  function pmMouseMove(e: React.MouseEvent) { if (!pmDragging.current || !pmScrollRef.current) return; pmScrollRef.current.scrollLeft = pmScrollX.current - (e.clientX - pmDragX.current) }
  function pmMouseUp()    { pmDragging.current = false }
  function pmMouseLeave() { pmDragging.current = false }

  // Demanda scroll — drag-to-scroll
  const dmScrollRef  = useRef<HTMLDivElement>(null)
  const dmDragging   = useRef(false)
  const dmDragX      = useRef(0)
  const dmScrollX    = useRef(0)
  function dmMouseDown(e: React.MouseEvent) {
    dmDragging.current = true
    dmDragX.current    = e.clientX
    dmScrollX.current  = dmScrollRef.current?.scrollLeft ?? 0
  }
  function dmMouseMove(e: React.MouseEvent) {
    if (!dmDragging.current || !dmScrollRef.current) return
    dmScrollRef.current.scrollLeft = dmScrollX.current - (e.clientX - dmDragX.current)
  }
  function dmMouseUp()    { dmDragging.current = false }
  function dmMouseLeave() { dmDragging.current = false }
  function dmScroll(dir: number) {
    setDmOffset(prev => Math.max(0, Math.min(prev + dir * 2, semanas.length - DM_WINDOW)))
  }
  function dmScrollToToday() {
    const idx = semanas.indexOf(hoyLunes)
    if (idx < 0) return
    setDmOffset(Math.max(0, Math.min(idx - 1, semanas.length - DM_WINDOW)))
  }

  // Demanda SALDO: existencia (semana cargada) + PROD acumulado - PEDIDO acumulado
  function getSaldosDemanda(ref: string): (number | null)[] {
    const inv = inventario.find(p => p.referencia === ref)
    const semAct = inv?.semana_actualizacion ?? null

    const pedidoDe = (s: string) => {
      const pedidoManual = demandaOverride[`${ref}|${s}`]
      const proyectado   = planData[`${ref}_${s}`]?.pedido ?? 0
      return pedidoManual !== undefined ? pedidoManual : proyectado
    }
    const prodDe = (s: string) => {
      // Entregas al almacén tienen prioridad sobre PROD de planData
      const despTotal = despMap[`${ref}_${s}`]
      if (despTotal !== undefined) return despTotal
      const ovKey = `${ref}|${s}`
      if (ovKey in demandaProdOv) return demandaProdOv[ovKey] ?? 0
      return planData[`${ref}_${s}`]?.produccion ?? 0
    }

    if (!semAct) {
      let prev = inv?.existencia ?? 0
      return semanas.map(s => {
        prev = prev + prodDe(s) - pedidoDe(s)
        return prev
      })
    }

    // Desde semana_actualizacion: arranca desde existencia sin ajuste previo
    let prev: number | null = null
    return semanas.map(s => {
      if (s < semAct) return null
      if (prev === null) prev = inv?.existencia ?? 0
      prev = prev + prodDe(s) - pedidoDe(s)
      return prev
    })
  }

  if (!authOk) return null

  return (
    <main className="min-h-screen flex flex-col" style={{ background: '#d4e8b8' }}>

      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3 flex-wrap"
        style={{ background: '#1e3a14', borderBottom: '2px solid #3a6228', boxShadow: '0 2px 12px rgba(20,60,10,0.3)' }}>
        <button onClick={() => router.push('/produccion')}
          className="p-2 rounded-xl transition-colors hover:brightness-125"
          style={{ background: 'rgba(80,180,60,0.15)', color: '#a3d982' }}>
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <BarChart2 size={20} style={{ color: '#7acc50' }} />
          <h1 className="text-xl font-bold text-white">Planeación de Demanda e Inventario</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setTab(5)}
            className="px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors"
            style={tab === 5
              ? { background: '#4caf50', color: '#fff' }
              : { background: 'rgba(80,180,60,0.15)', color: '#a3d982', border: '1px solid rgba(80,180,60,0.3)' }}>
            Inventario PT/BLK
          </button>
          <button onClick={() => setTab(6)}
            className="px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors"
            style={tab === 6
              ? { background: '#4caf50', color: '#fff' }
              : { background: 'rgba(80,180,60,0.15)', color: '#a3d982', border: '1px solid rgba(80,180,60,0.3)' }}>
            Actividades
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="mx-4 mt-3 rounded-xl px-4 py-3 flex items-start gap-3"
          style={{ background: '#fef3e2', border: '1px solid #d4a050' }}>
          <AlertTriangle size={16} style={{ color: '#b86020', marginTop: 2 }} className="shrink-0" />
          <p className="text-sm flex-1" style={{ color: '#7a3a10' }}>{errorMsg}</p>
          <button onClick={() => setErrorMsg('')} className="shrink-0" style={{ color: '#b86020' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* SQL Banner */}
      {showSql && (
        <div className="mx-4 mt-4 rounded-xl p-4" style={{ background: '#1e3a14', border: '1px solid #3a6228' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-sm flex items-center gap-2" style={{ color: '#7acc50' }}>
              <AlertTriangle size={14} /> Ejecuta este SQL en Supabase → SQL Editor una sola vez
            </p>
            <button onClick={() => setShowSql(false)} style={{ color: '#7acc50' }}><X size={14} /></button>
          </div>
          <pre className="text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed" style={{ color: '#a3d982' }}>{SQL_SETUP}</pre>
        </div>
      )}

      {/* Tabs */}
      <div className="px-4 pt-4 flex gap-1 flex-wrap">
        {TABS.filter(t => perfil === 'comercial' ? !t.ocultarComercial : true).map((t, i) => {
          const realIdx = TABS.findIndex(x => x.label === t.label)
          return (
            <button key={i} onClick={() => setTab(realIdx)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-sm font-semibold transition-all"
              style={{
                background: tab === realIdx ? '#1e3a14' : 'rgba(30,58,20,0.25)',
                border: `1px solid ${tab === realIdx ? '#3a6228' : '#8ab87a'}`,
                borderBottom: tab === realIdx ? '1px solid #1e3a14' : '1px solid #8ab87a',
                color: tab === realIdx ? '#a3d982' : '#3a5a28',
              }}>
              {t.icon} {t.label}
            </button>
          )
        })}
      </div>

      <div className="flex-1 p-4 pt-3 rounded-b-xl" style={{ border: '1px solid #8ab87a', borderTop: 'none', background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(4px)' }}>

        {/* ══════════════════════════════════════════════════
            TAB 4 — ENTREGAS AL ALMACÉN
        ══════════════════════════════════════════════════ */}
        {tab === 4 && (() => {
          const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
          const despSemana = hoyLunes
          const despSemana_ = despSemana  // alias para usar en filtros
          const despSemanales = despachos.filter(d => d.semana_inicio === despSemana)
          const despPorRef: Record<string, number> = {}
          for (const d of despSemanales) {
            despPorRef[d.referencia] = (despPorRef[d.referencia] ?? 0) + d.cantidad
          }
          return (
            <div>
              {/* Header */}
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <h2 className="font-bold text-sm flex items-center gap-2" style={{ color: '#1e3a14' }}>
                  <Truck size={15} /> Entregas al Almacén
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full font-mono" style={{ background: '#e0f0c8', color: '#3a6228', border: '1px solid #a0c878' }}>
                  Sem {getISOWeek(isoToDate(despSemana))} · {fmtDMM(despSemana)}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <button onClick={() => { setDespRef(''); setDespCantidad(''); setDespFecha(hoy); setModalDesp({ref:'', desc:''}) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: '#1e3a14', color: '#a3d982', border: '1px solid #3a6228' }}>
                    <Plus size={13} /> Nueva Entrega
                  </button>
                  <button onClick={() => cargarDespachos()}
                    className="p-1.5 rounded-lg"
                    style={{ background: '#c8e0a8', border: '1px solid #8ab87a', color: '#1e3a14' }}>
                    <RefreshCw size={13} />
                  </button>
                </div>
              </div>

              {/* Tabla de referencias */}
              {inventario.length === 0 ? (
                <div className="text-center py-12 text-sm" style={{ color: '#6a8a50' }}>Carga el inventario primero (Inventario PT/BLK)</div>
              ) : (
                <div className="overflow-x-auto rounded-xl shadow-sm mb-6" style={{ border: '1px solid #a0c878' }}>
                  <table className="text-xs w-full">
                    <thead>
                      <tr style={{ background: '#1e3a14', borderBottom: '2px solid #3a6228' }}>
                        <th className="px-3 py-2.5 text-left font-bold sticky left-0 z-10" style={{ background: '#1e3a14', color: '#a3d982', minWidth: 80 }}>REF</th>
                        <th className="px-3 py-2.5 text-left font-bold" style={{ color: '#a3d982', minWidth: 220 }}>PRODUCTO</th>
                        <th className="px-2 py-2.5 text-center font-bold" style={{ color: '#e8d870', minWidth: 100 }}>INV. ACTUAL</th>
                        <th className="px-2 py-2.5 text-center font-bold" style={{ color: '#7acc50', minWidth: 120 }}>DESP. SEM. ACTUAL</th>
                        <th className="px-2 py-2.5 text-center font-bold" style={{ color: '#a3d982', minWidth: 60 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventario.map((p, pi) => {
                        const rowBg = pi % 2 === 0 ? '#ffffff' : '#f0f7e4'
                        const despTotal = despPorRef[p.referencia] ?? 0
                        const invActual = p.existencia ?? 0
                        return (
                          <tr key={p.referencia} style={{ background: rowBg, borderBottom: '1px solid #d0e8b0' }}>
                            <td className="px-3 py-2 font-mono font-bold sticky left-0 z-10" style={{ background: rowBg, color: '#1e5a3a' }}>{p.referencia}</td>
                            <td className="px-3 py-2" style={{ color: '#2a4a1a' }}>{p.descripcion ?? '—'}</td>
                            <td className="px-2 py-2 text-center font-mono font-bold" style={{ color: invActual > 0 ? '#2a6a1e' : '#8a9a80' }}>
                              {invActual > 0 ? invActual.toLocaleString('es-CO') : '—'}
                            </td>
                            <td className="px-2 py-2 text-center font-mono font-bold" style={{ color: despTotal > 0 ? '#3a5a20' : '#b0c0a0' }}>
                              {despTotal > 0 ? despTotal.toLocaleString('es-CO') : '—'}
                            </td>
                            <td className="px-2 py-2 text-center">
                              <button
                                onClick={() => { setDespRef(p.referencia); setDespCantidad(''); setDespFecha(hoy); setModalDesp({ ref: p.referencia, desc: p.descripcion ?? '' }) }}
                                className="px-2 py-0.5 rounded text-xs font-bold transition-all hover:brightness-110"
                                style={{ background: '#c8e0a8', border: '1px solid #8ab87a', color: '#1e3a14' }}>
                                + Entregar
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Historial de despachos de la semana */}
              {despSemanales.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold mb-2" style={{ color: '#3a6228' }}>
                    Historial de entregas · Sem {getISOWeek(isoToDate(despSemana))}
                  </h3>
                  {loadingDespachos ? (
                    <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin" style={{ color: '#3a7228' }} /></div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl shadow-sm" style={{ border: '1px solid #a0c878' }}>
                      <table className="text-xs w-full">
                        <thead>
                          <tr style={{ background: '#2a4a1a', borderBottom: '1px solid #3a6228' }}>
                            <th className="px-3 py-2 text-left font-bold" style={{ color: '#a3d982' }}>FECHA</th>
                            <th className="px-3 py-2 text-left font-bold" style={{ color: '#a3d982' }}>REF</th>
                            <th className="px-3 py-2 text-left font-bold" style={{ color: '#a3d982' }}>PRODUCTO</th>
                            <th className="px-2 py-2 text-center font-bold" style={{ color: '#7acc50' }}>CANTIDAD</th>
                          </tr>
                        </thead>
                        <tbody>
                          {despSemanales.map((d, di) => (
                            <tr key={d.id} style={{ background: di % 2 === 0 ? '#ffffff' : '#f0f7e4', borderBottom: '1px solid #d0e8b0' }}>
                              <td className="px-3 py-1.5 font-mono" style={{ color: '#4a6a30' }}>{d.fecha}</td>
                              <td className="px-3 py-1.5 font-mono font-bold" style={{ color: '#1e5a3a' }}>{d.referencia}</td>
                              <td className="px-3 py-1.5" style={{ color: '#2a4a1a' }}>{d.descripcion ?? '—'}</td>
                              <td className="px-2 py-1.5 text-center font-mono font-bold" style={{ color: '#2a6a1e' }}>{d.cantidad.toLocaleString('es-CO')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

            </div>
          )
        })()}

        {/* ══════════════════════════════════════════════════
            TAB 5 — INVENTARIO (header)
        ══════════════════════════════════════════════════ */}
        {tab === 5 && (
          <div>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <h2 className="font-bold text-sm" style={{ color: '#1e3a14' }}>Inventario Producto Terminado y BLK</h2>
              <div className="ml-auto flex items-center gap-2">
                <input type="text" value={filtroInv} onChange={e => setFiltroInv(e.target.value)}
                  placeholder="Buscar ref o producto…"
                  className="text-xs rounded-lg px-3 py-1.5 focus:outline-none"
                  style={{ background: '#fff', border: '1px solid #8ab87a', color: '#1e3a14', width: 180 }} />
                <button onClick={cargarInventario}
                  className="p-1.5 rounded-lg transition-colors hover:brightness-110"
                  style={{ background: '#c8e0a8', border: '1px solid #8ab87a', color: '#1e3a14' }}>
                  <RefreshCw size={13} />
                </button>
                <input ref={fileInvRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleInvExcel} />
                <button onClick={() => fileInvRef.current?.click()} disabled={uploadingInv}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all hover:brightness-110 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#2c5a1e,#3a7228)', border: '1px solid #6aaa40', color: 'white' }}>
                  {uploadingInv ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  {uploadingInv ? 'Importando…' : 'Importar Excel'}
                </button>
              </div>
            </div>

            {/* Formato hint */}
            <div className="mb-3 px-3 py-2 rounded-lg text-xs"
              style={{ background: '#e8f4d4', border: '1px solid #a0c878', color: '#3a5a20' }}>
              Formato Excel esperado (fila 1 = encabezados):
              <strong className="ml-1" style={{ color: '#1e4a14' }}>Referencia · Desc. item · Bodega · U.M. · Existencia · Fecha última</strong>
            </div>

            {/* Stats */}
            {inventario.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: 'Productos',      value: inventario.length, color: '#2c6a1e', bg: '#d4edba' },
                  { label: 'Total unidades', value: inventario.reduce((s,p)=>s+p.existencia,0).toLocaleString('es-CO'), color: '#1e4a6a', bg: '#d4e8f4' },
                  { label: 'Bodega 003',     value: inventario.filter(p=>p.bodega==='003').length, color: '#8a4a10', bg: '#f4e4c8' },
                ].map(k => (
                  <div key={k.label} className="rounded-xl p-3 text-center" style={{ background: k.bg, border: '1px solid rgba(0,0,0,0.08)' }}>
                    <p className="text-xl font-bold" style={{ color: k.color }}>{k.value}</p>
                    <p className="text-xs mt-0.5" style={{ color: k.color, opacity: 0.7 }}>{k.label}</p>
                  </div>
                ))}
              </div>
            )}

            {loadingInv ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={28} className="animate-spin" style={{ color: '#3a7228' }} />
              </div>
            ) : inventario.length === 0 ? (
              <div className="text-center py-16" style={{ color: '#6a8a50' }}>
                <Package size={40} strokeWidth={1} className="mx-auto mb-3" />
                <p className="text-sm">Sin inventario. Importa un Excel para comenzar.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl shadow-sm" style={{ border: '1px solid #a0c878' }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: '#1e3a14', borderBottom: '2px solid #3a6228' }}>
                      {['REF','DESCRIPCIÓN','BODEGA','U.M.','EXISTENCIA','FECHA ULT.','SEM. ACTUALIZ.'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-bold uppercase tracking-wide whitespace-nowrap"
                          style={{ color: '#a3d982', fontSize: '0.65rem' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {productos.map((p, i) => (
                      <tr key={p.id} style={{ background: i%2===0?'#ffffff':'#f0f7e4', borderBottom:'1px solid #d0e8b0' }}>
                        <td className="px-3 py-2 font-mono font-bold" style={{ color: '#1e5a3a' }}>{p.referencia}</td>
                        <td className="px-3 py-2 font-medium max-w-[280px] truncate" style={{ color: '#1a3010' }} title={p.descripcion??''}>{p.descripcion??'—'}</td>
                        <td className="px-3 py-2" style={{ color: '#5a7a42' }}>{p.bodega??'—'}</td>
                        <td className="px-3 py-2" style={{ color: '#5a7a42' }}>{p.um??'UND'}</td>
                        <td className="px-3 py-2 text-right">
                          <span className="font-bold" style={{ color: p.existencia > 0 ? '#2a6a1e' : '#c04030' }}>
                            {p.existencia.toLocaleString('es-CO')}
                          </span>
                        </td>
                        <td className="px-3 py-2" style={{ color: '#7a9a60' }}>
                          {p.fecha_ultima ? p.fecha_ultima.split('-').reverse().join('/') : '—'}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs" style={{ color: p.semana_actualizacion ? '#2a6a1e' : '#b0c0a0' }}>
                          {p.semana_actualizacion ? (() => {
                            const d = new Date(p.semana_actualizacion + 'T00:00:00')
                            const jan4 = new Date(d.getFullYear(), 0, 4)
                            const w1 = new Date(jan4); w1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7))
                            const sem = Math.round((d.getTime() - w1.getTime()) / (7 * 86400000)) + 1
                            const dd = String(d.getDate()).padStart(2,'0')
                            const mm = String(d.getMonth()+1).padStart(2,'0')
                            return `Sem ${sem} · ${dd}/${mm}/${d.getFullYear()}`
                          })() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            TAB 0 — FORECAST
        ══════════════════════════════════════════════════ */}
        {tab === 0 && (
          <div>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <h2 className="font-bold text-sm" style={{ color: '#1e3a14' }}>FORECAST</h2>
              <span className="text-xs" style={{ color: '#6a8a50' }}>
                {new Date().getFullYear()} · {semanas.length} semanas
              </span>
              {/* Buscador */}
              <div className="relative flex items-center" style={{ minWidth: 220 }}>
                <input
                  type="text"
                  value={filtroFc}
                  onChange={e => setFiltroFc(e.target.value)}
                  placeholder="Buscar REF o producto…"
                  className="w-full pl-3 pr-7 py-1.5 rounded-lg text-xs outline-none"
                  style={{ background: '#fff', border: '1.5px solid #8ab87a', color: '#1e3a14' }}
                />
                {filtroFc && (
                  <button onClick={() => setFiltroFc('')}
                    className="absolute right-2 text-gray-400 hover:text-gray-600">
                    <X size={12} />
                  </button>
                )}
              </div>
              {filtroFc && (
                <span className="text-xs" style={{ color: '#6a8a50' }}>
                  {productos.filter(p => {
                    const q = filtroFc.toLowerCase()
                    return p.referencia.toLowerCase().includes(q) || (p.descripcion??'').toLowerCase().includes(q)
                  }).length} resultado(s)
                </span>
              )}
              {fcImportMsg && (
                <span className="text-xs px-2 py-0.5 rounded-lg flex items-center gap-1"
                  style={{ background: '#e8f5d0', border: '1px solid #8ab87a', color: '#2a6a1e' }}>
                  {fcImportMsg}
                  <button onClick={() => setFcImportMsg('')} style={{ color: '#6a8a50' }}><X size={11} /></button>
                </span>
              )}
              <div className="ml-auto flex items-center gap-2">
                {/* Import PEDIDO from Excel */}
                <input ref={fileFcRef} type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={handleForecastExcel} />
                <button
                  onClick={() => fileFcRef.current?.click()}
                  disabled={uploadingFc || inventario.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:brightness-110 disabled:opacity-50"
                  style={{ background: '#1e3a14', border: '1px solid #3a6228', color: '#a3d982' }}
                  title="Importar PEDIDO desde Excel (REF + valores por semana)">
                  {uploadingFc ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  Importar PEDIDO
                </button>
                <button onClick={() => fcScroll(-1)}
                  className="px-2.5 py-1 rounded-lg text-sm font-bold transition-all hover:brightness-110"
                  style={{ background:'#c8e0a8', border:'1px solid #8ab87a', color:'#1e3a14' }}>←</button>
                <button onClick={fcScrollToToday}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all hover:brightness-110"
                  style={{ background:'#1e3a14', border:'1px solid #8ab87a', color:'#7acc50' }}
                  title="Ir a semana actual">Hoy</button>
                <button onClick={() => fcScroll(1)}
                  className="px-2.5 py-1 rounded-lg text-sm font-bold transition-all hover:brightness-110"
                  style={{ background:'#c8e0a8', border:'1px solid #8ab87a', color:'#1e3a14' }}>→</button>
                <button onClick={cargarPlan}
                  className="p-1.5 rounded-lg transition-colors hover:brightness-110"
                  style={{ background: '#c8e0a8', border: '1px solid #8ab87a', color: '#1e3a14' }}>
                  <RefreshCw size={13} />
                </button>
              </div>
            </div>

            {inventario.length === 0 ? (
              <div className="text-center py-16" style={{ color: '#6a8a50' }}>
                <BarChart2 size={40} strokeWidth={1} className="mx-auto mb-3" />
                <p className="text-sm">Primero importa el inventario en la pestaña "Inventario PT/BLK".</p>
              </div>
            ) : loadingPlan ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={28} className="animate-spin" style={{ color: '#3a7228' }} />
              </div>
            ) : (
              <>
                {/* Leyenda */}
                <div className="flex items-center gap-4 mb-3 text-xs flex-wrap" style={{ color: '#5a7a42' }}>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{background:'#4a7ab5'}} /> PEDIDO (manual)</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{background:'#3a7228'}} /> PROD (manual)</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{background:'#a06828'}} /> SALDO (auto)</span>
                  {savingCell && <span className="flex items-center gap-1" style={{ color:'#a06828' }}><Loader2 size={10} className="animate-spin" />Guardando…</span>}
                </div>

                <div
                  ref={fcScrollRef}
                  onMouseDown={fcMouseDown}
                  onMouseMove={fcMouseMove}
                  onMouseUp={fcMouseUp}
                  onMouseLeave={fcMouseLeave}
                  className="overflow-x-auto rounded-xl select-none shadow-sm"
                  style={{ border:'1px solid #a0c878', cursor:'grab', scrollbarWidth:'thin', scrollbarColor:'#8ab87a #d4e8b8' }}>
                  <table className="text-xs" style={{ minWidth: `${472 + semanasVis.length * 168}px`, borderCollapse: 'separate', borderSpacing: 0 }}>
                    <thead>
                      {/* Row 1: weeks */}
                      <tr style={{ background: '#1e3a14', borderBottom: '1px solid #2e5a20' }}>
                        <th className="px-3 py-2 text-left sticky left-0 z-20 w-48" style={{ background: '#1e3a14', minWidth: 240 }}>
                          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#a3d982' }}>PRODUCTO</span>
                        </th>
                        <th className="px-2 py-2 text-center sticky z-20" style={{ background: '#1e3a14', minWidth: 120, left: 240 }}>
                          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#e8b870' }}>INVENTARIO DISPONIBLE</span>
                        </th>
                        <th className="px-2 py-2 text-center sticky z-20" style={{ background: '#1e3a14', minWidth: 112, left: 360, borderRight: '2px solid #4a8a30', boxShadow: '3px 0 6px rgba(0,0,0,0.15)' }}>
                          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#7ab5e8' }}>TOTAL<br/>PROYECTADO</span>
                        </th>
                        {semanasVis.map(s => {
                          const d = isoToDate(s)
                          return (
                            <th key={s} colSpan={2} className="px-2 py-2 text-center font-bold whitespace-nowrap"
                              style={{ color: '#a3d982', borderLeft: '1px solid #2e5a20', minWidth: 168 }}>
                              SEM {getISOWeek(d)} · {fmtShortDate(s)}
                            </th>
                          )
                        })}
                      </tr>
                      {/* Row 2: sub-headers */}
                      <tr style={{ background: '#264a18', borderBottom: '2px solid #3a6228' }}>
                        <th className="sticky left-0 z-20" style={{ background: '#264a18' }} />
                        <th className="sticky z-20" style={{ background: '#264a18', left: 240, minWidth: 120 }} />
                        <th className="sticky z-20" style={{ background: '#264a18', left: 360, borderRight: '2px solid #4a8a30', boxShadow: '3px 0 6px rgba(0,0,0,0.15)', minWidth: 112 }} />
                        {semanasVis.map(s => (
                          <React.Fragment key={s}>
                            <th className="px-2 py-1.5 text-center font-bold uppercase"
                              style={{ color: '#7ab5e8', borderLeft: '1px solid #3a6228', fontSize: '0.6rem', minWidth: 84 }}>
                              PROYECTADO
                            </th>
                            <th className="px-2 py-1.5 text-center font-bold uppercase"
                              style={{ color: '#e8a030', fontSize: '0.6rem', minWidth: 84 }}>
                              PEDIDO
                            </th>
                          </React.Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {inventario.filter(p => {
                        if (!filtroFc) return true
                        const q = filtroFc.toLowerCase()
                        return p.referencia.toLowerCase().includes(q) || (p.descripcion??'').toLowerCase().includes(q)
                      }).map((prod, pi) => (
                        <tr key={prod.referencia} style={{ background: pi%2===0 ? '#ffffff' : '#f0f7e4', borderBottom:'1px solid #d0e8b0' }}>
                          {/* Product name */}
                          <td className="px-3 py-2 sticky left-0 z-10" style={{ background: pi%2===0 ? '#ffffff' : '#f0f7e4', minWidth: 240 }}>
                            <div className="font-mono font-bold text-xs" style={{ color: '#1e5a3a' }}>{prod.referencia}</div>
                            <div style={{ fontSize: '0.65rem', color: '#5a7a42' }}>{prod.descripcion??'—'}</div>
                          </td>
                          {/* INV. — saldo Demanda semana en curso */}
                          {((inv) => (
                            <td className="px-2 py-1.5 text-center font-mono font-bold text-xs sticky z-10"
                              style={{ background: pi%2===0 ? '#ffffff' : '#f0f7e4', left: 240, minWidth: 120,
                                color: inv === null ? '#8a9a80' : inv > 0 ? '#2a6a1e' : '#c04030' }}>
                              {inv !== null && inv !== 0 ? inv.toLocaleString('es-CO') : '—'}
                            </td>
                          ))(fcIdxAct >= 0 ? (getSaldosDemanda(prod.referencia)[fcIdxAct] ?? null) : null)}
                          {((total) => (
                            <td className="px-2 py-1.5 text-center font-mono font-bold text-xs sticky z-10"
                              style={{ background: pi%2===0 ? '#ffffff' : '#f0f7e4', left: 360, minWidth: 112,
                                color: total > 0 ? '#2a5a8a' : '#b0b8a8',
                                borderRight: '2px solid #8ab87a', boxShadow: '3px 0 6px rgba(0,0,0,0.08)' }}>
                              {total > 0 ? total.toLocaleString('es-CO') : '—'}
                            </td>
                          ))(semanas.filter(s => s > hoyLunes).reduce((acc, s) => acc + (planData[`${prod.referencia}_${s}`]?.pedido ?? 0), 0))}
                          {semanasVis.map((s) => {
                            const key = `${prod.referencia}_${s}`
                            const { pedido = 0 } = planData[key] ?? {}
                            const pedidoDemanda = demandaOverride[`${prod.referencia}|${s}`] ?? 0
                            return (
                              <React.Fragment key={s}>
                                {/* PROYECTADO */}
                                <td className="py-1.5 text-center relative group/com"
                                  style={{ borderLeft: '1px solid #c0dca0', background: 'rgba(74,122,181,0.08)', minWidth: 84 }}>
                                  {comentarios[key] && (
                                    <div className="absolute top-0 right-0 w-0 h-0 z-10"
                                      style={{ borderStyle:'solid', borderWidth:'0 9px 9px 0', borderColor:'transparent #e8a030 transparent transparent' }}
                                      title={`${comentarios[key].autor ? comentarios[key].autor + ': ' : ''}${comentarios[key].texto}`}
                                    />
                                  )}
                                  <input
                                    type="number"
                                    value={pedido || ''}
                                    placeholder="—"
                                    readOnly={perfil === 'comercial'}
                                    onChange={perfil === 'comercial' ? undefined : e => updateCell(prod.referencia, s, 'pedido', e.target.value)}
                                    className="w-20 text-center text-xs font-mono rounded px-1 py-0.5 focus:outline-none"
                                    style={{ background: 'transparent', border: '1px solid transparent', color: '#2a5a8a',
                                      cursor: perfil === 'comercial' ? 'default' : undefined }}
                                    onFocus={perfil === 'comercial' ? undefined : e => (e.target as HTMLInputElement).style.borderColor = '#4a7ab5'}
                                    onBlur={perfil === 'comercial' ? undefined : e => (e.target as HTMLInputElement).style.borderColor = 'transparent'}
                                  />
                                  {perfil !== 'comercial' && (
                                    <button
                                      onClick={() => {
                                        const d = isoToDate(s)
                                        setCommentModal({ key, ref: prod.referencia, semana: s, semLabel: `SEM ${getISOWeek(d)} · ${fmtShortDate(s)}` })
                                        setCommentDraft(comentarios[key]?.texto ?? '')
                                        setCommentAuthor(comentarios[key]?.autor ?? '')
                                      }}
                                      className="absolute bottom-0.5 right-0.5 opacity-0 group-hover/com:opacity-100 transition-opacity rounded"
                                      style={{ padding: '1px 2px', color: comentarios[key] ? '#e8a030' : '#8ab87a', background: 'rgba(255,255,255,0.7)' }}
                                      title="Agregar / editar comentario">
                                      <MessageSquare size={9} />
                                    </button>
                                  )}
                                </td>
                                {/* PEDIDO — de Demanda */}
                                <td className="px-2 py-1.5 text-center font-mono text-xs"
                                  style={{ background: 'rgba(232,160,48,0.07)', minWidth: 84,
                                    color: pedidoDemanda > 0 ? '#b07820' : '#b0b8a8' }}>
                                  {pedidoDemanda > 0 ? pedidoDemanda.toLocaleString('es-CO') : '—'}
                                </td>
                              </React.Fragment>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs mt-2 text-right" style={{ color: '#8a9a80' }}>
                  {inventario.length} productos
                </p>
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            TAB 3 — PLAN MENSUAL
        ══════════════════════════════════════════════════ */}
        {tab === 3 && (() => {
          const mesActivoIdx = mesesDisponibles.indexOf(mesActivo)
          const tresMeses = mesesDisponibles.slice(mesActivoIdx, mesActivoIdx + 2)
          return (
          <div>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <h2 className="font-bold text-sm" style={{ color: '#1e3a14' }}>Plan Mensual — PROYECTADO vs PEDIDO por semana</h2>
              {/* Botón descargar */}
              <div className="relative">
                <button onClick={() => setPmExportMenu(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:brightness-110"
                  style={{ background: '#1e3a14', border: '1px solid #3a6228', color: '#a3d982' }}>
                  <Download size={12} /> Descargar Excel
                </button>
                {pmExportMenu && (
                  <div className="absolute left-0 top-full mt-1 rounded-xl shadow-xl z-50 overflow-hidden"
                    style={{ background: '#f0faf0', border: '1px solid #b7ddb7', minWidth: 210 }}>
                    <button className="w-full text-left px-4 py-2.5 text-xs font-medium hover:brightness-95 transition-colors"
                      style={{ color: '#1e3a14' }}
                      onClick={() => { exportarPlanMensual(tresMeses); setPmExportMenu(false) }}>
                      Vista actual ({tresMeses.join(' + ')})
                    </button>
                    <div style={{ borderTop: '1px solid #c8e0a8' }} />
                    {mesesDisponibles.map(mes => (
                      <button key={mes} className="w-full text-left px-4 py-2.5 text-xs font-medium hover:brightness-95 transition-colors"
                        style={{ color: '#1e3a14' }}
                        onClick={() => { exportarPlanMensual([mes]); setPmExportMenu(false) }}>
                        Solo {mes}
                      </button>
                    ))}
                    <div style={{ borderTop: '1px solid #c8e0a8' }} />
                    <button className="w-full text-left px-4 py-2.5 text-xs font-semibold hover:brightness-95 transition-colors"
                      style={{ color: '#1e3a14' }}
                      onClick={() => { exportarPlanMensual(mesesDisponibles); setPmExportMenu(false) }}>
                      Todo el año ({new Date().getFullYear()})
                    </button>
                  </div>
                )}
              </div>
              <div className="flex gap-1.5 ml-auto flex-wrap">
                {mesesDisponibles.map(mes => (
                  <button key={mes} onClick={() => setMesFiltro(mes)}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all hover:brightness-110"
                    style={{
                      background: mesActivo===mes ? '#1e3a14' : '#c8e0a8',
                      border: `1px solid ${mesActivo===mes ? '#3a6228' : '#8ab87a'}`,
                      color: mesActivo===mes ? '#a3d982' : '#3a5a20',
                    }}>
                    {mes}
                  </button>
                ))}
              </div>
            </div>

            {/* Leyenda */}
            <div className="flex items-center gap-4 mb-3 text-xs" style={{ color: '#5a7a42' }}>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{background:'#7040a8'}} /> PROY (del FORECAST)</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{background:'#4a7ab5'}} /> PED (pedido real)</span>
            </div>

            {inventario.length === 0 ? (
              <div className="text-center py-16" style={{ color: '#6a8a50' }}>
                <Calendar size={40} strokeWidth={1} className="mx-auto mb-3" />
                <p className="text-sm">Primero importa el inventario y completa el FORECAST.</p>
              </div>
            ) : loadingPlan ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={28} className="animate-spin" style={{ color: '#3a7228' }} />
              </div>
            ) : (
              <div
                ref={pmScrollRef}
                onMouseDown={pmMouseDown}
                onMouseMove={pmMouseMove}
                onMouseUp={pmMouseUp}
                onMouseLeave={pmMouseLeave}
                className="overflow-x-auto rounded-xl shadow-sm select-none"
                style={{ border: '1px solid #a0c878', cursor: 'grab', scrollbarWidth: 'thin', scrollbarColor: '#8ab87a #d4e8b8' }}>
                <table className="text-xs" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead>
                    {/* Row 1 — month groups */}
                    <tr style={{ background: '#1e3a14' }}>
                      <th rowSpan={3} className="px-3 py-2 text-left sticky left-0 z-20 font-bold uppercase tracking-wide"
                        style={{ background: '#1e3a14', color: '#a3d982', fontSize: '0.65rem', minWidth: 240, borderRight: '1px solid #3a6228', verticalAlign: 'bottom' }}>
                        REF / PRODUCTO
                      </th>
                      {tresMeses.map((mes, mi) => {
                        const semsM = semanasPorMes[mes] ?? []
                        return (
                          <th key={mes} colSpan={semsM.length * 2 + 2}
                            className="px-3 py-2 text-center font-bold"
                            style={{
                              color: '#a3d982', fontSize: '0.7rem',
                              borderLeft: mi > 0 ? '2px solid #4a8a30' : '1px solid #3a6228',
                              borderBottom: '1px solid #3a6228',
                            }}>
                            {mes}
                          </th>
                        )
                      })}
                      <th rowSpan={3} className="px-3 py-2 text-center font-bold"
                        style={{ color: '#e8c870', fontSize: '0.65rem', borderLeft: '2px solid #4a8a30', minWidth: 72, verticalAlign: 'bottom' }}>
                        TOTAL<br/>PROY<br/>
                        <span style={{ fontSize: '0.55rem', color: '#a09060' }}>2 meses</span>
                      </th>
                      <th rowSpan={3} className="px-3 py-2 text-center font-bold"
                        style={{ color: '#7ab5e8', fontSize: '0.65rem', borderLeft: '1px solid #4a8a30', minWidth: 72, verticalAlign: 'bottom' }}>
                        TOTAL<br/>PED<br/>
                        <span style={{ fontSize: '0.55rem', color: '#6090b0' }}>2 meses</span>
                      </th>
                    </tr>
                    {/* Row 2 — weeks (span 2) + PROY MES */}
                    <tr style={{ background: '#1a3410' }}>
                      {tresMeses.map((mes, mi) => {
                        const semsM = semanasPorMes[mes] ?? []
                        return [
                          ...semsM.map((s, si) => {
                            const d = isoToDate(s)
                            return (
                              <th key={s} colSpan={2} className="px-2 py-1.5 text-center font-semibold whitespace-nowrap"
                                style={{
                                  color: '#8ac870', fontSize: '0.6rem',
                                  borderLeft: (mi > 0 && si === 0) ? '2px solid #4a8a30' : si === 0 ? '1px solid #3a6228' : 'none',
                                  borderBottom: '1px solid #3a6228',
                                }}>
                                SEM {getISOWeek(d)}<br/>
                                <span style={{ color: '#5a8850', fontSize: '0.55rem' }}>{fmtShortDate(s)}</span>
                              </th>
                            )
                          }),
                          <th key={`${mes}_pmh`} rowSpan={2} className="px-2 py-1 text-center font-bold"
                            style={{ color: '#e8b870', fontSize: '0.6rem', borderLeft: '1px solid #4a8a30', minWidth: 68, verticalAlign: 'middle' }}>
                            PROY<br/>MES
                          </th>,
                          <th key={`${mes}_pedmh`} rowSpan={2} className="px-2 py-1 text-center font-bold"
                            style={{ color: '#7ab5e8', fontSize: '0.6rem', borderLeft: '1px solid #4a8a30', minWidth: 68, verticalAlign: 'middle' }}>
                            PED<br/>MES
                          </th>,
                        ]
                      })}
                    </tr>
                    {/* Row 3 — PROY / PED sub-cols */}
                    <tr style={{ background: '#162c0e', borderBottom: '2px solid #3a6228' }}>
                      {tresMeses.map((mes, mi) => {
                        const semsM = semanasPorMes[mes] ?? []
                        return semsM.flatMap((s, si) => [
                          <th key={`${s}_proy`} className="px-1 py-1.5 text-center font-bold uppercase"
                            style={{ color: '#c0a0e8', fontSize: '0.55rem', borderLeft: (mi > 0 && si === 0) ? '2px solid #4a8a30' : si === 0 ? '1px solid #3a6228' : 'none', minWidth: 60 }}>
                            PROY
                          </th>,
                          <th key={`${s}_ped`} className="px-1 py-1.5 text-center font-bold uppercase"
                            style={{ color: '#7ab5e8', fontSize: '0.55rem', minWidth: 60 }}>
                            PED
                          </th>,
                        ])
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {inventario.map((prod, pi) => {
                      const rowBg = pi % 2 === 0 ? '#ffffff' : '#f0f7e4'
                      const monthData = tresMeses.map(mes => {
                        const semsM = semanasPorMes[mes] ?? []
                        const weeks = semsM.map(s => {
                          const key = `${prod.referencia}_${s}`
                          return {
                            s,
                            proy: planData[key]?.pedido ?? 0,
                            ped:  demandaOverride[`${prod.referencia}|${s}`] ?? 0,
                          }
                        })
                        const proyMes = weeks.reduce((a, w) => a + w.proy, 0)
                        const pedMes  = weeks.reduce((a, w) => a + w.ped,  0)
                        return { mes, weeks, proyMes, pedMes }
                      })
                      const grandTotal    = monthData.reduce((a, m) => a + m.proyMes, 0)
                      const grandTotalPed = monthData.reduce((a, m) => a + m.pedMes,  0)

                      return (
                        <tr key={prod.referencia} style={{ background: rowBg, borderBottom: '1px solid #d0e8b0' }}>
                          <td className="px-3 py-2 sticky left-0 z-10"
                            style={{ background: rowBg, borderRight: '1px solid #c0dca0', minWidth: 240 }}>
                            <div className="font-mono font-bold text-xs" style={{ color: '#1e5a3a' }}>{prod.referencia}</div>
                            <div style={{ fontSize: '0.65rem', color: '#5a7a42' }}>{prod.descripcion??'—'}</div>
                          </td>
                          {monthData.map(({ mes, weeks, proyMes, pedMes }, mi) => [
                            ...weeks.flatMap(({ s, proy, ped }, si) => [
                              <td key={`${s}_proy`} className="px-2 py-1.5 text-center font-mono"
                                style={{ borderLeft: (mi > 0 && si === 0) ? '2px solid #b0d890' : si === 0 ? '1px solid #d0e8b0' : 'none',
                                  color: proy > 0 ? '#7040a8' : '#c0ceb0' }}>
                                {proy > 0 ? proy.toLocaleString('es-CO') : '—'}
                              </td>,
                              <td key={`${s}_ped`} className="px-2 py-1.5 text-center font-mono"
                                style={{ color: ped > 0 ? '#2a5a8a' : '#c0ceb0' }}>
                                {ped > 0 ? ped.toLocaleString('es-CO') : '—'}
                              </td>,
                            ]),
                            <td key={`${mes}_pm`} className="px-2 py-1.5 text-center font-mono font-bold"
                              style={{ borderLeft: '1px solid #c0dca0', color: proyMes > 0 ? '#a06828' : '#c0ceb0', background: 'rgba(160,104,40,0.06)' }}>
                              {proyMes > 0 ? proyMes.toLocaleString('es-CO') : '—'}
                            </td>,
                            <td key={`${mes}_pedm`} className="px-2 py-1.5 text-center font-mono font-bold"
                              style={{ borderLeft: '1px solid #c0dca0', color: pedMes > 0 ? '#2a5a8a' : '#c0ceb0', background: 'rgba(74,122,181,0.06)' }}>
                              {pedMes > 0 ? pedMes.toLocaleString('es-CO') : '—'}
                            </td>,
                          ])}
                          <td className="px-2 py-1.5 text-center font-mono font-bold"
                            style={{ borderLeft: '2px solid #a0c878', color: grandTotal > 0 ? '#1a5a10' : '#c0ceb0', background: 'rgba(30,58,20,0.06)' }}>
                            {grandTotal > 0 ? grandTotal.toLocaleString('es-CO') : '—'}
                          </td>
                          <td className="px-2 py-1.5 text-center font-mono font-bold"
                            style={{ borderLeft: '1px solid #a0c878', color: grandTotalPed > 0 ? '#2a5a8a' : '#c0ceb0', background: 'rgba(74,122,181,0.06)' }}>
                            {grandTotalPed > 0 ? grandTotalPed.toLocaleString('es-CO') : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          )
        })()}

        {/* ══════════════════════════════════════════════════
            TAB 6 — ACTIVIDADES (header)
        ══════════════════════════════════════════════════ */}
        {tab === 6 && (
          <div className="rounded-2xl p-4" style={{ background: '#edf7ed', border: '1px solid #b7ddb7' }}>

            {/* Toolbar */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <h2 className="font-bold text-sm" style={{ color: '#1a4a1a' }}>Desagregado de Actividades por Producto</h2>
              <div className="ml-auto flex items-center gap-2 flex-wrap">
                <input type="text" value={filtroAct} onChange={e => setFiltroAct(e.target.value)}
                  placeholder="Buscar ref o producto…"
                  className="text-xs rounded-lg px-3 py-1.5 focus:outline-none"
                  style={{ background: '#fff', border: '1px solid #a3c9a3', color: '#1a4a1a', width: 180 }} />
                <button onClick={cargarActividades} className="p-1.5 rounded-lg hover:bg-green-100 transition-colors"
                  style={{ border: '1px solid #a3c9a3', color: '#2d7a2d', background: '#fff' }}>
                  <RefreshCw size={13} />
                </button>
                {/* Agregar manual */}
                <button onClick={() => setModalAddAct({ ref: '', desc: '', acts: [{ actividad: '', subRef: '' }] })}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all hover:brightness-95"
                  style={{ background: '#fff', border: '1px solid #4ade80', color: '#166534' }}>
                  <Package size={12} /> Agregar Producto
                </button>
                {/* Limpiar */}
                <button onClick={async () => {
                    if (!confirm('¿Eliminar TODAS las actividades?')) return
                    setBorrandoAct(true)
                    const r = await fetch('/api/planeacion/actividades', { method: 'DELETE' })
                    if (r.ok) { setActividades([]); setErrorMsg('') }
                    else setErrorMsg('Error al eliminar actividades')
                    setBorrandoAct(false)
                  }} disabled={borrandoAct || actividades.length === 0}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all hover:brightness-95 disabled:opacity-40"
                  style={{ background: '#fff', border: '1px solid #fca5a5', color: '#991b1b' }}>
                  {borrandoAct ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  {borrandoAct ? 'Eliminando…' : 'Limpiar'}
                </button>
                {/* Importar Excel */}
                <input ref={fileActRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleActExcel} />
                <button onClick={() => fileActRef.current?.click()} disabled={uploadingAct}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all hover:brightness-95 disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#14532d,#166534)', border: '1px solid #4ade80', color: 'white' }}>
                  {uploadingAct ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  {uploadingAct ? 'Importando…' : 'Importar Excel'}
                </button>
              </div>
            </div>

            {/* Formato hint */}
            <div className="mb-4 px-3 py-2 rounded-lg text-xs" style={{ background: '#d4edda', border: '1px solid #a3c9a3', color: '#1a4a1a' }}>
              Excel esperado: columna A = <strong>REF</strong>, columna B = <strong>DESCRIPCIÓN</strong>.
              Filas de producto en <strong>MAYÚSCULAS</strong>, actividades en minúsculas debajo.
            </div>

            {loadingAct ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={28} className="animate-spin" style={{ color: '#2d7a2d' }} />
              </div>
            ) : actividades.length === 0 ? (
              <div className="text-center py-16" style={{ color: '#6b9c6b' }}>
                <ListChecks size={40} strokeWidth={1} className="mx-auto mb-3" />
                <p className="text-sm">Sin actividades. Importa un Excel o agrega manualmente.</p>
              </div>
            ) : (
              <ActividadesTabla
                refsAct={refsAct}
                actPorRef={actPorRef}
                filtroAct={filtroAct}
                onEditRef={ref => {
                  const acts = actPorRef[ref] ?? []
                  const desc = acts[0]?.descripcion_producto ?? ''
                  setModalAddAct({
                    ref,
                    desc,
                    acts: [
                      ...acts.map(a => ({ actividad: a.actividad, subRef: a.sub_referencia ?? '' })),
                      { actividad: '', subRef: '' },
                    ],
                  })
                }}
              />
            )}

          </div>
        )}

        {/* ══════════════════════════════════════════════════
            TAB 2 — PLAN DIARIO
        ══════════════════════════════════════════════════ */}
        {tab === 2 && (() => {
          const dias = getDias(semDiario)
          // All refs that have activities, filtered to those in inventario
          const refsConActAll = Object.keys(actPorRef).filter(r => actPorRef[r]?.length > 0)
          const refsConAct = refsConActAll.filter(r => {
            if (filtroDiario) {
              const q = filtroDiario.toLowerCase()
              if (!r.toLowerCase().includes(q) && !(actPorRef[r][0]?.descripcion_producto ?? '').toLowerCase().includes(q))
                return false
            }
            if (diaFiltro) {
              const hasParent = (planDiario[`${r}||${diaFiltro}`] ?? 0) > 0
              const hasActivity = (actPorRef[r] ?? []).some(a => (planDiario[`${r}|${a.actividad}|${diaFiltro}`] ?? 0) > 0)
              return hasParent || hasActivity
            }
            return true
          })

          return (
            <div>
              {/* Navigator */}
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <h2 className="font-bold text-sm" style={{ color: '#1e3a14' }}>Plan Diario de Producción</h2>
                {/* Buscador */}
                <div className="relative flex items-center" style={{ minWidth: 220 }}>
                  <input
                    type="text"
                    value={filtroDiario}
                    onChange={e => setFiltroDiario(e.target.value)}
                    placeholder="Buscar REF o producto…"
                    className="w-full pl-3 pr-7 py-1.5 rounded-lg text-xs outline-none"
                    style={{ background: '#fff', border: '1.5px solid #8ab87a', color: '#1e3a14' }}
                  />
                  {filtroDiario && (
                    <button onClick={() => setFiltroDiario('')}
                      className="absolute right-2 text-gray-400 hover:text-gray-600">
                      <X size={12} />
                    </button>
                  )}
                </div>
                {/* Filtro por día */}
                <div className="flex items-center gap-1">
                  <span className="text-xs mr-1" style={{ color: '#6a8a50' }}>Filtrar día:</span>
                  {dias.map(d => (
                    <button key={d} onClick={() => setDiaFiltro(diaFiltro === d ? null : d)}
                      className="px-2 py-1 rounded text-xs font-semibold transition-all"
                      style={diaFiltro === d
                        ? { background: '#1e3a14', border: '1px solid #3a6228', color: '#7acc50' }
                        : { background: '#c8e0a8', border: '1px solid #8ab87a', color: '#3a5a20' }}>
                      {diaCorto(d)}<br/>
                      <span style={{ fontSize: '0.55rem', opacity: 0.8 }}>{fmtDMM(d)}</span>
                    </button>
                  ))}
                </div>
                {diaFiltro && (
                  <span className="text-xs" style={{ color: '#6a8a50' }}>
                    {refsConAct.length} ref{refsConAct.length !== 1 ? 's' : ''}
                  </span>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <button onClick={() => { const s = prevSem(semDiario); setSemDiario(s); }}
                    className="px-2 py-1 rounded text-xs font-bold hover:brightness-110"
                    style={{ background:'#c8e0a8', border:'1px solid #8ab87a', color:'#1e3a14' }}>←</button>
                  <span className="text-xs font-mono whitespace-nowrap" style={{ color: '#3a5a20' }}>
                    Sem {getISOWeek(isoToDate(semDiario))} · {fmtDMM(dias[0])} → {fmtDMM(dias[5])}
                  </span>
                  <button onClick={() => { const s = nextSem(semDiario); setSemDiario(s); }}
                    className="px-2 py-1 rounded text-xs font-bold hover:brightness-110"
                    style={{ background:'#c8e0a8', border:'1px solid #8ab87a', color:'#1e3a14' }}>→</button>
                </div>
              </div>

              {loadingDiario ? (
                <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin" style={{ color: '#3a7228' }} /></div>
              ) : refsConAct.length === 0 ? (
                <div className="text-center py-12 text-sm" style={{ color: '#6a8a50' }}>Importa actividades primero (tab Actividades)</div>
              ) : (
                <div className="overflow-x-auto rounded-xl shadow-sm" style={{ border:'1px solid #a0c878' }}>
                  <table className="text-xs" style={{ minWidth: 900 }}>
                    <thead>
                      <tr style={{ background:'#1e3a14', borderBottom:'2px solid #3a6228' }}>
                        <th className="px-3 py-2.5 text-left font-bold sticky left-0 z-10" style={{ background:'#1e3a14', color:'#a3d982', minWidth:70 }}>REF</th>
                        <th className="px-3 py-2.5 text-left font-bold" style={{ color:'#a3d982', minWidth:180 }}>ACTIVIDAD / PRODUCTO</th>
                        <th className="px-3 py-2.5 text-center font-bold" style={{ color:'#e8b870', minWidth:80 }}>SUGERIDO</th>
                        {dias.map(d => (
                          <th key={d} className="px-2 py-2.5 text-center font-bold" style={{ minWidth:80 }}>
                            <div style={{ color:'#a3d982', fontSize:'0.7rem' }}>{diaCorto(d)}</div>
                            <div style={{ color:'#6a9850', fontSize:'0.65rem' }}>{fmtDMM(d)}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {refsConAct.map((ref, ri) => {
                        const acts = actPorRef[ref]
                        const prodDesc = acts[0]?.descripcion_producto ?? ref
                        const sugerido = planData[`${ref}_${semDiario}`]?.produccion ?? 0
                        const rowBg = ri % 2 === 0 ? '#ffffff' : '#f0f7e4'
                        return [
                          // Product header row
                          <tr key={`h-${ref}`} style={{ background:'#dff0c8', borderBottom:'2px solid #b0d890' }}>
                            <td className="px-3 py-2 font-mono font-bold sticky left-0 z-10" style={{ background:'#d0e8b8', color:'#1e5a3a' }}>{ref}</td>
                            <td className="px-3 py-2 font-semibold" style={{ color: '#1a3010' }}>{prodDesc}</td>
                            {(() => {
                              const weekTotal = dias.reduce((s, d) => s + (planDiario[`${ref}||${d}`] ?? 0), 0)
                              const sgColor = sugerido === 0
                                ? '#8a9a80'
                                : weekTotal >= sugerido ? '#2a6a1e' : '#c04030'
                              return (
                                <td className="px-3 py-2 text-center font-bold font-mono" style={{ color: sgColor }}>
                                  {sugerido > 0 ? (
                                    <>
                                      {sugerido.toLocaleString('es-CO')}
                                      {weekTotal > 0 && (
                                        <div style={{ fontSize:'0.6rem', fontWeight:400, opacity:0.8 }}>
                                          {weekTotal.toLocaleString('es-CO')} / {sugerido.toLocaleString('es-CO')}
                                        </div>
                                      )}
                                    </>
                                  ) : <span style={{ color:'#b0c0a0' }}>—</span>}
                                </td>
                              )
                            })()}
                            {dias.map(d => {
                              const ptKey = `${ref}||${d}`
                              const ptVal = planDiario[ptKey] ?? 0
                              return (
                                <td key={d} className="px-1 py-1">
                                  <input
                                    type="number" min={0}
                                    value={ptVal === 0 ? '' : ptVal}
                                    placeholder="0"
                                    onChange={e => saveDiario(ref, '', d, Number(e.target.value) || 0)}
                                    className="w-full text-center text-xs rounded focus:outline-none"
                                    style={{
                                      background: ptVal > 0 ? 'rgba(160,104,40,0.12)' : 'rgba(255,255,255,0.7)',
                                      border: ptVal > 0 ? '1px solid rgba(160,104,40,0.4)' : '1px solid #b0d090',
                                      color: ptVal > 0 ? '#8a4a10' : '#6a8a50',
                                      padding: '3px 4px', fontWeight: ptVal > 0 ? 700 : 400,
                                    }}
                                  />
                                </td>
                              )
                            })}
                          </tr>,
                          // Activity rows
                          ...acts.map(a => (
                            <tr key={`${ref}-${a.actividad}`} style={{ background: rowBg, borderBottom:'1px solid #d0e8b0' }}>
                              <td className="px-3 py-1.5 font-mono sticky left-0 z-10" style={{ background: rowBg, color:'#8a9a80', fontSize:'0.65rem' }}>
                                {a.sub_referencia ?? ''}
                              </td>
                              <td className="px-3 py-1.5 pl-6">
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{
                                  background: a.actividad.toLowerCase().includes('fabr') ? '#dbeafe'
                                    : a.actividad.toLowerCase().includes('etiq') ? '#ede9fe'
                                    : a.actividad.toLowerCase().includes('envas') ? '#fef9c3'
                                    : '#dcfce7',
                                  color: a.actividad.toLowerCase().includes('fabr') ? '#1d4ed8'
                                    : a.actividad.toLowerCase().includes('etiq') ? '#7c3aed'
                                    : a.actividad.toLowerCase().includes('envas') ? '#854d0e'
                                    : '#166534',
                                }}>{a.actividad}</span>
                              </td>
                              <td></td>
                              {dias.map(d => {
                                const key = `${ref}|${a.actividad}|${d}`
                                const val = planDiario[key] ?? 0
                                return (
                                  <td key={d} className="px-1 py-1">
                                    <input
                                      type="number" min={0}
                                      value={val === 0 ? '' : val}
                                      placeholder="0"
                                      onChange={e => saveDiario(ref, a.actividad, d, Number(e.target.value) || 0)}
                                      className="w-full text-center text-xs rounded focus:outline-none"
                                      style={{
                                        background: val > 0 ? 'rgba(58,114,40,0.1)' : 'rgba(255,255,255,0.6)',
                                        border: val > 0 ? '1px solid rgba(58,114,40,0.35)' : '1px solid #c0d8a0',
                                        color: val > 0 ? '#2a6a1e' : '#8a9a80',
                                        padding: '3px 4px',
                                      }}
                                    />
                                  </td>
                                )
                              })}
                            </tr>
                          )),
                        ]
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })()}

        {/* ══════════════════════════════════════════════════
            TAB 1 — DEMANDA SEMANAL
        ══════════════════════════════════════════════════ */}
        {tab === 1 && (
          <div>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <h2 className="font-bold text-sm" style={{ color: '#1e3a14' }}>Demanda Semanal</h2>
              <span className="text-xs" style={{ color: '#6a8a50' }}>
                {new Date().getFullYear()} · {semanas.length} semanas
              </span>
              {/* Buscador */}
              <div className="relative flex items-center" style={{ minWidth: 220 }}>
                <input
                  type="text"
                  value={filtroDemanda}
                  onChange={e => setFiltroDemanda(e.target.value)}
                  placeholder="Buscar REF o producto…"
                  className="w-full pl-3 pr-7 py-1.5 rounded-lg text-xs outline-none"
                  style={{ background: '#fff', border: '1.5px solid #8ab87a', color: '#1e3a14' }}
                />
                {filtroDemanda && (
                  <button onClick={() => setFiltroDemanda('')}
                    className="absolute right-2 text-gray-400 hover:text-gray-600">
                    <X size={12} />
                  </button>
                )}
              </div>
              {filtroDemanda && (
                <span className="text-xs" style={{ color: '#6a8a50' }}>
                  {inventario.filter(p => {
                    const q = filtroDemanda.toLowerCase()
                    return p.referencia.toLowerCase().includes(q) || (p.descripcion??'').toLowerCase().includes(q)
                  }).length} resultado(s)
                </span>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button onClick={() => dmScroll(-1)}
                  className="px-2.5 py-1 rounded-lg text-sm font-bold transition-all hover:brightness-110"
                  style={{ background:'#c8e0a8', border:'1px solid #8ab87a', color:'#1e3a14' }}>←</button>
                <button onClick={dmScrollToToday}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all hover:brightness-110"
                  style={{ background:'#1e3a14', border:'1px solid #8ab87a', color:'#7acc50' }}
                  title="Ir a semana actual">Hoy</button>
                <button onClick={() => dmScroll(1)}
                  className="px-2.5 py-1 rounded-lg text-sm font-bold transition-all hover:brightness-110"
                  style={{ background:'#c8e0a8', border:'1px solid #8ab87a', color:'#1e3a14' }}>→</button>
                <button onClick={cargarDemanda}
                  className="p-1.5 rounded-lg transition-colors hover:brightness-110"
                  style={{ background: '#c8e0a8', border: '1px solid #8ab87a', color: '#1e3a14' }}>
                  <RefreshCw size={13} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4 mb-3 text-xs flex-wrap" style={{ color: '#5a7a42' }}>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{background:'#8a60b8'}} /> PROYECTADO (del FORECAST)</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{background:'#4a7ab5'}} /> PEDIDO (adicional manual)</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{background:'#3a7228'}} /> PROD (del FORECAST)</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{background:'#a06828'}} /> SALDO (auto · usa PEDIDO si &gt; 0, si no PROYECTADO)</span>
            </div>

            {inventario.length === 0 ? (
              <div className="text-center py-16" style={{ color: '#6a8a50' }}>
                <Calendar size={40} strokeWidth={1} className="mx-auto mb-3" />
                <p className="text-sm">Primero importa el inventario en la pestaña "Inventario PT/BLK".</p>
              </div>
            ) : loadingDemanda ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={28} className="animate-spin" style={{ color: '#3a7228' }} />
              </div>
            ) : (
              <div
                ref={dmScrollRef}
                onMouseDown={dmMouseDown}
                onMouseMove={dmMouseMove}
                onMouseUp={dmMouseUp}
                onMouseLeave={dmMouseLeave}
                className="overflow-x-auto rounded-xl select-none shadow-sm"
                style={{ border:'1px solid #a0c878', cursor:'grab', scrollbarWidth:'thin', scrollbarColor:'#8ab87a #d4e8b8' }}>
                <table className="text-xs" style={{ minWidth: `${424 + semanasVisDm.length * 336}px`, borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead>
                    {/* Row 1: semanas */}
                    <tr style={{ background: '#1e3a14', borderBottom: '1px solid #2e5a20' }}>
                      <th className="px-3 py-2 text-left sticky left-0 z-20" style={{ background: '#1e3a14', minWidth: 240 }}>
                        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#a3d982' }}>PRODUCTO</span>
                      </th>
                      <th className="px-2 py-2 text-center sticky z-20" style={{ background: '#1e3a14', minWidth: 72, left: 240 }}>
                        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#e8b870' }}>INV.</span>
                      </th>
                      <th className="px-2 py-2 text-center sticky z-20" style={{ background: '#1e3a14', minWidth: 112, left: 312, borderRight: '2px solid #4a8a30', boxShadow: '3px 0 6px rgba(0,0,0,0.15)' }}>
                        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#7ab5e8' }}>TOTAL PROYECTADO</span>
                      </th>
                      {semanasVisDm.map(s => {
                        const d = isoToDate(s)
                        return (
                          <th key={s} colSpan={4} className="px-2 py-2 text-center font-bold whitespace-nowrap"
                            style={{ color: '#a3d982', borderLeft: '1px solid #2e5a20', minWidth: 336 }}>
                            SEM {getISOWeek(d)} · {fmtShortDate(s)}
                          </th>
                        )
                      })}
                    </tr>
                    {/* Row 2: sub-headers */}
                    <tr style={{ background: '#264a18', borderBottom: '2px solid #3a6228' }}>
                      <th className="sticky left-0 z-20" style={{ background: '#264a18' }} />
                      <th className="sticky z-20" style={{ background: '#264a18', left: 240, minWidth: 72 }} />
                      <th className="px-2 py-1.5 text-center sticky z-20 font-bold uppercase" style={{ background: '#264a18', left: 312, minWidth: 112, borderRight: '2px solid #4a8a30', boxShadow: '3px 0 6px rgba(0,0,0,0.15)', color: '#7ab5e8', fontSize: '0.6rem' }}>FORECAST</th>
                      {semanasVisDm.map(s => (
                        ['PROYECTADO','PEDIDO','PROD','SALDO'].map(h => (
                          <th key={`${s}_${h}`} className="px-2 py-1.5 text-center font-bold uppercase"
                            style={{
                              color: h==='PROYECTADO'?'#c0a0e8':h==='PEDIDO'?'#7ab5e8':h==='PROD'?'#a3d982':'#e8b870',
                              borderLeft: h==='PROYECTADO'?'1px solid #3a6228':'none',
                              fontSize: '0.6rem',
                              minWidth: 84,
                            }}>
                            {h}
                          </th>
                        ))
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {inventario.filter(p => {
                      if (!filtroDemanda) return true
                      const q = filtroDemanda.toLowerCase()
                      return p.referencia.toLowerCase().includes(q) || (p.descripcion??'').toLowerCase().includes(q)
                    }).map((prod, pi) => {
                      const ref = prod.referencia
                      const saldos = getSaldosDemanda(ref)
                      const rowBg = pi % 2 === 0 ? '#ffffff' : '#f0f7e4'
                      return (
                        <tr key={ref} style={{ background: rowBg, borderBottom:'1px solid #d0e8b0' }}>
                          {/* Producto */}
                          <td className="px-3 py-2 sticky left-0 z-10"
                            style={{ background: rowBg, minWidth: 240 }}>
                            <div className="font-mono font-bold text-xs" style={{ color: '#1e5a3a' }}>{ref}</div>
                            <div style={{ fontSize: '0.65rem', color: '#5a7a42' }}>{prod.descripcion??'—'}</div>
                          </td>
                          {/* Inventario actual */}
                          <td className="px-2 py-1.5 text-center font-mono font-bold text-xs sticky z-10"
                            style={{ background: rowBg, left: 240, minWidth: 72,
                              color: (prod.existencia ?? 0) > 0 ? '#2a6a1e' : '#c04030' }}>
                            {(prod.existencia ?? 0) > 0 ? (prod.existencia).toLocaleString('es-CO') : '—'}
                          </td>
                          {/* Total Proyectado */}
                          {((total) => (
                            <td className="px-2 py-1.5 text-center font-mono font-bold text-xs sticky z-10"
                              style={{ background: rowBg, left: 312, minWidth: 112,
                                color: total > 0 ? '#2a5a8a' : '#c0ceb0',
                                borderRight: '2px solid #8ab87a', boxShadow: '3px 0 6px rgba(0,0,0,0.08)' }}>
                              {total > 0 ? total.toLocaleString('es-CO') : '—'}
                            </td>
                          ))(semanas.filter(s => s > hoyLunes).reduce((acc, s) => acc + (planData[`${ref}_${s}`]?.pedido ?? 0), 0))}
                          {semanasVisDm.map((s, vi) => {
                            const planKey = `${ref}_${s}`
                            const demKey      = `${ref}|${s}`
                            const proyectado  = planData[planKey]?.pedido ?? 0
                            const pedidoOv    = demandaOverride[demKey]
                            const pedido      = pedidoOv ?? 0
                            const prodFc      = planData[planKey]?.produccion ?? 0
                            const hasProdOv   = demKey in demandaProdOv
                            const prodOvVal   = demandaProdOv[demKey] ?? 0
                            const produccion  = hasProdOv ? prodOvVal : prodFc
                            const saldo       = saldos[dmOffset + vi]
                            return (
                              <>
                                {/* PROYECTADO */}
                                <td key={`${s}_proy`} className="px-2 py-1.5 text-center font-mono text-xs"
                                  style={{ borderLeft:'1px solid #c0dca0', background:'rgba(138,96,184,0.07)',
                                    color: proyectado > 0 ? '#7040a8' : '#c0ceb0', minWidth: 84 }}>
                                  {proyectado > 0 ? proyectado.toLocaleString('es-CO') : '—'}
                                </td>
                                {/* PEDIDO (editable manual) */}
                                <td key={`${s}_ped`} className="py-1.5 text-center relative group/com"
                                  style={{ background:'rgba(74,122,181,0.08)', minWidth: 84 }}>
                                  {comentarios[planKey] && (
                                    <div className="absolute top-0 right-0 w-0 h-0 z-10"
                                      style={{ borderStyle:'solid', borderWidth:'0 9px 9px 0', borderColor:'transparent #e8a030 transparent transparent' }}
                                      title={`${comentarios[planKey].autor ? comentarios[planKey].autor + ': ' : ''}${comentarios[planKey].texto}`}
                                    />
                                  )}
                                  <input
                                    type="number" min={0}
                                    value={pedido || ''}
                                    placeholder="—"
                                    onChange={e => saveDemandaPedido(ref, s, Number(e.target.value) || 0)}
                                    className="w-20 text-center text-xs font-mono rounded px-1 py-0.5 focus:outline-none"
                                    style={{ background:'transparent', border:'1px solid transparent', color:'#2a5a8a' }}
                                    onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#4a7ab5'}
                                    onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'transparent'}
                                  />
                                  <button
                                    onClick={() => {
                                      const d = isoToDate(s)
                                      setCommentModal({ key: planKey, ref, semana: s, semLabel: `SEM ${getISOWeek(d)} · ${fmtShortDate(s)}` })
                                      setCommentDraft(comentarios[planKey]?.texto ?? '')
                                      setCommentAuthor(comentarios[planKey]?.autor ?? '')
                                    }}
                                    className="absolute bottom-0.5 right-0.5 opacity-0 group-hover/com:opacity-100 transition-opacity rounded"
                                    style={{ padding: '1px 2px', color: comentarios[planKey] ? '#e8a030' : '#8ab87a', background: 'rgba(255,255,255,0.7)' }}
                                    title="Agregar / editar comentario">
                                    <MessageSquare size={9} />
                                  </button>
                                </td>
                                {/* PROD */}
                                <td key={`${s}_prod`} className="py-1.5 text-center relative group/prod"
                                  style={{ background:'rgba(58,114,40,0.08)', minWidth: 84 }}>
                                  <input
                                    type="number" min={0}
                                    value={produccion || ''}
                                    placeholder={prodFc > 0 ? prodFc.toLocaleString('es-CO') : '—'}
                                    onChange={e => saveProdDemandaOv(ref, s, e.target.value)}
                                    className="w-20 text-center text-xs font-mono rounded px-1 py-0.5 focus:outline-none"
                                    style={{ background:'transparent', border:'1px solid transparent',
                                      color: hasProdOv ? (prodOvVal > 0 ? '#2a6a1e' : '#c0ceb0') : (prodFc > 0 ? '#2a6a1e' : '#c0ceb0') }}
                                    onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#3a7228'}
                                    onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'transparent'}
                                    title={hasProdOv && prodFc > 0 ? `Forecast: ${prodFc.toLocaleString('es-CO')} · Borrar para restaurar` : 'Modificar producción en Demanda'}
                                  />
                                  {hasProdOv && prodFc > 0 && (
                                    <div className="absolute top-0 left-0 w-0 h-0"
                                      style={{ borderStyle:'solid', borderWidth:'6px 6px 0 0', borderColor:'#3a7228 transparent transparent transparent' }}
                                      title={`Forecast original: ${prodFc.toLocaleString('es-CO')}`} />
                                  )}
                                </td>
                                {/* SALDO */}
                                <td key={`${s}_sal`} className="px-2 py-1.5 text-center font-mono font-bold text-xs"
                                  style={{
                                    background:'rgba(160,104,40,0.08)', minWidth: 84,
                                    color: saldo === null ? '#c0ceb0'
                                      : saldo > 0 ? '#2a6a1e'
                                      : saldo < 0 ? '#c04030'
                                      : '#8a9a80',
                                  }}>
                                  {saldo !== null && saldo !== 0 ? saldo.toLocaleString('es-CO') : '—'}
                                </td>
                              </>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Modal agregar producto ───────────────────────────────────────── */}
      {modalAddAct !== null && (
        <ModalAgregarProducto
          onClose={() => setModalAddAct(null)}
          onSave={guardarProductoManual}
          initialRef={modalAddAct.ref}
          initialDesc={modalAddAct.desc}
          initialActs={modalAddAct.acts}
        />
      )}

      {/* ── Modal Nueva Entrega al Almacén ──────────────────────────────── */}
      {modalDesp !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setModalDesp(null) }}>
          <div className="rounded-2xl shadow-2xl w-full max-w-sm mx-4" style={{ background: '#f0faf0', border: '1px solid #8ab87a' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 rounded-t-2xl" style={{ background: '#1e3a14', borderBottom: '1px solid #3a6228' }}>
              <div className="font-bold text-sm flex items-center gap-2" style={{ color: '#a3d982' }}>
                <Truck size={14} /> Nueva Entrega al Almacén
              </div>
              <button onClick={() => setModalDesp(null)} style={{ color: '#6a9a50' }}><X size={16} /></button>
            </div>
            {/* Body */}
            <div className="px-5 py-4 flex flex-col gap-3">
              {/* Referencia */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#2a5a1e' }}>Referencia</label>
                <input
                  list="desp-refs-list"
                  value={despRef}
                  onChange={e => setDespRef(e.target.value.toUpperCase())}
                  placeholder="Ej: 10007"
                  className="w-full px-3 py-2 rounded-lg text-sm font-mono font-bold focus:outline-none"
                  style={{ border: '1px solid #8ab87a', background: '#ffffff', color: '#1a3010' }}
                  autoFocus
                />
                <datalist id="desp-refs-list">
                  {inventario.map(p => <option key={p.referencia} value={p.referencia}>{p.descripcion}</option>)}
                </datalist>
              </div>
              {/* Nombre auto */}
              {inventario.find(p => p.referencia === despRef)?.descripcion && (
                <div className="px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: '#e0f0d0', border: '1px solid #a0c878', color: '#2a5a1e' }}>
                  {inventario.find(p => p.referencia === despRef)?.descripcion}
                </div>
              )}
              {/* Cantidad */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#2a5a1e' }}>Cantidad entregada</label>
                <input
                  type="number" min={1}
                  value={despCantidad}
                  onChange={e => setDespCantidad(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-lg text-sm font-mono font-bold text-center focus:outline-none"
                  style={{ border: '1px solid #8ab87a', background: '#ffffff', color: '#1a3010' }}
                />
              </div>
              {/* Fecha */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#2a5a1e' }}>Fecha de entrega</label>
                <input
                  type="date"
                  value={despFecha}
                  onChange={e => setDespFecha(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm font-mono focus:outline-none"
                  style={{ border: '1px solid #8ab87a', background: '#ffffff', color: '#1a3010' }}
                />
              </div>
              {/* Semana calculada */}
              <div className="flex items-center justify-between px-3 py-2 rounded-lg text-xs" style={{ background: '#e0f0d0', border: '1px solid #a0c878' }}>
                <span style={{ color: '#4a7a30' }}>Semana calculada</span>
                <span className="font-mono font-bold" style={{ color: '#1e5a1e' }}>{despSemLabel}</span>
              </div>
            </div>
            {/* Footer */}
            <div className="flex gap-2 px-5 pb-5">
              <button onClick={() => setModalDesp(null)}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold"
                style={{ background: '#e0ead8', border: '1px solid #a0c080', color: '#4a6a30' }}>
                Cancelar
              </button>
              <button
                onClick={guardarDespacho}
                disabled={!despRef || !despCantidad || savingDespacho}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40"
                style={{ background: '#1e3a14', color: '#a3d982', border: '1px solid #3a6228' }}>
                {savingDespacho ? <Loader2 size={12} className="animate-spin" /> : <Truck size={12} />}
                Registrar Entrega
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal comentario ─────────────────────────────────────────────── */}
      {commentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={e => { if (e.target === e.currentTarget) setCommentModal(null) }}>
          <div className="rounded-2xl shadow-2xl w-full max-w-sm mx-4" style={{ background: '#f0faf0', border: '1px solid #8ab87a' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 rounded-t-2xl" style={{ background: '#1e3a14', borderBottom: '1px solid #3a6228' }}>
              <div>
                <div className="font-bold text-sm" style={{ color: '#a3d982' }}>Comentario</div>
                <div className="text-xs mt-0.5" style={{ color: '#6a9a50' }}>
                  {commentModal.ref} · {commentModal.semLabel}
                </div>
              </div>
              <button onClick={() => setCommentModal(null)} style={{ color: '#6a9a50' }}><X size={16} /></button>
            </div>
            {/* Body */}
            <div className="px-5 py-4 flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#2a5a1e' }}>Autor (opcional)</label>
                <input
                  type="text"
                  value={commentAuthor}
                  onChange={e => setCommentAuthor(e.target.value)}
                  placeholder="Nombre de quien escribe…"
                  className="w-full rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                  style={{ border: '1px solid #8ab87a', background: '#ffffff', color: '#1a3010' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#2a5a1e' }}>Comentario</label>
                <textarea
                  value={commentDraft}
                  onChange={e => setCommentDraft(e.target.value)}
                  placeholder="Escribe el comentario aquí…"
                  rows={4}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                  style={{ border: '1px solid #8ab87a', background: '#ffffff', color: '#1a3010' }}
                  autoFocus
                />
              </div>
              {comentarios[commentModal.key] && (
                <div className="text-xs rounded-lg px-3 py-2" style={{ background: '#fff8e8', border: '1px solid #e8c870', color: '#7a5820' }}>
                  <span className="font-semibold">Comentario actual:</span>{' '}
                  {comentarios[commentModal.key].autor && <span className="font-medium">{comentarios[commentModal.key].autor}: </span>}
                  {comentarios[commentModal.key].texto}
                </div>
              )}
            </div>
            {/* Footer */}
            <div className="flex items-center justify-between px-5 pb-4">
              <button
                onClick={async () => {
                  setSavingComment(true)
                  await fetch(`/api/planeacion/comentarios?referencia=${commentModal.ref}&semana_inicio=${commentModal.semana}`, { method: 'DELETE' })
                  setComentarios(prev => { const n = {...prev}; delete n[commentModal.key]; return n })
                  setSavingComment(false)
                  setCommentModal(null)
                }}
                disabled={!comentarios[commentModal.key] || savingComment}
                className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-40"
                style={{ background: '#fce8e8', border: '1px solid #e8a0a0', color: '#b03030' }}>
                Eliminar
              </button>
              <div className="flex gap-2">
                <button onClick={() => setCommentModal(null)}
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: '#e0ead8', border: '1px solid #a0c080', color: '#4a6a30' }}>
                  Cancelar
                </button>
                <button
                  onClick={guardarComentario}
                  disabled={savingComment}
                  className="text-xs px-4 py-1.5 rounded-lg font-semibold disabled:opacity-50 flex items-center gap-1.5"
                  style={{ background: '#1e3a14', color: '#a3d982' }}>
                  {savingComment ? <Loader2 size={11} className="animate-spin" /> : null}
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
