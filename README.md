# Pokenetes

API REST en **Node.js + Fastify + TypeScript** para gestionar Pokémon, entrenadores y batallas. En AWS los datos viven en **RDS Postgres**. Versión actual: **2.0.0** (`/api/v2`).

- Test: https://pokenetes-api-test.onrender.com
- Producción: https://pokenetes-api-prod.onrender.com

## Quién opera cada nube

| Integrante | Nube | Qué opera |
|---|---|---|
| Neithan (Enedev) | AWS | API Pokenetes en EKS, orquestador, SQS + DLQ, API Gateway, Secrets Manager, RDS Postgres, CloudWatch |
| Phol (PholCast) | Azure | API biblio-express. Pokenetes consume `books` |
| Dhani (Dhani-dev) | GCP | API Hospitaline. Pokenetes consume `hospitals` |

El tablero compartido es Grafana Cloud.

## Arquitectura en AWS

Neithan opera esta nube. Phol opera Azure y Dhani opera GCP; el diagrama completo de las tres se arma aparte.

```mermaid
flowchart TD
    subgraph acceso [Acceso]
        postman[Postman]
        apigw[API Gateway]
        elb[Elastic Load Balancing]
    end
    subgraph computo [Computo]
        ecr[ECR]
        eks[EKS]
        ec2[EC2]
        orchestrator[Orquestador]
        api[API Pokenetes]
    end
    subgraph datos [Datos]
        sqs[SQS y DLQ]
        rds[RDS Postgres]
        secrets[Secrets Manager]
    end
    subgraph observabilidad [Observabilidad]
        otel[OpenTelemetry]
        cloudwatch[CloudWatch]
        grafana[Grafana Cloud]
    end

    postman -->|envia el flujo| apigw
    apigw -->|HTTPS| elb
    elb -->|entra al cluster| eks
    ecr -->|entrega las imagenes| eks
    eks -->|corre en| ec2
    eks -->|pod| orchestrator
    eks -->|pods| api
    orchestrator -->|llama el last| api
    orchestrator -->|encola| sqs
    orchestrator -->|lee secretos| secrets
    api -->|lee secretos| secrets
    api -->|guarda datos| rds
    orchestrator -->|trazas y metricas RED| otel
    api -->|trazas y metricas RED| otel
    otel -->|traceparent| grafana
    orchestrator -->|logs con x-trace-id| cloudwatch
    api -->|logs con x-trace-id| cloudwatch
    cloudwatch -->|logs y metricas de la nube| grafana
```

## Observabilidad de las tres nubes

Cada uno manda trazas con OpenTelemetry al mismo Grafana. Los logs se quedan primero en el monitor de su nube y Grafana los lee desde ahí.

```mermaid
flowchart TD
    subgraph aws [AWS Neithan]
        apiAws[API y orquestador]
        otelAws[OpenTelemetry]
        cw[CloudWatch]
    end
    subgraph azure [Azure Phol]
        apiAz[biblio-express]
        otelAz[OpenTelemetry]
        azmon[Azure Monitor]
    end
    subgraph gcp [GCP Dhani]
        apiGcp[Hospitaline]
        otelGcp[OpenTelemetry]
        gcplog[Cloud Logging]
    end
    grafana[Grafana Cloud]

    apiAws -->|trazas y metricas RED| otelAws
    apiAz -->|trazas y metricas RED| otelAz
    apiGcp -->|trazas y metricas RED| otelGcp
    otelAws -->|traceparent| grafana
    otelAz -->|traceparent| grafana
    otelGcp -->|traceparent| grafana
    apiAws -->|logs con x-trace-id| cw
    apiAz -->|logs con x-trace-id| azmon
    apiGcp -->|logs con x-trace-id| gcplog
    cw -->|logs y metricas| grafana
    azmon -->|logs y metricas| grafana
    gcplog -->|logs y metricas| grafana
```

---

## Entornos y ramas

| Rama | Entorno | Coverage mínimo |
|---|---|---|
| `dev` | Test / staging | ≥ 50% |
| `main` | Producción | ≥ 50% |

Flujo: trabajas en `dev` → el pipeline de test valida el código → cuando está estable, mergeas `dev` en `main` → el pipeline de prod valida de nuevo.

Los umbrales de cobertura se cambian en un solo archivo: [`coverage-gates.json`](./coverage-gates.json) (`test` = 50, `prod` = 50).

---

## Requisitos locales

- Node.js 22+
- npm
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (solo para correr con contenedores)
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
npm run dev                 # desarrollo con recarga
npm run build               # compila TypeScript a dist/
npm start                   # arranca dist/index.js
npm test                    # corre la suite de tests
npm run test:coverage       # coverage con umbral de test (≥ 50%)
npm run test:coverage:prod  # coverage con umbral de producción (≥ 50%)
```

---

## Coverage

Los dos entornos usan **la misma suite de tests**. Lo que cambia es el **mínimo exigido**:

| Entorno | Comando | Umbral | Archivo de config |
|---|---|---|---|
| Test (`dev`) | `npm run test:coverage` | ≥ 50% | `vitest.config.pruebas.ts` |
| Producción (`main`) | `npm run test:coverage:prod` | ≥ 50% | `vitest.config.prod.ts` |

Los umbrales se editan en [`coverage-gates.json`](./coverage-gates.json). Si la cobertura queda por debajo del umbral, el comando falla (en local y en CI).

Generar el reporte e abrirlo:

```bash
npm run test:coverage
# o: npm run test:coverage:prod

# Windows
start coverage/index.html

# macOS
open coverage/index.html

# Linux
xdg-open coverage/index.html
```

El porcentaje también aparece en la terminal (`All files`). El HTML se escribe en `coverage/index.html` (esa carpeta está en `.gitignore`).

---

## Docker

La API y una base Postgres local se levantan juntas con Compose.

| Archivo | Rol |
|---|---|
| `Dockerfile` | Imagen de la API (compila TypeScript y ejecuta `node dist/index.js`) |
| `docker-compose.yml` | Servicio `api` + servicio `db` (Postgres 16) |
| `docker/init.sql` | Crea las tablas `pokemon`, `entrenador` y `batalla` al iniciar Postgres |

Necesitas Docker Desktop en ejecución y un archivo `.env.test` en la raíz (Supabase).

```bash
docker compose up --build
# equivalente: npm run docker:up
```

| Contenedor | Servicio | Puerto |
|---|---|---|
| `pokenetes-api` | Fastify | `3000` |
| `pokenetes-db` | Postgres 16 | `5432` |

Compose inyecta `DATABASE_URL` hacia el servicio `db`. Las operaciones REST usan las credenciales de Supabase de `.env.test`.

```bash
curl http://localhost:3000/health
curl http://localhost:3000/
docker compose ps
docker logs pokenetes-api
```

Detener:

```bash
docker compose down
# equivalente: npm run docker:down
```

`docker compose down -v` elimina también el volumen `pgdata` de Postgres.

En CI, después de tests y coverage, el pipeline construye la misma imagen con `docker build`.

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

Las mismas rutas de negocio existen bajo `/api/v2` (listar, crear, actualizar, borrar). El GET all de v2 **no** mezcla APIs ajenas. El GET by id de v2 **sí** pide el last de las otras nubes.

### GET /api/v2/{entidad}/last

Solo el **último registro local**. Sin `peers`.

```bash
curl http://localhost:3000/api/v2/pokemon/last
```

### GET /api/v2/{entidad}/:id

Uno local (ese id) + last en vivo de biblio-express y Hospitaline. Así salen los 3 objetos.

```bash
curl http://localhost:3000/api/v2/pokemon/UUID
```

```json
{
  "api": "pokenetes",
  "version": "2.0.0",
  "trace_id": "...",
  "entity": "pokemon",
  "local": { "id": "...", "nombre": "Pikachu" },
  "peers": {
    "biblio-express": { "live": true, "entity": "books", "data": { "title": "..." } },
    "hospitaline": { "live": true, "entity": "hospitals", "data": { "name": "..." } }
  }
}
```

APIs compañeras:

- [biblio-express](https://github.com/PholCast/biblio-express) — users, books, loans. Se consume `books` en **Azure**.
- [Hospitaline](https://github.com/Dhani-dev/Hospitaline) — hospitals, doctors, pacientes. Se consume `hospitals` en **GCP**.

Hasta que esas URLs existan, deja `BIBLIO_API_URL` y `HOSPITALINE_API_URL` vacías.

El tag `v1.0.0` marca Seguimiento #1. El tag `v2.0.0` se crea al terminar Seguimiento #2.

## Orquestador

Microservicio en `orchestrator/`. Arranca el saga `POST /api/v2/flujo` (puerto 3001). Guía: [`orchestrator/README.md`](./orchestrator/README.md).

El GET by id de v2 intenta `.../last` del compañero; si aún no existe, usa su listado y toma el último ítem. Configura `BIBLIO_API_URL` y `HOSPITALINE_API_URL` en `.env` o en Secrets Manager. Si un peer falla, `local` sigue saliendo y el peer marca `live: false` (nunca se inventan datos).

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
| `.github/workflows/test-pipeline.yml` | **Test Environment Pipeline** | Push o PR a `dev`, o corrida manual | ≥ 50% |
| `.github/workflows/prod-pipeline.yml` | **Production Environment Pipeline** | Push a `main`, o corrida manual | ≥ 50% |

Cada corrida hace: instalar → build → tests → coverage.

### Cómo se ejecutan solos (lo normal)

1. `git push origin dev` → pipeline de **test**.
2. `git push origin main` (o merge `dev` → `main`) → pipeline de **prod**.
3. Un Pull Request hacia `dev` → pipeline de test (solo valida).

No tienes que pulsar nada: GitHub detecta el push y lanza el workflow.

### Cómo ver si pasó o falló

1. Entra al repo: https://github.com/Enedev/Pokenetes-API
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
  routes/               REST de las 3 entidades + last v2
  integrations/         Cliente HTTP de APIs compañeras
tests/                  Vitest
docker/init.sql         Tablas para Postgres local
Dockerfile              Imagen de la API
docker-compose.yml      API + Postgres
coverage-gates.json     Umbrales 60 (test) / 85 (prod)
.github/workflows/      CI/CD
```
