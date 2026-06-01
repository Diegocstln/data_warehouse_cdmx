-- Correlación entre consumo de agua y temperatura en CDMX.
SELECT *
FROM vw_consumo_clima_bimestral
ORDER BY anio, bimestre;

-- Consumo por alcaldía e índice de desarrollo para los mismos bimestres.
SELECT
    t.anio,
    t.bimestre,
    u.alcaldia,
    i.indice_des,
    ROUND(SUM(fca.consumo_total), 2) AS total_agua,
    ROUND(AVG(fca.consumo_prom), 2) AS consumo_promedio
FROM fact_consumo_agua fca
JOIN dim_tiempo t ON fca.id_tiempo = t.id_tiempo
JOIN dim_ubicacion u ON fca.id_ubicacion = u.id_ubicacion
JOIN dim_indice_des i ON fca.id_indice_des = i.id_indice_des
GROUP BY t.anio, t.bimestre, u.alcaldia, i.indice_des
ORDER BY t.anio, t.bimestre, total_agua DESC;

-- Correlaciones calculadas con la función estadística corr().
SELECT *
FROM vw_correlacion_clima_consumo;
