# Resultados de Neithan — latencia saliente

Medición del Chaos Gate, 16 de noviembre de 2026, con el k6 de Phol (`load/k6/flow.js`, commit `7b2aef79`) y `perfil-comun-v1`. Entrada: `GET http://pokenetes-alb-1190353326.us-east-1.elb.amazonaws.com/api/v5/flujo`.

## Línea base

Es la fase `baseline` de las mismas dos corridas, antes de que entre `x-peer-latency-ms`. No hay una calibración aparte en Actions.

| Corrida | p95 de la fase baseline |
|---|---|
| Ronda 0, [43914350422](https://github.com/Enedev/Pokenetes-API/actions/runs/43914350422) | 152.1 ms |
| Ronda 1, [43917687975](https://github.com/Enedev/Pokenetes-API/actions/runs/43917687975) | 177.0 ms |

Las dos fases respondieron sin errores HTTP.

## Hipótesis

Dado `perfil-comun-v1`, cuando se inyectan 2000 ms en la llamada saliente a `GET /api/v5/books/last` durante 120 s (del segundo 150 al 270), el p95 de `GET /api/v5/flujo` se mantiene bajo 800 ms.

## Qué no estaba activo en la ronda 0

No estaban el timeout de 300 ms ni el circuit breaker. Esas son las protecciones nuevas. No se apagó el corte de 5 s que ya tenía `fetch` ni el health check del balanceador.

## Las dos rondas

Mismo perfil, mismo fallo, misma duración, mismo instrumento: p95 de `http_req_duration{phase:fault}`.

| Ronda | `x-peer-resilience` | Peticiones | Éxito HTTP | p95 | Umbral | Veredicto |
|---|---|---|---|---|---|---|
| 0 | ausente | 920 | 1.0 | 2147.15 ms | 800 ms | hipótesis refutada |
| 1 | `true` | 3898 | 1.0 | 145.64 ms | 800 ms | hipótesis cumplida |

Variación porcentual: (145.64 − 2147.15) / 2147.15 = **−93.2 %**.

La ronda 0 tiene menos peticiones porque cada una espera el retraso. La ronda 1 responde enseguida, así que los mismos 20 usuarios alcanzan a hacer más peticiones en los mismos 120 s.

## Por qué pasó

En la ronda 0 el coordinador duerme 2000 ms antes de llamar a Phol y se queda ahí hasta que la llamada termina. El Pokémon y el hospital no reciben ese retraso. El flujo igual responde 200, porque 2000 ms cabe dentro del corte viejo de 5 s. El modo de fallo es acoplamiento de latencia: la espera de un compañero se vuelve la espera de todo el flujo. En CloudWatch, el p95 del balanceador en ese minuto fue 2.14 s.

Con `x-peer-resilience: true` el paso del libro sale `error: timeout` a los 300 ms. Después de tres timeouts el circuito se abre 15 s y el paso sale `circuit_open` sin volver a esperar. Por eso el p95 de la ventana baja a 145.64 ms.

## Reversión

El 17 de noviembre de 2026 a las 03:53 UTC, sobre el flujo en ejecución:

| Petición | Resultado |
|---|---|
| `x-peer-latency-ms: 2000`, trace `reversion-on` | 200 en 2505 ms, `latency_ms` 2000, libro en vivo |
| la siguiente, sin esa cabecera, trace `reversion-off` | 200 en 263 ms, `latency_ms` 0, libro en vivo |

Quitar la cabecera apaga el fallo. No queda un estado pegado en el proceso.

## Ventana de inyección en los logs

El grupo es `/pokenetes/canary`, región `us-east-1`. En esas dos horas los eventos traen `Latency`, `route`, `Requests` y `Errors5xx`. No traen `peer_call`: la imagen que atendió el gate todavía no escribía ese mensaje. Para ver la ventana con lo que sí quedó:

```
fields @timestamp, Latency, Requests
| filter route = "/api/v5/flujo"
| stats avg(Latency) as latencia_ms by bin(1m)
```

La ronda 0 se ve como el salto de `Latency`. La ronda 1 no se ve como un salto, porque el timeout corta la espera: su evidencia es el p95 de 145.64 ms en el resumen de k6. El código actual escribe `peer_call` con `duration_ms` y `error` (`timeout` o `circuit_open`); un filtro por ese mensaje solo tendrá puntos después de publicar esa imagen.

## Qué se descartó

Reintentos con espera creciente. Cada reintento volvería a dormir los 2000 ms y armaría una tormenta de reintentos contra Phol.

## Qué queda fuera de este número

El tablero común lo arma Daniela. El informe de seis páginas lo consolida Phol. La llamada a hospitales no tiene el timeout de 300 ms: si ese servicio se pusiera lento, el p95 del flujo volvería a subir. Ese es el siguiente patrón, no parte de esta comparación.
