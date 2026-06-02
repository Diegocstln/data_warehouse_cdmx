import os
import time
from decimal import Decimal
from typing import Any

import psycopg
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from psycopg.rows import dict_row
from starlette.requests import Request


DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "5432")),
    "dbname": os.getenv("DB_NAME", "data_warehouse"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "postgres"),
}

app = FastAPI(title="Dashboard Data Warehouse CDMX")
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


def normalize(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    return value


def query(sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    for attempt in range(12):
        try:
            with psycopg.connect(**DB_CONFIG, row_factory=dict_row) as conn:
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
def kpis() -> dict[str, Any]:
    totals = query(
        """
        SELECT
            ROUND(SUM(total_agua), 2) AS consumo_total,
            ROUND(AVG(consumo_promedio), 2) AS consumo_promedio,
            COUNT(*) AS bimestres
        FROM vw_consumo_clima_bimestral;
        """
    )[0]
    corr = query("SELECT * FROM vw_correlacion_clima_consumo;")[0]
    return {**totals, **corr}


@app.get("/api/consumo-clima")
def consumo_clima() -> list[dict[str, Any]]:
    return query(
        """
        SELECT *
        FROM vw_consumo_clima_bimestral
        ORDER BY anio, bimestre;
        """
    )


@app.get("/api/consumo-alcaldia")
def consumo_alcaldia(limit: int = 10) -> list[dict[str, Any]]:
    limit = max(1, min(limit, 20))
    return query(
        """
        SELECT
            alcaldia,
            ROUND(SUM(total_agua), 2) AS total_agua,
            ROUND(AVG(consumo_promedio), 2) AS consumo_promedio
        FROM vw_consumo_por_alcaldia
        GROUP BY alcaldia
        ORDER BY total_agua DESC
        LIMIT %s;
        """,
        (limit,),
    )


@app.get("/api/consumo-indice")
def consumo_indice() -> list[dict[str, Any]]:
    return query(
        """
        SELECT
            indice_des,
            ROUND(SUM(total_agua), 2) AS total_agua,
            ROUND(AVG(consumo_promedio), 2) AS consumo_promedio
        FROM vw_consumo_por_indice_desarrollo
        GROUP BY indice_des
        ORDER BY total_agua DESC;
        """
    )


@app.get("/api/correlacion")
def correlacion() -> dict[str, Any]:
    return query("SELECT * FROM vw_correlacion_clima_consumo;")[0]
