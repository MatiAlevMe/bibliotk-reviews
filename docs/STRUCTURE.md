# Bibliotk Reviews Structure

Punto de entrada para cualquier consulta sobre el motor de calificación de **Bibliotk** (reseñas de libros): promedios, baneos retroactivos, notificaciones al autor, fraude y el frontend demo. Backend API-only en Rails + GraphQL, frontend demo en Vite + TypeScript.

- **Backend** — API GraphQL (`POST /graphql`), RSpec tests
- **Frontend demo** — SPA en `frontend/` para role-switching y prueba interactiva de cada feature
- **CI/CD** — GitHub Actions (scan, lint, tests con PostgreSQL efímera, frontend)

## Branches

- `main` — rama principal (protegida: requires status checks, bloquea force push)
- `dependabot/*` — PRs automáticos de dependencias (bundler, github-actions)
- Convención: un commit por cada actualización de código importante

## Database

`bibliotk_reviews_development` / `bibliotk_reviews_test` / `bibliotk_reviews_production` — PostgreSQL 16+

Tablas clave del dominio:

| Tabla | Modelo | Propósito |
|-------|--------|-----------|
| `users` | `User` | Cuentas (admin, autores, lectores). Flag `banned` + `banned_at` + `ban_reason` |
| `books` | `Book` | Libros con aggregates cacheados (`cached_average`, `cached_reviews_count`, `cached_non_banned_count`) |
| `reviews` | `Review` | Reseñas 1-5★ + body (≤1000). `hidden` para baneo. Índice único `(user_id, book_id)` |
| `ban_audit_logs` | `BanAuditLog` | Auditoría de baneo/desbaneo (`impact_details` jsonb snapshot) |
| `moderation_notifications` | `ModerationNotification` | Aviso al autor al cambiar el promedio por moderación |

Índices relevantes:
- `books.cached_average DESC` — top 50 es O(1)
- `reviews(user_id, book_id)` único — un usuario, una reseña por libro
- `users.email` único

## Migrations

| Date | File | Propósito |
|------|------|-----------|
| 2026-08-27 | `20260827053309_create_users.rb` | Tabla users |
| 2026-08-27 | `20260827053310_create_books.rb` | Tabla books |
| 2026-08-27 | `20260827053317_create_reviews.rb` | Tabla reviews |
| 2026-08-27 | `20260827053320_create_ban_audit_logs.rb` | Tabla ban_audit_logs |
| 2026-08-27 | `20260827053322_create_moderation_notifications.rb` | Tabla moderation_notifications |
| 2026-08-28 | `20260828211154_add_reviews_sum_and_count_raw_to_books.rb` | Columnas reviews_sum y reviews_count_raw |

## GraphQL Schema (endpoints)

Único endpoint: `POST /graphql`. Definido en `app/graphql/bibliotk_reviews_schema.rb`.

### Queries

| Field | Resolver | Descripción |
|-------|----------|-------------|
| `node` / `nodes` | `query_type` | Lookup por ID (relay) |
| `topBooks(limit)` | `query_type#top_books` | Top N por `cached_average` DESC |
| `book(id)` | `book` | Detalle de libro (promedio, confidence, reviews) |
| `bookReviews(bookId, includeHidden)` | `book_reviews` | Reseñas de un libro (ocultas opcional) |
| `userReviews(userId)` | `user_reviews` | Reseñas de un usuario |
| `user(id)` | `user` | Detalle de usuario |
| `banPreview(userId)` | `ban_preview` | Impacto proyectado de banear (sin escribir) |
| `moderationStatus(bookId)` | `moderation_status` | Reseñas ocultas + motivo (autor/soporte) |
| `notifications(userId, unreadOnly)` | `notifications` | Notificaciones del autor |
| `fraudCheck(bookId)` | `fraud_check` | Detección de patrones anómalos |
| `fraudAuthorAnomaly(authorName)` | `fraud_author_anomaly` | Detección de anomalías de autor |
| `banLogs(limit)` | `ban_logs` | Auditoría de baneos |

### Mutations

| Field | Resolver | Descripción |
|-------|----------|-------------|
| `createReview(bookId, userId, rating, body)` | `mutation_type#create_review` | Crea una reseña |
| `updateReview(id, rating, body)` | `update_review` | Edita rating/contenido |
| `deleteReview(id)` | `delete_review` | Elimina una reseña |
| `banUser(userId, reason, performedBy)` | `ban_user` | Banea, recalcula promedios, notifica al autor |
| `unbanUser(userId, performedBy)` | `unban_user` | Desbanea y reintegra promedios |

## Controllers

| File | Descripción |
|------|-------------|
| `app/controllers/graphql_controller.rb` | Ejecuta queries/mutations contra `BibliotkReviewsSchema` |
| `app/controllers/application_controller.rb` | Base |

## Models

| Modelo | Archivo | Notas |
|--------|---------|-------|
| `User` | `app/models/user.rb` | `ban!` / `unban!` (transacción, recalcula libros afectados, crea `BanAuditLog` + `ModerationNotification`) |
| `Book` | `app/models/book.rb` | `recalculate!`, `display_average` ("Insuficientes" si <3), `confidence` (low/medium/high) |
| `Review` | `app/models/review.rb` | Validación `rating 1..5`, `body ≤1000`, unicidad `[user_id, book_id]`; callbacks de recálculo; `hide_if_user_banned!` |
| `BanAuditLog` | `app/models/ban_audit_log.rb` | Enum action `banned|unbanned` |
| `ModerationNotification` | `app/models/moderation_notification.rb` | Notificación al autor, `read_at` |

## Services

| Servicio | Propósito |
|----------|-----------|
| `app/services/ban_impact_analyzer.rb` | Calcula en memoria el impacto de banear (O(n) sobre reseñas, suma exacta) |
| `app/services/fraud_detector.rb` | Detecta anomalías (ratio 5★, cuentas recientes) |
| `app/services/anomaly_watcher.rb` | Monitoreo de anomalías de ráfagas, deltas 24h y ratio de baneos |

## Rake Tasks

| Task | Propósito |
|------|-----------|
| `db:seed` | Seed determinístico: 1 admin, 5 autores, 10 libros, 50 lectores, reseñas |
| `db:seed:large_scale` | Libro con 500.000 reseñas (bulk insert, benchmark) |
| `db:seed:recalculate_all` | Recalcula todos los promedios desde cero (backfill/insurance) |
| `db:reset_demo` | Drop + create + migrate + seed. **Solo dev/test** (aborta en producción) |
| `metrics:scan` | Escaneo de métricas y alertas del sistema |

## Frontend DEMO (`frontend/`)

SPA estática (Vite + TypeScript + Vitest) que consume el backend GraphQL vía proxy de dev.

| Archivo | Propósito |
|---------|-----------|
| `src/api.ts` | Cliente GraphQL tipado (queries + mutations) |
| `src/types.ts` | Tipos de las respuestas |
| `src/state.ts` | Rol activo + `userId` (persistido en `localStorage`) |
| `src/app.ts` | Shell + router por rol |
| `src/views/login.ts` | Elegir rol (Admin/Autor/Lector) y cuenta |
| `src/views/top.ts` | Top 50 con Autor y Riesgo (Alto/Medio/Bajo) |
| `src/views/book.ts` | Detalle + crear/editar/eliminar reseña + fraud check |
| `src/views/moderation.ts` | Ban preview → ban/unban + auditoría (Admin) |
| `src/views/author.ts` | Notificaciones + reseñas ocultas (Autor) |
| `src/views/system.ts` | Ambientes + comando de reset de BD |
| `tests/unit.test.ts` | Tests unitarios (Vitest) |

Npm scripts: `dev`, `build` (`tsc --noEmit && vite build`), `typecheck`, `test`, `db:reset`.

## CI/CD (GitHub Actions — `.github/workflows/ci.yml`)

| Job | Qué corre |
|-----|-----------|
| `scan_ruby` | brakeman |
| `lint` | rubocop (`-f github`) |
| `test` | PostgreSQL 16 service, `db:create` + `db:schema:load` + `db:seed` + `rspec` (BD efímera por ejecución) |
| `frontend` | `npm ci` + `tsc --noEmit` + `vitest` |

`concurrency` cancela runs superpuestos. Dependabot revisa `bundler` y `github-actions` a diario.

## Environment / Config

- `config/database.yml` — host/port `localhost:5432` (dev/test); producción via env
- `DATABASE_URL` — usado en CI para apuntar al servicio PostgreSQL
- CORS abierto `*` (`config/initializers/cors.rb`) para el demo

## Importante: Ambientes y reset

| Ambiente | BD | ¿Reset a fábrica? | Demo |
|----------|----|-------------------|------|
| development | local | ✅ `db:reset_demo` | ✅ |
| test (CI) | efímera, por ejecución | ✅ automático | ❌ |
| production | real | ❌ | ❌ |

La demo apunta siempre a `localhost:3000` (development). No hay "switch de ambiente" desde la demo — dev es donde se destruye/reconstruye sin miedo; CI siempre arranca de fábrica.

## Docs relacionados

- `docs/PLAN.md` — plan de implementación y alto nivel
- `docs/STACK.md` — catálogo del stack (backend, frontend, CI, rake)
- `docs/PRUEBAS.md` — guía de pruebas del sistema
- `DECISIONES.md` — trade-offs y decisiones
- `PRODUCTO.md` — respuestas de producto a los 5 pains
- `AGENTS.md` — convenciones operativas
- `docs/Prueba Product builder.pdf` — brief del challenge
