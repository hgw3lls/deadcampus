(function () {
  const data = window.DEAD_CAMPUS_ATLAS;
  const sites = data.publicSites;
  const typology = data.typology;
  const state = {
    view: "archive",
    query: "",
    morphology: "All typologies",
    priorityOnly: false,
    activeId: sites[0]?.id,
  };

  const els = {
    statStrip: document.querySelector("#statStrip"),
    searchInput: document.querySelector("#searchInput"),
    morphologyFilter: document.querySelector("#morphologyFilter"),
    priorityOnly: document.querySelector("#priorityOnly"),
    mapPlane: document.querySelector("#mapPlane"),
    resultCount: document.querySelector("#resultCount"),
    recordNumber: document.querySelector("#recordNumber"),
    recordDetail: document.querySelector("#recordDetail"),
    recordList: document.querySelector("#recordList"),
    classBars: document.querySelector("#classBars"),
    timeline: document.querySelector("#timeline"),
    stateGrid: document.querySelector("#stateGrid"),
    releaseList: document.querySelector("#releaseList"),
    auditGrid: document.querySelector("#auditGrid"),
  };

  function byId(id) {
    return sites.find((site) => site.id === id) || sites[0];
  }

  function toneFor(morphology) {
    return typology[morphology]?.tone || "#4f4a45";
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("en-US").format(value);
  }

  function textMatch(site, query) {
    if (!query) return true;
    const haystack = [
      site.name,
      site.city,
      site.state,
      site.region,
      site.morphology,
      site.buyerController,
      site.reuseType,
      site.transformation,
      site.notes,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query.toLowerCase());
  }

  function filteredSites() {
    return sites.filter((site) => {
      const morphologyOk =
        state.morphology === "All typologies" || site.morphology === state.morphology;
      const priorityOk = !state.priorityOnly || site.atlasPriority === "Iconic";
      return morphologyOk && priorityOk && textMatch(site, state.query);
    });
  }

  function mapPosition(site) {
    const minLon = -125;
    const maxLon = -66;
    const minLat = 24;
    const maxLat = 50;
    const x = ((Number(site.longitude) - minLon) / (maxLon - minLon)) * 100;
    const y = (1 - (Number(site.latitude) - minLat) / (maxLat - minLat)) * 100;
    return {
      left: `${Math.max(4, Math.min(96, x))}%`,
      top: `${Math.max(6, Math.min(94, y))}%`,
    };
  }

  function renderStats() {
    const coordinates = sites.filter((site) => site.latitude && site.longitude).length;
    const iconic = sites.filter((site) => site.atlasPriority === "Iconic").length;
    const stats = [
      ["Public campuses", sites.length],
      ["Raw PEPS records", data.abyss.totalRecords],
      ["With coordinates", coordinates],
      ["Iconic records", iconic],
    ];
    els.statStrip.innerHTML = stats
      .map(
        ([label, value]) => `
          <div class="stat-cell">
            <span class="stat-value">${formatNumber(value)}</span>
            <span class="stat-label">${label}</span>
          </div>
        `,
      )
      .join("");
  }

  function renderFilters() {
    const options = ["All typologies", ...Object.keys(typology).sort()];
    els.morphologyFilter.innerHTML = options
      .map((option) => `<option value="${option}">${option}</option>`)
      .join("");
  }

  function renderMap(records) {
    els.mapPlane.innerHTML = "";
    records.forEach((site) => {
      const pos = mapPosition(site);
      const button = document.createElement("button");
      button.className = `site-pin${site.id === state.activeId ? " is-active" : ""}`;
      button.type = "button";
      button.style.left = pos.left;
      button.style.top = pos.top;
      button.style.setProperty("--pin-tone", toneFor(site.morphology));
      button.title = `${site.name}, ${site.state}`;
      button.setAttribute("aria-label", `Select ${site.name}`);
      button.addEventListener("click", () => {
        state.activeId = site.id;
        renderArchive();
      });
      els.mapPlane.appendChild(button);
    });
  }

  function renderRecord(site) {
    els.recordNumber.textContent = `#${String(site.recordNumber).padStart(2, "0")}`;
    const evidence = site.evidence.length
      ? site.evidence
          .map((item) => {
            const source = item.sourceUrl
              ? `<a href="${item.sourceUrl}" target="_blank" rel="noreferrer">source URL</a>`
              : item.sourceNote || "source needed";
            return `<li><strong>${item.sourceSheet}</strong> line ${item.line}: ${source}</li>`;
          })
          .join("")
      : "<li>Source trail pending.</li>";

    els.recordDetail.innerHTML = `
      <div class="record-kicker">
        <span class="tag" style="--tag-tone:${toneFor(site.morphology)}">${site.morphology}</span>
        <span class="tag" style="--tag-tone:#242320">${site.verification}</span>
        <span class="tag" style="--tag-tone:#285f74">${site.atlasPriority}</span>
      </div>
      <h4>${site.name}</h4>
      <p>${site.city ? `${site.city}, ` : ""}${site.state}. Closed ${site.closureYear}. ${site.transformation || site.notes}</p>
      <dl class="record-meta">
        <div><dt>Afterlife</dt><dd>${site.afterlife || site.reuseType || "Pending"}</dd></div>
        <div><dt>Controller</dt><dd>${site.buyerController || "Pending"}</dd></div>
        <div><dt>Scale</dt><dd>${site.scale || "Pending"}</dd></div>
        <div><dt>Sector</dt><dd>${site.sector || "Pending"}</dd></div>
      </dl>
      <p>${typology[site.morphology]?.description || ""}</p>
      <ul class="source-list">${evidence}</ul>
    `;
  }

  function renderList(records) {
    els.recordList.innerHTML = records
      .map(
        (site) => `
          <button class="record-button${site.id === state.activeId ? " is-active" : ""}" type="button" data-site-id="${site.id}">
            <strong>${site.name}</strong>
            <span>${site.state} / ${site.closureYear} / ${site.morphology}</span>
            <span>${site.buyerController || site.reuseType || "Afterlife pending"}</span>
          </button>
        `,
      )
      .join("");
    els.recordList.querySelectorAll("[data-site-id]").forEach((button) => {
      button.addEventListener("click", () => {
        state.activeId = button.dataset.siteId;
        renderArchive();
      });
    });
  }

  function renderArchive() {
    const records = filteredSites();
    if (!records.some((site) => site.id === state.activeId)) {
      state.activeId = records[0]?.id || sites[0].id;
    }
    els.resultCount.textContent = `${records.length} shown`;
    renderMap(records);
    renderRecord(byId(state.activeId));
    renderList(records);
  }

  function renderBarStack(target, rows, tone) {
    const max = Math.max(...rows.map((row) => row.count));
    target.innerHTML = rows
      .map(
        (row) => `
          <div class="bar-row">
            <span>${row.label}</span>
            <span class="bar-track">
              <span class="bar-fill" style="--bar-width:${(row.count / max) * 100}%; --bar-tone:${tone}"></span>
            </span>
            <span>${formatNumber(row.count)}</span>
          </div>
        `,
      )
      .join("");
  }

  function renderAbyss() {
    renderBarStack(els.classBars, data.abyss.classCounts, "#a44732");
    const max = Math.max(...data.abyss.timeline.map((row) => row.count));
    els.timeline.innerHTML = data.abyss.timeline
      .map(
        (row) => `
          <div class="year-bar">
            <span style="--bar-height:${Math.max(12, (row.count / max) * 220)}px"></span>
            <span>${row.label}</span>
          </div>
        `,
      )
      .join("");
    els.stateGrid.innerHTML = data.abyss.stateCounts
      .map(
        (row) => `
          <div class="state-cell">
            <strong>${formatNumber(row.count)}</strong>
            <span>${row.label}</span>
          </div>
        `,
      )
      .join("");
  }

  function renderMethod() {
    const releaseItems = [
      "One canonical record per public campus.",
      "Source URLs for every afterlife claim.",
      "Normalized morphology labels before publication.",
      "Coordinates for every public site.",
      "Raw PEPS rows kept separate from interpretive records.",
    ];
    els.releaseList.innerHTML = releaseItems.map((item) => `<li>${item}</li>`).join("");
    const auditRows = [
      ["Blank source URLs", data.queueAudit.blankCounts.sourceUrl],
      ["Non-URL source notes", data.queueAudit.nonUrlSourceUrlRows],
      ["Blank verification", data.queueAudit.blankCounts.verification],
      ["Duplicate non-PEPS rows", data.queueAudit.nonPepsDuplicateRows],
    ];
    els.auditGrid.innerHTML = auditRows
      .map(
        ([label, value]) => `
          <div class="audit-cell">
            <strong>${formatNumber(value)}</strong>
            <span>${label}</span>
          </div>
        `,
      )
      .join("");
  }

  function switchView(view) {
    state.view = view;
    document.querySelectorAll(".tab-button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.view === view);
    });
    document.querySelectorAll(".view-panel").forEach((panel) => {
      const isActive = panel.id === `view-${view}`;
      panel.hidden = !isActive;
      panel.classList.toggle("is-active", isActive);
    });
  }

  function bindEvents() {
    els.searchInput.addEventListener("input", (event) => {
      state.query = event.target.value;
      renderArchive();
    });
    els.morphologyFilter.addEventListener("change", (event) => {
      state.morphology = event.target.value;
      renderArchive();
    });
    els.priorityOnly.addEventListener("change", (event) => {
      state.priorityOnly = event.target.checked;
      renderArchive();
    });
    document.querySelectorAll(".tab-button").forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.view));
    });
  }

  function init() {
    renderStats();
    renderFilters();
    renderArchive();
    renderAbyss();
    renderMethod();
    bindEvents();
  }

  init();
})();
