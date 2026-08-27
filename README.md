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

## Documentación

- [docs/PLAN.md](docs/PLAN.md) — Plan de implementación
- [DECISIONES.md](DECISIONES.md) — Trade-offs y decisiones técnicas
- [PRODUCTO.md](PRODUCTO.md) — Decisiones de producto frente a los 5 pains
