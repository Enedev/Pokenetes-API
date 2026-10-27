# Changelog

## 3.0.0 - 2026-10-27

Versión canary. `api/v2` sigue disponible sin cambios, junto a `api/v3`.

- `api/v3/pokemon` acepta un `apodo` opcional (máx. 50 caracteres) y devuelve `nombre_mostrado` (el `apodo` o, si no hay, el `nombre`).
- `api/v3` también sirve `entrenador`, `batalla` y `last`. Las rutas públicas sin versión (`/api/{entidad}`) sirven `api/v3` en esta versión.
- Expand/Contract: al arrancar se agrega `pokemon.apodo` como columna nullable. No se borra ni se renombra nada, así que 2.2.0 y 3.0.0 comparten la misma tabla.
- Inyección de fallas solo en el track canary: cabeceras `x-fault-latency-ms` y `x-fault-error-rate`, variables `FAULT_LATENCY_MS` y `FAULT_ERROR_RATE`, y el endpoint `PUT|GET|DELETE /api/v3/fault`. Los 500 inyectados se devuelven antes de tocar la base de datos.
- Infraestructura canary: ALB con pesos por target group, regla `x-canary: true`, alarmas sobre los SLO de `canary/slo.json`, dashboard stable vs canary y una Lambda que regresa el 100% a stable cuando dispara una alarma.
- Scripts de rollout por etapas (0%, 10%, 50%, 100%) con bake time, carga concurrente y comparación estadística contra el baseline.

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
