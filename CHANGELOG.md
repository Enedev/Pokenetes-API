# Changelog

## 2.0.0 - 2026-09-13

- Versionado semántico de la API a `2.0.0`.
- Prefijo `/api/v2` para pokemon, entrenador, batalla y QUERY.
- `GET /api/v2/{entidad}/last` agrega el último registro local y un registro en vivo de biblio-express y Hospitaline.
- Se propaga `x-trace-id` en las llamadas a las APIs compañeras.
- Las rutas v1 (`/pokemon`, `/entrenador`, `/batalla`) se mantienen.

## 1.0.0

- API REST inicial de Seguimiento #1.
