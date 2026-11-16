# Resultados de Neithan — latencia saliente

Fecha de medición: 15 de noviembre de 2026. Entrada: `GET http://pokenetes-alb-1190353326.us-east-1.elb.amazonaws.com/api/v5/flujo`.

## Estado estable medido

20 peticiones seguidas, sin `x-peer-latency-ms` y sin `x-peer-resilience`.

| Dato | Valor |
|---|---|
| Respuestas 200 | 20 de 20 |
| Libros en vivo | 20 de 20 |
| Hospitales en vivo | 20 de 20 |
| p95 | 273 ms |
| Mínimo / máximo | 169 ms / 587 ms |

## Hipótesis

Dado `perfil-comun-v1`, cuando se inyectan 2000 ms en la llamada saliente a `GET /api/v5/books/last` durante 120 s (del segundo 150 al 270), el p95 de `GET /api/v5/flujo` se mantiene bajo 800 ms.

## Qué no estaba activo en la ronda 0

No estaban el timeout de 300 ms ni el circuit breaker. Esas son las protecciones nuevas. No se apagó el corte de 5 s que ya tenía `fetch` ni el health check del balanceador: no forman parte de la comparación.

## Las dos rondas

Mismo perfil, mismo fallo, misma duración, mismo instrumento: p95 de la duración vista por el cliente, solo dentro de la ventana de fallo.

| Ronda | `x-peer-resilience` | Muestras | Éxito HTTP | p95 | Umbral | Veredicto |
|---|---|---|---|---|---|---|
| 0 | ausente | 900 | 1.0 | 2268 ms | 800 ms | hipótesis refutada |
| 1 | `true` | 3599 | 1.0 | 232 ms | 800 ms | hipótesis cumplida |

Variación porcentual: (232 − 2268) / 2268 = **−89.8 %**.

La ronda 0 tiene menos muestras porque cada petición espera el retraso. La ronda 1 responde enseguida, así que los mismos 20 usuarios alcanzan a hacer más peticiones en los mismos 120 s. El perfil no cambió.

## Por qué pasó

En la ronda 0 el coordinador duerme 2000 ms antes de llamar a Phol y se queda ahí hasta que la llamada termina. El Pokémon y el hospital no reciben ese retraso. El flujo igual responde 200, porque 2000 ms cabe dentro del corte viejo de 5 s. El modo de fallo es acoplamiento de latencia: la espera de un compañero se vuelve la espera de todo el flujo.

Una petición de diagnóstico con las dos cabeceras (`x-peer-latency-ms: 2000` y `x-peer-resilience: true`, trace `diag-resilience`) respondió 200 en 684 ms. El paso `books` salió `live: false` con `error: timeout`. El paso `hospitals` siguió `live: true`. Después de tres timeouts el circuito se abre 15 s y el paso sale `circuit_open` sin volver a esperar. Por eso el p95 de la ventana baja a 232 ms: la mayoría de las peticiones ya no llaman a Phol.

## Qué se descartó

Reintentos con espera creciente. Cada reintento volvería a dormir los 2000 ms y armaría una tormenta de reintentos contra Phol.

## Qué queda fuera de este número

El tablero común de las dos rondas lo arma Daniela. El generador k6 canónico y el informe de seis páginas los consolida Phol. Este repositorio corre el mismo perfil en `chaos/flujo.k6.js` y en `scripts/chaos/run-profile.mjs`, y el Chaos Gate falla el job si el p95 de la ventana no baja de 800 ms. La llamada a hospitales no tiene el timeout de 300 ms: si ese servicio se pusiera lento, el p95 del flujo volvería a subir. Ese es el siguiente patrón, no parte de esta comparación.
