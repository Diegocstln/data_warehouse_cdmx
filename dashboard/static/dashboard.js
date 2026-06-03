const money = new Intl.NumberFormat("es-MX", {
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat("es-MX", {
  maximumFractionDigits: 2,
});

const colors = {
  blue: "#2563eb",
  teal: "#0f9f8f",
  amber: "#c27a18",
  red: "#c24135",
  gray: "#64757b",
};

const mapColors = ["#e8f4f8", "#b9e1e7", "#74c7d2", "#2f9fb8", "#176b8a"];

let selectedBimestre = "";
let climaChart;
let alcaldiaChart;
let indiceChart;
let consumoMap;
let consumoLayer;
let alcaldiasGeoJson;

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error consultando ${url}`);
  }
  return response.json();
}

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function labelBimestre(row) {
  return `${row.anio} B${row.bimestre}`;
}

function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function renderKpis(data) {
  setText("kpi-total", money.format(data.consumo_total ?? 0));
  setText("kpi-promedio", number.format(data.consumo_promedio ?? 0));
  setText("kpi-bimestres", data.bimestres);
  setText(
    "kpi-correlacion",
    data.correlacion_consumo_temperatura === null
      ? "N/D"
      : number.format(data.correlacion_consumo_temperatura),
  );
}

function renderClimaChart(rows) {
  if (climaChart) climaChart.destroy();
  climaChart = new Chart(document.getElementById("climaChart"), {
    type: "bar",
    data: {
      labels: rows.map(labelBimestre),
      datasets: [
        {
          label: "Consumo total",
          type: "bar",
          data: rows.map((row) => row.total_agua),
          borderColor: colors.blue,
          backgroundColor: "rgba(37, 99, 235, 0.72)",
          borderRadius: 4,
          yAxisID: "y",
        },
        {
          label: "Temperatura promedio",
          type: "line",
          data: rows.map((row) => row.temp_promedio),
          borderColor: colors.red,
          backgroundColor: "rgba(194, 65, 53, 0.12)",
          yAxisID: "y1",
          tension: 0.25,
          pointRadius: rows.length === 1 ? 7 : 4,
          pointHoverRadius: rows.length === 1 ? 9 : 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        y: { beginAtZero: true, ticks: { callback: (value) => money.format(value) } },
        y1: { position: "right", grid: { drawOnChartArea: false } },
      },
    },
  });
}

function renderAlcaldiaChart(rows) {
  if (alcaldiaChart) alcaldiaChart.destroy();
  alcaldiaChart = new Chart(document.getElementById("alcaldiaChart"), {
    type: "bar",
    data: {
      labels: rows.map((row) => row.alcaldia),
      datasets: [
        {
          label: "Consumo total",
          data: rows.map((row) => row.total_agua),
          backgroundColor: colors.teal,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { maxRotation: 45, minRotation: 0 } },
        y: { beginAtZero: true, ticks: { callback: (value) => money.format(value) } },
      },
    },
  });
}

function renderIndiceChart(rows) {
  if (indiceChart) indiceChart.destroy();
  indiceChart = new Chart(document.getElementById("indiceChart"), {
    type: "doughnut",
    data: {
      labels: rows.map((row) => row.indice_des),
      datasets: [
        {
          data: rows.map((row) => row.total_agua),
          backgroundColor: [colors.blue, colors.teal, colors.amber, colors.red],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
      },
    },
  });
}

function getMapColor(value, maxValue) {
  if (!value || !maxValue) return "#eef3f4";
  const ratio = value / maxValue;
  if (ratio >= 0.8) return mapColors[4];
  if (ratio >= 0.6) return mapColors[3];
  if (ratio >= 0.4) return mapColors[2];
  if (ratio >= 0.2) return mapColors[1];
  return mapColors[0];
}

function initMap() {
  if (consumoMap) return consumoMap;

  consumoMap = L.map("consumoMap", {
    zoomControl: true,
    scrollWheelZoom: false,
    attributionControl: true,
  }).setView([19.35, -99.14], 10);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap &copy; CARTO",
  }).addTo(consumoMap);

  return consumoMap;
}

function renderLegend(maxValue) {
  const legend = document.getElementById("map-legend");
  const steps = [0.2, 0.4, 0.6, 0.8, 1];

  legend.innerHTML = `
    <span class="legend-title">Consumo total</span>
    <div class="legend-scale">
      ${steps
        .map(
          (step, index) => `
            <span>
              <i style="background:${mapColors[index]}"></i>
              ${money.format(maxValue * step)}
            </span>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderMap(rows) {
  const map = initMap();
  const byAlcaldia = new Map(rows.map((row) => [normalizeName(row.alcaldia), row]));
  const maxValue = Math.max(...rows.map((row) => row.total_agua ?? 0), 0);

  if (consumoLayer) {
    consumoLayer.removeFrom(map);
  }

  consumoLayer = L.geoJSON(alcaldiasGeoJson, {
    style(feature) {
      const data = byAlcaldia.get(normalizeName(feature.properties.NOMGEO));
      return {
        color: "#ffffff",
        fillColor: getMapColor(data?.total_agua, maxValue),
        fillOpacity: data ? 0.86 : 0.35,
        opacity: 1,
        weight: 1.4,
      };
    },
    onEachFeature(feature, layer) {
      const nombre = feature.properties.NOMGEO;
      const data = byAlcaldia.get(normalizeName(nombre));
      const tooltip = data
        ? `<strong>${nombre}</strong><br>Total: ${money.format(data.total_agua)}<br>Promedio: ${number.format(data.consumo_promedio)}<br>Ranking: #${data.ranking}`
        : `<strong>${nombre}</strong><br>Sin datos de consumo`;

      layer.bindTooltip(tooltip, { sticky: true, direction: "top" });
      layer.on({
        mouseover(event) {
          event.target.setStyle({ color: "#172326", fillOpacity: 0.96, weight: 2.4 });
          if (data) {
            setText(
              "map-selection",
              `${nombre}: ${money.format(data.total_agua)} | ranking #${data.ranking}`,
            );
          } else {
            setText("map-selection", `${nombre}: sin datos`);
          }
        },
        mouseout(event) {
          consumoLayer.resetStyle(event.target);
          setText("map-selection", selectedBimestre ? `Filtro B${selectedBimestre}` : "Todas las alcaldías");
        },
      });
    },
  }).addTo(map);

  map.fitBounds(consumoLayer.getBounds(), { padding: [18, 18] });
  setTimeout(() => map.invalidateSize(), 0);
  renderLegend(maxValue);
  setText("map-selection", selectedBimestre ? `Filtro B${selectedBimestre}` : "Todas las alcaldías");
}

function renderTable(rows) {
  const body = document.getElementById("summary-body");
  body.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td>${labelBimestre(row)}</td>
          <td>${money.format(row.total_agua)}</td>
          <td>${number.format(row.consumo_promedio)}</td>
          <td>${number.format(row.temp_promedio)} C</td>
          <td>${number.format(row.total_lluvia)} mm</td>
          <td>${row.dias_ola_calor}</td>
        </tr>
      `,
    )
    .join("");
}

function apiUrl(path) {
  const params = new URLSearchParams();
  if (selectedBimestre) params.set("bimestre", selectedBimestre);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

async function loadDashboard() {
  try {
    setText("status", selectedBimestre ? `Cargando B${selectedBimestre}` : "Cargando datos");
    const [kpis, consumoClima, alcaldias, indices, mapaConsumo, geoJson] = await Promise.all([
      getJson(apiUrl("/api/kpis")),
      getJson(apiUrl("/api/consumo-clima")),
      getJson(`${apiUrl("/api/consumo-alcaldia")}${selectedBimestre ? "&" : "?"}limit=10`),
      getJson(apiUrl("/api/consumo-indice")),
      getJson(apiUrl("/api/mapa-consumo")),
      alcaldiasGeoJson ?? getJson("/static/alcaldias_cdmx.geojson"),
    ]);

    alcaldiasGeoJson = geoJson;
    renderKpis(kpis);
    renderClimaChart(consumoClima);
    renderAlcaldiaChart(alcaldias);
    renderIndiceChart(indices);
    renderMap(mapaConsumo);
    renderTable(consumoClima);
    setText("status", selectedBimestre ? `Filtro B${selectedBimestre}` : "Datos actualizados");
  } catch (error) {
    console.error(error);
    setText("status", "Error al cargar");
  }
}

function initFilters() {
  document.querySelectorAll(".filter-button").forEach((button) => {
    button.addEventListener("click", () => {
      selectedBimestre = button.dataset.bimestre;
      document.querySelectorAll(".filter-button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      loadDashboard();
    });
  });
}

initFilters();
loadDashboard();
