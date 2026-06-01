# Análisis y Mejoras del Data Warehouse CDMX

## Diagnóstico

El proyecto implementa un modelo estrella para comparar consumo de agua y clima en CDMX durante 2019. La base es correcta para una entrega académica, pero tenía riesgos que podían afectar el resultado del análisis:

- `dim_tiempo` se poblaba solo desde el CSV de clima. Si una fecha bimestral de consumo no existía en clima, los registros de `fact_consumo_agua` se perdían en el join.
- `dim_ubicacion` y `dim_indice_des` no tenían restricciones de unicidad, por lo que el ETL podía generar duplicados si se reejecutaba o si cambiaba la carga.
- La dimensión de ubicación descartaba latitud y longitud aunque el CSV las trae.
- Los scripts de análisis no incluían validaciones de integridad para comprobar que la carga realmente funcionó.
- Docker copiaba la consulta de análisis dentro de la ruta de inicialización, pero no había separación clara entre scripts de carga automática y scripts manuales de análisis.

## Mejoras Aplicadas

- Se reforzó el esquema con `NOT NULL`, `UNIQUE` y `CHECK` en dimensiones y llaves foráneas obligatorias en hechos.
- `dim_tiempo` ahora se construye con fechas de clima y de consumo, evitando pérdida de registros por diferencias de granularidad.
- `dim_ubicacion` conserva latitud y longitud promedio por colonia/alcaldía.
- El ETL de dimensiones usa `ON CONFLICT DO NOTHING` para tolerar reintentos y mantener unicidad.
- `fact_clima` garantiza una sola fila por fecha mediante `UNIQUE (id_tiempo)`.
- `3_fact.sql` valida que las tablas de hechos no queden vacías antes de eliminar staging.
- Se agregaron `scripts/validaciones.sql` y `scripts/analisis_extra.sql` para revisar calidad y ampliar el análisis.
- Se agregaron vistas analíticas permanentes: `vw_consumo_clima_bimestral`, `vw_consumo_por_alcaldia`, `vw_consumo_por_indice_desarrollo` y `vw_correlacion_clima_consumo`.
- El Dockerfile separa scripts de inicialización de scripts manuales en `/docker-entrypoint-initdb.d/scripts/`.

## Cómo Validar

Levantar la base desde cero:

```bash
docker compose down -v
docker compose up -d --build
```

Ejecutar validaciones:

```bash
docker exec -it data_warehouse_cdmx psql -U postgres -d data_warehouse -f /docker-entrypoint-initdb.d/scripts/validaciones.sql
```

Ejecutar análisis:

```bash
docker exec -it data_warehouse_cdmx psql -U postgres -d data_warehouse -f /docker-entrypoint-initdb.d/scripts/consulta.sql
docker exec -it data_warehouse_cdmx psql -U postgres -d data_warehouse -f /docker-entrypoint-initdb.d/scripts/analisis_extra.sql
```

Consultar vistas directamente:

```sql
SELECT * FROM vw_consumo_clima_bimestral;
SELECT * FROM vw_consumo_por_alcaldia ORDER BY total_agua DESC LIMIT 10;
SELECT * FROM vw_consumo_por_indice_desarrollo;
SELECT * FROM vw_correlacion_clima_consumo;
```

## Resultado Esperado

- Las tablas de hechos deben tener registros.
- Las consultas de duplicados deben regresar cero filas.
- `fact_consumo_agua` debe conservar registros de los bimestres disponibles.
- El análisis debe permitir comparar consumo total, temperatura, lluvia e índice de desarrollo.
