-- Validaciones de integridad y calidad de carga.

SELECT 'dim_tiempo' AS tabla, COUNT(*) AS registros FROM dim_tiempo
UNION ALL
SELECT 'dim_ubicacion', COUNT(*) FROM dim_ubicacion
UNION ALL
SELECT 'dim_indice_des', COUNT(*) FROM dim_indice_des
UNION ALL
SELECT 'fact_consumo_agua', COUNT(*) FROM fact_consumo_agua
UNION ALL
SELECT 'fact_clima', COUNT(*) FROM fact_clima;

SELECT table_name AS vista
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name LIKE 'vw_%'
ORDER BY table_name;

-- Debe regresar 0: hechos de agua sin dimensión relacionada.
SELECT COUNT(*) AS hechos_agua_huerfanos
FROM fact_consumo_agua fca
LEFT JOIN dim_tiempo t ON fca.id_tiempo = t.id_tiempo
LEFT JOIN dim_ubicacion u ON fca.id_ubicacion = u.id_ubicacion
LEFT JOIN dim_indice_des i ON fca.id_indice_des = i.id_indice_des
WHERE t.id_tiempo IS NULL
   OR u.id_ubicacion IS NULL
   OR i.id_indice_des IS NULL;

-- Debe regresar cero filas: fechas duplicadas en la dimensión de tiempo.
SELECT fecha, COUNT(*) AS duplicados
FROM dim_tiempo
GROUP BY fecha
HAVING COUNT(*) > 1;

-- Debe regresar cero filas: ubicaciones duplicadas.
SELECT alcaldia, colonia, COUNT(*) AS duplicados
FROM dim_ubicacion
GROUP BY alcaldia, colonia
HAVING COUNT(*) > 1;

-- Debe regresar cero filas: alcaldías del mapa sin datos en el Data Warehouse.
WITH alcaldias_mapa(alcaldia) AS (
    VALUES
        ('Álvaro Obregón'),
        ('Azcapotzalco'),
        ('Benito Juárez'),
        ('Coyoacán'),
        ('Cuajimalpa de Morelos'),
        ('Cuauhtémoc'),
        ('Gustavo A. Madero'),
        ('Iztacalco'),
        ('Iztapalapa'),
        ('La Magdalena Contreras'),
        ('Miguel Hidalgo'),
        ('Milpa Alta'),
        ('Tláhuac'),
        ('Tlalpan'),
        ('Venustiano Carranza'),
        ('Xochimilco')
), alcaldias_dw AS (
    SELECT DISTINCT alcaldia
    FROM vw_consumo_por_alcaldia
)
SELECT m.alcaldia AS alcaldia_sin_datos
FROM alcaldias_mapa m
LEFT JOIN alcaldias_dw d ON lower(unaccent(m.alcaldia)) = lower(unaccent(d.alcaldia))
WHERE d.alcaldia IS NULL
ORDER BY m.alcaldia;
