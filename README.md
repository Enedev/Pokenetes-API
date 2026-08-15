# Pokenetes

API REST en **Node.js + Fastify + TypeScript** para gestionar Pokémon, entrenadores y batallas. Usa **Supabase** como base de datos y se despliega en **Render**, con un entorno de pruebas (`dev`) y uno de producción (`main`).

- Test: https://pokenetes-api-test.onrender.com
- Producción: https://pokenetes-api-prod.onrender.com

La guía detallada de Render está en [`RENDER_SETUP.md`](./RENDER_SETUP.md).

---

## Entornos y ramas

| Rama | Entorno | Base de datos | Servicio Render | Coverage mínimo |
|---|---|---|---|---|
| `dev` | Test / staging | Supabase test | `pokenetes-api-test` | ≥ 60% |
| `main` | Producción | Supabase prod | `pokenetes-api-prod` | ≥ 85% |

Flujo de trabajo: desarrollas en `dev` → el pipeline de test valida y despliega a Render test → cuando está estable, mergeas `dev` en `main` → el pipeline de prod valida y despliega a Render prod.

---

## Requisitos locales

- Node.js 22+
- npm
- Archivos `.env.test` y/o `.env.prod` (copia desde los `.example`)

```bash
cp .env.test.example .env.test
cp .env.prod.example .env.prod
```

Variables necesarias:

```
PORT=3000
NODE_ENV=test
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
SUPABASE_JWKS_URL=...
DATABASE_URL=...   # opcional; si existe, crea las tablas al arrancar
```

---

## Cómo correr el proyecto

```bash
npm install
npm run dev          # desarrollo con recarga
npm run build        # compila TypeScript a dist/
npm start            # arranca dist/index.js
npm test             # tests
npm run test:coverage
```

Con Docker (usa `.env.test`):

```bash
docker compose up --build
```

---

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/` | Índice de la API |
| `GET` | `/health` | Health check |
| `POST` | `/pokemon` | Crear Pokémon |
| `POST` | `/entrenador` | Crear entrenador |
| `POST` | `/batalla` | Crear batalla |
| `QUERY` | `/query` | Consultar registros (RFC 9324) |

### Ejemplos

Health:

```bash
curl https://pokenetes-api-test.onrender.com/health
```

Crear Pokémon:

```bash
curl -X POST https://pokenetes-api-test.onrender.com/pokemon \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Pikachu","tipo":"Electrico","nivel":5}'
```

Crear entrenador:

```bash
curl -X POST https://pokenetes-api-test.onrender.com/entrenador \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Ash","region":"Kanto"}'
```

Crear batalla (usa los `id` que devolvieron los POST anteriores):

```bash
curl -X POST https://pokenetes-api-test.onrender.com/batalla \
  -H "Content-Type: application/json" \
  -d '{"pokemon_id":"UUID-POKEMON","entrenador_id":"UUID-ENTRENADOR","resultado":"victoria"}'
```

QUERY (en local; en Render el proxy suele devolver `405`):

```bash
curl -X QUERY http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{"entity":"pokemon","limit":5}'
```

`entity` puede ser `pokemon`, `entrenador` o `batalla`.

---

## Base de datos

Tablas permitidas: `pokemon`, `entrenador`, `batalla`.

Si las tablas no existen, el arranque falla. Créalas en el SQL Editor de cada proyecto Supabase (test y prod). El SQL está en `src/db/schemas/` y también en `RENDER_SETUP.md`.

Si configuras `DATABASE_URL` en Render, la app aplica el DDL sola al iniciar.

---

## GitHub Actions (CI/CD)

Hay **dos pipelines independientes**. No se “ejecutan desde tu PC”: corren en los servidores de GitHub.

| Archivo | Nombre en GitHub | Se dispara cuando | Coverage | Despliega a |
|---|---|---|---|---|
| `.github/workflows/test-pipeline.yml` | **Test Environment Pipeline** | Push o PR a `dev`, o corrida manual | ≥ 60% | Render test |
| `.github/workflows/prod-pipeline.yml` | **Production Environment Pipeline** | Push a `main`, o corrida manual | ≥ 85% | Render prod |

Cada corrida hace: instalar → build → tests → coverage → (si pasó) Deploy Hook de Render.

### Cómo se ejecutan solos (lo normal)

1. Haces `git push origin dev` → corre el pipeline de **test**.
2. Haces `git push origin main` (o mergeas `dev` → `main`) → corre el pipeline de **prod**.
3. Abres un Pull Request hacia `dev` → corre el de test, **sin desplegar** (solo valida).

No tienes que pulsar nada: GitHub detecta el push y lanza el workflow.

### Cómo ver si pasó o falló

1. Entra al repo: https://github.com/Enedev/Pokenetes
2. Pestaña **Actions** (arriba).
3. A la izquierda ves los dos workflows.
4. Al centro, el historial de corridas (verde = OK, rojo = falló, amarillo = en curso).
5. Entra a una corrida para ver cada paso (Install, Build, Test, Coverage, Deploy).

También aparece un check al lado de cada commit.

### Cómo ejecutarlo manualmente

Sirve para volver a desplegar o revalidar **sin hacer un commit nuevo**.

1. Repo → **Actions**.
2. En la barra izquierda elige el workflow:
   - `Test Environment Pipeline` (test)
   - `Production Environment Pipeline` (prod)
3. Arriba a la derecha: **Run workflow**.
4. Elige la rama:
   - Test → `dev`
   - Prod → `main`
5. Pulsa **Run workflow**.
6. Recarga la lista; aparece una corrida nueva con evento `workflow_dispatch`.

El deploy a Render **solo ocurre** si la rama coincide (`dev` para test, `main` para prod) y los tests/coverage pasan.

### Secrets que necesita

En el repo: **Settings → Secrets and variables → Actions**:

| Secret | Para qué |
|---|---|
| `RENDER_TEST_DEPLOY_HOOK` | URL del Deploy Hook del servicio test |
| `RENDER_PROD_DEPLOY_HOOK` | URL del Deploy Hook del servicio prod |

Si faltan, el job de tests puede pasar y el de Deploy fallar.

### Si quieres dispararlo desde la terminal

Con [GitHub CLI](https://cli.github.com/):

```bash
gh workflow run "Test Environment Pipeline" --ref dev
gh workflow run "Production Environment Pipeline" --ref main
```

Ver corridas:

```bash
gh run list
gh run watch
```

---

## Estructura

```
src/
  index.ts              Entrada del servidor
  app.ts                Fastify + rutas
  config/env.ts         Carga .env.test o .env.prod
  db/client.ts          Cliente Supabase
  db/migrate.ts         Migraciones / verificación de tablas
  db/schemas/           DDL de pokemon, entrenador, batalla
  routes/               POST y QUERY
tests/                  Vitest
.github/workflows/      CI/CD
```
