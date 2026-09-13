# Changelog

## Unreleased (hacia 2.0.0)

El tag `v2.0.0` se crea **al cerrar** Seguimiento #2 (orquestador, AWS, cola, peers en OCI/Azure y observabilidad).

- Prefijo `/api/v2` y `GET /api/v2/{entidad}/last`.
- Las URLs de biblio-express (Oracle) y Hospitaline (Azure) se configuran por entorno; si aún no existen, el peer sale `live: false` y no se inventan datos.
- MS orquestador (`orchestrator/`) con `POST /api/v2/flujo`.

## 1.0.0 - 2026-09-13

Tag `v1.0.0` en el último commit de Seguimiento #1 (API REST, Docker, pipelines, coverage).
