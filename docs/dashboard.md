# Dashboard Web

El proyecto incluye una pagina de dashboard con FastAPI y Chart.js para visualizar los resultados principales del Data Warehouse.

## Contenido

- KPIs de consumo total, consumo promedio, bimestres y correlacion.
- Grafica de consumo y temperatura por bimestre.
- Grafica de consumo por alcaldia.
- Grafica de consumo por indice de desarrollo.
- Tabla de resumen bimestral.

## Endpoints

- `/api/kpis`
- `/api/consumo-clima`
- `/api/consumo-alcaldia`
- `/api/consumo-indice`
- `/api/correlacion`

## Uso

Levantar servicios:

```bash
docker compose up -d --build
```

Abrir dashboard:

```text
http://localhost:8000
```
