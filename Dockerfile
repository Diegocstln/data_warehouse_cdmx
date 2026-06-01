FROM postgres:16

RUN mkdir -p /docker-entrypoint-initdb.d/data
RUN mkdir -p /docker-entrypoint-initdb.d/scripts

COPY data/*.csv /docker-entrypoint-initdb.d/data/
COPY ddl/*.sql /docker-entrypoint-initdb.d/
COPY etl/*.sql /docker-entrypoint-initdb.d/
COPY scripts/*.sql /docker-entrypoint-initdb.d/scripts/
