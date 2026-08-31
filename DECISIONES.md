# DECISIONES.md

## Requisitos ambiguos o contradictorios

### 1. "Reseñas Insuficientes" vs mostrar el promedio

El enunciado dice: "Un libro con menos de 3 reseñas muestra 'Reseñas Insuficientes' en lugar del promedio." Growth pide: "¿No podemos mostrar el promedio igual, aunque sea con dos reseñas?"

**Decisión:** Mantuve el umbral de 3 para el top 50, pero mostré el promedio en el detalle del libro siempre. Agregué un campo `confidence` para que Growth tome decisiones informadas.

### 2. Qué pasa con la reseña de un usuario baneado

El enunciado dice: "Tu API debe reflejar esa decisión de forma explícita, no como efecto colateral de la implementación."

**Decisión:** Las reseñas quedan con `hidden: true`. No se borran. El autor puede verlas, soporte puede verlas, el lector general no. Esto es una decisión explícita que se refleja en el esquema (campo `hidden`) y en los queries (`moderationStatus`).

### 3. Ban preview sin escribir en producción

El enunciado dice: "Si tu arquitectura está bien hecha esto es barato; si te sale caro, eso también es un hallazgo."

**Decisión:** Calculo el impacto en memoria usando los aggregates cacheados. No toco la DB. Es O(n) donde n = reseñas del usuario, y es barato porque los promedios ya están cacheados.

## Trade-offs tomados

### GraphQL vs REST

**Decisión:** GraphQL permite queries más eficientes (ej: pedir solo `average` y `confidence` sin traer todo el libro).

**Costo:** Más setup inicial, más complejidad en el schema. Pero la flexibilidad lo vale para un sistema con múltiples actores (autores, lectores, moderación, soporte).

### Cached aggregates vs recalcular on-the-fly

**Decisión:** Cached aggregates en `books` (`cached_average`, `cached_reviews_count`, `cached_non_banned_count`).

**Costo:** Consistencia eventual (si el server crashea después de un review pero antes del recálculo, el promedio queda desactualizado). Mitigación: rake task `recalculate_all` como insurance.

**Beneficio:** El top 50 es O(1) — un simple `ORDER BY cached_average DESC LIMIT 50`. Sin esto, sería O(n*m) donde n = libros y m = reviews por libro.

### Reseñas hidden vs deleted

**Decisión:** Hidden (no borradas).

**Costo:** La tabla de reviews crece indefinidamente. Los queries deben filtrar por `hidden: false` siempre.

**Beneficio:** Trazabilidad completa. Soporte puede ver qué pasó. El usuario puede ver que su reseña fue ocultada. No hay黑洞 de información.

### Texto estático vs IA para notificaciones

**Decisión:** Texto estático.

**Costo:** Menos personalización. El autor recibe el mismo mensaje siempre.

**Beneficio:** Predictible, auditable, sin costo de API. La IA se puede agregar después como bonus.

## Decisiones de ingeniería / entrega

### TypeScript vs JavaScript para el demo

**Decisión:** TypeScript (Vite + TS + Vitest).

**Costo:** Setup de tooling (tsconfig, tipos). 

**Beneficio:** Tipado estricto de las respuestas GraphQL y del estado; validación de tipos en tiempo de compilación (`tsc --noEmit`) sin abrir el navegador, y tests unitarios en runtime con Vitest.

### SPA estática vs vistas Rails para el demo

**Decisión:** SPA estática en `frontend/`, separada de la app API-only.

**Costo:** Se sirve aparte (Vite dev/build). No reutiliza el pipeline de Rails.

**Beneficio:** No obliga a sacar la app de `api_only`, ni a re-inventar assets. El demo es 100% estático y consume GraphQL por HTTP (CORS abierto).

### Reset de BD solo dev/test (nunca en producción)

**Decisión:** `db:reset_demo` aborta si `Rails.env.production?`. La demo y el reset viven solo en development.

**Costo:** No hay forma de regenerar la BD en producción (a propósito).

**Beneficio:** Evita borrar datos reales por accidente. En dev podés destruir/reconstruir sin miedo; en test la BD se recrea automáticamente.

### CI determinístico: BD efímera por ejecución

**Decisión:** El job `test` de CI crea la BD desde cero en cada ejecución (`db:create` + `db:schema:load` + `db:seed`) antes de correr RSpec.

**Costo:** Cada run re-ejecuta el setup de BD (~segundos).

**Beneficio:** Una prueba que borra datos no contamina la ejecución siguiente. Evita "falsos errores" por estado residual (ej: borré todo en una prueba y la siguiente falla al intentar borrar algo que ya no existe).

### Gems brakeman + rubocop declaradas en el Gemfile

**Decisión:** Agregar `brakeman` y `rubocop-rails-omakase` al grupo `:development, :test`.

**Costo:** Ninguno real; son dev-only.

**Beneficio:** Los jobs de CI `scan_ruby` y `lint` fallaban porque los binstubs `bin/brakeman`/`bin/rubocop` hacían `bundler/setup` + `Gem.bin_path` de gems que no estaban en el bundle (`Gem::MissingSpecError`). Este fallo era pre-existente (no culpa del bump de `actions/checkout` de dependabot).

### Reset de BD desde la DEMO: por CLI, no endpoint del server

**Decisión:** El reset se hace vía `npm run db:reset` (o `bin/rails db:reset_demo`) desde terminal, no desde un botón que ejecuta el `DROP` dentro del server.

**Costo:** Más fricción que un botón (hay que ir a la terminal).

**Beneficio:** `db:drop` no puede caerse con la BD a la que el server Rails está conectado (PostgreSQL rechaza `DROP` con conexiones activas). Correrlo como proceso CLI es determinístico y seguro. La vista Sistema del demo muestra el comando y un botón de copiar.

**Matiz para Vercel:** este razonamiento aplica a **BD reales** (no se puede `DROP` con el server conectado). En la demo estática de Vercel no hay BD ni server conectado: el equivalente a `db:reset_demo` es el **botón "Reiniciar demo"**, que hace `resetMockData()` (vuelve el estado en memoria a los datos de fábrica de la sesión). El CLI `npm run db:reset` sigue siendo el camino para el backend real en localhost.

### Demo en Vercel: modo offline/mock (Opción B, sin backend desplegado)

**Contexto:** El deploy estático en Vercel no tiene un backend Rails detrás (no hay API en ningún cloud). La primera versión fallaba con `GraphQL HTTP 405`: el catch-all de Vercel (`/(.*)` → `index.html`) interceptaba el `POST /graphql`, y Vercel respondía `405 Method Not Allowed` porque un HTML estático rechaza POST.

**Decisión:** Se descartó desplegar la API a Railway/Render/Fly.io por ahora (Opción A: requiere cuenta, setup y posible costo) y se implementó un **mock client** en `frontend/src/mock-client.ts` que resuelve todas las queries (top 50, libro, ban preview, moderación, fraude, logs, notificaciones) y mutations (crear reseña, banear/desbanear) sobre **datos en memoria**, replicando el seed real de Rails (admin, 5 autores, 50 lectores, 10 libros idénticos en títulos/autores).

`MOCK_MODE` se activa **solo** cuando `VITE_GRAPHQL_ENDPOINT` está vacía **y** el build es de producción (Vercel), o se fuerza localmente con `VITE_GRAPHQL_ENDPOINT=mock`. En dev (`npm run dev`) nunca se activa: el proxy de Vite sigue enviando `/graphql` a `localhost:3000` (backend real).

**Costo:** La demo de Vercel es una **simulación**: los datos mutados persisten solo durante la sesión (recargar la página los descarta). El sistema real solo se ejerce completo en localhost.

**Beneficio:** Cero infraestructura y costo; la demo desplegada queda 100% funcional para presentar cada feature y decisión de producto (incluyendo ban preview, reseñas ocultas, notificaciones al autor y detección de fraude con un cluster 5★ de cuentas recientes en «El Aleph»); y documenta exactamente cómo re-conectar una API real en el futuro (setear `VITE_GRAPHQL_ENDPOINT`).

## Qué dejaría fuera si esto saliera mañana

1. **Fraud detection:** Es un nice-to-have. El sistema core (promedios, baneos, notificaciones) es lo crítico.
2. **El seed de 500k reviews:** Es para benchmark, no para producción. En producción los datos ya existen.
3. **Las 3 métricas de monitoreo:** Se definen pero no se implementan. En producción irían a Datadog o similar.

## Qué haría distinto con una semana más

1. **Background jobs para recálculo:** En lugar de recalcular en la misma transacción del review, usar Sidekiq para recalcular asincrónicamente. Esto mejora la performance de escritura.
2. **Optimistic locking en reviews:** En lugar de `SELECT FOR UPDATE`, usar un `lock_version` para detectar conflictos sin bloquear.
3. **Cache en Redis para el top 50:** Guardar el top 50 en Redis con TTL de 5 minutos. Esto reduce la carga a la DB.
4. **API versioning:** Empezar con `v1/` en los queries para poder evolucionar sin romper clientes existentes.

## Decisiones de producto y UI (demo)

### "¿Qué define que una reseña es falsa?"

No existe un estado **individual** "falsa" en una reseña: el sistema no etiqueta reseñas sueltas. Lo que existe:
- **`FraudDetector` / `fraudAuthorAnomaly`** marcan **señales agregadas** (mayoría 5★ de cuentas recientes, distribución anómala) a nivel libro/autor → "sospechoso", no "falsa".
- **El baneo de moderación** (`ban!` con `reason`) oculta retroactivamente **todas** las reseñas del usuario baneado (`hidden: true`) con un `ban_reason`.

**Decisión:** No inventar un campo "falsa / legítima". La pregunta "por qué está oculta" se responde con `ban_reason` del usuario baneado, y "por qué es sospechosa" con el reporte de fraude. Así no se abre la caja de «¿es esta reseña en particular falsa?», que no es comprobable per-review.

### Dónde mostrar las reseñas ocultas (vista Libro)

El pain de Soporte ("¿dónde está mi reseña?") se muestra en dos lugares:
- **Panel autor** (`moderationStatus`) — el autor ve las ocultas de su libro.
- **Nuevo: detalle de libro → "Ver reseñas ocultas por moderación"**, visible solo para **admin** o el **autor del libro** (el lector común no las ve). Mejor descubribilidad que esconderlo solo en el panel autor, sin filtrar información sensible.

### "Confianza" vs "Riesgo" y español

El backend expone `confidence` (`low/medium/high`) como convención de schema. En la UI se presentó antes como "Confianza" en inglés, que confundía (confianza alta con poca data es engañoso). **Decisión:** re-etiquetar como **Riesgo** en español: poca data = Riesgo **Alto** (el promedio pude no representar), mucha data = Riesgo **Bajo**. Solo cambia la presentación; el valor de schema sigue intacto.

### Top 50: columna Autor y más libros en el mock

Se agregó columna **Autor** y el mock pasó de 10 a **20 libros** para que el Top 50 se vea con volumen. En el backend real el Top 50 es `ORDER BY cached_average DESC LIMIT 50` (si hay menos de 50 libros, lista los que hay).

### Detección de anomalías: selector en vez de input

**Decisión:** el "Analizar autor" pasó de un input de texto libre a un **selector** con los autores presentes en el catálogo. Evita errores de tipeo y confirma que el autor existe. (En la API se mantiene `fraudAuthorAnomaly(authorName:)` para uso programático.)
