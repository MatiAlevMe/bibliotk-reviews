# Plan de Continuación — Pendientes, Bugs y Cómo Resolverlos

Documento vivo con todo lo que quedó pendiente, detectado o diferido tras la entrega inicial. Cada entrada tiene estado, impacto, causa raíz y una propuesta concreta de resolución.

Convención de estado: `[✅ resuelto]`, `[⏳ pendiente]`, `[🟡 bajo prioridad]`, `[📌 decisión tomada]`.

---

## 📌 Plan de ejecución completo (próximos pasos)

> Estado operativo al momento de escribir: la demo actualmente **no es funcional** en este Windows porque las gems nativas de Rails (puma, psych, date, etc.) no compilan/cargan en el Ruby de Windows (`C:\Ruby33`), y Postgres no está instalado localmente. Se decidió **mover el entorno de ejecución a WSL (Ubuntu 24.04)**.

### Decisiones confirmadas (28/08/2026)

- **Backend y tests se corren en WSL** (Ubuntu 24.04, WSL2). Ruby 3.3.1 vía **rbenv** (ya instalado en `/home/eva2a/.rbenv`), **solo project-local** — NO se toca el global rbenv (que tiene 3.1.2).
- **Rechazado el setup Docker dev** (`Dockerfile.dev` + `docker-compose.yml` descartados). El `Dockerfile` de producción NO se toca salvo lo ya commiteado (ARG RUBY_VERSION → 3.3.1, commit `6cc036e`).
- **`db:reset` de la demo corre vía WSL**: `wsl -e bash -lc 'cd /home/eva2a/EVA/repos/bibliotk-reviews && bin/rails db:reset_demo'` (ya en `frontend/package.json`, commit `02333ea`).
- **`.gitattributes`** añadido en `02333ea`: fuerza `eol=lf` para todo texto → los binstubs `bin/*` corren bien en Linux/contenedores incluso con `core.autocrlf=true` en Windows.
- **`fraudAuthorAnomaly` (#10) se expone como query GraphQL** (visible en la demo), no solo rake.
- **Copia del proyecto en WSL sin `.git`**: se clona limpio desde `origin` y se aplican los archivos locales no commiteados como sea necesario.

### Fase A — Setup del entorno WSL (backend + tests)

1. **Clonar limpio** en WSL en `/home/eva2a/EVA/repos/bibliotk-reviews` desde `git@github.com:MatiAlevMe/bibliotk-reviews.git` (SSH). WSL ya tiene `git`, `gcc`, `make`, `curl`, `nvm/node v18.20.8`.
2. **Ruby 3.3.1 project-local**: `rbenv install 3.3.1` (compila con gcc/make). `.ruby-version` (ya = `3.3.1`) activa 3.3.1 **solo dentro** de ese folder; el global rbenv queda en 3.1.2 intacto.
3. **PostgreSQL**: `sudo apt install postgresql`; crear rol `eva2a` con password y DBs `bibliotk_reviews_development` + `bibliotk_reviews_test`. `config/database.yml` usa `localhost`/5432 y el usuario por defecto del SO (evitar el auth `peer` de Ubuntu para TCP localhost; configurar password auth para el rol).
4. **Dependencias + BD**: `bundle install`, `bin/rails db:create db:migrate db:seed`.
5. **Verificar**: `bundle exec rspec` (baseline: 47 examples, 0 failures), `bin/rubocop -f github`, `bin/brakeman --no-pager`.

### Fase B — Demo funcional de punta a punta

- Backend en WSL: `bin/rails server -b 0.0.0.0 -p 3000` (WSL2 reenvía localhost → Windows la alcanza en `localhost:3000`).
- Frontend en Windows (E:): `cd frontend && npm install && npm run dev` → SPA en `:5173`, proxy `/graphql → localhost:3000` ya configurado en `vite.config.ts`.
- Reset a fábrica de BD: `cd frontend && npm run db:reset` (vía WSL).

### Fase C — Fixes de código pendientes (1 commit por hito)

Ver detalles completos en los puntos numerados abajo.

1. **#2 + #3 — Precisión del ban preview + spec de equivalencia** (requiere migración):
   - Migración: añadir `reviews_sum` (integer, suma exacta no redondeada) y `reviews_count_raw` a `books`. `Book#recalculate!` los mantiene en la misma `update_columns`. Regenerar y commitear `db/schema.rb`.
   - `BanImpactAnalyzer#analyze` (`app/services/ban_impact_analyzer.rb:20`) usa `reviews_sum` en vez de `cached_average * count`.
   - Spec en `ban_impact_analyzer_spec.rb` comparando contra "banear + recalcular" real.
2. **#5 — Redundancia `includes(:book).joins(:book)`** (`ban_impact_analyzer.rb:9`) → `reviews.includes(:book)`.
3. **#4 — Concurrencia**: `spec/models/concurrency_spec.rb` → rescatar `ActiveRecord::RecordNotUnique` en `t.join` o recolectar errores asertando ≤1 insert por usuario.
4. **#10 — `fraudAuthorAnomaly`**: query GraphQL `fraudAuthorAnomaly(authorName: String!): FraudResult` en `query_type.rb` + type `FraudResult`, conectando `FraudDetector.detect_author_anomaly`. Actualizar `frontend/src/api.ts` (tipado acorde al schema) y agregar spec con caso sospechoso.
5. **#9 — 3 métricas**: servicio `AnomalyWatcher`/`AlertingService` + rake `metrics:scan` que calcule Reviews/min, average delta, y ratio banned/total. + specs.

Cada hito: correr `rspec` + `rubocop`, commit imperativo con alcance.

### Fase D — Docs y CI

- Actualizar `docs/CONTINUACION.md` (marcar 2,3,4,5,9,10 resueltos con commit refs; ajustar tabla de migraciones), `PLAN.md`, `PRUEBAS.md` (flujo demo WSL + `db:reset` vía wsl), `STACK.md`, `STRUCTURE.md`, `DECISIONES.md`, `PRODUCTO.md`, `AGENTS.md` (workflow WSL, postgres local, `db:reset` por wsl, quitar referencias docker dev).
- CI ya recalibrado a Ruby 3.3.1 + actions v5 + node 22 (commit `6cc036e`); se valida al abrir PR (checks `test`, `lint`, `scan_ruby`, `frontend`).

### Fase E — Push / PR

- Rama feature (ej. `feat/demo-wsl-pendientes`), commits atómicos por fase, abrir PR → checks CI → merge a `main` (protegida).

---

## 1. Fluir cambios a `main` (protección habilitada)

**Estado:** `[📌 decisión tomada]` — ver abajo cómo hacerlo.

**Problema:** Tras proteger `main` (require PR + status checks), no se puede `git push` directo a `main`, ni siquiera siendo owner.

**Resolución (owner):**
1. **Recomendado:** trabajar en una rama feature + abrir PR. La protección te obliga a pasar por review y los checks de CI (`test`, `lint`, `scan_ruby`, `frontend`). Es el flujo correcto.
   ```bash
   git checkout -b feat/xyz
   # ...commits...
   git push -u origin feat/xyz
   gh pr create --fill
   ```
2. Si igualmente querés push directo ocasional:
   - Settings → Branches → regla de `main` → desmarcar **"Do not allow bypassing the above settings"**.
   - Con eso, como owner/admin, el bypass se aplica y podés pushear directo. (Mantener marcada la opción garantiza que ni admins salten los checks; es la opción segura por defecto.)
   - Para rewrite: `git push --force-with-lease` (el "Block force pushes" solo aplica si no tenés bypass).

**Nota (28/08/2026):** el owner tiene bypass habilitado y el push directo a `main` funciona; los commits se ven "Bypassed rule violations" pero se aplican.

---

## 2. Precisión del ban preview (BanImpactAnalyzer)

**Estado:** `[⏳ pendiente]`

**Bug/limitación:** `BanImpactAnalyzer#analyze` reconstruye el total desde `cached_average`, que ya está **redondeado a 1 decimal**. Por eso el promedio proyectado puede desviarse ±0.1 respecto al resultado real de banear y recalcular.

Ejemplo: `cached_average = 3.3`, `cached_non_banned_count = 10` → total asumido `3.3 * 10 = 33`, cuando el total real sin redondear pudo ser `33.4`.

**Archivo:** `app/services/ban_impact_analyzer.rb:20-21`

**Cómo resolverlo (opciones):**
- **A (recomendado):** guardar además estadísticas en precisión completa en `books` — columnas `reviews_sum` y/o `reviews_count_raw` (no redondeadas). El preview usa la suma exacta:
  ```ruby
  total_without = book.reviews_sum - review.rating
  projected_avg = (total_without.to_f / new_count).round(1)
  ```
  `recalculate!` mantiene `reviews_sum` en la misma `update_columns`.
- **B (sin migración):** en vez de usar agregados cacheados, el preview calcula la suma real consultando la BD (más caro, requiere contar reseñas visibles).

**Verificación:** agregar spec que compare `BanImpactAnalyzer` contra "banear y recalcular" de verdad para el mismo set de datos.

---

## 3. Spec del ban preview no verifica equivalencia

**Estado:** `[⏳ pendiente]`

**Brecha:** el brief exige *"Ban preview: resultado coincide con banear y recalcular"*, pero `spec/services/ban_impact_analyzer_spec.rb` solo comprueba que no modifica la BD y que devuelve los campos — **no** que la proyección coincida con el ban real.

**Cómo resolverlo:**
```ruby
it "matches the result of actually banning and recalculating" do
  preview = described_class.new(user).analyze
  user.ban!(reason: "spec")
  book1.reload
  expect(book1.cached_average).to eq(preview[:details]
    .find { |d| d[:book_id] == book1.id }[:projected_average])
end
```
Cuidado: con el fix del punto 2 este test pasa; con el código actual puede fallar por el redondeo (±0.1).

---

## 4. Ruido en el spec de concurrencia

**Estado:** `[🟡 bajo prioridad]`

**Detalle:** `spec/models/concurrency_spec.rb` lanza 200 threads con `Review.create` sin rescatar. En carrera, el **unique index** `(user_id, book_id)` puede lanzar `ActiveRecord::RecordNotUnique` en algún thread (la validación de modelo no protege ante races). Como los threads no se inspeccionan, el test pasa pero "traga" excepciones.

**Impacto:** bajo — el test valida el invariante correcto, pero es frágil/sucio.

**Cómo resolverlo:**
```ruby
threads.each do |t|
  begin; t.join; rescue ActiveRecord::RecordNotUnique => e ; end
end
```
o usar `Review.create!` y recolectar errores explícitamente, asertando que a lo sumo 1 insert del mismo usuario tuvo éxito.

---

## 5. Redundancia `includes(:book).joins(:book)` (resuelto en parte)

**Estado:** `[🟡 bajo prioridad]`

**Detalle:** en `app/services/ban_impact_analyzer.rb:9` se combina `reviews.includes(:book).joins(:book)`. `joins` ya carga los libros; `includes` es redundante y puede impedir el eager-load efectivo al combinarse.

**Cómo resolverlo:** usar solo `reviews.joins(:book).includes(:book)` (eager + inner join) o directamente `reviews.includes(:book)`. Es cosmético; no afecta resultados.

---

## 6. Configuración manual de GitHub (no automatizable)

**Estado:** `[📌 decisión tomada]`

**Detalle:** la protección de `main` y el default `RUBY_VERSION: 3.1.2` (via `vars.RUBY_VERSION` en `ci.yml`) dependen de configuración en GitHub (branch protection rules, repository variables). No se puede commitear.

**Cómo resolverlo:** documentado en `AGENTS.md` (pasos de Settings → Branches). Si querés Rails más nuevo (p.ej. 7.2, el de la app), setear `vars.RUBY_VERSION` en el repo a la versión real del proyecto; ver `ci.yml:16`.

---

## 7. Demo: libro de 500k reseñas no se genera desde la UI

**Estado:** `[📌 decisión tomada]`

**Detalle:** el benchmark de 500k (`db:seed:large_scale`) se corre por CLI; la UI del demo no lo dispara.

**Cómo resolverlo:** no es un bug, es una decisión. Si se quisiera: un job/rake invocable desde la UI **solo en dev**, o un endpoint con flag de entorno que corra el batch de forma asíncrona. Requiere evaluación de tiempo de ejecución.

---

## 8. Reset de BD desde la UI

**Estado:** `[📌 decisión tomada]`

**Detalle:** no se implementó un endpoint de reset porque PostgreSQL rechaza `DROP` mientras el server mantiene conexión. Se resuelve vía `npm run db:reset` (→ `bin/rails db:reset_demo`, dev/test-only). Ver `DECISIONES.md`. **Nota (28/08/2026):** con el backend en WSL, `db:reset` de la demo corre `bin/rails db:reset_demo` dentro de WSL (ver `frontend/package.json`, commit `02333ea`).

**Cómo resolverlo (si se quisiera desde UI):** endpoint que cierre conexiones activas y ejecute el reset con `pg_terminate_backend`, limitado estrictamente a `Rails.env.development?` y protegido. Riesgo operativo alto; no recomendado.

---

## 9. Métricas "Que no se vuelva a repetir" (no implementadas)

**Estado:** `[⏳ pendiente]`

**Detalle:** en `PRODUCTO.md`/`PLAN.md` se definieron 3 métricas pero no se implementaron:
1. **Reviews/min por libro** — alerta si >50 en 1 hora → Moderación
2. **Average delta por libro** — alerta si cambia >1.0 en 24h → Moderación
3. **Ratio banned/total reviewers** — alerta si >5% en 7 días → Growth

**Cómo resolverlo:** un servicio `AnomalyWatcher`/`AlertingService` que corra por rake/scheduled job y compare contra la base. Datos disponibles: `Reviews` por `created_at`, `ModerationNotification.previous_average`/`new_average`, y conteo de baneados.

---

## 10. FraudDetector: anomalía de autor no expuesta

**Estado:** `[🟡 bajo prioridad]`

**Detalle:** `FraudDetector.detect_author_anomaly` existe como clase-método pero no está conectada a ninguna query/mutation GraphQL ni a un job con scheduler.

**Cómo resolverlo:** exponer query `fraudAuthorAnomaly(authorName: String!): FraudResult` en el schema **y en la demo** (decisión tomada 28/08/2026: visible en la UI), conectando `FraudDetector.detect_author_anomaly`. Ver `app/services/fraud_detector.rb:50`.

---

## 11. Notificación al autor con IA (opcional)

**Estado:** `[🟡 bajo prioridad]`

**Detalle:** `PRODUCTO.md` define texto estático (más barato y confiable). La opción de generar el texto con Gemini free quedó como futuro opcional.

**Cómo resolverlo:** servicio `NotificationCopyGenerator` que reciba `{title, previous_average, new_average}` y genere texto vía API de Gemini; fallback al texto estático si la API no responde.

---

## 12. Redondeo half-up en specs (🛠️ resuelto)

**Estado:** `[✅ resuelto]` — commit `35be83e`

Los specs `3.35` y `2.249` en `spec/models/review_spec.rb` estaban vacíos (sin assertions). Se reemplazaron por casos deterministas: `3.25→3.3` (half-up), `3.35→3.4` (arriba), `2.24→2.2` (abajo).

---

## 13. `display_average` tipo GraphQL (🛠️ resuelto)

**Estado:** `[✅ resuelto]` — commit `042860a`

El campo `display_average` estaba tipado `String` pero devolvía un `Float`/`"Insuficientes"`. Se cambió a `GraphQL::Types::JSON`.

---

## Cambios que requieren migración

| Cambio | ¿Migración? | Relacionado con |
|--------|-------------|-----------------|
| Guardar `reviews_sum` / stats exactas en `books` | Sí | Punto 2 (precisión del preview) |
| Alertas/Scheduler para métricas | No (solo servicio/job) | Punto 9 |
| Endpoint reset desde UI | Sí (flag/env) | Punto 8 |

Si se agrega una migración, **regenerar y commitear `db/schema.rb`** (regla de `AGENTS.md`).
