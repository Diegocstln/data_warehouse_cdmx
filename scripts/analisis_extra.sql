-- Análisis adicional del Data Warehouse CDMX.

-- Top 10 alcaldías por consumo total en el periodo cargado.
SELECT
    u.alcaldia,
    ROUND(SUM(fca.consumo_total), 2) AS total_agua,
    ROUND(AVG(fca.consumo_prom), 2) AS consumo_promedio
FROM fact_consumo_agua fca
JOIN dim_ubicacion u ON fca.id_ubicacion = u.id_ubicacion
GROUP BY u.alcaldia
ORDER BY total_agua DESC
LIMIT 10;

-- Consumo acumulado por índice de desarrollo.
SELECT
    i.indice_des,
    ROUND(SUM(fca.consumo_total), 2) AS total_agua,
    ROUND(AVG(fca.consumo_prom), 2) AS consumo_promedio
FROM fact_consumo_agua fca
JOIN dim_indice_des i ON fca.id_indice_des = i.id_indice_des
GROUP BY i.indice_des
ORDER BY total_agua DESC;

-- Vistas listas para BI o exploración desde DBeaver/pgAdmin.
SELECT *
FROM vw_consumo_por_alcaldia
ORDER BY anio, bimestre, total_agua DESC
LIMIT 20;

SELECT *
FROM vw_consumo_por_indice_desarrollo
ORDER BY anio, bimestre, total_agua DESC;

-- Resumen climático por bimestre.
SELECT
    t.anio,
    t.bimestre,
    ROUND(AVG(fc.temp_promedio), 2) AS temp_promedio,
    ROUND(MAX(fc.temp_maxima), 2) AS temp_maxima_periodo,
    ROUND(MIN(fc.temp_minima), 2) AS temp_minima_periodo,
    ROUND(SUM(fc.lluvia_total), 2) AS lluvia_total
FROM fact_clima fc
JOIN dim_tiempo t ON fc.id_tiempo = t.id_tiempo
GROUP BY t.anio, t.bimestre
ORDER BY t.anio, t.bimestre;
