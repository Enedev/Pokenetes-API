# Changelog

## Unreleased (hacia 2.0.0)

El tag `v2.0.0` se crea **al cerrar** Seguimiento #2 (orquestador, AWS, cola, peers en OCI/Azure y observabilidad).

- Prefijo `/api/v2`. `GET /api/v2/{entidad}/last` solo devuelve el registro local. `GET /api/v2/{entidad}/:id` arma los 3 objetos (`local` + last de las otras nubes).
- MS orquestador (`orchestrator/`) con `POST /api/v2/flujo`.

## 1.0.0 - 2026-09-13

Tag `v1.0.0` en el último commit de Seguimiento #1 (API REST, Docker, pipelines, coverage).
