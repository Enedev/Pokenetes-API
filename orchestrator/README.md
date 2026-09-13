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
| `AWS_SQS_QUEUE_URL` | vacía | Se usa cuando exista la cola en AWS |

## Docker

```bash
docker build -t pokenetes-orchestrator -f orchestrator/Dockerfile orchestrator
docker run --rm -p 3001:3001 -e POKENETES_API_URL=http://host.docker.internal:3000 pokenetes-orchestrator
```

El pipeline `Orchestrator Pipeline` instala, compila y hace `docker build` de esta imagen.

## AWS

La cuenta y los clics de consola no van en este archivo. El orquestador se publica luego en ECS Fargate; la cola será SQS + DLQ.
