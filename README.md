# Bibliotk Reviews

Motor de calificación para Bibliotk — plataforma de reseñas de libros.

## Requisitos

- Ruby 3.1.2
- PostgreSQL 16+
- Rails 7.2

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

Hay un demo interactivo en `frontend/` (SPA estática con **Vite + TypeScript + Vitest**) para switchear de rol y probar cada feature con cambios en la BD.

```bash
cd frontend
npm install
npm run dev        # dev server en :5173, proxy a :3000
```

- **Role switching:** elegís Admin / Autor / Lector y ejecutás las acciones de ese rol.
- **Top 50, Libro (CRUD reseñas + fraud check), Moderación (ban preview/ban/unban/auditoría), Panel autor (notificaciones + ocultas), Sistema (reset BD).**
- Validación previa a navegador: `npm run typecheck` (tsc) y `npm test` (vitest).

## Ambientes y reset de BD

| Ambiente | Dónde | Reset a fábrica | Demo |
|----------|-------|------------------|------|
| development | `localhost:3000` | `bin/rails db:reset_demo` | sí |
| test (CI/CD) | GitHub Actions, BD por ejecución | automático cada run | no |
| production | deploy futuro | no | no |

El reset de BD a fábrica en dev: `bin/rails db:reset_demo` (o `cd frontend && npm run db:reset`) — drop + create + migrate + seed. Solo dev/test; aborta en producción.

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
