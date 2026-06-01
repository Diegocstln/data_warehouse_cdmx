# Data Warehouse CDMX - Consumo de Agua y Clima

Proyecto de Data Warehouse para analizar la correlación entre el consumo de agua y las condiciones climáticas en la Ciudad de México durante 2019.

## Índice

1. [Descripción del Proyecto](#descripción-del-proyecto)
2. [Estructura del Proyecto](#estructura-del-proyecto)
3. [Esquema de la Base de Datos](#esquema-de-la-base-de-datos)
4. [Requisitos](#requisitos)
5. [Instalación y Uso](#instalación-y-uso)
6. [Scripts SQL](#scripts-sql)
7. [Consultas de Análisis](#consultas-de-análisis)
8. [Notas Técnicas](#notas-técnicas)

---

## Descripción del Proyecto

Este Data Warehouse integra dos fuentes de datos:

| Fuente              | Descripción                                              | Granularidad                                           |
| ------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| **Consumo de Agua** | Datos históricos de consumo de agua por colonia/alcaldía | Bimestral (3 bimestres: feb, abr, jun 2019)            |
| **Clima**           | Datos meteorológicos de Open-Meteo (estación CDMX)       | Diaria (181 días correspondientes a los bimestres 1-3) |

**Objetivo:** Analizar la correlación entre el consumo de agua y las condiciones climáticas (temperatura, lluvia, humedad).

---

## Estructura del Proyecto

```
data_warehouse/
├── Dockerfile              # Imagen PostgreSQL con datos
├── compose.yml            # Orquestación del contenedor
├── README.md              # Este archivo
├── ddl/
│   └── 0_schema.sql      # Definición de tablas (DDL)
├── etl/
│   ├── 1_copy.sql        # Carga de datos a staging
│   ├── 2_dim.sql         # Poblamiento de dimensiones
│   └── 3_fact.sql        # Poblamiento de tablas de hechos
├── scripts/
│   ├── consulta.sql        # Consulta principal de análisis
│   ├── analisis_extra.sql  # Consultas complementarias
│   └── validaciones.sql    # Controles de calidad e integridad
├── docs/
│   └── analisis_mejoras.md # Diagnóstico y mejoras aplicadas
└── data/
    ├── consumo_agua_historico_2019.csv   # Datos de consumo
    └── open-meteo-19.44N99.11W2233m.csv # Datos climáticos
```

---

## Esquema de la Base de Datos

### Modelo Estrella

```
dim_tiempo (SCD - Slowly Changing Dimension)
├── id_tiempo (PK)
├── fecha (UNIQUE)
├── anio
├── mes
├── dia
└── bimestre

dim_ubicacion
├── id_ubicacion (PK)
├── alcaldia
├── colonia
├── latitud
└── longitud

dim_indice_des (Índice de Desarrollo)
├── id_indice_des (PK)
└── indice_des (ALTO, MEDIO, BAJO, POPULAR)

fact_consumo_agua ──────────────────────→ dim_tiempo
    │                                    dim_ubicacion
    │                                    dim_indice_des
    ├── id_fact (PK)
    ├── consumo_total_mixto
    ├── consumo_prom_dom
    ├── consumo_total_dom
    ├── consumo_prom_mixto
    ├── consumo_total
    ├── consumo_prom
    ├── consumo_prom_no_dom
    └── consumo_total_no_dom

fact_clima ─────────────────────────────→ dim_tiempo
├── id_fact_clima (PK)
├── temp_maxima
├── temp_minima
├── temp_promedio
├── humedad_promedio
└── lluvia_total
```

### Tablas de Staging (temporales)

| Tabla             | Uso                                          |
| ----------------- | -------------------------------------------- |
| `staging_consumo` | Recibe datos crudos de consumo antes del ETL |
| `staging_clima`   | Recibe datos crudos de clima antes del ETL   |

---

## Requisitos

- Docker
- Docker Compose
- PostgreSQL 16 (incluido en la imagen)

---

## Instalación y Uso

### 1. Construir y levantar el contenedor

```bash
cd data_warehouse
docker compose up -d
```

### 2. Verificar que el contenedor está corriendo

```bash
docker ps
```

Deberías ver `data_warehouse_cdmx` en la lista.

### 3. Conectarse a la base de datos

```bash
docker exec -it data_warehouse_cdmx psql -U postgres -d data_warehouse
```

### 4. Verificar que los datos se cargaron correctamente

```sql
-- Contar registros en tablas de hechos
SELECT COUNT(*) FROM fact_consumo_agua;
SELECT COUNT(*) FROM fact_clima;

-- Ver fechas en dim_tiempo
SELECT COUNT(DISTINCT fecha) FROM dim_tiempo;
```

También puedes ejecutar el script de validaciones incluido:

```bash
docker exec -it data_warehouse_cdmx psql -U postgres -d data_warehouse -f /docker-entrypoint-initdb.d/scripts/validaciones.sql
```

### 5. Ejecutar la consulta de análisis

```bash
docker exec -it data_warehouse_cdmx psql -U postgres -d data_warehouse -f /docker-entrypoint-initdb.d/scripts/consulta.sql
```

Consultas complementarias:

```bash
docker exec -it data_warehouse_cdmx psql -U postgres -d data_warehouse -f /docker-entrypoint-initdb.d/scripts/analisis_extra.sql
```

O dentro de psql:

```sql
\i /docker-entrypoint-initdb.d/scripts/consulta.sql
```

---

## Scripts SQL

### DDL (Data Definition Language)

**Archivo:** `ddl/0_schema.sql`

Crea el esquema completo de la base de datos:

1. Tablas de staging (temporales para ETL)
2. Dimensiones (dim_tiempo, dim_ubicacion, dim_indice_des)
3. Tablas de hechos (fact_consumo_agua, fact_clima)
4. Vistas analiticas para consumo, clima y correlacion

### Vistas de analisis

El modelo incluye vistas listas para consulta directa:

- `vw_consumo_clima_bimestral`: consumo y clima agregados por bimestre.
- `vw_consumo_por_alcaldia`: consumo por alcaldia y bimestre.
- `vw_consumo_por_indice_desarrollo`: consumo por indice de desarrollo y bimestre.
- `vw_correlacion_clima_consumo`: correlacion entre consumo, temperatura y lluvia.

Ejemplos:

```sql
SELECT * FROM vw_consumo_clima_bimestral;
SELECT * FROM vw_consumo_por_alcaldia ORDER BY total_agua DESC LIMIT 10;
SELECT * FROM vw_correlacion_clima_consumo;
```

### ETL (Extract, Transform, Load)

#### 1_copy.sql - Carga de datos crudos

Copia los datos desde los archivos CSV a las tablas de staging.

```sql
COPY staging_consumo FROM '/docker-entrypoint-initdb.d/data/consumo_agua_historico_2019.csv' CSV HEADER;
COPY staging_clima FROM '/docker-entrypoint-initdb.d/data/open-meteo-19.44N99.11W2233m.csv' CSV HEADER;
```

#### 2_dim.sql - Poblamiento de dimensiones

Inserta los datos en las tablas de dimensiones:

- `dim_ubicacion`: Colonias y alcaldías únicas
- `dim_indice_des`: Valores únicos de índice de desarrollo
- `dim_tiempo`: Fechas únicas desde clima diario y consumo bimestral

#### 3_fact.sql - Poblamiento de tablas de hechos

Inserta los datos agregados en las tablas de hechos:

- `fact_consumo_agua`: Une staging_consumo con dimensiones
- `fact_clima`: Agrega datos climáticos por día (MAX, MIN, AVG, SUM)
- Valida que las tablas de hechos no queden vacías
- Elimina las tablas de staging

---

## Consultas de Análisis

### Correlación Clima vs Consumo (bimestral)

**Archivo:** `scripts/consulta.sql`

```sql
-- Correlación entre consumo de agua y temperatura en CDMX

WITH ClimaBimestral AS (
    SELECT
        t.anio,
        t.bimestre,
        ROUND(AVG(fc.temp_promedio), 2) AS temp_promedio,
        COUNT(CASE WHEN fc.temp_maxima >= 28 THEN 1 END) AS dias_ola_calor,
        COUNT(CASE WHEN fc.temp_minima <= 10 THEN 1 END) AS dias_frio,
        SUM(fc.lluvia_total) AS total_lluvia
    FROM fact_clima fc
    JOIN dim_tiempo t ON fc.id_tiempo = t.id_tiempo
    GROUP BY t.anio, t.bimestre
),
AguaBimestral AS (
    SELECT
        t.anio,
        t.bimestre,
        SUM(fca.consumo_total) AS total_agua
    FROM fact_consumo_agua fca
    JOIN dim_tiempo t ON fca.id_tiempo = t.id_tiempo
    GROUP BY t.anio, t.bimestre
)
SELECT
    a.anio,
    a.bimestre,
    a.total_agua,
    c.temp_promedio,
    c.dias_ola_calor,
    c.dias_frio,
    c.total_lluvia
FROM AguaBimestral a
JOIN ClimaBimestral c ON a.anio = c.anio AND a.bimestre = c.bimestre
ORDER BY a.anio, a.bimestre;
```

### Resultado esperado

| anio | bimestre | total_agua | temp_promedio | dias_ola_calor | dias_frio | total_lluvia |
| ---- | -------- | ---------- | ------------- | -------------- | --------- | ------------ |
| 2019 | 1        | X          | Y             | Z              | W         | V            |
| 2019 | 2        | X          | Y             | Z              | W         | V            |
| 2019 | 3        | X          | Y             | Z              | W         | V            |

---

## Notas Técnicas

### Orden de ejecución automática

PostgreSQL ejecuta automáticamente los archivos `.sql` en `/docker-entrypoint-initdb.d/` en orden alfabético:

1. `0_schema.sql` → Crea tablas
2. `1_copy.sql` → Carga staging
3. `2_dim.sql` → Puebla dimensiones
4. `3_fact.sql` → Puebla hechos

---

## Detener y limpiar

```bash
# Detener el contenedor
docker compose down

# Eliminar datos persistentes (volumen)
docker compose down -v

# Reconstruir desde cero
docker compose down -v && docker compose up -d --build
```

---

## Créditos

- Datos climáticos: [Open-Meteo](https://open-meteo.com/)
- Datos de consumo de agua: SACMEX CDMX
