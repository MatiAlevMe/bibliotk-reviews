# AGENTS.md

Documento maestro de convenciones operativas para agentes y colaboradores de **Bibliotk Reviews**.

> Complementa a `docs/STACK.md` (qué tecnologías), `docs/STRUCTURE.md` (dónde está cada cosa) y `docs/PLAN.md` (el plan).

## Repo & local

- **Rama principal:** `main`. Se trabaja sobre `main` con commits atómicos. No se pushea directamente a `main` si está protegida sin PR.
- **Idioma de commits:** imperativo en inglés, corto y descriptivo, con un alcance claro (ej: `ci:`, `feat(frontend):`, `fix:`).
- **Un commit por cada actualización de código importante.** No se amontonan cambios sin relación en un mismo commit.
- CORS está abierto (`*`) a propósito para el demo.

## Comandos

```bash
# Backend (en WSL)
bundle install
bin/rails db:create db:migrate
bin/rails db:seed
bin/rails db:reset_demo          # dev/test solamente (aborta en producción)
bin/rails db:seed:large_scale    # benchmark 500k reviews
bin/rails db:seed:recalculate_all
bin/rake metrics:scan            # escaneo de anomalías y métricas

# Tests / lint / security
bundle exec rspec
bin/rubocop -f github
bin/brakeman --no-pager

# Frontend demo (en Windows o WSL)
cd frontend
npm install
npm run dev          # dev server con proxy a :3000
npm run typecheck    # tsc --noEmit
npm test             # vitest
npm run db:reset     # ejecuta bin/rails db:reset_demo en WSL
```

## Reglas importantes

1. **`db:reset_demo` es dev/test-only.** Nunca se ejecuta en producción. El código aborta si `Rails.env.production?`.
2. **Los tests de CI arrancan con BD de fábrica en cada ejecución** (job `test`: `db:create` + `db:schema:load` + `db:seed`). Una prueba que borra datos no contamina la siguiente corrida.
3. **Promedios:** el promedio se recalculó vía `Book#recalculate!` dentro de la misma transacción del review (con `SELECT ... FOR UPDATE`) para consistencia bajo concurrencia. No romper ese invariante.
4. **Reseñas de usuarios baneados:** quedan `hidden: true`, nunca se borran. Los queries públicos filtras `hidden: false`.
5. **Agregar/editar una migración** → siempre regenerar y commitear `db/schema.rb`.
6. **Frontend:** TS estricto. Antes de commitear tocar el demo, correr `npm run typecheck` y `npm test`.
7. **Escritura de GraphQL:** mantener tipado en `frontend/src/api.ts` acorde al schema.

## Git / GitHub

### Proteger `main` (GitHub)

Settings → Branches → Add rule:

- Branch name pattern: `main`
- ☑ Require a pull request before merging (1 approved review, opcional según criterio)
- ☑ Require status checks to pass before merging
  - Marcar: `test`, `lint`, `scan_ruby`, `frontend`
- ☑ Require branches to be up to date before merging
- ☑ Do not allow bypassing the above settings
- ☑ Block force pushes
- ☑ Require conversation resolution before merging

### Findings

Si durante una revisión se detecta algo (bug, PV, deuda) que no se va a arreglar ya:

1. Anotarlo en `docs/PLAN.md` en la sección de hitos como **Finding / Pendiente**.
2. Si es una decisión de producto, registrarlo en `DECISIONES.md` o `PRODUCTO.md`.

## Normas de código

- Ruby: seguir el estilo omakase (`.rubocop.yml`). Sin comentarios salvo que aporten contexto.
- TypeScript: `strict: true`, `noUnusedLocals`, `noUnusedParameters`.
- No commitear secretos ni keys. Variables de entorno via env (ver `DATABASE_URL`, `.env` local).
