# Bibliotk Reviews

Motor de calificación para Bibliotk — plataforma de reseñas de libros.

## Requisitos

- Ruby 3.3.1 (`.ruby-version`)
- PostgreSQL 16+
- Rails 7.2
- Node 22+ (para el frontend demo)

## Setup

```bash
# Instalar dependencias
bundle install

# Crear base de datos
bin/rails db:create db:migrate

# Seed de desarrollo
bin/rails db:seed

# Generar 500k reviews para benchmark
bin/rails db:seed:large_scale
```

## Ejecutar tests

```bash
bundle exec rspec
```

## API GraphQL

El endpoint está en `POST /graphql`.

### Queries principales

```graphql
# Top 50 libros
query {
  topBooks(limit: 50) {
    id
    title
    cachedAverage
    displayAverage
    confidence
    cachedReviewsCount
  }
}

# Detalle de libro
query {
  book(id: "1") {
    id
    title
    cachedAverage
    displayAverage
    confidence
    visibleReviews {
      id
      rating
      body
      user { name }
    }
  }
}

# Ban preview (moderación)
query {
  banPreview(userId: "1") {
    userId
    userName
    totalReviews
    booksAffected
    details {
      bookId
      title
      currentAverage
      projectedAverage
      delta
    }
  }
}

# Moderación status (autor puede ver reseñas ocultas)
query {
  moderationStatus(bookId: "1") {
    bookId
    title
    hiddenCount
    hiddenReviews {
      id
      userName
      rating
      banReason
    }
  }
}

# Notificaciones del autor
query {
  notifications(userId: "1") {
    id
    previousAverage
    newAverage
    reason
    readAt
    book { title }
  }
}

# Fraud check
query {
  fraudCheck(bookId: "1") {
    suspicious
    reason
    fiveStarRatio
    recentAccountsRatio
  }
}
```

### Mutations

```graphql
# Crear reseña
mutation {
  createReview(bookId: "1", userId: "1", rating: 4, body: "Muy buen libro") {
    id
    rating
    body
  }
}

# Editar reseña
mutation {
  updateReview(id: "1", rating: 5) {
    id
    rating
  }
}

# Eliminar reseña
mutation {
  deleteReview(id: "1")
}

# Banear usuario
mutation {
  banUser(userId: "1", reason: "Reseñas falsas", performedBy: "admin") {
    id
    action
    booksAffected
    impactDetails
  }
}

# Desbanear usuario
mutation {
  unbanUser(userId: "1", performedBy: "admin") {
    id
    action
    booksAffected
  }
}

# Ocultar UNA reseña (moderación quirúrgica, sin banear al autor)
mutation {
  hideReview(id: "1", reason: "Contenido inapropiado") {
    id
  }
}

# Restaurar una reseña oculta
mutation {
  showReview(id: "1")
}
```

## Frontend DEMO

Hay un demo interactivo en `frontend/` (SPA estática con **Vite + TypeScript + Vitest**) para switchear de rol y probar cada feature.

```bash
cd frontend
npm install
npm run dev        # dev server en :5173, proxy a :3000 → backend REAL (necesita Rails corriendo)
```

- **Role switching:** elegís Admin / Autor / Lector y ejecutás las acciones de ese rol.
- **Top 50 (con Autor y Riesgo Alto/Medio/Bajo), Libro (crear/editar/eliminar tu reseña + fraud check + "ver reseñas ocultas" para admin/autor), Moderación (ban preview/ban/unban con motivo opcional/auditoría/autor anomalía), Panel autor (notificaciones + ocultas), Lector (aviso "Sobre tus reseñas" al ser baneado), Sistema (reset BD).**
- Validación previa a navegador: `npm run typecheck` (tsc) y `npm test` (vitest).
- **En localhost la demo usa el backend Rails real** (el proxy de Vite envía `/graphql` a `:3000`). Para forzar el modo mock local: `VITE_GRAPHQL_ENDPOINT=mock` en un `.env.local`.

### Deploy a Vercel

- **URL en vivo:** [https://bibliotk-reviews.vercel.app](https://bibliotk-reviews.vercel.app)
- Configuración en `frontend/vercel.json` con soporte para `VITE_GRAPHQL_ENDPOINT`.

> [!IMPORTANT]
> **El demo en Vercel corre en modo OFFLINE/MOCK.** No hay backend Rails desplegado, por lo que `VITE_GRAPHQL_ENDPOINT` no está definida y la app resuelve todas las queries y mutations con un client mock **en memoria durante tu sesión** (ver `frontend/src/mock-client.ts`). Eso significa:
> - **No hay error 405** ni dependencia de servidores externos.
> - Crear reseñas, banear/desbanear, etc. **persisten solo mientras no recargues la página**.
> - Para **volver a fábrica** durante la sesión usá el botón **"Reiniciar demo"** (arriba a la derecha o en la vista Sistema).
> - Para probar el **backend real** corré la demo en **localhost** (`npm run dev` + Rails en `:3000`) y reseteá con `npm run db:reset`.

```bash
# Desde el root o importando la carpeta frontend/ en Vercel:
# Root Directory: frontend
# Build Command: npm run build
# Output Directory: dist
#
# Sin variables de entorno → la demo desplegada usa el modo mock/offline.
# OPCIONAL — si querés conectar una API Rails desplegada (Railway/Render/Fly.io):
# Environment Variable: VITE_GRAPHQL_ENDPOINT=https://tu-api-rails.com/graphql
```


## Requerimiento vs. completado

Tabla comparativa del brief (`docs/Prueba Product builder.md`) contra lo implementado. Estado: **completado** (requerimientos originales), **extra** (agregados de producto que el brief pedía como resolver) y **bonus** (funcionalidades extra pedidas a entregar).

| # | Requerimiento (brief) | Estado | Dónde |
|---|-----------------------|--------|-------|
| 1 | Motor de calificación 1-5 por libro + crear/editar/eliminar reseña | Completado | `Review` model, `createReview`/`updateReview`/`deleteReview`, vista Libro |
| 2 | Promedio con fase "fresca" vs "participación asimétrica" (3.0 / 3.3 / 2.2) | Completado | `Book#recalculate!` + redondeo half-up @ .25 (spec: 3.25→3.3, 3.35→3.4, 2.24→2.2) |
| 3 | Actualización del promedio en la misma transacción bajo concurrencia | Completado | `Review` after_save/after_destroy con `SELECT … FOR UPDATE` (libro bloqueado) |
| 4 | Respuesta 500k reviews (benchmark) | Completado | `db:seed:large_scale`, queries paginadas y agregadas |
| 5 | Top libros con índice de frescura | Completado | `topBooks` + `confidence` |
| 6 | Aviso al asimétrico (autor) de cambios de promedio | Completado | `ModerationNotification` + panel autor |
| 7 | Participación asimétrica = anomalía (Lector nuevo + review 5★ tras 20 min) | Completado | `metrics:scan`, flag de riesgo en Top 50, `fraudAuthors` |
| 8 | Moderación (ban con preview de impacto y razón) | Completado | `banPreview`, `banUser`, auditoría (`BanAuditLog`), UI Moderación |
| 9 | Usuario baneado: reseñas ocultas `{hidden:true}`, nunca borradas | Completado | `User#ban!` + `after_save :hide_if_user_banned!`; queries públicas filtran `hidden:false` |
| 10 | Desbanear restaura visibilidad y promedios | Completado | `unbanUser` |
| 11 | Notificación al propio baneado | Completado (extra en code review) | `ban!` crea `ModerationNotification` por libro + card "Tu cuenta fue baneada" |
| 12 | Medir las métricas definidas (instrumentación) | Documentado (pendiente de producción) | `PRODUCTO.md` — puntos de emisión definidos, faltan observability real |
| 13 | Errores de validación GraphQL volcados | Trade-off aceptado | `DECISIONES.md` — integridad en el modelo, UI detecta duplicados |
| 14 | Editar/eliminar visible en frontend | Completado (extra en code review) | Vista Libro, botones Editar/Eliminar |
| Bonus A | Reseñas 5★ de cuentas frescas a un mismo autor = revisión crítica | Completado | `fraudAuthorAnomaly` + UI Modulación |
| Bonus B | Moderar reseña individual sin banear al autor | Completado | `hideReview`/`showReview` + `moderation_reason` |

Para ejecutar cada prueba paso a paso ver [docs/PRUEBAS.md](docs/PRUEBAS.md).

## Ambientes y reset de BD

| Ambiente | Dónde | Reset a fábrica | Demo |
|----------|-------|------------------|------|
| development | `localhost:3000` | `bin/rails db:reset_demo` (CLI) | sí, **backend real** |
| test (CI/CD) | GitHub Actions, BD por ejecución | automático cada run | no |
| Vercel demo (production) | `bibliotk-reviews.vercel.app` | **Botón "Reiniciar demo"** (mock en memoria, no toca BD) | sí, **modo mock/offline** |
| producción real | deploy futuro | no | no |

El reset de BD real a fábrica en dev: `bin/rails db:reset_demo` (o `cd frontend && npm run db:reset`) — drop + create + migrate + seed. Solo dev/test; aborta en producción. En la **demo de Vercel** no hay BD: el botón "Reiniciar demo" devuelve el estado mock a los datos de fábrica de la sesión.

## CI/CD (GitHub Actions)

Jobs: `scan_ruby` (brakeman), `lint` (rubocop), `test` (RSpec + PostgreSQL service, BD creada de cero en cada ejecución), `frontend` (typecheck + vitest). `main` está protegida (status checks requeridos).

## Documentación

- [docs/PLAN.md](docs/PLAN.md) — Plan de implementación + hitos
- [docs/STACK.md](docs/STACK.md) — Catálogo del stack tecnológico
- [docs/STRUCTURE.md](docs/STRUCTURE.md) — Estructura del dominio
- [docs/PRUEBAS.md](docs/PRUEBAS.md) — Guía de pruebas del sistema
- [DECISIONES.md](DECISIONES.md) — Trade-offs y decisiones técnicas
- [PRODUCTO.md](PRODUCTO.md) — Decisiones de producto frente a los 5 pains
- [AGENTS.md](AGENTS.md) — Convenciones operativas

## 📄 Licencia

Software libre bajo [GNU AGPL v3.0](LICENSE). Podés usarlo, modificarlo y desplegarlo en tus propios servidores. Si ejecutás una versión modificada como servicio en red, debés publicar el código fuente bajo la misma licencia. Nadie puede convertir este software en un producto cerrado o propietario.
