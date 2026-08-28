# STACK.md — Stack tecnológico

Catálogo completo del stack de **Bibliotk Reviews** (backend + frontend demo + CI/CD + tooling).

## Backend (API GraphQL)

| Capa | Tecnología | Versión | Propósito |
|------|-----------|---------|-----------|
| Lenguaje | Ruby | 3.1.2 (`.ruby-version`) | Runtime |
| Framework | Rails | 7.2 (API-only) | Servidor de la API |
| Base de datos | PostgreSQL | 16+ | Persistencia, transacciones, `SELECT FOR UPDATE` |
| API | GraphQL (gem `graphql`) | ~2.6 | Contrato de queries/mutations |
| ORM | ActiveRecord | (Rails) | Modelos y migraciones |

### Gems clave
| Gem | Uso |
|-----|-----|
| `pg` | Driver PostgreSQL |
| `puma` | Servidor web |
| `rack-cors` | CORS (abierto `*` para el demo) |
| `bootsnap` | Acelera el boot |
| `tzinfo-data` | Zonas horarias |

### Grupo :development, :test
| Gem | Uso |
|-----|-----|
| `debug` | Debugging (byebug/prelude) |
| `rspec-rails` | Testing |
| `factory_bot_rails` | Fábricas para specs |
| `faker` | Datos aleatorios en seeds/specs |
| `shoulda-matchers` | Matchers de testing de Rails |
| `brakeman` | Análisis estático de seguridad (CI `scan_ruby`) |
| `rubocop-rails-omakase` | Estilo / lint (CI `lint`) |

## Frontend DEMO (SPA estático)

| Capa | Tecnología | Versión | Propósito |
|------|-----------|---------|-----------|
| Bundler / dev server | Vite | 5.x | Dev server + build + proxy `/graphql` → :3000 |
| Lenguaje | TypeScript | 5.x | Tipado con `tsc --noEmit` |
| Testing | Vitest | 2.x | Tests unitarios de helpers/estado |
| Cliente HTTP | fetch (vanilla) | — | Consume `POST /graphql` |

El demo queda en `frontend/`, es **100% estático** (no toca el stack Rails) y se comunica con el backend GraphQL por HTTP. El proxy de Vite evita CORS en dev.

## CI/CD (GitHub Actions)

| Job | Tecnología | Servicio | Qué corre |
|-----|-----------|----------|-----------|
| `scan_ruby` | brakeman | — | Análisis de seguridad estático |
| `lint` | rubocop | — | `bin/rubocop -f github` |
| `test` | rspec | PostgreSQL 16 (contenedor) | `db:create`, `db:schema:load`, `db:seed`, `rspec` |
| `frontend` | node/npm | — | `npm ci`, `tsc --noEmit`, `vitest` |

**BD determinística en CI:** el job `test` crea la base desde cero en **cada ejecución** (`db:create` + `db:schema:load` + `db:seed`). Así, una prueba que borra datos no contamina la ejecución siguiente: cada run arranca del estado de fábrica del seed.

### Dependabot
`bundler` y `github-actions` con check diario y límite de 10 PRs abiertos.

## Rake tasks (background / benchmarking)

| Task | Propósito |
|------|-----------|
| `db:seed` | Seed determinístico: admin, autores, 10 libros, 50 lectores, reseñas |
| `db:seed:large_scale` | Libro con 500.000 reseñas (benchmark, bulk insert) |
| `db:seed:recalculate_all` | Recalcula todos los `cached_average` desde cero (backfill/insurance) |
| `db:reset_demo` | Drop + create + migrate + seed. **Solo dev/test** (aborta en producción) |

## Estructura del repo

```
bibliotk-reviews/
├── app/
│   ├── graphql/          # Schema, types, queries, mutations
│   ├── models/           # User, Book, Review, BanAuditLog, ModerationNotification
│   ├── services/         # BanImpactAnalyzer, FraudDetector
│   └── controllers/      # GraphQL controller
├── spec/                 # RSpec (modelos, servicios, concurrencia)
├── frontend/             # Demo SPA (Vite + TypeScript + Vitest)
├── docs/                 # PLAN, STACK, STRUCTURE, PRUEBAS, brief PDF
├── lib/tasks/            # Rake tasks de seed y reset
├── .github/workflows/    # CI
├── AGENTS.md             # Convenciones operativas para agentes/colaboradores
├── DECISIONES.md         # Trade-offs y decisiones
├── PRODUCTO.md           # Respuestas de producto a los 5 pains
└── README.md             # Setup y uso
```

## Ambientes

| Ambiente | Dónde | BD | Reset a fábrica | Demo |
|----------|-------|----|------------------|------|
| `development` | tu máquina (`localhost:3000`) | `bibliotk_reviews_development` | ✅ `bin/rails db:reset_demo` | ✅ |
| `test` (CI/CD) | GitHub Actions, por ejecución | efímera, se recrea cada run | ✅ automático | ❌ |
| `production` | deploy futuro | `bibliotk_reviews_production` | ❌ | ❌ |

La demo vive **solo** en development. No hay "switch de ambiente" desde la demo; siempre apunta a `localhost:3000`.
