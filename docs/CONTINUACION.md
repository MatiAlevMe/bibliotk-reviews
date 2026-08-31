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

### Fase C — Fixes de código completados (✅ resuelto)

1. **#2 + #3 — Precisión del ban preview + spec de equivalencia** (`ad25155`):
   - Migración: `AddReviewsSumAndCountRawToBooks` añade `reviews_sum` y `reviews_count_raw` a `books`. `Book#recalculate!` los mantiene en `update_columns`. `db/schema.rb` regenerado y commiteado.
   - `BanImpactAnalyzer#analyze` usa `reviews_sum` exacto.
   - Spec de equivalencia añadido en `ban_impact_analyzer_spec.rb` comparando con banear y recalcular real.
2. **#5 — Redundancia `includes(:book).joins(:book)`** (`f0e7150`): simplificado a `reviews.includes(:book)`.
3. **#4 — Concurrencia**: `spec/models/concurrency_spec.rb` (`b2e3e47`): rescata `ActiveRecord::RecordNotUnique` en los threads para evitar excepciones no controladas por el índice único concurrente.
4. **#10 — `fraudAuthorAnomaly`** (`c764353`): expuesta query GraphQL `fraudAuthorAnomaly(authorName: String!)` con `Types::FraudAuthorAnomalyType`, integrado en `frontend/src/api.ts`, vista de moderación y spec de request.
5. **#9 — 3 métricas de anomalías** (`7229545`): servicio `AnomalyWatcher`, rake task `metrics:scan` y suite de specs.

Cada hito ejecutado con un commit atómico, con `rspec` (55 examples, 0 failures) y `rubocop` (0 offenses).

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
 
**Estado:** `[✅ resuelto]` — commit `ad25155`
 
**Bug/limitación:** `BanImpactAnalyzer#analyze` reconstruye el total desde `cached_average`, que ya está **redondeado a 1 decimal**. Por eso el promedio proyectado puede desviarse ±0.1 respecto al resultado real de banear y recalcular.
 
---
 
## 3. Spec del ban preview no verifica equivalencia
 
**Estado:** `[✅ resuelto]` — commit `ad25155`
 
**Brecha:** el brief exige *"Ban preview: resultado coincide con banear y recalcular"*. Se agregó spec en `spec/services/ban_impact_analyzer_spec.rb` que valida que `projected_average` coincide con `user.ban!` y `recalculate!`.
 
---
 
## 4. Ruido en el spec de concurrencia
 
**Estado:** `[✅ resuelto]` — commit `b2e3e47`
 
**Detalle:** `spec/models/concurrency_spec.rb` rescata `ActiveRecord::RecordNotUnique` y `ActiveRecord::RecordInvalid` de manera explícita y limpia.
 
---
 
## 5. Redundancia `includes(:book).joins(:book)`
 
**Estado:** `[✅ resuelto]` — commit `f0e7150`
 
**Detalle:** en `app/services/ban_impact_analyzer.rb` se simplificó a `reviews.includes(:book)`.
 
---
 
## 6. Configuración manual de GitHub (no automatizable)
 
**Estado:** `[📌 decisión tomada]`
 
---
 
## 7. Demo: libro de 500k reseñas no se genera desde la UI
 
**Estado:** `[📌 decisión tomada]`
 
---
 
## 8. Reset de BD desde la UI
 
**Estado:** `[📌 decisión tomada]`
 
---
 
## 9. Métricas "Que no se vuelva a repetir"
 
**Estado:** `[✅ resuelto]` — commit `7229545`
 
**Detalle:** Implementado servicio `AnomalyWatcher` y rake `metrics:scan` para los 3 monitoreos (reviews/min >50 en 1h, average delta >1.0 en 24h, y ratio de baneados >5% en 7 días).
 
---
 
## 10. FraudDetector: anomalía de autor expuesta
 
**Estado:** `[✅ resuelto]` — commit `c764353`
 
**Detalle:** Query `fraudAuthorAnomaly(authorName: String!)` expuesta en `Types::QueryType`, soportada en el frontend demo (vista Moderación) y con tests en RSpec.

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

---

## 14. Fallo Brakeman EOLRails en CI

**Estado:** `[✅ resuelto]`

**Detalle:** Rails 7.2.3.2 activaba advertencia de ciclo de vida en Brakeman 8.0. Se configuró `config/brakeman.ignore` con el fingerprint SHA-256 exacto y se actualizó `.github/workflows/ci.yml` para usar `-i config/brakeman.ignore`.

---

## 15. Aislamiento de datos en AnomalyWatcher specs

**Estado:** `[✅ resuelto]`

**Detalle:** El job `test` en CI ejecuta `db:seed` antes de `rspec`. Se añadió limpieza en `spec/services/anomaly_watcher_spec.rb` para garantizar que las métricas basadas en tiempo no sean afectadas por datos residuales del seed.

---

## 16. Deploy en Vercel del Frontend DEMO

**Estado:** `[✅ resuelto]`

**Detalle:** Se agregó `frontend/vercel.json` con rewrite de SPA y soporte en `frontend/src/api.ts` para la variable de entorno `VITE_GRAPHQL_ENDPOINT`.

---

## Cambios que requieren migración

| Cambio | ¿Migración? | Relacionado con |
|--------|-------------|-----------------|
| Guardar `reviews_sum` / stats exactas en `books` | Sí | Punto 2 (precisión del preview) |
| Alertas/Scheduler para métricas | No (solo servicio/job) | Punto 9 |
| Endpoint reset desde UI | Sí (flag/env) | Punto 8 |

Si se agrega una migración, **regenerar y commitear `db/schema.rb`** (regla de `AGENTS.md`).
