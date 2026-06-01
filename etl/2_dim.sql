-- ============================================
-- ETL: Poblar dimensiones
-- ============================================

-- Poblar dim_ubicacion
INSERT INTO dim_ubicacion (alcaldia, colonia, latitud, longitud)
SELECT
    alcaldia,
    colonia,
    AVG(latitud) AS latitud,
    AVG(longitud) AS longitud
FROM staging_consumo
WHERE colonia IS NOT NULL
  AND alcaldia IS NOT NULL
GROUP BY alcaldia, colonia
ON CONFLICT (alcaldia, colonia) DO NOTHING;

-- Poblar dim_indice_des
INSERT INTO dim_indice_des (indice_des)
SELECT DISTINCT indice_des
FROM staging_consumo
WHERE indice_des IS NOT NULL
ON CONFLICT (indice_des) DO NOTHING;

-- Poblar dim_tiempo desde clima diario y fechas bimestrales de consumo.
INSERT INTO dim_tiempo (fecha, anio, mes, dia, bimestre)
WITH fechas AS (
    SELECT DATE(fecha_hora) AS fecha
    FROM staging_clima
    WHERE fecha_hora IS NOT NULL

    UNION

    SELECT fecha_referencia AS fecha
    FROM staging_consumo
    WHERE fecha_referencia IS NOT NULL
)
SELECT
    fecha,
    EXTRACT(YEAR FROM fecha)::INT,
    EXTRACT(MONTH FROM fecha)::INT,
    EXTRACT(DAY FROM fecha)::INT,
    CASE
        WHEN EXTRACT(MONTH FROM fecha) IN (1,2) THEN 1
        WHEN EXTRACT(MONTH FROM fecha) IN (3,4) THEN 2
        WHEN EXTRACT(MONTH FROM fecha) IN (5,6) THEN 3
        WHEN EXTRACT(MONTH FROM fecha) IN (7,8) THEN 4
        WHEN EXTRACT(MONTH FROM fecha) IN (9,10) THEN 5
        ELSE 6
    END
FROM fechas
ON CONFLICT (fecha) DO NOTHING;
