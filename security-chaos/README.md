# Game day de Neithan

Experimento 1, identidad de la máquina que coordina `GET /api/v5/flujo`. La métrica es el MTTC. La hipótesis está en `exp1-identidad/experiment.yaml`.

Copia `gameday.env.example` a `gameday.env`. No pongas secretos en ese archivo.

```bash
cd security-chaos/exp1-identidad
./steady-state.sh
./inject.sh
./stop.sh
./measure.sh
```

La siembra del experimento 4 está en `exp4-datos/seed.sh`. No llama a servicios fuera del grupo.
