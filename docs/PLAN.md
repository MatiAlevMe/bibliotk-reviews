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

### Finding / Pendiente
> Inventario completo y registro histórico en **[docs/CONTINUACION.md](CONTINUACION.md)**.
- La **demo no genera el libro de 500k reseñas** desde la UI (requiere `db:seed:large_scale`); el benchmark se corre por CLI.
- El **reset de BD desde la UI** no usa endpoint (no se puede `DROP` con el server conectado); se hace vía `npm run db:reset` (CLI dentro de WSL). Ver `DECISIONES.md`.

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
