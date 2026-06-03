import os
import shutil
import tempfile
import urllib.request
from pathlib import Path

from db import connect


BASE_DIR = Path(__file__).resolve().parent
DDL_PATH = BASE_DIR / "ddl" / "0_schema.sql"
DIM_PATH = BASE_DIR / "etl" / "2_dim.sql"
FACT_PATH = BASE_DIR / "etl" / "3_fact.sql"
CONSUMO_CSV = BASE_DIR / "data" / "consumo_agua_historico_2019.csv"
CLIMA_CSV = BASE_DIR / "data" / "open-meteo-19.44N99.11W2233m.csv"
CONSUMO_CSV_URL = os.getenv(
    "CONSUMO_CSV_URL",
    "https://datos.cdmx.gob.mx/dataset/eb38823c-488a-49e8-a2cf-62e628fa246f/resource/2263bf74-c0ed-4e7c-bb9c-73f0624ac1a9/download/consumo_agua_historico_2019.csv",
)


RESET_SQL = """
DROP VIEW IF EXISTS vw_correlacion_clima_consumo CASCADE;
DROP VIEW IF EXISTS vw_consumo_por_indice_desarrollo CASCADE;
DROP VIEW IF EXISTS vw_consumo_por_alcaldia CASCADE;
DROP VIEW IF EXISTS vw_consumo_clima_bimestral CASCADE;
DROP TABLE IF EXISTS fact_clima CASCADE;
DROP TABLE IF EXISTS fact_consumo_agua CASCADE;
DROP TABLE IF EXISTS dim_indice_des CASCADE;
DROP TABLE IF EXISTS dim_ubicacion CASCADE;
DROP TABLE IF EXISTS dim_tiempo CASCADE;
DROP TABLE IF EXISTS staging_clima CASCADE;
DROP TABLE IF EXISTS staging_consumo CASCADE;
"""


def _execute_sql_file(cursor, path: Path) -> None:
    cursor.execute(path.read_text(encoding="utf-8"))


def _download_file(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(delete=False) as temp_file:
        temp_path = Path(temp_file.name)

    try:
        print(f"Descargando CSV de consumo desde {url}", flush=True)
        with urllib.request.urlopen(url, timeout=90) as response:
            with temp_path.open("wb") as temp_file:
                shutil.copyfileobj(response, temp_file)
        if temp_path.stat().st_size == 0:
            raise RuntimeError("La descarga del CSV de consumo quedó vacía")
        temp_path.replace(destination)
    finally:
        if temp_path.exists():
            temp_path.unlink()


def _ensure_consumo_csv() -> None:
    if CONSUMO_CSV.exists() and CONSUMO_CSV.stat().st_size > 0:
        return
    _download_file(CONSUMO_CSV_URL, CONSUMO_CSV)


def _copy_csv(cursor, table: str, path: Path) -> None:
    with path.open("r", encoding="utf-8", newline="") as file:
        with cursor.copy(f"COPY {table} FROM STDIN WITH (FORMAT CSV, HEADER TRUE)") as copy:
            while chunk := file.read(1024 * 1024):
                copy.write(chunk)


def _fact_table_ready(cursor) -> bool:
    cursor.execute("SELECT to_regclass('public.fact_consumo_agua') AS table_name;")
    if cursor.fetchone()["table_name"] is None:
        return False

    cursor.execute("SELECT COUNT(*) AS registros FROM fact_consumo_agua;")
    return cursor.fetchone()["registros"] > 0


def initialize_warehouse_if_needed() -> None:
    if os.getenv("DW_AUTO_INIT", "true").lower() not in {"1", "true", "yes", "on"}:
        return

    with connect() as conn:
        with conn.cursor() as cursor:
            if _fact_table_ready(cursor):
                return

            _ensure_consumo_csv()
            for path in (DDL_PATH, DIM_PATH, FACT_PATH, CONSUMO_CSV, CLIMA_CSV):
                if not path.exists():
                    raise RuntimeError(f"No se encontró el archivo requerido para inicializar la base: {path}")
                if path.suffix == ".csv" and path.stat().st_size == 0:
                    raise RuntimeError(f"El archivo CSV requerido está vacío: {path}")

            cursor.execute(RESET_SQL)
            _execute_sql_file(cursor, DDL_PATH)
            _copy_csv(cursor, "staging_consumo", CONSUMO_CSV)
            _copy_csv(cursor, "staging_clima", CLIMA_CSV)
            _execute_sql_file(cursor, DIM_PATH)
            _execute_sql_file(cursor, FACT_PATH)
        conn.commit()
