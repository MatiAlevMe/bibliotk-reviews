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
```

## Frontend DEMO

Hay un demo interactivo en `frontend/` (SPA estática con **Vite + TypeScript + Vitest**) para switchear de rol y probar cada feature.

```bash
cd frontend
npm install
npm run dev        # dev server en :5173, proxy a :3000 → backend REAL (necesita Rails corriendo)
```

- **Role switching:** elegís Admin / Autor / Lector y ejecutás las acciones de ese rol.
- **Top 50 (con Autor y Riesgo Alto/Medio/Bajo), Libro (crear reseña + fraud check + "ver reseñas ocultas" para admin/autor), Moderación (ban preview/ban/unban/auditoría/autor anomalía), Panel autor (notificaciones + ocultas), Sistema (reset BD).**
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
