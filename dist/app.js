(function () {
  const data = window.DEAD_CAMPUS_ATLAS;
  const sites = data.publicSites;
  const typology = data.typology;
  const FEDERAL_RECORDS_URL = "data/federal-records.js";
  // The federal table is ~11 MB, so it is loaded only when the Abyss view is opened.
  let federalRecords = [];
  let federalLoad = null;
  const state = {
    view: "archive",
    query: "",
    morphology: "All typologies",
    priorityOnly: false,
    activeId: sites[0]?.id || "",
    federalQuery: "",
    federalState: "All states",
    federalYear: "All years",
    federalSiteType: "All types",
    federalPage: 1,
    federalPageSize: 50,
    federalStatus: "idle",
  };
  const views = new Set(["archive", "abyss", "method"]);

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
    federalSearch: document.querySelector("#federalSearch"),
    federalState: document.querySelector("#federalState"),
    federalYear: document.querySelector("#federalYear"),
    federalSiteType: document.querySelector("#federalSiteType"),
    federalResultCount: document.querySelector("#federalResultCount"),
    federalTableBody: document.querySelector("#federalTableBody"),
    federalPager: document.querySelector("#federalPager"),
    releaseList: document.querySelector("#releaseList"),
    auditGrid: document.querySelector("#auditGrid"),
    federalStatus: document.querySelector("#federalStatus"),
  };

  const allowedUrlProtocols = new Set(["http:", "https:"]);
  const mapZoom = {
    min: 1,
    max: 4,
    step: 0.5,
  };
  const mapState = {
    viewport: null,
    stage: null,
    markerLayer: null,
    markerById: new Map(),
    lastRecordKey: "",
    transform: { scale: 1, x: 0, y: 0 },
    drag: null,
  };

  function clear(element) {
    element.replaceChildren();
  }

  function append(parent, children) {
    const items = Array.isArray(children) ? children : [children];
    items.forEach((child) => {
      if (child === null || child === undefined) return;
      parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
    });
  }

  function element(tag, options = {}, children = []) {
    const node = document.createElement(tag);
    if (options.className) node.className = options.className;
    if (options.text !== undefined) node.textContent = options.text;
    if (options.attrs) {
      Object.entries(options.attrs).forEach(([name, value]) => {
        if (value !== null && value !== undefined && value !== false) {
          node.setAttribute(name, String(value));
        }
      });
    }
    if (options.dataset) {
      Object.entries(options.dataset).forEach(([name, value]) => {
        node.dataset[name] = String(value);
      });
    }
    if (options.style) {
      Object.entries(options.style).forEach(([name, value]) => {
        if (name.startsWith("--")) {
          node.style.setProperty(name, String(value));
        } else {
          node.style[name] = String(value);
        }
      });
    }
    append(node, children);
    return node;
  }

  function safeHttpUrl(value) {
    if (!value) return "";
    try {
      const url = new URL(value, window.location.href);
      return allowedUrlProtocols.has(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function byId(id) {
    return sites.find((site) => site.id === id) || null;
  }

  // Routes: "#campus/<id>" opens a campus dossier, "#view/<name>" opens a tab.
  // Campus ids are permanent, so "#campus/<id>" is the citation URL for a record.
  function readRoute() {
    const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    const [kind, value] = hash.split("/");
    if (kind === "campus" && byId(value)) return { view: "archive", campusId: value };
    if (kind === "view" && views.has(value)) return { view: value };
    return null;
  }

  function writeRoute() {
    const next =
      state.view === "archive" && state.activeId ? `#campus/${state.activeId}` : `#view/${state.view}`;
    if (window.location.hash !== next) {
      history.replaceState(null, "", next);
    }
  }

  function citationUrl(site) {
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}#campus/${site.id}`;
  }

  function applyRoute() {
    const route = readRoute();
    if (!route) return false;
    if (route.campusId) {
      // Clear filters that would hide the cited campus.
      const target = byId(route.campusId);
      if (!filteredSites().includes(target)) {
        state.query = "";
        state.morphology = "All typologies";
        state.priorityOnly = false;
        els.searchInput.value = "";
        els.morphologyFilter.value = state.morphology;
        els.priorityOnly.checked = false;
      }
      state.activeId = route.campusId;
    }
    switchView(route.view);
    if (route.view === "archive") renderArchive();
    return true;
  }

  function indexFederalRecord(record) {
    return {
      ...record,
      searchText: [
        record.name,
        record.location,
        record.address,
        record.city,
        record.state,
        record.country,
        record.opeid,
        record.rootOpeid,
        record.siteType,
        record.classification,
      ]
        .join(" ")
        .toLowerCase(),
    };
  }

  function setFederalStatus(status, message) {
    state.federalStatus = status;
    if (!els.federalStatus) return;
    els.federalStatus.textContent = message || "";
    els.federalStatus.hidden = !message;
  }

  function loadFederalRecords() {
    if (federalLoad) return federalLoad;
    setFederalStatus("loading", `Loading ${formatNumber(data.abyss.totalRecords)} federal records…`);
    federalLoad = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = FEDERAL_RECORDS_URL;
      script.async = true;
      script.onload = () => {
        const source = window.DEAD_CAMPUS_FEDERAL_RECORDS || [];
        federalRecords = source.map(indexFederalRecord);
        delete window.DEAD_CAMPUS_FEDERAL_RECORDS;
        resolve(federalRecords);
      };
      script.onerror = () => reject(new Error(`Could not load ${FEDERAL_RECORDS_URL}`));
      document.head.appendChild(script);
    })
      .then((records) => {
        setFederalStatus("ready", "");
        renderFederalFilters();
        renderFederalTable();
        return records;
      })
      .catch((error) => {
        federalLoad = null;
        setFederalStatus("error", "The federal record table could not be loaded. Reload to try again.");
        console.error(error);
        return [];
      });
    return federalLoad;
  }

  function toneFor(morphology) {
    return typology[morphology]?.tone || "#4f4a45";
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("en-US").format(value);
  }

  function formatMetric(value) {
    return typeof value === "number" ? formatNumber(value) : value || "Pending";
  }

  function compactDate(value, year) {
    if (!value) return year || "Unknown";
    return String(value).split(" ")[0];
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
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

  function federalRecordState(record) {
    return record.state || "Foreign/unknown";
  }

  function filteredFederalRecords() {
    const query = state.federalQuery.trim().toLowerCase();
    return federalRecords.filter((record) => {
      const queryOk = !query || record.searchText.includes(query);
      const stateOk = state.federalState === "All states" || federalRecordState(record) === state.federalState;
      const yearOk = state.federalYear === "All years" || String(record.closureYear || "Unknown") === state.federalYear;
      const typeOk = state.federalSiteType === "All types" || (record.siteType || "Unclassified") === state.federalSiteType;
      return queryOk && stateOk && yearOk && typeOk;
    });
  }

  function filterOption(value) {
    return element("option", { text: value, attrs: { value } });
  }

  function mapPercent(site) {
    const minLon = -125;
    const maxLon = -66;
    const minLat = 24;
    const maxLat = 50;
    const x = ((Number(site.longitude) - minLon) / (maxLon - minLon)) * 100;
    const y = (1 - (Number(site.latitude) - minLat) / (maxLat - minLat)) * 100;
    return {
      x: clamp(x, 0, 100),
      y: clamp(y, 0, 100),
    };
  }

  function mapPosition(site) {
    const pos = mapPercent(site);
    return {
      left: `${clamp(pos.x, 4, 96)}%`,
      top: `${clamp(pos.y, 6, 94)}%`,
    };
  }

  function renderStats() {
    const coordinates = sites.filter((site) => site.latitude && site.longitude).length;
    const iconic = sites.filter((site) => site.atlasPriority === "Iconic").length;
    const stats = [
      ["Curated campuses", sites.length],
      ["Federal records", data.abyss.totalRecords],
      ["With coordinates", coordinates],
      ["Iconic records", iconic],
    ];
    clear(els.statStrip);
    stats.forEach(([label, value]) => {
      els.statStrip.appendChild(
        element("div", { className: "stat-cell" }, [
          element("span", { className: "stat-value", text: formatNumber(value) }),
          element("span", { className: "stat-label", text: label }),
        ]),
      );
    });
  }

  function renderFilters() {
    const options = ["All typologies", ...Object.keys(typology).sort()];
    clear(els.morphologyFilter);
    options.forEach((option) => {
      els.morphologyFilter.appendChild(
        element("option", { text: option, attrs: { value: option } }),
      );
    });
  }

  function renderFederalFilters() {
    const states = [...new Set(federalRecords.map(federalRecordState))].sort();
    const years = [
      ...new Set(federalRecords.map((record) => String(record.closureYear || "Unknown"))),
    ].sort((a, b) => {
      if (a === "Unknown") return 1;
      if (b === "Unknown") return -1;
      return Number(b) - Number(a);
    });
    const siteTypes = [
      ...new Set(federalRecords.map((record) => record.siteType || "Unclassified")),
    ].sort();

    clear(els.federalState);
    ["All states", ...states].forEach((option) => els.federalState.appendChild(filterOption(option)));
    clear(els.federalYear);
    ["All years", ...years].forEach((option) => els.federalYear.appendChild(filterOption(option)));
    clear(els.federalSiteType);
    ["All types", ...siteTypes].forEach((option) => els.federalSiteType.appendChild(filterOption(option)));
  }

  function applyMapTransform() {
    if (!mapState.stage) return;
    const rect = els.mapPlane.getBoundingClientRect();
    const width = rect.width || 1;
    const height = rect.height || 1;
    const scaledWidth = width * mapState.transform.scale;
    const scaledHeight = height * mapState.transform.scale;

    mapState.transform.x =
      scaledWidth <= width
        ? (width - scaledWidth) / 2
        : clamp(mapState.transform.x, width - scaledWidth, 0);
    mapState.transform.y =
      scaledHeight <= height
        ? (height - scaledHeight) / 2
        : clamp(mapState.transform.y, height - scaledHeight, 0);

    mapState.stage.style.transform = `translate(${mapState.transform.x}px, ${mapState.transform.y}px) scale(${mapState.transform.scale})`;
    els.mapPlane.style.setProperty("--map-scale", mapState.transform.scale);
  }

  function zoomMap(nextScale, focalPoint) {
    const rect = els.mapPlane.getBoundingClientRect();
    const oldScale = mapState.transform.scale;
    const scale = clamp(nextScale, mapZoom.min, mapZoom.max);
    const focalX = focalPoint?.x ?? rect.width / 2;
    const focalY = focalPoint?.y ?? rect.height / 2;
    if (scale === oldScale) return;

    mapState.transform.x = focalX - (focalX - mapState.transform.x) * (scale / oldScale);
    mapState.transform.y = focalY - (focalY - mapState.transform.y) * (scale / oldScale);
    mapState.transform.scale = scale;
    applyMapTransform();
  }

  function resetMapTransform() {
    mapState.transform = { scale: 1, x: 0, y: 0 };
    applyMapTransform();
  }

  function focusMapOnSite(site, scale = 2.2) {
    const rect = els.mapPlane.getBoundingClientRect();
    const pos = mapPercent(site);
    mapState.transform.scale = clamp(scale, mapZoom.min, mapZoom.max);
    mapState.transform.x = rect.width / 2 - (pos.x / 100) * rect.width * mapState.transform.scale;
    mapState.transform.y = rect.height / 2 - (pos.y / 100) * rect.height * mapState.transform.scale;
    applyMapTransform();
  }

  function fitLocalMap(records, recordKey) {
    if (recordKey === mapState.lastRecordKey) return;
    mapState.lastRecordKey = recordKey;
    if (records.length === 1) {
      focusMapOnSite(records[0]);
      return;
    }
    resetMapTransform();
  }

  function startMapDrag(event) {
    if (event.button !== 0) return;
    mapState.drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: mapState.transform.x,
      originY: mapState.transform.y,
    };
    els.mapPlane.setPointerCapture(event.pointerId);
    els.mapPlane.classList.add("is-dragging");
  }

  function dragMap(event) {
    if (!mapState.drag || mapState.drag.pointerId !== event.pointerId) return;
    mapState.transform.x = mapState.drag.originX + event.clientX - mapState.drag.startX;
    mapState.transform.y = mapState.drag.originY + event.clientY - mapState.drag.startY;
    applyMapTransform();
  }

  function endMapDrag(event) {
    if (!mapState.drag || mapState.drag.pointerId !== event.pointerId) return;
    mapState.drag = null;
    els.mapPlane.releasePointerCapture(event.pointerId);
    els.mapPlane.classList.remove("is-dragging");
  }

  function initLocalMap() {
    if (mapState.viewport) return;

    clear(els.mapPlane);
    els.mapPlane.classList.add("is-map-ready");
    els.mapPlane.setAttribute("tabindex", "0");

    const controls = element("div", { className: "map-controls", attrs: { "aria-label": "Map controls" } }, [
      element("button", { text: "+", attrs: { type: "button", "aria-label": "Zoom map in" } }),
      element("button", { text: "-", attrs: { type: "button", "aria-label": "Zoom map out" } }),
      element("button", { text: "Reset", attrs: { type: "button" } }),
    ]);
    controls.addEventListener("pointerdown", (event) => event.stopPropagation());
    const [zoomIn, zoomOut, reset] = Array.from(controls.querySelectorAll("button"));
    zoomIn.addEventListener("click", () => zoomMap(mapState.transform.scale + mapZoom.step));
    zoomOut.addEventListener("click", () => zoomMap(mapState.transform.scale - mapZoom.step));
    reset.addEventListener("click", resetMapTransform);

    mapState.viewport = element("div", { className: "map-viewport" });
    mapState.stage = element("div", { className: "map-stage" }, [
      element("img", {
        className: "map-image",
        attrs: { src: "assets/phase10-map.png", alt: "" },
      }),
    ]);
    mapState.markerLayer = element("div", { className: "map-marker-layer" });
    mapState.stage.appendChild(mapState.markerLayer);
    mapState.viewport.appendChild(mapState.stage);
    append(els.mapPlane, [mapState.viewport, controls]);

    els.mapPlane.addEventListener("pointerdown", startMapDrag);
    els.mapPlane.addEventListener("pointermove", dragMap);
    els.mapPlane.addEventListener("pointerup", endMapDrag);
    els.mapPlane.addEventListener("pointercancel", endMapDrag);
    els.mapPlane.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        const rect = els.mapPlane.getBoundingClientRect();
        const direction = event.deltaY > 0 ? -mapZoom.step : mapZoom.step;
        zoomMap(mapState.transform.scale + direction, {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        });
      },
      { passive: false },
    );
    els.mapPlane.addEventListener("keydown", (event) => {
      const panStep = 34;
      if (event.key === "+" || event.key === "=") zoomMap(mapState.transform.scale + mapZoom.step);
      if (event.key === "-") zoomMap(mapState.transform.scale - mapZoom.step);
      if (event.key === "0") resetMapTransform();
      if (event.key === "ArrowLeft") mapState.transform.x += panStep;
      if (event.key === "ArrowRight") mapState.transform.x -= panStep;
      if (event.key === "ArrowUp") mapState.transform.y += panStep;
      if (event.key === "ArrowDown") mapState.transform.y -= panStep;
      if (["+", "=", "-", "0", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        applyMapTransform();
      }
    });
  }

  function renderMap(records) {
    initLocalMap();
    const recordKey = records.map((site) => site.id).join("|");
    clear(mapState.markerLayer);
    mapState.markerById.clear();

    records.forEach((site) => {
      const pos = mapPosition(site);
      const button = element("button", {
        className: `map-marker${site.id === state.activeId ? " is-active" : ""}`,
        attrs: {
          type: "button",
          title: `${site.name}, ${site.state}`,
          "aria-label": `Select ${site.name}`,
        },
        style: {
          left: pos.left,
          top: pos.top,
          "--pin-tone": toneFor(site.morphology),
        },
      });
      button.addEventListener("click", () => {
        state.activeId = site.id;
        renderArchive();
      });
      button.addEventListener("pointerdown", (event) => event.stopPropagation());
      mapState.markerLayer.appendChild(button);
      mapState.markerById.set(site.id, button);
    });

    fitLocalMap(records, recordKey);
  }

  function renderEmptyRecord() {
    els.recordNumber.textContent = "";
    clear(els.recordDetail);
    els.recordDetail.appendChild(
      element("div", { className: "empty-state" }, [
        element("h4", { text: "No matching campus" }),
        element("p", { text: "Clear a filter or try a broader search." }),
      ]),
    );
  }

  function sourceNode(item) {
    const safeUrl = safeHttpUrl(item.sourceUrl);
    if (safeUrl) {
      return element("a", {
        text: "source URL",
        attrs: {
          href: safeUrl,
          target: "_blank",
          rel: "noreferrer noopener",
        },
      });
    }
    return document.createTextNode(item.sourceNote || "source needed");
  }

  function evidenceItem(item) {
    const li = element("li");
    append(li, [
      element("strong", { text: item.sourceSheet || "Unknown source" }),
      ` line ${item.line || "?"}: `,
      sourceNode(item),
    ]);
    return li;
  }

  function tag(text, tone) {
    return element("span", {
      className: "tag",
      text,
      style: { "--tag-tone": tone },
    });
  }

  function metaItem(label, value) {
    return element("div", {}, [
      element("dt", { text: label }),
      element("dd", { text: value || "Pending" }),
    ]);
  }

  function gapLabel(gap) {
    const labels = {
      coordinates: "Coordinates needed",
      closureYear: "Closure year needed",
      morphology: "Morphology not normalized",
      sourceUrl: "Source URL needed",
      verification: "Verification pending",
      summary: "Summary needed",
    };
    return labels[gap] || gap;
  }

  function citationNode(site) {
    const url = citationUrl(site);
    const link = element("a", { text: url, attrs: { href: `#campus/${site.id}` } });
    link.addEventListener("click", (event) => {
      event.preventDefault();
      state.activeId = site.id;
      switchView("archive");
      renderArchive();
    });
    return element("p", { className: "record-cite" }, [
      element("span", { text: "Cite this record" }),
      link,
    ]);
  }

  function renderRecord(site) {
    if (!site) {
      renderEmptyRecord();
      return;
    }

    els.recordNumber.textContent = `#${String(site.recordNumber).padStart(2, "0")}`;
    const fallbackSummary = `${site.city ? `${site.city}, ` : ""}${site.state}. Closed ${
      site.closureYear
    }. ${site.transformation || site.notes || ""}`;

    clear(els.recordDetail);
    append(els.recordDetail, [
      element("div", { className: "record-kicker" }, [
        tag(site.morphology, toneFor(site.morphology)),
        tag(site.verification, "#242320"),
        tag(site.atlasPriority, "#285f74"),
      ]),
      element("h4", { text: site.name }),
      element("p", { text: site.publicSummary || fallbackSummary }),
      element("dl", { className: "record-meta" }, [
        metaItem("Afterlife", site.afterlife || site.reuseType),
        metaItem("Controller", site.buyerController),
        metaItem("Scale", site.scale),
        metaItem("Sector", site.sector),
      ]),
      element("p", {
        text: site.transformation || site.notes || typology[site.morphology]?.description || "",
      }),
      site.releaseGaps?.length
        ? element(
            "ul",
            { className: "gap-list", attrs: { "aria-label": "Release gaps" } },
            site.releaseGaps.map((gap) => element("li", { text: gapLabel(gap) })),
          )
        : null,
      element(
        "ul",
        { className: "source-list" },
        site.evidence.length
          ? site.evidence.map(evidenceItem)
          : [element("li", { text: "Source trail pending." })],
      ),
      citationNode(site),
    ]);
  }

  function renderList(records) {
    clear(els.recordList);
    if (!records.length) {
      els.recordList.appendChild(
        element("div", { className: "empty-state empty-state-list" }, [
          element("h4", { text: "No records shown" }),
          element("p", { text: "The current filters do not match any public campus record." }),
        ]),
      );
      return;
    }

    records.forEach((site) => {
      const button = element(
        "button",
        {
          className: `record-button${site.id === state.activeId ? " is-active" : ""}`,
          attrs: { type: "button" },
          dataset: { siteId: site.id },
        },
        [
          element("strong", { text: site.name }),
          element("span", { text: `${site.state} / ${site.closureYear} / ${site.morphology}` }),
          element("span", { text: site.buyerController || site.reuseType || "Afterlife pending" }),
        ],
      );
      button.addEventListener("click", () => {
        state.activeId = button.dataset.siteId;
        renderArchive();
      });
      els.recordList.appendChild(button);
    });
  }

  function renderArchive() {
    const records = filteredSites();
    if (!records.some((site) => site.id === state.activeId)) {
      state.activeId = records[0]?.id || "";
    }
    els.resultCount.textContent = `${records.length} shown`;
    renderMap(records);
    renderRecord(byId(state.activeId));
    renderList(records);
    writeRoute();
  }

  function renderBarStack(target, rows, tone) {
    clear(target);
    const max = Math.max(...rows.map((row) => Number(row.count) || 0), 1);
    rows.forEach((row) => {
      target.appendChild(
        element("div", { className: "bar-row" }, [
          element("span", { text: row.label }),
          element("span", { className: "bar-track" }, [
            element("span", {
              className: "bar-fill",
              style: {
                "--bar-width": `${((Number(row.count) || 0) / max) * 100}%`,
                "--bar-tone": tone,
              },
            }),
          ]),
          element("span", { text: formatNumber(row.count) }),
        ]),
      );
    });
  }

  function federalPlace(record) {
    const domestic = [record.city, record.state].filter(Boolean).join(", ");
    return domestic || record.country || "Unknown";
  }

  function renderFederalRow(record) {
    return element("tr", {}, [
      element("td", {}, [
        element("div", { className: "federal-school" }, [
          element("strong", { text: record.name || "Unnamed school" }),
          element("span", { text: record.location || record.address || "Location pending" }),
        ]),
      ]),
      element("td", {}, [
        document.createTextNode(federalPlace(record)),
        element("div", { className: "federal-muted", text: record.address || record.zip || "" }),
      ]),
      element("td", { text: compactDate(record.closureDate, record.closureYear) }),
      element("td", {}, [
        document.createTextNode(record.opeid || "Pending"),
        element("div", {
          className: "federal-muted",
          text: record.branchSuffix ? `Branch ${record.branchSuffix}` : "",
        }),
      ]),
      element("td", {}, [
        document.createTextNode(record.siteType || "Unclassified"),
        element("div", { className: "federal-muted", text: record.classification || "" }),
      ]),
    ]);
  }

  function renderFederalPager(records, totalPages) {
    clear(els.federalPager);
    const start = records.length ? (state.federalPage - 1) * state.federalPageSize + 1 : 0;
    const end = Math.min(start + state.federalPageSize - 1, records.length);
    const previous = element("button", {
      text: "Previous",
      attrs: { type: "button", disabled: state.federalPage <= 1 },
    });
    const next = element("button", {
      text: "Next",
      attrs: { type: "button", disabled: state.federalPage >= totalPages },
    });
    previous.addEventListener("click", () => {
      state.federalPage = Math.max(1, state.federalPage - 1);
      renderFederalTable();
    });
    next.addEventListener("click", () => {
      state.federalPage = Math.min(totalPages, state.federalPage + 1);
      renderFederalTable();
    });
    append(els.federalPager, [
      element("span", {
        text: `${formatNumber(start)}-${formatNumber(end)} of ${formatNumber(records.length)}`,
      }),
      element("div", { className: "pager-buttons" }, [previous, next]),
    ]);
  }

  function renderFederalTable() {
    const records = filteredFederalRecords();
    const totalPages = Math.max(1, Math.ceil(records.length / state.federalPageSize));
    state.federalPage = clamp(state.federalPage, 1, totalPages);
    els.federalResultCount.textContent = `${formatNumber(records.length)} shown`;

    const start = (state.federalPage - 1) * state.federalPageSize;
    const pageRecords = records.slice(start, start + state.federalPageSize);
    clear(els.federalTableBody);
    if (!pageRecords.length) {
      els.federalTableBody.appendChild(
        element("tr", {}, [
          element("td", {
            className: "federal-empty",
            text: "No federal records match the current filters.",
            attrs: { colspan: "5" },
          }),
        ]),
      );
    } else {
      pageRecords.forEach((record) => {
        els.federalTableBody.appendChild(renderFederalRow(record));
      });
    }
    renderFederalPager(records, totalPages);
  }

  function renderAbyss() {
    renderBarStack(els.classBars, data.abyss.classCounts, "#a44732");
    const max = Math.max(...data.abyss.timeline.map((row) => Number(row.count) || 0), 1);
    clear(els.timeline);
    data.abyss.timeline.forEach((row) => {
      els.timeline.appendChild(
        element("div", { className: "year-bar" }, [
          element("span", {
            style: { "--bar-height": `${Math.max(12, ((Number(row.count) || 0) / max) * 220)}px` },
          }),
          element("span", { text: row.label }),
        ]),
      );
    });

    clear(els.stateGrid);
    data.abyss.stateCounts.forEach((row) => {
      els.stateGrid.appendChild(
        element("div", { className: "state-cell" }, [
          element("strong", { text: formatNumber(row.count) }),
          element("span", { text: row.label }),
        ]),
      );
    });
    if (state.federalStatus === "idle") {
      setFederalStatus("idle", "Federal records load when this view is opened.");
    }
  }

  function renderMethod() {
    const federalFreshness = data.sourceFreshness?.fsaClosedSchoolSearch || {};
    const reportedDate = federalFreshness.reportedDate
      ? federalFreshness.reportedDate.split(" ")[0]
      : "";
    const sourceAge = Number.isFinite(federalFreshness.reportedAgeDays)
      ? `${federalFreshness.reportedAgeDays} days`
      : "";
    const bar = data.releaseBar || { gapCounts: {}, publicSites: sites.length, releaseReady: 0 };
    const gateLabels = {
      coordinates: "Coordinates for every public site",
      closureYear: "Closure year for every public site",
      morphology: "Normalized morphology labels",
      sourceUrl: "Source URL for every afterlife claim",
      verification: "Verification state from the controlled vocabulary",
      summary: "Visitor-facing summary per campus",
    };
    clear(els.releaseList);
    els.releaseList.appendChild(
      element("li", {
        className: "release-total",
        text: `${bar.releaseReady} of ${bar.publicSites} public campuses clear every gate.`,
      }),
    );
    Object.entries(gateLabels).forEach(([gate, label]) => {
      const missing = bar.gapCounts[gate] || 0;
      els.releaseList.appendChild(
        element("li", { className: missing ? "is-open" : "is-met" }, [
          element("span", { text: label }),
          element("span", {
            className: "release-count",
            text: missing ? `${missing} missing` : "met",
          }),
        ]),
      );
    });

    const auditRows = [
      ["Blank source URLs", data.queueAudit.blankCounts.sourceUrl],
      ["Non-URL source notes", data.queueAudit.nonUrlSourceUrlRows],
      ["Blank verification", data.queueAudit.blankCounts.verification],
      ["Duplicate non-PEPS rows", data.queueAudit.nonPepsDuplicateRows],
      ["Federal detail rows", federalFreshness.detailRows || federalFreshness.normalizedRows],
      ["Official federal total", federalFreshness.reportedTotal],
      ["Federal report date", reportedDate],
      ["Federal source age", sourceAge],
    ];
    clear(els.auditGrid);
    auditRows.forEach(([label, value]) => {
      els.auditGrid.appendChild(
        element("div", { className: "audit-cell" }, [
          element("strong", { text: formatMetric(value) }),
          element("span", { text: label }),
        ]),
      );
    });
  }

  function switchView(view) {
    state.view = view;
    document.querySelectorAll(".tab-button").forEach((button) => {
      const isActive = button.dataset.view === view;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
      button.setAttribute("tabindex", isActive ? "0" : "-1");
    });
    document.querySelectorAll(".view-panel").forEach((panel) => {
      const isActive = panel.id === `view-${view}`;
      panel.hidden = !isActive;
      panel.classList.toggle("is-active", isActive);
    });
    if (view === "archive" && mapState.stage) {
      requestAnimationFrame(applyMapTransform);
    }
    if (view === "abyss") {
      loadFederalRecords();
    }
    writeRoute();
  }

  function handleTabKeydown(event, buttons) {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();

    const currentIndex = buttons.indexOf(event.currentTarget);
    let nextIndex = currentIndex;
    if (event.key === "ArrowLeft") nextIndex = currentIndex === 0 ? buttons.length - 1 : currentIndex - 1;
    if (event.key === "ArrowRight") nextIndex = currentIndex === buttons.length - 1 ? 0 : currentIndex + 1;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = buttons.length - 1;

    buttons[nextIndex].focus();
    switchView(buttons[nextIndex].dataset.view);
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
    els.federalSearch.addEventListener("input", (event) => {
      state.federalQuery = event.target.value;
      state.federalPage = 1;
      renderFederalTable();
    });
    els.federalState.addEventListener("change", (event) => {
      state.federalState = event.target.value;
      state.federalPage = 1;
      renderFederalTable();
    });
    els.federalYear.addEventListener("change", (event) => {
      state.federalYear = event.target.value;
      state.federalPage = 1;
      renderFederalTable();
    });
    els.federalSiteType.addEventListener("change", (event) => {
      state.federalSiteType = event.target.value;
      state.federalPage = 1;
      renderFederalTable();
    });
    const tabButtons = Array.from(document.querySelectorAll(".tab-button"));
    tabButtons.forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.view));
      button.addEventListener("keydown", (event) => handleTabKeydown(event, tabButtons));
    });
    window.addEventListener("hashchange", () => {
      applyRoute();
    });
  }

  function init() {
    renderStats();
    renderFilters();
    renderAbyss();
    renderMethod();
    bindEvents();
    if (!applyRoute()) {
      renderArchive();
      switchView(state.view);
    }
  }

  init();
})();
