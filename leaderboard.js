document.addEventListener("DOMContentLoaded", () => {
  const tableElement = document.getElementById("leaderboard-table");
  const tableTitle = document.getElementById("table-title");
  const tableCaption = document.getElementById("table-caption");
  const sourcePill = document.getElementById("source-pill");
  const topScore = document.getElementById("top-score");
  const lastUpdated = document.getElementById("last-updated");
  const searchInput = document.getElementById("model-search");
  const tabButtons = Array.from(document.querySelectorAll(".tab-button"));
  const filterButtons = Array.from(document.querySelectorAll(".filter-button"));

  const state = {
    data: null,
    view: "success",
    typeFilter: "all",
    query: "",
    sortKey: "scores.total",
    sortDirection: "desc"
  };

  const viewConfig = {
    success: {
      title: "Primary Success Rate",
      caption: "Success Rate (%) over the 149-task primary pool.",
      defaultSort: "scores.total",
      defaultDirection: "desc"
    },
    stability: {
      title: "Stability Evaluation",
      caption: "Pass rate (%) under original, Chinese, instruction variation, dark mode, and pad settings.",
      defaultSort: "stability.spr",
      defaultDirection: "desc"
    },
    cost: {
      title: "Inference Cost",
      caption: "Total output tokens and average per-step output tokens.",
      defaultSort: "cost.pt",
      defaultDirection: "asc"
    },
    diagnostics: {
      title: "Capability Diagnostics",
      caption: "PUDAM capability success rate (%) on basic (L1-2) and advanced (L3-4) task levels.",
      defaultSort: "diagnostics.average",
      defaultDirection: "desc"
    }
  };

  fetch("results/venusbench-mobile.json")
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      state.data = data;
      hydrateSummary(data);
      render();
    })
    .catch((error) => {
      console.error("Failed to load leaderboard data:", error);
      tableElement.innerHTML = `
        <tbody>
          <tr>
            <td class="load-error">
              Failed to load leaderboard data. Please serve this directory with a local web server.
            </td>
          </tr>
        </tbody>
      `;
      sourcePill.textContent = "Data unavailable";
    });

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.view;
      state.view = view;
      state.sortKey = viewConfig[view].defaultSort;
      state.sortDirection = viewConfig[view].defaultDirection;
      tabButtons.forEach((item) => {
        item.classList.toggle("active", item === button);
        item.setAttribute("aria-selected", item === button ? "true" : "false");
      });
      render();
    });
  });

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.typeFilter = button.dataset.filter;
      filterButtons.forEach((item) => item.classList.toggle("active", item === button));
      render();
    });
  });

  searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    render();
  });

  function hydrateSummary(data) {
    const best = data.models.reduce((winner, model) => {
      return model.scores.total > winner.scores.total ? model : winner;
    }, data.models[0]);

    topScore.textContent = `${formatNumber(best.scores.total)}%`;
    sourcePill.textContent = data.metadata.source;
    lastUpdated.textContent = data.metadata.lastUpdated;
  }

  function render() {
    if (!state.data) return;

    const config = viewConfig[state.view];
    tableTitle.textContent = config.title;
    tableCaption.textContent = config.caption;

    const filteredModels = state.data.models
      .filter((model) => state.typeFilter === "all" || model.type === state.typeFilter)
      .filter((model) => {
        if (!state.query) return true;
        return `${model.name} ${model.type} ${model.setup}`.toLowerCase().includes(state.query);
      });

    const sortedModels = filteredModels.sort((a, b) => {
      const aValue = getValue(a, state.sortKey);
      const bValue = getValue(b, state.sortKey);
      const aMissing = isMissing(aValue);
      const bMissing = isMissing(bValue);

      if (aMissing && bMissing) return 0;
      if (aMissing) return 1;
      if (bMissing) return -1;

      if (typeof aValue === "string" || typeof bValue === "string") {
        return state.sortDirection === "asc"
          ? String(aValue).localeCompare(String(bValue))
          : String(bValue).localeCompare(String(aValue));
      }

      return state.sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    });

    if (state.view === "success") renderSuccessTable(sortedModels);
    if (state.view === "stability") renderStabilityTable(sortedModels);
    if (state.view === "cost") renderCostTable(sortedModels);
    if (state.view === "diagnostics") renderDiagnosticsTable(sortedModels);

    addSortingHandlers();
  }

  function renderSuccessTable(models) {
    const taskColumns = state.data.metadata.taskColumns;
    const header = `
      <thead>
        <tr>
          <th rowspan="2" class="rank-column">Rank</th>
          <th rowspan="2" class="sortable model-column" data-key="name">Model</th>
          <th rowspan="2" class="sortable" data-key="type">Type</th>
          <th colspan="${taskColumns.length}" class="header-group">Task Categories</th>
          <th rowspan="2" class="sortable total-column border-left-strong" data-key="scores.total">Total</th>
        </tr>
        <tr>
          ${taskColumns.map((column, index) => `
            <th class="sortable ${index === 0 ? "border-left-soft" : ""}" data-key="scores.${column.key}" title="${column.description}">
              ${column.label}
            </th>
          `).join("")}
        </tr>
      </thead>
    `;

    const body = models.map((model, index) => `
      <tr>
        <td class="rank-cell">${index + 1}</td>
        <td class="model-name">${renderModelName(model)}</td>
        <td>${renderTypeTag(model.type)}</td>
        ${taskColumns.map((column, columnIndex) => `
          <td class="${columnIndex === 0 ? "border-left-soft" : ""}">${formatPercent(model.scores[column.key])}</td>
        `).join("")}
        <td class="total-value border-left-strong">${formatPercent(model.scores.total)}</td>
      </tr>
    `).join("");

    tableElement.innerHTML = header + `<tbody>${body || renderEmptyRow(13)}</tbody>`;
  }

  function renderStabilityTable(models) {
    const columns = state.data.metadata.stabilityColumns;
    const header = `
      <thead>
        <tr>
          <th rowspan="2" class="rank-column">Rank</th>
          <th rowspan="2" class="sortable model-column" data-key="name">Model</th>
          <th colspan="5" class="header-group">Environment Settings</th>
          <th colspan="3" class="header-group border-left-strong">Summary</th>
        </tr>
        <tr>
          ${columns.map((column, index) => `
            <th class="sortable ${index === 5 ? "border-left-strong" : ""}" data-key="stability.${column.key}">
              ${column.label}
            </th>
          `).join("")}
        </tr>
      </thead>
    `;

    const body = models.map((model, index) => `
      <tr>
        <td class="rank-cell">${index + 1}</td>
        <td class="model-name">${renderModelName(model)}</td>
        ${columns.map((column, columnIndex) => `
          <td class="${columnIndex === 5 ? "border-left-strong" : ""} ${column.key === "spr" ? "total-value" : ""}">
            ${formatPercent(getValue(model, `stability.${column.key}`), 0)}
          </td>
        `).join("")}
      </tr>
    `).join("");

    tableElement.innerHTML = header + `<tbody>${body || renderEmptyRow(10)}</tbody>`;
  }

  function renderCostTable(models) {
    const header = `
      <thead>
        <tr>
          <th class="rank-column">Rank</th>
          <th class="sortable model-column" data-key="name">Model</th>
          <th class="sortable" data-key="type">Type</th>
          <th class="sortable" data-key="cost.tt_k">TT (K)</th>
          <th class="sortable" data-key="cost.pt">PT</th>
          <th class="sortable total-column border-left-strong" data-key="scores.total">Total SR</th>
        </tr>
      </thead>
    `;

    const body = models.map((model, index) => `
      <tr>
        <td class="rank-cell">${index + 1}</td>
        <td class="model-name">${renderModelName(model)}</td>
        <td>${renderTypeTag(model.type)}</td>
        <td>${formatNumber(getValue(model, "cost.tt_k"), 1)}</td>
        <td>${formatNumber(getValue(model, "cost.pt"), 1)}</td>
        <td class="total-value border-left-strong">${formatPercent(model.scores.total)}</td>
      </tr>
    `).join("");

    tableElement.innerHTML = header + `<tbody>${body || renderEmptyRow(6)}</tbody>`;
  }

  function renderDiagnosticsTable(models) {
    const columns = state.data.metadata.diagnosticColumns;
    const header = `
      <thead>
        <tr>
          <th rowspan="2" class="rank-column">Rank</th>
          <th rowspan="2" class="sortable model-column" data-key="name">Model</th>
          ${columns.map((column, index) => `
            <th colspan="2" class="header-group ${index === 0 ? "border-left-soft" : ""}">
              ${column.short}: ${column.group}
            </th>
          `).join("")}
          <th rowspan="2" class="sortable total-column border-left-strong" data-key="diagnostics.average">Avg</th>
        </tr>
        <tr>
          ${columns.map((column, index) => `
            <th class="sortable ${index === 0 ? "border-left-soft" : ""}" data-key="diagnostics.${column.keys[0]}">L1-2</th>
            <th class="sortable" data-key="diagnostics.${column.keys[1]}">L3-4</th>
          `).join("")}
        </tr>
      </thead>
    `;

    const body = models.map((model, index) => `
      <tr>
        <td class="rank-cell">${index + 1}</td>
        <td class="model-name">${renderModelName(model)}</td>
        ${columns.map((column, columnIndex) => `
          <td class="${columnIndex === 0 ? "border-left-soft" : ""}">${formatPercent(getValue(model, `diagnostics.${column.keys[0]}`), 0)}</td>
          <td>${formatPercent(getValue(model, `diagnostics.${column.keys[1]}`), 0)}</td>
        `).join("")}
        <td class="total-value border-left-strong">${formatPercent(getDiagnosticAverage(model), 1)}</td>
      </tr>
    `).join("");

    tableElement.innerHTML = header + `<tbody>${body || renderEmptyRow(13)}</tbody>`;
  }

  function addSortingHandlers() {
    const headers = Array.from(tableElement.querySelectorAll("th.sortable"));
    headers.forEach((header) => {
      const key = header.dataset.key;
      header.classList.toggle("sorted-asc", key === state.sortKey && state.sortDirection === "asc");
      header.classList.toggle("sorted-desc", key === state.sortKey && state.sortDirection === "desc");

      header.addEventListener("click", () => {
        if (state.sortKey === key) {
          state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
        } else {
          state.sortKey = key;
          state.sortDirection = key.startsWith("cost.") ? "asc" : "desc";
        }
        render();
      });
    });
  }

  function renderModelName(model) {
    const name = model.link
      ? `<a href="${model.link}" target="_blank" class="model-link">${model.name}</a>`
      : `<span>${model.name}</span>`;

    return `
      <div class="model-stack">
        ${name}
        <span class="setup-label">${model.setup}</span>
      </div>
    `;
  }

  function renderTypeTag(type) {
    const className = type === "Closed-source" ? "tag-closed" : "tag-open";
    return `<span class="type-tag ${className}">${type}</span>`;
  }

  function renderEmptyRow(colspan) {
    return `<tr><td colspan="${colspan}" class="empty-state">No matching models.</td></tr>`;
  }

  function getValue(model, key) {
    if (key === "name") return model.name;
    if (key === "type") return model.type;
    if (key === "diagnostics.average") return getDiagnosticAverage(model);

    const value = key.split(".").reduce((currentValue, part) => {
      if (currentValue === undefined || currentValue === null) return null;
      return currentValue[part];
    }, model);

    return isMissing(value) ? null : value;
  }

  function getDiagnosticAverage(model) {
    const values = Object.values(model.diagnostics || {}).filter((value) => !isMissing(value));
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function isMissing(value) {
    return value === undefined || value === null || value === "";
  }

  function formatPercent(value, digits = 1) {
    return formatNumber(value, digits);
  }

  function formatNumber(value, digits = 1) {
    if (isMissing(value) || Number.isNaN(Number(value))) return "N/A";
    if (Number.isInteger(value) && digits === 0) return `${value}`;
    return Number(value).toFixed(digits);
  }
});
