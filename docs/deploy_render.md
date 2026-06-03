# Deploy en Render

Esta configuracion despliega el dashboard con FastAPI real y una base PostgreSQL gestionada por Render.

## Que se despliega

- Web service: `data-warehouse-cdmx-dashboard` en plan Free.
- Base PostgreSQL: `data-warehouse-cdmx-db` en plan Free.
- Archivo de infraestructura: `render.yaml`.

El servicio usa `dashboard/Dockerfile.render`. Ese Dockerfile copia el dashboard, los CSV, el DDL y el ETL dentro de la imagen. Al arrancar, FastAPI revisa si `fact_consumo_agua` ya tiene datos; si la base esta vacia, ejecuta el DDL, carga los CSV en staging y corre el ETL.

## Pasos

1. Entra a Render: https://render.com
2. Conecta tu cuenta de GitHub si aun no esta conectada.
3. Selecciona **New** > **Blueprint**.
4. Elige el repo `Diegocstln/data_warehouse_cdmx`.
5. Usa la rama `mejoras-dw-cdmx` cuando estos cambios ya esten mergeados.
6. Render detectara `render.yaml` y propondra crear el web service y la base PostgreSQL.
7. Confirma que ambos recursos muestran plan **Free** antes de crear el Blueprint.
8. Espera el primer deploy. La primera carga puede tardar mas porque inicializa el Data Warehouse.
9. Abre la URL publica del web service, por ejemplo:

```text
https://data-warehouse-cdmx-dashboard.onrender.com
```

## Variables

`render.yaml` configura estas variables automaticamente:

- `DATABASE_URL`: connection string de la base PostgreSQL gestionada.
- `DW_AUTO_INIT=true`: permite inicializar la base si esta vacia.

## Verificacion

Probar endpoints:

```text
/api/kpis
/api/mapa-consumo
/api/consumo-clima
```

El dashboard principal queda en `/`.

## Nota sobre costos

El Blueprint declara `plan: free` para el web service y para Postgres. Si Render pide tarjeta, revisa que no estes creando un recurso pagado. La base Postgres Free tiene limite de 1 GB y expira a los 30 dias.

Si alguna vez quieres recrear los datos desde cero, vacia o reemplaza la base PostgreSQL gestionada y redeploya el servicio. El bootstrap solo carga datos cuando `fact_consumo_agua` no existe o esta vacia.
