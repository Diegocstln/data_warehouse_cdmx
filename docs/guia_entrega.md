# Guia de entrega y uso del proyecto

Esta guia explica que se hizo en el proyecto, como funciona y como puede usarlo una persona que no conoce Docker, PostgreSQL ni desarrollo web.

## 1. Que es este proyecto

El proyecto es un Data Warehouse sobre consumo de agua y clima en la Ciudad de Mexico durante 2019.

Integra dos fuentes de datos:

- Consumo de agua por colonia y alcaldia.
- Datos climaticos diarios de Open-Meteo.

El objetivo es comparar el consumo de agua contra variables climaticas como temperatura y lluvia.

## 2. Que se mejoro

El repositorio original tenia la base del Data Warehouse, pero se reforzo para que fuera mas completo y presentable.

Se hicieron estas mejoras:

- Se corrigio y reforzo el modelo de base de datos.
- Se mejoro el proceso ETL.
- Se agregaron validaciones de carga.
- Se agregaron vistas SQL para analisis.
- Se agrego documentacion.
- Se agrego un dashboard web.
- Se agregaron filtros interactivos por bimestre.

## 3. Como esta organizado

La estructura principal es:

```text
data_warehouse_cdmx/
|-- data/        Datos CSV originales
|-- ddl/         Definicion de tablas y vistas
|-- etl/         Scripts de carga y transformacion
|-- scripts/     Consultas y validaciones
|-- dashboard/   Pagina web del dashboard
|-- docs/        Documentacion
|-- Dockerfile   Imagen de PostgreSQL con los datos
`-- compose.yml  Levanta la base de datos y el dashboard
```

## 4. Como funciona por dentro

El flujo general es:

```text
CSV -> staging -> dimensiones -> hechos -> vistas SQL -> API -> dashboard web
```

Explicado de forma sencilla:

1. Los archivos CSV se cargan primero en tablas temporales llamadas staging.
2. Despues se limpian y organizan en dimensiones y tablas de hechos.
3. Con esas tablas se crean vistas SQL ya listas para consultar.
4. La API de FastAPI consulta esas vistas.
5. El navegador muestra los datos como graficas con Chart.js.

## 5. Que es el modelo estrella

El modelo estrella separa los datos en:

- Dimensiones: describen el contexto.
- Hechos: guardan los valores numericos que se analizan.

En este proyecto las dimensiones son:

- `dim_tiempo`: fechas, anio, mes, dia y bimestre.
- `dim_ubicacion`: alcaldia, colonia, latitud y longitud.
- `dim_indice_des`: clasificacion de indice de desarrollo.

Las tablas de hechos son:

- `fact_consumo_agua`: metricas de consumo de agua.
- `fact_clima`: temperatura, humedad y lluvia.

## 6. Mejoras en la base de datos

Se reforzo el esquema para que fuera mas confiable:

- Se agregaron restricciones `NOT NULL`.
- Se agregaron restricciones `UNIQUE`.
- Se agregaron validaciones `CHECK`.
- Las llaves foraneas en las tablas de hechos ahora son obligatorias.
- `dim_ubicacion` ahora conserva latitud y longitud.
- `fact_clima` evita duplicados por fecha.

Esto ayuda a que los datos sean mas consistentes y reduce errores al consultar.

## 7. Mejoras en el ETL

El ETL es el proceso que carga y transforma los datos.

Antes, `dim_tiempo` se llenaba solo con fechas del clima. Eso podia provocar que algunos registros de consumo de agua no encontraran su fecha y se perdieran.

Ahora `dim_tiempo` se llena usando:

- Fechas del clima.
- Fechas del consumo de agua.

Tambien se agregaron validaciones para detener la carga si una tabla de hechos queda vacia.

## 8. Vistas SQL agregadas

Se agregaron vistas para que el analisis sea mas facil. Una vista es como una consulta guardada que se puede reutilizar.

Vistas creadas:

- `vw_consumo_clima_bimestral`
- `vw_consumo_por_alcaldia`
- `vw_consumo_por_indice_desarrollo`
- `vw_correlacion_clima_consumo`

Ejemplos:

```sql
SELECT * FROM vw_consumo_clima_bimestral;
SELECT * FROM vw_consumo_por_alcaldia ORDER BY total_agua DESC LIMIT 10;
SELECT * FROM vw_correlacion_clima_consumo;
```

## 9. Dashboard web

Se agrego una pagina web para ver los resultados sin escribir SQL.

El dashboard muestra:

- Consumo total.
- Consumo promedio.
- Numero de bimestres analizados.
- Correlacion entre consumo y temperatura.
- Grafica de consumo y temperatura por bimestre.
- Top alcaldias con mayor consumo.
- Consumo por indice de desarrollo.
- Tabla resumen.

Tambien tiene botones para filtrar:

```text
Todos | B1 | B2 | B3
```

Al presionar un filtro, las graficas y KPIs se actualizan.

## 10. Tecnologias usadas

Se usaron estas herramientas:

- Docker: levanta todo el proyecto sin instalar PostgreSQL manualmente.
- PostgreSQL: base de datos del Data Warehouse.
- FastAPI: backend que consulta la base y entrega datos al dashboard.
- Chart.js: biblioteca para graficas en el navegador.
- HTML, CSS y JavaScript: interfaz web.

## 11. Como ejecutar el proyecto

Primero abre Docker Desktop.

Despues entra al proyecto:

```bash
cd ~/data_warehouse_cdmx
```

Levanta los servicios:

```bash
docker compose up -d --build
```

Verifica que esten activos:

```bash
docker ps
```

Debes ver dos contenedores:

```text
data_warehouse_cdmx
data_warehouse_cdmx_dashboard
```

## 12. Como abrir el dashboard

Abre esta direccion en el navegador:

```text
http://localhost:8000
```

Si haces cambios y no se ven, recarga con:

```text
Ctrl + F5
```

## 13. Como consultar la base de datos

Para entrar a PostgreSQL desde la terminal:

```bash
docker exec -it data_warehouse_cdmx psql -U postgres -d data_warehouse
```

Para ver tablas y vistas:

```sql
\dt
\dv
```

Para salir:

```sql
\q
```

## 14. Como probar la API

Puedes abrir estos enlaces en el navegador:

```text
http://localhost:8000/api/kpis
http://localhost:8000/api/consumo-clima
http://localhost:8000/api/consumo-alcaldia
http://localhost:8000/api/consumo-indice
http://localhost:8000/api/correlacion
```

Tambien puedes filtrar por bimestre:

```text
http://localhost:8000/api/kpis?bimestre=2
http://localhost:8000/api/consumo-alcaldia?bimestre=2&limit=5
```

## 15. Como apagar el proyecto

Para detener los contenedores:

```bash
docker compose down
```

Para borrar tambien el volumen y reconstruir desde cero:

```bash
docker compose down -v
docker compose up -d --build
```

## 16. Como explicarlo en una exposicion

Una forma sencilla de explicarlo:

```text
Este proyecto toma datos de consumo de agua y clima de CDMX, los carga en PostgreSQL y los organiza como un Data Warehouse con modelo estrella. Despues se crearon vistas SQL para resumir los datos y una API en FastAPI que entrega esos resultados al dashboard web. La pagina muestra KPIs, graficas y filtros por bimestre para analizar la relacion entre consumo de agua, temperatura y lluvia.
```

## 17. Resultado final

El resultado final es un proyecto que incluye:

- Data Warehouse funcional.
- ETL automatizado con Docker.
- Validaciones de calidad.
- Vistas SQL analiticas.
- Dashboard web interactivo.
- Documentacion para uso y explicacion.
