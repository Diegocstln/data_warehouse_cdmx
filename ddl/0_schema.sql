-- ============================================
-- DDL: Esquema del Data Warehouse
-- ============================================

-- ============================================
-- STAGING: Consumo de Agua
-- ============================================
CREATE TABLE staging_consumo (
    fecha_referencia DATE,
    anio INT,
    bimestre INT,
    consumo_total_mixto NUMERIC,
    consumo_prom_dom NUMERIC,
    consumo_total_dom NUMERIC,
    consumo_prom_mixto NUMERIC,
    consumo_total NUMERIC,
    consumo_prom NUMERIC,
    consumo_prom_no_dom NUMERIC,
    consumo_total_no_dom NUMERIC,
    indice_des VARCHAR(50),
    colonia VARCHAR(255),
    alcaldia VARCHAR(255),
    latitud NUMERIC,
    longitud NUMERIC
);

-- ============================================
-- STAGING: Clima
-- ============================================
CREATE TABLE staging_clima (
    fecha_hora TIMESTAMP,
    temperatura NUMERIC,
    humedad_relativa INT,
    lluvia NUMERIC
);

-- ============================================
-- DIMENSIONES
-- ============================================

-- Dimensión de Tiempo
CREATE TABLE dim_tiempo (
    id_tiempo SERIAL PRIMARY KEY,
    fecha DATE NOT NULL UNIQUE,
    anio INT NOT NULL,
    mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    dia INT NOT NULL CHECK (dia BETWEEN 1 AND 31),
    bimestre INT NOT NULL CHECK (bimestre BETWEEN 1 AND 6)
);

-- Dimensión de Ubicación
CREATE TABLE dim_ubicacion (
    id_ubicacion SERIAL PRIMARY KEY,
    alcaldia VARCHAR(255) NOT NULL,
    colonia VARCHAR(255) NOT NULL,
    latitud NUMERIC,
    longitud NUMERIC,
    UNIQUE (alcaldia, colonia)
);

-- Dimensión de Índice de Desarrollo
CREATE TABLE dim_indice_des (
    id_indice_des SERIAL PRIMARY KEY,
    indice_des VARCHAR(50) NOT NULL UNIQUE
);

-- ============================================
-- TABLAS DE HECHOS
-- ============================================

-- Tabla de Hechos: Consumo de Agua
CREATE TABLE fact_consumo_agua (
    id_fact SERIAL PRIMARY KEY,
    id_tiempo INT NOT NULL REFERENCES dim_tiempo(id_tiempo),
    id_ubicacion INT NOT NULL REFERENCES dim_ubicacion(id_ubicacion),
    id_indice_des INT NOT NULL REFERENCES dim_indice_des(id_indice_des),
    consumo_total_mixto NUMERIC,
    consumo_prom_dom NUMERIC,
    consumo_total_dom NUMERIC,
    consumo_prom_mixto NUMERIC,
    consumo_total NUMERIC,
    consumo_prom NUMERIC,
    consumo_prom_no_dom NUMERIC,
    consumo_total_no_dom NUMERIC
);

-- Tabla de Hechos: Clima
CREATE TABLE fact_clima (
    id_fact_clima SERIAL PRIMARY KEY,
    id_tiempo INT NOT NULL UNIQUE REFERENCES dim_tiempo(id_tiempo),
    temp_maxima NUMERIC,
    temp_minima NUMERIC,
    temp_promedio NUMERIC,
    humedad_promedio NUMERIC,
    lluvia_total NUMERIC
);

-- ============================================
-- VISTAS DE ANALISIS
-- ============================================

CREATE VIEW vw_consumo_clima_bimestral AS
WITH clima_bimestral AS (
    SELECT
        t.anio,
        t.bimestre,
        ROUND(AVG(fc.temp_promedio), 2) AS temp_promedio,
        COUNT(*) FILTER (WHERE fc.temp_maxima >= 28) AS dias_ola_calor,
        COUNT(*) FILTER (WHERE fc.temp_minima <= 10) AS dias_frio,
        ROUND(SUM(fc.lluvia_total), 2) AS total_lluvia
    FROM fact_clima fc
    JOIN dim_tiempo t ON fc.id_tiempo = t.id_tiempo
    GROUP BY t.anio, t.bimestre
),
agua_bimestral AS (
    SELECT
        t.anio,
        t.bimestre,
        ROUND(SUM(fca.consumo_total), 2) AS total_agua,
        ROUND(AVG(fca.consumo_prom), 2) AS consumo_promedio
    FROM fact_consumo_agua fca
    JOIN dim_tiempo t ON fca.id_tiempo = t.id_tiempo
    GROUP BY t.anio, t.bimestre
)
SELECT
    a.anio,
    a.bimestre,
    a.total_agua,
    a.consumo_promedio,
    c.temp_promedio,
    c.dias_ola_calor,
    c.dias_frio,
    c.total_lluvia
FROM agua_bimestral a
JOIN clima_bimestral c ON a.anio = c.anio AND a.bimestre = c.bimestre;

CREATE VIEW vw_consumo_por_alcaldia AS
SELECT
    t.anio,
    t.bimestre,
    u.alcaldia,
    ROUND(SUM(fca.consumo_total), 2) AS total_agua,
    ROUND(AVG(fca.consumo_prom), 2) AS consumo_promedio,
    COUNT(*) AS registros
FROM fact_consumo_agua fca
JOIN dim_tiempo t ON fca.id_tiempo = t.id_tiempo
JOIN dim_ubicacion u ON fca.id_ubicacion = u.id_ubicacion
GROUP BY t.anio, t.bimestre, u.alcaldia;

CREATE VIEW vw_consumo_por_indice_desarrollo AS
SELECT
    t.anio,
    t.bimestre,
    i.indice_des,
    ROUND(SUM(fca.consumo_total), 2) AS total_agua,
    ROUND(AVG(fca.consumo_prom), 2) AS consumo_promedio,
    COUNT(*) AS registros
FROM fact_consumo_agua fca
JOIN dim_tiempo t ON fca.id_tiempo = t.id_tiempo
JOIN dim_indice_des i ON fca.id_indice_des = i.id_indice_des
GROUP BY t.anio, t.bimestre, i.indice_des;

CREATE VIEW vw_correlacion_clima_consumo AS
SELECT
    corr(total_agua::DOUBLE PRECISION, temp_promedio::DOUBLE PRECISION) AS correlacion_consumo_temperatura,
    corr(total_agua::DOUBLE PRECISION, total_lluvia::DOUBLE PRECISION) AS correlacion_consumo_lluvia
FROM vw_consumo_clima_bimestral;
