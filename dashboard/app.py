import time
from typing import Any

import psycopg
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.requests import Request

from db import connect, normalize
from db_init import initialize_warehouse_if_needed


app = FastAPI(title="Dashboard Data Warehouse CDMX")
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


@app.on_event("startup")
def startup() -> None:
    initialize_warehouse_if_needed()


def query(sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    for attempt in range(12):
        try:
            with connect() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, params)
                    rows = cur.fetchall()
                    return [{key: normalize(value) for key, value in row.items()} for row in rows]
        except psycopg.OperationalError:
            if attempt == 11:
                raise
            time.sleep(2)
    return []


@app.get("/", response_class=HTMLResponse)
def index(request: Request) -> HTMLResponse:
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/api/kpis")
def kpis(bimestre: int | None = None) -> dict[str, Any]:
    where = "WHERE bimestre = %s" if bimestre else ""
    params = (bimestre,) if bimestre else ()
    totals = query(
        f"""
        SELECT
            ROUND(SUM(total_agua), 2) AS consumo_total,
            ROUND(AVG(consumo_promedio), 2) AS consumo_promedio,
            COUNT(*) AS bimestres
        FROM vw_consumo_clima_bimestral
        {where};
        """,
        params,
    )[0]
    corr = query(
        f"""
        SELECT
            corr(total_agua::DOUBLE PRECISION, temp_promedio::DOUBLE PRECISION) AS correlacion_consumo_temperatura,
            corr(total_agua::DOUBLE PRECISION, total_lluvia::DOUBLE PRECISION) AS correlacion_consumo_lluvia
        FROM vw_consumo_clima_bimestral
        {where};
        """,
        params,
    )[0]
    return {**totals, **corr}


@app.get("/api/consumo-clima")
def consumo_clima(bimestre: int | None = None) -> list[dict[str, Any]]:
    where = "WHERE bimestre = %s" if bimestre else ""
    params = (bimestre,) if bimestre else ()
    return query(
        f"""
        SELECT *
        FROM vw_consumo_clima_bimestral
        {where}
        ORDER BY anio, bimestre;
        """,
        params,
    )


@app.get("/api/consumo-alcaldia")
def consumo_alcaldia(limit: int = 10, bimestre: int | None = None) -> list[dict[str, Any]]:
    limit = max(1, min(limit, 20))
    where = "WHERE bimestre = %s" if bimestre else ""
    params: tuple[Any, ...] = (bimestre, limit) if bimestre else (limit,)
    return query(
        f"""
        SELECT
            alcaldia,
            ROUND(SUM(total_agua), 2) AS total_agua,
            ROUND(AVG(consumo_promedio), 2) AS consumo_promedio
        FROM vw_consumo_por_alcaldia
        {where}
        GROUP BY alcaldia
        ORDER BY total_agua DESC
        LIMIT %s;
        """,
        params,
    )


@app.get("/api/mapa-consumo")
def mapa_consumo(bimestre: int | None = None) -> list[dict[str, Any]]:
    where = "WHERE bimestre = %s" if bimestre else ""
    params = (bimestre,) if bimestre else ()
    return query(
        f"""
        WITH consumo AS (
            SELECT
                alcaldia,
                ROUND(SUM(total_agua), 2) AS total_agua,
                ROUND(AVG(consumo_promedio), 2) AS consumo_promedio,
                SUM(registros)::INT AS registros
            FROM vw_consumo_por_alcaldia
            {where}
            GROUP BY alcaldia
        )
        SELECT
            alcaldia,
            total_agua,
            consumo_promedio,
            registros,
            ROW_NUMBER() OVER (ORDER BY total_agua DESC) AS ranking
        FROM consumo
        ORDER BY ranking;
        """,
        params,
    )


@app.get("/api/consumo-indice")
def consumo_indice(bimestre: int | None = None) -> list[dict[str, Any]]:
    where = "WHERE bimestre = %s" if bimestre else ""
    params = (bimestre,) if bimestre else ()
    return query(
        f"""
        SELECT
            indice_des,
            ROUND(SUM(total_agua), 2) AS total_agua,
            ROUND(AVG(consumo_promedio), 2) AS consumo_promedio
        FROM vw_consumo_por_indice_desarrollo
        {where}
        GROUP BY indice_des
        ORDER BY total_agua DESC;
        """,
        params,
    )


@app.get("/api/correlacion")
def correlacion() -> dict[str, Any]:
    return query("SELECT * FROM vw_correlacion_clima_consumo;")[0]
