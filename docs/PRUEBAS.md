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
 
## Prueba 8b: Anomalía por autor (FraudAuthorAnomaly)
 
Verificar detección de patrones sospechosos para todos los libros de un autor.
 
```bash
curl -s -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ fraudAuthorAnomaly(authorName:\"Gabriel García Márquez\") { suspicious author flaggedBooks checkedAt } }"}' | jq
```
 
**Esperado:** Reporte del autor con `suspicious: false/true`.
 
---
 
## Prueba 8c: Escaneo de anomalías y métricas
 
```bash
bin/rake metrics:scan
```
 
**Esperado:** Resumen de ráfagas (>50/hora), deltas de promedios (>1.0 en 24h) y ratio de usuarios baneados en 7 días.

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
| Top 50 | cualquiera | Orden por promedio, columna Autor y Riesgo (Alto/Medio/Bajo), `displayAverage` |
| Libro | lector/autor | Detalle + crear/**editar/eliminar** tu reseña + fraud check + "ver reseñas ocultas" (admin/autor) |
| Moderación | admin | Ban preview → banear → desbanear + auditoría (refresca al instante) + anomalía por autor (selector) |
| Panel autor | autor | Notificaciones + reseñas ocultas |
| Sistema | cualquiera | Ambientes + comando de reset de BD |

El demo refleja los cambios directamente en la BD de desarrollo, así que podés probar cada flujo (baneo, ocultar reseñas, notificaciones) y después regenerar la BD con `node npm run db:reset`.

---

## Probar la DEMO en Vercel (modo offline/mock)

**URL:** https://bibliotk-reviews.vercel.app

La demo en Vercel corre **sin backend**: resuelve todas las queries y mutations con un client mock en memoria (`frontend/src/mock-client.ts`). Por eso:

- **No hay que configurar nada** (ni Vercel env vars ni servidor externo) → sin error 405.
- Los datos mutados **persisten solo durante la sesión**; recargar la página los descarta.
- Para volver a fábrica a mitad de sesión: botón **"Reiniciar demo"** (arriba a la derecha o en la vista Sistema).

> Preparación: pestaña **Roles** para switchear de personaje, o recargá la página para resetear.

### Admin (Moderación)
1. **Ban preview** — Moderación → elegí un usuario (ej. «Reader 3» #9) → mirá la tabla Actual / Proyectado / Delta por libro **antes** de banear (no escribe nada).
2. **Banear** — escribí un motivo opcional (default "Reseñas falsas") y banéá → verás el cambio en "Auditoría de baneos" (se refresca al instante) y las reseñas del usuario dejan de contar. Si el usuario ya está baneado, solo se ofrece "Desbanear".
3. **Desbanear** — reversa: entra de nuevo y los promedios vuelven.
4. **Detección de fraude** — en "Analizar autor" elegí `Jorge Luis Borges` del selector → marca ⚠️ anomalía en «El Aleph» (cluster 5★ de cuentas recientes de ejemplo).
5. **Top 50** — promedios redondeados a 1 decimal, "Insuficiente" si <3 reseñas, columna "Riesgo" (Alto/Medio/Bajo) y Autor.
6. **Libro → Moderación** — botón "Ver reseñas ocultas por moderación" (admin o autor del libro) con el motivo de cada ban.
7. **Sistema** — botón reset mock + comando CLI documentado.

### Autor (ej. "García Márquez" #2)
1. **Panel autor** — banéá (como admin) a un lector que reseñó sus libros (p.ej. Reader 1 #7 en «Cien años de soledad») y luego entrá como García Márquez: verás la **notificación de moderación** (`4.x → 2.x`, motivo "moderación de cuenta") y las **reseñas ocultas** de sus libros.
2. **Libro** — detalle con promedio, riesgo, fraud check y sus reseñas visibles.

### Lector (ej. Reader 1 #7 o Reader 10 #16)
1. **Libro** → elegí un libro → **"Crear reseña"** (1-5★ + texto opcional). El promedio y el conteo se recalculan al instante (mutación funcional).
2. **No podés reseñar el mismo libro dos veces** (unicidad): la app te lo indica y te muestra "Editar"/"Eliminar" en tu reseña de la lista.
3. **Editar/eliminar tu reseña** — en tu reseña aparece "Editar" (cambia rating/texto en línea) y "Eliminar" (pide confirmación). Ambos recalculan el promedio del libro.
4. **Top 50** — el libro reseñado sube de posición en el ranking.
5. **"Sobre tus reseñas"** — si te banearon de moderación, al entrar (home) ves una card con los avisos de en qué libros tus reseñas quedaron ocultas y el motivo.

### Notificación al usuario baneado (backend)
Cuando `banUser` esconde las reseñas de un usuario, además de notificar al **autor**, se crea una notificación **para el propio usuario baneado** por cada libro afectado:

```bash
curl -s -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ notifications(userId:7) { id previousAverage newAverage reason book { title } } }"}' | jq
```
**Esperado:** mensaje tipo "Tu reseña en «X» quedó oculta por moderación de cuenta (motivo: …)".
