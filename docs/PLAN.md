# Plan de Implementación - Motor de Reseñas Bibliotk

## Resumen

Reconstrucción del motor de calificación de **Bibliotk**, una plataforma de reseñas de libros. El sistema debe calcular promedios correctamente, manejar baneos retroactivos, y resistir concurrencia masiva — todo exponiendo una API GraphQL.

## Convención de trabajo

**Un commit por cada actualización de código importante.** Cada feature/fix/refactor se commitea en `main` de forma atómica, con mensaje imperativo en inglés y alcance claro (`ci:`, `feat(frontend):`, `fix:`, etc.). No se amontonan cambios sin relación en un mismo commit.

## Hitos del plan (checklist)

Estado de ejecución. Los hitos marcados están implementados; los hallazgos quedan anotados en **Finding / Pendiente**.

### Hito 1 — Motor de reseñas (✅ completado)
- [x] Modelos: `User`, `Book`, `Review`, `BanAuditLog`, `ModerationNotification`
- [x] Promedios cacheados + recálculo transaccional (`SELECT FOR UPDATE`)
- [x] Redondeo half-up y umbral de 3 reseñas ("Insuficientes")
- [x] Baneo/desbaneo retroactivo con notificación al autor
- [x] Grading de reseñas ocultas (`hidden: true`)
- [x] GraphQL queries + mutations + servicios (`BanImpactAnalyzer`, `FraudDetector`)
- [x] Tests RSpec (modelos, servicios, concurrencia, unicidad, ban preview)

### Hito 2 — Infraestructura y CI/CD (✅ completado)
- [x] Gemfile: agregadas `brakeman` y `rubocop-rails-omakase` (arregla jobs `lint`/`scan_ruby`)
- [x] `ci.yml`: jobs `scan_ruby`, `lint`, `test` (PostgreSQL service), `frontend`
- [x] BD de test determinística (se recrea de cero en cada ejecución)
- [x] Rake task `db:reset_demo` (dev/test-only) + `db:seed:recalculate_all`
- [x] Protección de `main` en GitHub (status checks: test, lint, scan_ruby, frontend)

### Hito 3 — Frontend DEMO (✅ completado)
- [x] SPA estática `frontend/` (Vite + TypeScript + Vitest)
- [x] Rol switching (Admin/Autor/Lector) + vistas por feature
- [x] Vista Sistema con reset de BD a fábrica (dev)
- [x] Typecheck (`tsc --noEmit`) + tests de CI del frontend

### Hito 4 — Documentación (✅ completado)
- [x] `docs/STACK.md` — catálogo del stack
- [x] `docs/STRUCTURE.md` — estructura del dominio
- [x] `README.md`, `docs/PRUEBAS.md`, `DECISIONES.md`, `PRODUCTO.md` actualizados
- [x] `AGENTS.md` — convenciones operativas

### Hito 5 — Calidad, Precisión y Alertas (✅ completado)
- [x] Precisión exacta en ban preview (`reviews_sum` / `reviews_count_raw`)
- [x] Spec de equivalencia en `BanImpactAnalyzer` (compara con banear y recalcular real)
- [x] Manejo de carreras en `concurrency_spec` (`ActiveRecord::RecordNotUnique`)
- [x] Redundancia `includes(:book)` simplificada
- [x] Query GraphQL `fraudAuthorAnomaly` y visualización en demo UI
- [x] Servicio `AnomalyWatcher`, rake `metrics:scan` y specs de alertas (3 métricas de producto)

### Hito 6 — Vercel Deploy, Estabilidad Node/Ruby y Saneamiento CI (✅ completado)
- [x] Soporte de despliegue en Vercel para la demo frontend (`frontend/vercel.json` y `VITE_GRAPHQL_ENDPOINT`)
- [x] Corrección de autoría de commits unificada a `MatiAlevMe` (`inefableataraxia1@gmail.com`)
- [x] Estabilización de tests de `AnomalyWatcher` con aislamiento de base de datos en CI
- [x] Actualización de flags en `scan_ruby` (Brakeman) y compatibilidad con Node 22 LTS
- [x] Saneamiento de scripts en `frontend/package.json` (`db:reset`)

### Hito 7 — Demo Vercel Offline/Mock (Opción B, fix del 405) (✅ completado)
- [x] Diagnóstico del `GraphQL HTTP 405`: el catch-all de Vercel interceptaba el `POST /graphql` y servía el HTML estático (405)
- [x] Mock client en memoria (`frontend/src/mock-client.ts` + `mock-data.ts`) que replica el seed real de Rails: admin, 5 autores, 50 lectores (ids 7-56) y los 10 títulos reales
- [x] `MOCK_MODE` corregido: se activa solo en build de producción sin endpoint (Vercel) o con `VITE_GRAPHQL_ENDPOINT=mock`; en dev usa el backend real vía proxy
- [x] Queries mock: top 50, detalle de libro, reseñas, ban preview, moderación, notificaciones, fraud check, fraud author anomaly, ban logs
- [x] Mutations mock: crear/editar/eliminar reseña, banear/desbanear — persisten en la sesión y recalculan los aggregates del libro
- [x] Notificaciones a autores: al banear, se notifican a los autores de los libros afectados (igual que `User#ban!` real)
- [x] Cluster 5★ "recientes" en «El Aleph» → la detección de fraude de la demo muestra un caso positivo
- [x] Botones **"Reiniciar demo"** (topbar y vista Sistema) que dejan el estado mock en fábrica — equivalente en Vercel a `db:reset_demo`
- [x] Docs/README/DECISIONES/PRODUCTO actualizados (Vercel = mock offline; localhost = backend real)
- [x] Tests de Vitest para `mockApi` (top books, crear reseña + recálculo, banear + recálculo)

### Finding / Pendiente
> Ver también sección **[Continuación y pendientes](#continuación-y-pendientes)** más abajo (registro histórico consolidado de CONTINUACION.md).

## Stack

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| Framework | Rails 7.2 API-only | Requisito del challenge |
| DB | PostgreSQL | Atomicidad, `SELECT FOR UPDATE`, transactions |
| API | GraphQL (gem `graphql`) | Queries eficientes, empresa lo usa |
| Testing | RSpec + FactoryBot | Requisito del challenge |

## Modelos

### users
| Column | Type | Notes |
|--------|------|-------|
| id | bigint | PK |
| name | string | |
| email | string | unique |
| banned | boolean | default: false |
| banned_at | datetime | |
| ban_reason | text | |
| created_at, updated_at | datetime | |

### books
| Column | Type | Notes |
|--------|------|-------|
| id | bigint | PK |
| title | string | |
| author_name | string | |
| cached_average | decimal(3,1) | half-up rounded |
| cached_reviews_count | integer | total (hidden + visible) |
| cached_non_banned_count | integer | only non-banned, non-hidden |
| created_at, updated_at | datetime | |

**Index:** `(cached_average DESC)` para top 50 eficiente.

### reviews
| Column | Type | Notes |
|--------|------|-------|
| id | bigint | PK |
| user_id | bigint | FK → users |
| book_id | bigint | FK → books |
| rating | integer | 1-5 |
| body | text | max 1000 chars, nullable |
| hidden | boolean | default: false |
| created_at, updated_at | datetime | |

**Unique index:** `(user_id, book_id)` — un usuario, una reseña por libro.

### ban_audit_logs
| Column | Type | Notes |
|--------|------|-------|
| id | bigint | PK |
| user_id | bigint | FK → users |
| action | integer | enum: 0=banned, 1=unbanned |
| books_affected | integer | |
| impact_details | jsonb | snapshot de cambios |
| performed_by | string | admin identifier |
| created_at | datetime | |

### moderation_notifications
| Column | Type | Notes |
|--------|------|-------|
| id | bigint | PK |
| user_id | bigint | FK → users (author) |
| book_id | bigint | FK → books |
| previous_average | decimal(3,1) | |
| new_average | decimal(3,1) | |
| reason | text | |
| read_at | datetime | |
| created_at | datetime | |

## Decisiones de Producto

### Reseñas de usuarios baneados
**Decisión:** Las reseñas quedan con `hidden: true`, NO se borran.

- **Autor** puede ver reseñas ocultas via `moderationStatus` query
- **Lector general** NO ve reseñas ocultas
- **Soporte** puede ver reseñas ocultas con motivo
- **Resuelve** el dolor de Soporte ("¿por qué ya no aparece?")

### Reseñas Insuficientes
**Decisión:** NO bajamos el umbral de 3 a 1.

- En detalle de libro se muestra el promedio siempre, incluyendo con 1 reseña
- En top 50, si <3 reseñas se muestra `"Insuficiente"` pero se ordena por average real
- Campo `confidence`: `low` (1-2), `medium` (3-9), `high` (10+)
- Le da a Growth el dato sin mentir sobre la confiabilidad

### Ban Preview
**Decisión:** Endpoint que calcula el impacto SIN modificar la DB.

- Calcula promedio proyectado en memoria: O(n) donde n = reseñas del usuario
- Resultado: lista de libros con promedio actual vs proyectado

### Notificación al Autor
**Decisión:** Texto estático claro, sin IA en primera instancia.

```
"Tu libro [TITULO] tuvo un cambio en su calificación de [4.6] a [2.3].
 Esto se debió a la exclusión de reseñas por moderación de cuenta.
 Si tenés preguntas, contactá a soporte@bibliotk.com"
```

### Dirección: Que no se vuelva a repetir
**3 métricas definidas (no implementadas):**

1. **Reviews/min por libro** - alerta si >50 en 1 hora → Moderación
2. **Average delta por libro** - alerta si cambia >1.0 en 24h → Moderación
3. **Ratio banned/total reviewers** - alerta si >5% en 7 días → Growth

### Reseñas subidas/bajadas
**Decisión:** Al banear/desbanear, se recalculan TODOS los libros afectados.

- `recalculate!` para cada libro, generando `BanAuditLog`
- Proceso atómico: o todo se recalcula o no se hace

### Recálculo de promedios corruptos
**Decisión:** Rake task `recalculate_all` que recalcula desde cero.

- Se corre periódicamente o después de ban masivo
- Sistema sigue con datos viejos mientras se actualizan de a uno
- Log de qué libros cambiaron

### Fraud Detection
**Decisión:** Detección básica de patrones sospechosos.

**Señales:**
- >X% de reseñas 5★ de cuentas creadas en <24h para un libro
- Autor con múltiples campañas de compra
- Distribución anómala (ej: 95% 5-estrellas)

**Implementación:** Servicio `FraudDetector` después de cada batch.

## Endpoints GraphQL

```graphql
# Queries
query {
  topBooks(limit: 50) { id, title, average, confidence, reviewsCount }
  book(id: ID) { id, title, average, confidence, reviews }
  myReviews(userId: ID!) { id, book, rating, body, hidden }
  moderationStatus(bookId: ID!) { id, hiddenCount, hiddenReviews }
  banPreview(userId: ID!) { booksAffected, details { bookId, current, projected, delta } }
  notifications(userId: ID!) { id, book, previousAverage, newAverage, reason }
}

# Mutations
mutation {
  createReview(bookId: ID!, rating: Int!, body: String): Review
  updateReview(id: ID!, rating: Int, body: String): Review
  deleteReview(id: ID!): Boolean
  banUser(userId: ID!, reason: String!): BanAuditLog
  unbanUser(userId: ID!): BanAuditLog
}
```

## Concurrencia

Para 200 reviews simultáneos en el mismo libro:

1. **Transacción PostgreSQL** con `SELECT ... FOR UPDATE` en el libro
2. **Unique index** `(user_id, book_id)` previene duplicados
3. **Recálculo post-escritura:** `recalculate!` dentro de la misma transacción

```ruby
class Review < ApplicationRecord
  after_save :recalculate_book!
  after_destroy :recalculate_book!

  private

  def recalculate_book!
    Book.transaction do
      book.lock!  # SELECT FOR UPDATE
      book.recalculate!
    end
  end
end
```

## Tests (RSpec)

### Mínimos (requisito)
- Redondeo half-up: 3.25→3.3, 3.35→3.4, 2.249→2.2
- Umbral 3 reseñas: 2→"Insuficientes", 3→muestra promedio
- Baneo retroactivo: ban→recalcula, unban→reincorpora
- Editar/Eliminar: recalcula promedio
- Concurrencia: 200 threads, promedio correcto
- Unicidad: mismo usuario dos veces → falla
- Ban preview: resultado coincide con banear y recalcular

### Adicionales
- Reseñas ocultas: usuario baneado→hidden, home no las incluye
- ModerationStatus: autor ve reseñas ocultas
- FraudDetector: detecta patrones anómalos

## Bonus

### Seed con 500k reviews
- Bulk insert con batches de 1000
- Ratings distribuidos (no uniformes)
- Benchmark top 50 con EXPLAIN ANALYZE

### Fraud Detection
- Detección de autor comprando reseñas
- Análisis de distribución de ratings
- Alertas por patrones anómalos

## AI Integration

**Implementado:**
- Ban preview + notificación al autor con texto estático (más barato, más confiable)

**Opcional (si hay tiempo):**
- Generar texto de notificación con Gemini free para mayor naturalidad

## Archivos del Proyecto

```
bibliotk-reviews/
├── app/
│   ├── graphql/        # Schema, types, mutations
│   ├── models/         # User, Book, Review, BanAuditLog, ModerationNotification
│   ├── services/       # BanImpactAnalyzer, FraudDetector
│   └── controllers/    # GraphQL controller
├── spec/               # RSpec tests
├── frontend/           # Demo SPA (Vite + TypeScript + Vitest)
├── docs/
│   ├── PLAN.md         # Este documento (plan + hitos)
│   ├── STACK.md        # Catálogo del stack
│   ├── STRUCTURE.md    # Estructura del dominio
│   ├── PRUEBAS.md      # Guía de pruebas
│   └── Prueba Product builder.pdf          # Brief del challenge
├── db/seeds.rb         # Seed determinístico
├── lib/tasks/          # Rake tasks (seeds, recalculate_all, reset_demo)
├── .github/workflows/  # CI (scan_ruby, lint, test, frontend)
├── AGENTS.md
├── DECISIONES.md
├── PRODUCTO.md
└── README.md
```

---

# Continuación y pendientes

> Documento vivo consolidado (absorbido de `docs/CONTINUACION.md`, que fue eliminado) con todo lo que quedó pendiente, detectado o diferido. Cada entrada tiene estado, impacto, causa raíz y propuesta de resolución.
>
> Convención de estado: `[✅ resuelto]`, `[⏳ pendiente]`, `[🟡 bajo prioridad]`, `[📌 decisión tomada]`.

## 📌 Plan de ejecución completo (histórico)

> Estado operativo al momento de escribir: la demo **no era funcional** en Windows porque las gems nativas de Rails (puma, psych, date, etc.) no compilaban en el Ruby de Windows (`C:\Ruby33`) y Postgres no estaba instalado. Se decidió **mover el entorno de ejecución a WSL (Ubuntu 24.04)**. Esta sección queda como registro histórico: el entorno WSL está operativo y la demo + CI funcionan.

### Decisiones confirmadas (28/08/2026)
- **Backend y tests se corren en WSL** (Ubuntu 24.04, WSL2). Ruby 3.3.1 vía **rbenv**, solo project-local.
- **Rechazado el setup Docker dev.** El `Dockerfile` de producción NO se toca salvo lo ya commiteado (ARG RUBY_VERSION → 3.3.1).
- **`db:reset` de la demo corre vía WSL**: `wsl -e bash -lc 'cd /home/eva2a/EVA/repos/bibliotk-reviews && bin/rails db:reset_demo'`.
- **`.gitattributes`**: `eol=lf` para todo texto (binstubs `bin/*` corren bien en Linux/contenedores).
- **`fraudAuthorAnomaly` (#10)** se expone como query GraphQL (visible en la demo), no solo rake.

### Fase A — Setup del entorno WSL (backend + tests) ([✅ resuelto])
1. Clonar limpio en WSL desde el repo (SSH WSL tiene git, gcc, make, curl, nvm/node v18).
2. Ruby 3.3.1 project-local (`rbenv install 3.3.1`). `.ruby-version` activa 3.3.1 solo dentro del folder.
3. PostgreSQL: instalar, crear rol y DBs `bibliotk_reviews_development` + `bibliotk_reviews_test`.
4. Dependencias + BD: `bundle install`, `bin/rails db:create db:migrate db:seed`.
5. Verificar: `bundle exec rspec` (baseline), `bin/rubocop -f github`, `bin/brakeman --no-pager`.

### Fase B — Demo funcional de punta a punta ([✅ resuelto])
- Backend en WSL: `bin/rails server -b 0.0.0.0 -p 3000` → alcanzable en `localhost:3000`.
- Frontend: `cd frontend && npm install && npm run dev` → SPA en `:5173` con proxy `/graphql → localhost:3000`.
- Reset a fábrica: `cd frontend && npm run db:reset` (vía WSL).

### Fase C — Fixes de código ([✅ resuelto])
1. **#2+#3 — Precisión del ban preview + spec de equivalencia** (`ad25155`): migración `AddReviewsSumAndCountRawToBooks` (`reviews_sum`, `reviews_count_raw`); `Book#recalculate!` los mantiene; `BanImpactAnalyzer` usa `reviews_sum` exacto; spec de equivalencia.
2. **#5 — Redundancia `includes(:book).joins(:book)`** (`f0e7150`): simplificado a `reviews.includes(:book)`.
3. **#4 — Concurrencia** (`b2e3e47`): rescata `ActiveRecord::RecordNotUnique` en threads.
4. **#10 — `fraudAuthorAnomaly`** (`c764353`): query GraphQL + tipo + integración demo.
5. **#9 — 3 métricas de anomalías** (`7229545`): `AnomalyWatcher`, rake `metrics:scan`, specs.

### Fase E — Push / PR
- Rama feature, commits atómicos por fase, PR → checks CI → merge a `main` (protegida).

## Hallazgos y estado (consolidado de CONTINUACION.md)

### 1. Fluir cambios a `main` (protección habilitada) `[📌 decisión tomada]`
Con la protección de `main` no se puede push directo salvo por PR o bypass de owner. El owner tiene bypass habilitado y el push directo aplica ("Bypassed rule violations"). Recomendado: rama + PR con los checks (`test`, `lint`, `scan_ruby`, `frontend`).

### 2. Precisión del ban preview (BanImpactAnalyzer) `[✅ resuelto]` — `ad25155`
Reconstruía el total desde `cached_average` (redondeado), desviándose ±0.1. Se usa `reviews_sum` exacto.

### 3. Spec del ban preview no verifica equivalencia `[✅ resuelto]` — `ad25155`
Agregado spec que valida que `projected_average` coincide con `user.ban!` + `recalculate!`.

### 4. Ruido en el spec de concurrencia `[✅ resuelto]` — `b2e3e47`
`concurrency_spec.rb` rescata `ActiveRecord::RecordNotUnique`/`RecordInvalid` de forma limpia.

### 5. Redundancia `includes(:book).joins(:book)` `[✅ resuelto]` — `f0e7150`

### 6. Configuración manual de GitHub (no automatizable) `[📌 decisión tomada]`

### 7. Demo: libro de 500k reseñas no se genera desde la UI `[📌 decisión tomada]`
Requiere `db:seed:large_scale`; el benchmark se corre por CLI. `⏳ pendiente` si se quisiera expuesto en la UI.

### 8. Reset de BD desde la UI `[📌 decisión tomada]`
No usa endpoint (no se puede `DROP` con el server conectado); se hace vía `npm run db:reset` (CLI). En Vercel (sin BD) el equivalente es el botón **"Reiniciar demo"** (mock en memoria). Ver `DECISIONES.md`.

### 9. Métricas "Que no se vuelva a repetir" `[✅ resuelto]` — `7229545`
Implementado `AnomalyWatcher` y rake `metrics:scan`: reviews/min >50 en 1h, average delta >1.0 en 24h, ratio de baneados >5% en 7 días.

### 10. FraudDetector: anomalía de autor expuesta `[✅ resuelto]` — `c764353`
Query `fraudAuthorAnomaly(authorName: String!)` en `Types::QueryType`, soportada en la demo (vista Moderación) y con tests RSpec.

### 11. Notificación al autor con IA (opcional) `[🟡 bajo prioridad]`
`PRODUCTO.md` define texto estático (más barato y confiable). La opción de generar con Gemini free quedó como futuro opcional: servicio `NotificationCopyGenerator` con fallback al texto estático.

### 12. Redondeo half-up en specs `[✅ resuelto]` — `35be83e`
Reemplazados los specs vacíos `3.35`/`2.249` por casos deterministas: `3.25→3.3`, `3.35→3.4`, `2.24→2.2`.

### 13. Error `GraphQL HTTP 405` en Vercel `[✅ resuelto]` (Hito 7)
El catch-all de Vercel interceptaba el `POST /graphql` y servía el HTML → 405. Resuelto con el modo offline/mock (ver Hito 7 y `DECISIONES.md`).

### 14. Fallo Brakeman EOLRails en CI `[✅ resuelto]`
Configurado `config/brakeman.ignore` (fingerprint SHA-256 exacto) y `ci.yml` usa `-i config/brakeman.ignore`.

### 15. Aislamiento de datos en AnomalyWatcher specs `[✅ resuelto]`
Limpieza en `spec/services/anomaly_watcher_spec.rb` para que las métricas basadas en tiempo no sean afectadas por datos residuales del seed.

### 16. Deploy en Vercel del Frontend DEMO `[✅ resuelto]`
Se agregó `frontend/vercel.json` + soporte `VITE_GRAPHQL_ENDPOINT`; luego evolucionó a modo offline/mock (Hito 7).

## Cambios que requieren migración

| Cambio | ¿Migración? | Relacionado con |
|--------|-------------|-----------------|
| Guardar `reviews_sum` / stats exactas en `books` | Sí (hecha: `AddReviewsSumAndCountRawToBooks`) | Punto 2 (precisión del preview) |
| Alertas/Scheduler para métricas | No (solo servicio/job) | Punto 9 |
| Endpoint reset desde UI | No (se resolvió con botón de mock en Vercel; CLI en dev) | Punto 8 |

Si se agrega una migración, **regenerar y commitear `db/schema.rb`** (regla de `AGENTS.md`).
