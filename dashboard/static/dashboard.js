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

let selectedBimestre = "";
let climaChart;
let alcaldiaChart;
let indiceChart;

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
    type: "line",
    data: {
      labels: rows.map(labelBimestre),
      datasets: [
        {
          label: "Consumo total",
          data: rows.map((row) => row.total_agua),
          borderColor: colors.blue,
          backgroundColor: "rgba(37, 99, 235, 0.12)",
          yAxisID: "y",
          tension: 0.25,
          fill: true,
        },
        {
          label: "Temperatura promedio",
          data: rows.map((row) => row.temp_promedio),
          borderColor: colors.red,
          backgroundColor: "rgba(194, 65, 53, 0.12)",
          yAxisID: "y1",
          tension: 0.25,
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
    const [kpis, consumoClima, alcaldias, indices] = await Promise.all([
      getJson(apiUrl("/api/kpis")),
      getJson(apiUrl("/api/consumo-clima")),
      getJson(`${apiUrl("/api/consumo-alcaldia")}${selectedBimestre ? "&" : "?"}limit=10`),
      getJson(apiUrl("/api/consumo-indice")),
    ]);

    renderKpis(kpis);
    renderClimaChart(consumoClima);
    renderAlcaldiaChart(alcaldias);
    renderIndiceChart(indices);
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
