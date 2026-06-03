from __future__ import annotations

import os
from decimal import Decimal
from typing import Any

import psycopg
from psycopg.rows import dict_row


DATABASE_URL = os.getenv("DATABASE_URL")
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "5432")),
    "dbname": os.getenv("DB_NAME", "data_warehouse"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "postgres"),
}


def connect(row_factory: Any | None = dict_row) -> psycopg.Connection[Any]:
    if DATABASE_URL:
        return psycopg.connect(DATABASE_URL, row_factory=row_factory)
    return psycopg.connect(**DB_CONFIG, row_factory=row_factory)


def normalize(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    return value
