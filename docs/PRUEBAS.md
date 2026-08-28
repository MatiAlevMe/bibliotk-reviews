# Guía de Pruebas del Sistema

Cómo levantar, cargar datos y probar cada funcionalidad del motor de reseñas.

## Setup rápido

```bash
cd <ruta>/bibliotk-reviews
bundle install
bin/rails db:create db:migrate
bin/rails db:seed
bin/rails server
```

El servidor queda en `http://localhost:3000/graphql`. También podés probar desde el demo web (`cd frontend && npm install && npm run dev` → `http://localhost:5173`).

> **Nota de ambiente:** el job de tests de CI arranca con BD de fábrica en cada ejecución (la BD es efímera y se recrea con seed antes de correr). Por eso, aunque una prueba borre todo, la siguiente ejecución no se contamina.

## Cuentas de prueba

| Tipo | Email | ID |
|------|-------|----|
| Admin | admin@bibliotk.com | 1 |
| Autor 1 | garcia@books.com | 2 |
| Autor 2 | cortazar@books.com | 3 |
| Autor 3 | borges@books.com | 4 |
| Autor 4 | allende@books.com | 5 |
| Autor 5 | vargas@books.com | 6 |
| Lector 1 | reader1@test.com | 7 |
| Lector 2 | reader2@test.com | 8 |
| ... | ... | ... |
| Lector 50 | reader50@test.com | 56 |

## IDs de libros para testing

| ID | Título | Autor |
|----|--------|-------|
| 1 | Cien años de soledad | García Márquez |
| 2 | El amor en los tiempos del cólera | García Márquez |
| 3 | Rayuela | Cortázar |
| 4 | Bestiario | Cortázar |
| 5 | Ficciones | Borges |
| 6 | El Aleph | Borges |
| 7 | La casa de los espíritus | Allende |
| 8 | Eva Luna | Allende |
| 9 | La ciudad y los perros | Vargas Llosa |
| 10 | Conversación en La Catedral | Vargas Llosa |

---

## Prueba 1: Top 50 libros

Verificar que los libros aparecen ordenados por promedio.

```bash
curl -s -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ topBooks(limit:10) { id title cachedAverage displayAverage confidence cachedReviewsCount } }"}' | jq
```

**Esperado:** Lista ordenada de mayor a menor promedio.

---

## Prueba 2: Detalle de libro

Verificar que muestra el promedio SIEMPRE, incluyendo con 1 reseña.

```bash
curl -s -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ book(id:1) { id title cachedAverage displayAverage confidence visibleReviews { id rating body user { name } } } }"}' | jq
```

**Esperado:** `displayAverage` muestra el número o `"Insuficientes"` si <3 reseñas.

---

## Prueba 3: Ban Preview (antes de banear)

Ver qué pasaría SIN modificar nada.

```bash
curl -s -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ banPreview(userId:7) { userId userName totalReviews booksAffected details { bookId title currentAverage projectedAverage delta } } }"}' | jq
```

**Esperado:** Lista de libros con promedio actual vs proyectado. La DB no cambia.

---

## Prueba 4: Banear un usuario

Banear al Lector 7 y ver cómo cambian los promedios.

**Paso 1 - Ver promedio antes:**
```bash
curl -s -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ topBooks(limit:5) { id title cachedAverage } }"}' | jq
```

**Paso 2 - Banear:**
```bash
curl -s -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { banUser(userId:7, reason:\"Reseñas falsas\", performedBy:\"admin\") { id action booksAffected impactDetails } }"}' | jq
```

**Paso 3 - Ver promedio después:**
```bash
curl -s -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ topBooks(limit:5) { id title cachedAverage } }"}' | jq
```

**Esperado:** Los promedios de los libros que reseñó el Lector 7 cambiaron.

---

## Prueba 5: Reseñas ocultas (no borradas)

Ver que las reseñas del usuario baneado quedaron ocultas.

```bash
curl -s -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ moderationStatus(bookId:1) { bookId title hiddenCount hiddenReviews { id userName rating banReason } } }"}' | jq
```

**Esperado:** Lista de reseñas ocultas con el motivo del ban.

---

## Prueba 6: Notificación al autor

Ver qué le llegó al autor por el ban.

```bash
curl -s -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ notifications(userId:2) { id previousAverage newAverage reason readAt book { title } } }"}' | jq
```

**Esperado:** Mensaje tipo "Tu libro X tuvo un cambio de Y a Z por moderación".

---

## Prueba 7: Desbanear usuario

Revertir el ban y ver que los promedios se恢复.

```bash
curl -s -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { unbanUser(userId:7, performedBy:\"admin\") { id action booksAffected } }"}' | jq
```

Verificar que los promedios volvieron al valor anterior.

---

## Prueba 8: Fraud check

Verificar detección de patrones sospechosos.

```bash
curl -s -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ fraudCheck(bookId:1) { suspicious reason fiveStarRatio recentAccountsRatio } }"}' | jq
```

**Esperado:** `suspicious: false` con datos normales.

---

## Prueba 9: Crear reseña

```bash
curl -s -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { createReview(bookId:1, userId:57, rating:5, body:\"Obra maestra\") { id rating body hidden user { name } book { title } } }"}' | jq
```

**Nota:** Si el userId 57 no existe, usá uno que sí (7-56).

---

## Prueba 10: Editar reseña

```bash
curl -s -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { updateReview(id:1, rating:4, body:\"Muy buena\") { id rating body } }"}' | jq
```

---

## Prueba 11: Eliminar reseña

```bash
curl -s -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { deleteReview(id:1) }"}' | jq
```

---

## Prueba 12: Auditoría de baneos

Ver historial de baneos.

```bash
curl -s -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ banLogs(limit:5) { id action booksAffected performedBy createdAt user { name } } }"}' | jq
```

---

## Prueba 13: Benchmark 500k reviews

```bash
bin/rails db:seed:large_scale
```

Verificar performance:
```bash
bin/rails runner "
start = Time.now
top = Book.order(cached_average: :desc).limit(50)
elapsed = Time.now - start
puts \"Top 50 query: #{(elapsed * 1000).round(1)}ms\"
top.each { |b| puts \"  #{b.cached_average}★ #{b.title} (#{b.cached_reviews_count} reviews)\" }
"
```

**Esperado:** <100ms para el top 50 con 500k reviews.

---

## Prueba 14: Concurrencia

```bash
bin/rails runner "
book = Book.first
puts \"Before: #{book.cached_average}★ (#{book.cached_reviews_count} reviews)\"

threads = 100.times.map do |i|
  Thread.new do
    user = User.create!(name: \"Concurrent#{i}\", email: \"concurrent#{i}@test.com\")
    Review.create!(user: user, book: book, rating: rand(1..5))
  end
end

threads.each(&:join)
book.reload
puts \"After: #{book.cached_average}★ (#{book.cached_reviews_count} reviews)\"
puts \"Average is mathematically correct: #{book.cached_average == (Review.where(book: book).average(:rating).to_f.round(1))}\"
"
```

**Esperado:** Promedio correcto después de 100 reviews simultáneos.

---

## Reset de la base de datos (volver a fábrica)

En desarrollo, para volver al estado de fábrica (drop + create + migrate + seed):

```bash
bin/rails db:reset_demo
```

O desde el demo: `cd frontend && npm run db:reset`. **Solo dev/test** — el task aborta si `Rails.env.production?`.

Esto es útil si una prueba borró datos (p.ej. eliminaste muchas reseñas) y querés empezar de nuevo sin quedarte "stuck": siempre podés regenerar la BD.

## Probar desde el demo web

En `http://localhost:5173` (tras `npm run dev`):

| Vista | Rol requerido | Qué ejercita |
|-------|---------------|--------------|
| Roles (login) | cualquiera | Switchear admin/autor/lector y cuenta |
| Top 50 | cualquiera | Orden por promedio, `displayAverage`, `confidence` |
| Libro | lector/autor | Detalle + crear/editar/eliminar reseña + fraud check |
| Moderación | admin | Ban preview → banear → desbanear + auditoría |
| Panel autor | autor | Notificaciones + reseñas ocultas |
| Sistema | cualquiera | Ambientes + comando de reset de BD |

El demo refleja los cambios directamente en la BD de desarrollo, así que podés probar cada flujo (baneo, ocultar reseñas, notificaciones) y después regenerar la BD con `node npm run db:reset`.
