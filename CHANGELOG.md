# Changelog

## 2.2.0 - 2026-10-27

Línea base estable del canary. El contrato de `api/v2` no cambia.

- Cabeceras `X-App-Version`, `X-App-Track` y `X-Api-Version` en todas las respuestas. `/health` incluye `app_version` y `track`.
- Rutas públicas sin versión (`/api/{entidad}`). En esta versión sirven `api/v2`.
- `api/v2` devuelve solo sus columnas de `pokemon`, aunque el esquema crezca.
- Métricas EMF de CloudWatch por track: peticiones, latencia, errores 4xx/5xx, CPU y memoria del proceso, y `PokemonCreated`.

## Unreleased (hacia 2.0.0)

El tag `v2.0.0` se crea **al cerrar** Seguimiento #2 (orquestador, AWS, cola, peers en OCI/Azure y observabilidad).

- Prefijo `/api/v2`. `GET /api/v2/{entidad}/last` solo devuelve el registro local. `GET /api/v2/{entidad}/:id` arma los 3 objetos (`local` + last de las otras nubes).
- MS orquestador (`orchestrator/`) con `POST /api/v2/flujo`.

## 1.0.0 - 2026-09-13

Tag `v1.0.0` en el último commit de Seguimiento #1 (API REST, Docker, pipelines, coverage).
