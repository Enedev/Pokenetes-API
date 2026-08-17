# Pokenetes

API REST en **Node.js + Fastify + TypeScript** para gestionar Pokémon, entrenadores y batallas. Usa **Supabase** como base de datos, con un entorno de pruebas (`dev`) y uno de producción (`main`).

- Test: https://pokenetes-api-test.onrender.com
- Producción: https://pokenetes-api-prod.onrender.com

---

## Entornos y ramas

| Rama | Entorno | Coverage mínimo |
|---|---|---|
| `dev` | Test / staging | ≥ 60% |
| `main` | Producción | ≥ 85% |

Flujo: trabajas en `dev` → el pipeline de test valida el código → cuando está estable, mergeas `dev` en `main` → el pipeline de prod valida de nuevo.

Los umbrales de cobertura se cambian en un solo archivo: [`coverage-gates.json`](./coverage-gates.json) (`test` = 60, `prod` = 85).

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

Cada entidad expone todos estos verbos: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `QUERY`.

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/` | Índice de la API |
| `GET` | `/health` | Health check |
| `GET` | `/pokemon` `/entrenador` `/batalla` | Listar |
| `GET` | `/pokemon/:id` (igual para las otras) | Obtener uno |
| `POST` | `/pokemon` `/entrenador` `/batalla` | Crear |
| `PUT` | `/pokemon/:id` | Reemplazo completo |
| `PATCH` | `/pokemon/:id` | Actualización parcial |
| `DELETE` | `/pokemon/:id` | Eliminar |
| `HEAD` | `/pokemon` y `/pokemon/:id` | Igual que GET, sin body |
| `QUERY` | `/pokemon` `/entrenador` `/batalla` | Consulta RFC 9324 |
| `QUERY` | `/query` | Consulta genérica (`entity` + `limit`) |

`HEAD` lo genera Fastify a partir de cada `GET`. `QUERY` en Render/Cloudflare puede devolver `405`; en local funciona.

### Ejemplos

```bash
curl http://localhost:3000/health

curl -X POST http://localhost:3000/pokemon \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Pikachu","tipo":"Electrico","nivel":5}'

curl http://localhost:3000/pokemon
curl http://localhost:3000/pokemon/UUID

curl -X PUT http://localhost:3000/pokemon/UUID \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Pikachu","tipo":"Electrico","nivel":10}'

curl -X PATCH http://localhost:3000/pokemon/UUID \
  -H "Content-Type: application/json" \
  -d '{"nivel":8}'

curl -X DELETE http://localhost:3000/pokemon/UUID
curl -I http://localhost:3000/pokemon

curl -X QUERY http://localhost:3000/pokemon \
  -H "Content-Type: application/json" \
  -d '{"limit":5}'
```

Cuerpos de las otras entidades:

```json
{ "nombre": "Ash", "region": "Kanto" }
```

```json
{ "pokemon_id": "UUID-POKEMON", "entrenador_id": "UUID-ENTRENADOR", "resultado": "victoria" }
```

---

## Base de datos

Tablas permitidas: `pokemon`, `entrenador`, `batalla`.

Si las tablas no existen, el arranque falla. Créalas en el SQL Editor de cada proyecto Supabase (test y prod). El DDL está en `src/db/schemas/`.

Si configuras `DATABASE_URL`, la app aplica el DDL sola al iniciar.

---

## GitHub Actions (CI/CD)

Hay **dos pipelines independientes**. No se ejecutan en tu PC: corren en los servidores de GitHub.

| Archivo | Nombre en GitHub | Se dispara cuando | Coverage |
|---|---|---|---|
| `.github/workflows/test-pipeline.yml` | **Test Environment Pipeline** | Push o PR a `dev`, o corrida manual | ≥ 60% |
| `.github/workflows/prod-pipeline.yml` | **Production Environment Pipeline** | Push a `main`, o corrida manual | ≥ 85% |

Cada corrida hace: instalar → build → tests → coverage.

### Cómo se ejecutan solos (lo normal)

1. `git push origin dev` → pipeline de **test**.
2. `git push origin main` (o merge `dev` → `main`) → pipeline de **prod**.
3. Un Pull Request hacia `dev` → pipeline de test (solo valida).

No tienes que pulsar nada: GitHub detecta el push y lanza el workflow.

### Cómo ver si pasó o falló

1. Entra al repo: https://github.com/Enedev/Pokenetes
2. Pestaña **Actions**.
3. A la izquierda ves los dos workflows.
4. Al centro, el historial (verde = OK, rojo = falló, amarillo = en curso).
5. Entra a una corrida para ver cada paso.

También aparece un check al lado de cada commit.

### Cómo ejecutarlo manualmente

Sirve para revalidar **sin un commit nuevo**.

1. Repo → **Actions**.
2. Elige el workflow:
   - `Test Environment Pipeline` (test)
   - `Production Environment Pipeline` (prod)
3. Arriba a la derecha: **Run workflow**.
4. Rama: `dev` para test, `main` para prod.
5. Pulsa **Run workflow**.

### Desde la terminal

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
