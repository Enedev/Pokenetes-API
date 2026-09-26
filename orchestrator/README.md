# Pokenetes Orchestrator

Artefacto aparte de la API. Coordina el flujo multicloud de Seguimiento #2: AWS (Pokenetes) → OCI (biblio-express) → Azure (Hospitaline). Propaga `x-trace-id`.

## Correr en local

La API Pokenetes debe estar en el puerto 3000 si quieres el paso AWS de verdad.

```bash
cd orchestrator
npm install
npm run dev
```

```bash
curl -X POST http://localhost:3001/api/v2/flujo ^
  -H "Content-Type: application/json" ^
  -d "{\"entity\":\"pokemon\"}"
```

Si biblio u Hospitaline todavía no tienen URL en Oracle/Azure, esos pasos salen `skipped`. No se fabrican JSON.

## Endpoints

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/health` | Health |
| `POST` | `/api/v2/flujo` | Arranca el saga (`entity`: pokemon / entrenador / batalla) |
| `GET` | `/api/v2/flujo/:traceId` | Estado del mensaje |
| `GET` | `/api/v2/flujo` | Lista en memoria |

## Variables

| Variable | Default | Notas |
|---|---|---|
| `ORCHESTRATOR_PORT` | `3001` | Puerto del orquestador |
| `POKENETES_API_URL` | `http://127.0.0.1:3000` | Tu API en AWS (hoy local o Render) |
| `BIBLIO_API_URL` | vacía | URL pública OCI cuando Phol la tenga |
| `HOSPITALINE_API_URL` | vacía | URL pública Azure cuando Dhani la tenga |
| `AWS_SQS_QUEUE_URL` | vacía | En EKS: `pokenetes-flujo`. Vacío = cola en memoria (local/tests) |

## Docker

```bash
docker build -t pokenetes-orchestrator -f orchestrator/Dockerfile orchestrator
docker run --rm -p 3001:3001 -e POKENETES_API_URL=http://host.docker.internal:3000 pokenetes-orchestrator
```

El pipeline `Orchestrator Pipeline` instala, compila y hace `docker build` de esta imagen.

## AWS

SQS `pokenetes-flujo` + DLQ `pokenetes-flujo-dlq`. `POST /api/v2/flujo` encola el mensaje; un worker del mismo pod lo consume y corre el saga. Con cola, el POST vuelve `202 pending`: consulta `GET /api/v2/flujo/:traceId`.

La entrada pública del diagrama es API Gateway (HTTPS), no el Load Balancer a pelo:

```powershell
.\scripts\aws-api-gateway-test.ps1
```

Eso crea `pokenetes-orchestrator` en API Gateway HTTP API, región `us-east-1`, stage `test`:

- TLS: la URL es `https://....execute-api.us-east-1.amazonaws.com`
- Rate limit: 10 req/s, ráfaga 20
- `x-trace-id`: se reenvía al orquestador; si no viene, el orquestador genera uno y lo devuelve en el JSON y en el header `x-trace-id`
