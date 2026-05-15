# PRODPLAN — Guía de Implementación con Supabase
### De prototipo en Claude.ai → aplicación real en producción

---

## ¿Por qué este stack?

| Decisión | Elección | Razón |
|---|---|---|
| **Framework** | **Next.js 14** (App Router) | SSR, rutas API integradas, deploy trivial en Vercel, ideal para Claude Code |
| **Base de datos** | **Supabase** (PostgreSQL) | Gratuito, tiempo real, autenticación incluida, panel visual como Excel |
| **Auth** | **Supabase Auth** | Maneja sesiones admin/operario sin servidor propio |
| **Estilos** | **Tailwind CSS** | Ya compatible con el diseño actual, rápido con Claude Code |
| **Deploy** | **Vercel** | Free tier, conecta con GitHub, dominio gratis |
| **Tiempo real** | **Supabase Realtime** | Los reportes hora a hora se sincronizan entre dispositivos al instante |

> **¿Por qué Next.js sobre Vite/CRA?**
> Claude Code genera rutas API de Next.js en segundos, Supabase tiene integración oficial con Next.js, y Vercel (mismo equipo) lo despliega con un solo comando. Para un equipo de planta sin DevOps, es la ruta más corta de código a URL pública.

---

## Arquitectura general

```
┌─────────────────────────────────────────────────┐
│                  PRODPLAN App                    │
│              (Next.js en Vercel)                 │
├──────────────┬──────────────────┬───────────────┤
│   /login     │   /asistencia    │   /admin      │
│   /ejecucion │   (público)      │   (protegido) │
└──────┬───────┴────────┬─────────┴───────┬───────┘
       │                │                 │
       └────────────────▼─────────────────┘
                  Supabase
          ┌───────────────────────┐
          │  PostgreSQL (datos)   │
          │  Auth (sesiones)      │
          │  Realtime (websocket) │
          │  Storage (fotos plan) │
          └───────────────────────┘
```

---

## Esquema de base de datos

```sql
-- Ejecutar en Supabase SQL Editor

-- 1. PERSONAL
create table personal (
  id uuid primary key default gen_random_uuid(),
  cedula text unique not null,
  nombre text not null,
  activo boolean default true,
  created_at timestamptz default now()
);

-- 2. CATÁLOGO DE PRODUCTOS
create table catalogo (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  nombre text not null,
  created_at timestamptz default now()
);

-- 3. JORNADAS (encabezado de planeación)
create table jornadas (
  id uuid primary key default gen_random_uuid(),
  fecha date unique not null,
  semana text,
  personal_disponible integer not null,
  created_at timestamptz default now()
);

-- 4. ACTIVIDADES (planeación por jornada)
create table actividades (
  id uuid primary key default gen_random_uuid(),
  jornada_id uuid references jornadas(id) on delete cascade,
  sku text,
  producto text not null,
  proceso text not null,
  turno text default 'MAÑANA',
  personal_planeado integer,
  cantidad integer not null,
  lote text,
  notas text,
  created_at timestamptz default now()
);

-- 5. OPERARIOS ASIGNADOS a cada actividad
create table actividad_operarios (
  id uuid primary key default gen_random_uuid(),
  actividad_id uuid references actividades(id) on delete cascade,
  cedula text not null,
  nombre text not null,
  hora_asignacion text,
  created_at timestamptz default now(),
  unique(actividad_id, cedula)
);

-- 6. REPORTES HORA A HORA
create table reportes (
  id uuid primary key default gen_random_uuid(),
  actividad_id uuid references actividades(id) on delete cascade,
  hora text not null,
  cantidad integer not null,
  operario_cedula text,
  operario_nombre text,
  created_at timestamptz default now(),
  unique(actividad_id, hora)
);

-- 7. ASISTENCIA
create table asistencia (
  id uuid primary key default gen_random_uuid(),
  cedula text not null,
  nombre text not null,
  fecha date not null,
  turno text default 'MAÑANA',
  hora_ingreso text,
  hora_salida text,
  created_at timestamptz default now(),
  unique(cedula, fecha)
);

-- POLÍTICAS DE SEGURIDAD (RLS)
alter table personal enable row level security;
alter table catalogo enable row level security;
alter table jornadas enable row level security;
alter table actividades enable row level security;
alter table actividad_operarios enable row level security;
alter table reportes enable row level security;
alter table asistencia enable row level security;

-- Acceso público de lectura (operarios pueden ver planeación)
create policy "lectura publica" on jornadas for select using (true);
create policy "lectura publica" on actividades for select using (true);
create policy "lectura publica" on reportes for select using (true);
create policy "lectura publica" on asistencia for select using (true);
create policy "lectura publica" on catalogo for select using (true);

-- Solo admin puede escribir (se controla desde Next.js con service_role key)
-- Los operarios escriben reportes y asistencia a través de API routes protegidas
```

---

## Fases de implementación

---

### FASE 1 — Scaffolding y conexión a Supabase
**Tiempo estimado: 2-3 horas con Claude Code**

```bash
# En Claude Code, ejecutar:
npx create-next-app@latest prodplan --typescript --tailwind --app --src-dir
cd prodplan
npm install @supabase/supabase-js @supabase/ssr
```

**Archivos que Claude Code genera:**

```
src/
├── lib/
│   ├── supabase/
│   │   ├── client.ts        # Cliente del navegador
│   │   ├── server.ts        # Cliente del servidor (SSR)
│   │   └── middleware.ts    # Protección de rutas
├── app/
│   ├── layout.tsx
│   ├── page.tsx             # Home (login operario + admin + asistencia)
│   ├── asistencia/
│   │   └── page.tsx         # Pantalla pública de entrada/salida
│   ├── ejecucion/
│   │   └── page.tsx         # Vista operario
│   └── admin/
│       ├── layout.tsx       # Protección admin
│       ├── page.tsx         # Dashboard
│       ├── planeacion/
│       ├── catalogo/
│       ├── personal/
│       ├── asistencia/
│       └── config/
├── components/
│   ├── ui/                  # Componentes compartidos
│   └── ...
└── middleware.ts             # Auth guard global
```

**Prompt para Claude Code — Fase 1:**
```
Tengo una app Next.js 14 con Tailwind. Crea la conexión a Supabase con:
- src/lib/supabase/client.ts (createBrowserClient)
- src/lib/supabase/server.ts (createServerClient con cookies)
- middleware.ts que proteja /admin/* requiriendo rol "admin"
  y /ejecucion/* requiriendo rol "operario"
- Variables de entorno: NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

### FASE 2 — Autenticación y pantalla de inicio
**Tiempo estimado: 3-4 horas con Claude Code**

**Estrategia de auth:**
- **Admin:** Supabase Auth con email/password. Un solo usuario admin.
- **Operario:** Verificación de cédula contra tabla `personal`. Se crea una sesión custom en cookies (no usa Supabase Auth para no requerir email a cada operario).
- **Asistencia pública:** Sin sesión, solo consulta y escribe en tabla `asistencia` via API route.

**Prompt para Claude Code — Fase 2:**
```
En mi app Next.js con Supabase, implementa:

1. Página /page.tsx con tres secciones:
   - Card operario: campo cédula, verifica contra tabla "personal", 
     guarda {cedula, nombre} en cookie httpOnly, redirige a /ejecucion
   - Card admin: campo password, verifica con Supabase Auth 
     (usuario admin@prodplan.com), redirige a /admin
   - Banner verde "Marcar Asistencia" que lleva a /asistencia

2. API route POST /api/auth/operario que:
   - Recibe {cedula}
   - Busca en tabla personal donde cedula = $1 y activo = true
   - Si existe, setea cookie "operario_session" con {cedula, nombre}
   - Retorna {ok: true, nombre}

3. API route POST /api/auth/logout que limpia las cookies

4. middleware.ts que:
   - En /admin/* verifica sesión Supabase Auth con rol admin
   - En /ejecucion/* verifica cookie operario_session
   - En /asistencia no requiere auth
```

---

### FASE 3 — Módulo de Asistencia (público)
**Tiempo estimado: 2 horas con Claude Code**

**Pantalla `/asistencia`** — sin login requerido.

**Prompt para Claude Code — Fase 3:**
```
Crea la página /asistencia/page.tsx en Next.js con Tailwind.
Diseño oscuro similar al prototipo. Debe tener:

- Input grande de cédula (inputMode="numeric")
- Dos botones grandes: "✅ Entrada" (verde) y "🚪 Salida" (naranja)
- Al marcar llama a POST /api/asistencia con {cedula, tipo: "entrada"|"salida"}
- Muestra resultado: nombre, hora en grande, turno

API route POST /api/asistencia:
- Verifica que cedula exista en tabla personal
- Para entrada: INSERT en asistencia (cedula, nombre, fecha=today, turno auto, hora_ingreso=now)
  - Si ya tiene entrada del día → error 409
- Para salida: UPDATE asistencia SET hora_salida=now WHERE cedula=$1 AND fecha=today AND hora_salida IS NULL
  - Si no tiene entrada → error 404
  - Si ya tiene salida → error 409
- Retorna {nombre, hora, tipo, turno?}

Resumen al pie: cuántos están en planta hoy (GET /api/asistencia/resumen?fecha=today)
```

---

### FASE 4 — Planeación (admin)
**Tiempo estimado: 4-5 horas con Claude Code**

Migrar Paso 1 y Paso 2 del prototipo a Next.js con persistencia real.

**Prompt para Claude Code — Fase 4:**
```
Crea el módulo de planeación en /admin/planeacion con Next.js Server Components y Client Components.

Paso 1 - Jornadas (/admin/planeacion/page.tsx):
- Lista jornadas con SELECT * FROM jornadas ORDER BY fecha DESC
- Formulario crear/editar jornada (fecha, personal_disponible)
- Botón "Planear actividades →" lleva a /admin/planeacion/[jornadaId]

Paso 2 - Actividades (/admin/planeacion/[jornadaId]/page.tsx):
- Carga jornada y sus actividades con JOIN
- Gauge: disponibles - asignados = libres
- Formulario agregar actividad con campos:
  sku, producto (autocomplete desde catalogo), proceso (select),
  turno (MAÑANA/TARDE/NOCHE), personal_planeado (opcional), cantidad, notas
- Importar desde foto: llama a /api/planeacion/import-foto 
  que usa Anthropic API para leer la imagen
- Importar desde Excel: parsea con xlsx y muestra preview editable
- CRUD actividades con INSERT/UPDATE/DELETE en tabla actividades

API routes necesarias:
- GET /api/jornadas
- POST /api/jornadas
- GET /api/jornadas/[id]/actividades  
- POST /api/jornadas/[id]/actividades
- PUT /api/actividades/[id]
- DELETE /api/actividades/[id]
- POST /api/planeacion/import-foto (usa @anthropic-ai/sdk)
```

---

### FASE 5 — Ejecución con tiempo real
**Tiempo estimado: 4-5 horas con Claude Code**

Es la fase más crítica. Usa Supabase Realtime para que los reportes de todos los operarios aparezcan al instante en el panel admin.

**Prompt para Claude Code — Fase 5:**
```
Crea /ejecucion/page.tsx y /admin/ejecucion/page.tsx en Next.js con Supabase Realtime.

Vista operario (/ejecucion):
- Carga jornada del día actual con sus actividades
- Muestra nombre del operario (desde cookie)
- Al expandir actividad: grilla hora a hora (07:00-17:00)
- Click en hora → modal para reportar cantidad
- POST /api/reportes con {actividad_id, hora, cantidad, operario_cedula}
- Suscripción Realtime a cambios en tabla reportes para refrescar sin F5

Vista admin (/admin/ejecucion):
- Igual pero con selector de fecha y SIN restricción de operario
- Botón "👥 Asignar personas": abre modal con lista de asistencia del día
  - SELECT * FROM asistencia WHERE fecha = $1 AND hora_salida IS NULL
  - Al seleccionar: INSERT en actividad_operarios
- Botón "📦 Lote": UPDATE actividades SET lote = $1
- Suscripción Realtime a reportes y actividad_operarios

Supabase Realtime setup:
const channel = supabase
  .channel('reportes-cambios')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'reportes' },
    (payload) => refrescarActividades()
  )
  .subscribe()
```

---

### FASE 6 — Catálogo y Personal (admin)
**Tiempo estimado: 2 horas con Claude Code**

**Prompt para Claude Code — Fase 6:**
```
Crea dos módulos CRUD en /admin:

1. /admin/catalogo/page.tsx
   - Tabla con SELECT * FROM catalogo ORDER BY sku
   - Buscar por SKU o nombre
   - Agregar manual: INSERT INTO catalogo (sku, nombre)
   - Subir Excel: parsea con xlsx, INSERT masivo con upsert
   - Exportar a Excel
   - Descargar plantilla

2. /admin/personal/page.tsx  
   - Tabla con SELECT * FROM personal WHERE activo = true
   - Agregar operario: INSERT INTO personal (cedula, nombre)
   - Subir Excel con columnas Nombre y Cédula
   - Desactivar operario: UPDATE personal SET activo = false
   - Exportar lista
```

---

### FASE 7 — Dashboard con filtros
**Tiempo estimado: 3 horas con Claude Code**

**Prompt para Claude Code — Fase 7:**
```
Crea /admin/dashboard/page.tsx con:

Filtros: Por día (date picker) o rango de fechas (desde/hasta)

KPIs (queries SQL):
- Meta total: SUM(cantidad) FROM actividades WHERE jornada fecha IN rango
- Ejecutado: SUM(cantidad) FROM reportes WHERE actividad_id IN actividades del rango
- % Cumplimiento
- Personal planeado vs real

Tablas:
- Por proceso: GROUP BY proceso con meta, ejecutado, cumplimiento, std/persona
- Por día (modo rango): GROUP BY fecha
- Detalle actividades: JOIN actividades + jornadas + reportes

Usar recharts para gráfica de barras de cumplimiento por día.
Los datos se cargan con Server Components (no client fetch).
```

---

### FASE 8 — Configuración y deploy
**Tiempo estimado: 1-2 horas**

**Prompt para Claude Code — Fase 8:**
```
1. Página /admin/config/page.tsx:
   - Cambiar contraseña admin (usa Supabase Auth updateUser)
   - Sección informativa de accesos

2. Variables de entorno para producción:
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=   (solo server-side, para ops admin)
   ANTHROPIC_API_KEY=           (para importar planeación por foto)

3. Deploy en Vercel:
   - vercel --prod
   - Conectar a repositorio GitHub para auto-deploy en cada push

4. Dominio personalizado (opcional):
   - En Vercel Settings → Domains → agregar dominio de la empresa
```

---

## Resumen de tiempos

| Fase | Módulo | Horas estimadas |
|---|---|---|
| 1 | Scaffolding + Supabase | 2-3 h |
| 2 | Autenticación (admin + operario) | 3-4 h |
| 3 | Asistencia pública | 2 h |
| 4 | Planeación completa | 4-5 h |
| 5 | Ejecución + Realtime | 4-5 h |
| 6 | Catálogo + Personal | 2 h |
| 7 | Dashboard + gráficas | 3 h |
| 8 | Config + Deploy | 1-2 h |
| **Total** | | **~21-26 horas** |

Con Claude Code trabajando en paralelo en cada prompt, el tiempo real puede reducirse a **3-5 días** de trabajo enfocado.

---

## Comandos útiles de Claude Code

```bash
# Iniciar Claude Code en el proyecto
claude

# Dentro de Claude Code, ejemplos de prompts directos:
> "Crea la tabla de jornadas en Supabase y el hook useJornadas con SWR"
> "Agrega suscripción Realtime a la tabla reportes en EjecucionView"  
> "Genera los tipos TypeScript para todas las tablas de Supabase"
> "Crea un seed script para poblar datos de prueba en desarrollo"
> "Añade manejo de errores con toast notifications en todos los API routes"
```

---

## Checklist antes del lanzamiento

- [ ] RLS (Row Level Security) activado en todas las tablas
- [ ] Variables de entorno configuradas en Vercel
- [ ] `SUPABASE_SERVICE_ROLE_KEY` solo en server-side (nunca expuesta al cliente)
- [ ] `ANTHROPIC_API_KEY` en variable de entorno servidor (para import por foto)
- [ ] Backup automático activado en Supabase (plan Free lo incluye 7 días)
- [ ] Dominio con HTTPS (Vercel lo gestiona automáticamente)
- [ ] Prueba de flujo completo: asistencia → planeación → ejecución → dashboard
- [ ] Prueba en celular de la pantalla de asistencia y ejecución

---

## Recursos

- [Supabase Docs](https://supabase.com/docs)
- [Next.js + Supabase starter](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Claude Code docs](https://docs.claude.ai/code)
- [Vercel deploy guide](https://vercel.com/docs/deployments/overview)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
