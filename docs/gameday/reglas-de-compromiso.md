# Reglas de compromiso — Game day de Caos de Seguridad

**Grupo:** Phol (biblio-express, GCP), Neithan (Pokenetes-API, AWS), Daniela (HospitalineD, GCP/GKE).
**Fecha:** 17 de noviembre de 2026. Este archivo es idéntico en los tres repositorios; cada
integrante lo commitea en el suyo **antes de ejecutar la ronda 0**. La fecha del commit es la
prueba de que el grupo lo aceptó antes de tocar nada.

## Ventana de ejecución (hora Colombia, UTC−5)
La jornada fue continua el 17 de noviembre de 2026. No se usaron las franjas de las 16:00 y las 21:30: cada ronda empezó cuando el grupo lo ordenó.

Horas reales de Neithan:
- Exp. 1 R0: 14:01–14:03.
- Exp. 1 R1: 20:21–20:24.
- Exp. 4 R0: 16:14–16:48.
- Exp. 4 R1: 21:22–21:55.

## Radio de impacto por experimento
- **Exp. 1 (Neithan):** credenciales temporales del rol `pokenetes-api-instance` y lectura del
  secreto `pokenetes/terraform` desde un origen externo. No se modifica ningún recurso.
- **Exp. 2 (Daniela):** un pod efímero `gd-intruder` en el namespace `hospitaline-prod` y claves
  `gd2:*` en Redis. No afecta a los datos del negocio.
- **Exp. 3 (Phol):** exclusión temporal de logs y una política de alerta de biblio-express, más
  libros sintéticos con prefijo `GD3-SYNTH`. El flujo sigue respondiendo.
- **Exp. 4 (grupal):** comprobantes del flujo con prefijo `gd4-` en un bucket del grupo. Nunca se
  toca otro objeto.

## Cuentas y recursos autorizados (solo del grupo)
- GCP `biblio-express-final-2026` (Phol) y `project-39d0c894-3885-4211-89d` (Daniela).
- AWS cuenta `722500516562`, región `us-east-1` (Neithan).
- Queda **prohibido** actuar sobre servicios, cuentas, redes o datos de terceros, de la
  Universidad o de otros grupos. Para "salida a Internet" se usa un endpoint del propio grupo.

## Datos sintéticos
- Exp. 3: libros con título que empieza por `GD3-SYNTH`, borrados al final.
- Exp. 4: comprobantes `gd4-*` generados por el arnés. No hay datos personales reales.

## Interruptor de parada
- Crear el archivo `security-chaos/STOP` o exportar `GAMEDAY_STOP=1`.
- `stop.sh` de cada experimento crea el archivo y ejecuta la reversión de inmediato.
- Cualquier integrante puede accionarlo en su repositorio.

## Plan de reversión
- Cada experimento tiene `rollback.sh` probado antes de la ronda 0.
- Tras cada reversión se verifica que el flujo `GET /api/v5/flujo` responde 200 con las tres
  entidades y que `/health` de las tres API responde 200.
- Las mejoras se revierten con una variable de Terraform o `kubectl delete -f`.

## Bitácora
- Cada corrida escribe `bitacora.jsonl` local y un marcador en la nube (`gameday-markers` en GCP,
  `/pokenetes/gameday` en AWS), correlacionados por el `x-trace-id` del flujo.
- Las horas en la evidencia están en UTC.

## Excepciones y aprobaciones
- Dos controles usan retención de almacenamiento: la copia aislada del Exp. 4 (GCS, 7 días,
  bloqueada) y la bitácora inmutable del Exp. 3 (logs, 30 días, bloqueada). El bloqueo es
  irreversible y fue aprobado por Phol antes de aplicarlo.
