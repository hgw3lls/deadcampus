(function () {
  "use strict";

  const data = window.DEAD_CAMPUS_ATLAS;
  const sites = data.publicSites; // the curated records
  // Extended records are coded from public sources, not curated. They are a separate lazy
  // bundle so the first load carries only the curated layer.
  const EXTENDED_RECORDS_URL = "data/extended-records.js";
  const extendedCount = data.extendedCount || 0;
  // Content digests from the build, so a lazy bundle is never served from a stale cache entry.
  const versioned = (url, key) => (data.assetVersions && data.assetVersions[key] ? `${url}?v=${data.assetVersions[key]}` : url);
  let extended = [];
  let everything = sites.slice();
  let extendedLoad = null;
  const typology = data.typology || {};
  const FEDERAL_RECORDS_URL = "data/federal-records.js";
  // The federal table is ~12 MB, so it loads only when the Abyss is approached or asked for.
  let federalRecords = [];
  let federalLoad = null;
  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------------------------------------------------------------- constants

  const ZONES = [
    { code: "SECURITY", note: "Federal, military, policing, training" },
    { code: "CLOUD", note: "Data & computational infrastructure" },
    { code: "ABSORBED", note: "University land banks" },
    { code: "HEALTH", note: "Hospital & medical reuse" },
    { code: "HOUSING", note: "Senior, care & emergency housing" },
    { code: "PARCELIZED", note: "Split into parcels & fragments" },
    { code: "SPECULATIVE", note: "Investment & development holding" },
    { code: "K12", note: "Charter, K-12, religious academy" },
    { code: "COUNTER-USE", note: "Reuse outside replacement logic" },
    { code: "RUIN", note: "Abandoned or deteriorating" },
  ];
  const ZONE_INDEX = Object.fromEntries(ZONES.map((zone, index) => [zone.code, index]));
  const MORPHOLOGY_ZONE = {
    Security: "SECURITY",
    Cloud: "CLOUD",
    Absorbed: "ABSORBED",
    Health: "HEALTH",
    Housing: "HOUSING",
    Parcelized: "PARCELIZED",
    Speculative: "SPECULATIVE",
    Corporate: "SPECULATIVE",
    K12: "K12",
    "Religious/K12": "K12",
    "Educational reuse": "COUNTER-USE",
    "Arts reuse": "COUNTER-USE",
    Ruin: "RUIN",
  };
  const AXIS = [
    { key: "Ruin", note: "left to decay", morphologies: ["Ruin"] },
    { key: "Absorbed", note: "taken into a larger system", morphologies: ["Absorbed"] },
    { key: "Parcelized", note: "split and sold", morphologies: ["Parcelized"] },
    {
      key: "Reuse",
      note: "new institutional use",
      morphologies: ["Educational reuse", "Arts reuse", "Health", "K12", "Religious/K12", "Security", "Corporate", "Housing"],
    },
    { key: "Cloud", note: "land as asset or infrastructure", morphologies: ["Cloud", "Speculative"], cloud: true },
  ];
  const TRANSFER_TYPES = new Set(["ASSET-TRANSFER", "PARCELIZED", "CLOUD", "SECURITY", "COUNTER-USE"]);
  const STATE_CENTROIDS = {
    AL: [32.8, -86.8], AZ: [34.2, -111.7], AR: [34.9, -92.4], CA: [36.8, -119.4], CO: [39.0, -105.5],
    CT: [41.6, -72.7], DE: [39.0, -75.5], DC: [38.9, -77.0], FL: [28.6, -82.4], GA: [32.7, -83.4],
    ID: [44.4, -114.6], IL: [40.0, -89.2], IN: [39.9, -86.3], IA: [42.0, -93.5], KS: [38.5, -98.4],
    KY: [37.5, -85.3], LA: [31.0, -92.0], ME: [45.3, -69.2], MD: [39.0, -76.7], MA: [42.3, -71.8],
    MI: [44.3, -85.4], MN: [46.3, -94.3], MS: [32.7, -89.7], MO: [38.4, -92.5], MT: [47.0, -109.6],
    NE: [41.5, -99.8], NV: [39.3, -116.6], NH: [43.7, -71.6], NJ: [40.1, -74.7], NM: [34.4, -106.1],
    NY: [42.9, -75.5], NC: [35.5, -79.4], ND: [47.5, -100.5], OH: [40.3, -82.8], OK: [35.6, -97.5],
    OR: [44.0, -120.5], PA: [40.9, -77.8], RI: [41.7, -71.5], SC: [33.9, -80.9], SD: [44.4, -100.2],
    TN: [35.8, -86.4], TX: [31.5, -99.3], UT: [39.3, -111.7], VT: [44.0, -72.7], VA: [37.5, -78.8],
    WA: [47.4, -120.5], WV: [38.6, -80.6], WI: [44.6, -89.9], WY: [43.0, -107.5],
  };
  const allowedUrlProtocols = new Set(["http:", "https:"]);

  // ------------------------------------------------------------------ helpers

  const $ = (selector) => document.querySelector(selector);

  function clear(node) {
    node.replaceChildren();
  }

  function append(parent, children) {
    (Array.isArray(children) ? children : [children]).forEach((child) => {
      if (child === null || child === undefined || child === false) return;
      parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
    });
  }

  function element(tag, options = {}, children = []) {
    const node = document.createElement(tag);
    if (options.className) node.className = options.className;
    if (options.text !== undefined) node.textContent = options.text;
    if (options.attrs) {
      Object.entries(options.attrs).forEach(([name, value]) => {
        if (value !== null && value !== undefined && value !== false) node.setAttribute(name, String(value));
      });
    }
    if (options.style) {
      Object.entries(options.style).forEach(([name, value]) => {
        if (name.startsWith("--")) node.style.setProperty(name, String(value));
        else node.style[name] = String(value);
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

  const byId = (id) => everything.find((site) => site.id === id) || null;
  const isExtended = (site) => Boolean(site && site.tier);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const formatNumber = (value) => new Intl.NumberFormat("en-US").format(value);
  const compactDate = (value, year) => (!value ? year || "Unknown" : String(value).split(" ")[0]);
  const zoneOf = (site) => (isExtended(site) ? site.zone || null : MORPHOLOGY_ZONE[site.morphology] || "SPECULATIVE");
  const OUTCOME_LABEL = {
    "closed-campus-reused": "Campus reused",
    "closed-campus-unknown": "Campus fate not found",
    "merged-campus-closed": "Merged; campus closed",
  };
  const shortName = (site) => site.name.split(" ").slice(0, 2).join(" ");

  function eventDateLabel(value) {
    const [year, month, day] = String(value || "").split("-");
    if (!year) return "";
    if (!month) return year;
    const date = new Date(Number(year), Number(month) - 1, Number(day || 1));
    return date.toLocaleDateString("en-US", day ? { year: "numeric", month: "short", day: "numeric" } : { year: "numeric", month: "short" });
  }

  function money(value) {
    if (value === null || value === undefined) return "";
    const abs = Math.abs(value);
    const text = abs >= 1e6 ? `${(abs / 1e6).toFixed(1)}M` : abs >= 1e3 ? `${Math.round(abs / 1e3)}K` : String(abs);
    return `${value < 0 ? "-" : ""}$${text}`;
  }

  function sitePosition(site) {
    return {
      x: 60 + ((Number(site.longitude) + 125) / 61) * 1250,
      y: 80 + ((50 - Number(site.latitude)) / 25) * 700,
    };
  }

  const zoneY = (code) => 60 + ZONE_INDEX[code] * 78;

  // -------------------------------------------------------------------- state

  const state = {
    activeId: sites[0] ? sites[0].id : "",
    query: "",
    code: null, // replacement zone filter
    group: null, // axis group filter
    mode: "curated", // curated | abyss
    flows: true,
    haze: false,
    labels: true,
    ext: true, // show extended records on the map
    scope: "curated", // curated | extended | all
    panelOpen: true,
    federalQuery: "",
    federalState: "All states",
    federalYear: "All years",
    federalSiteType: "All types",
    federalFate: "All fates",
    federalProcess: "All closures",
    federalPage: 1,
    federalPageSize: 50,
    federalStatus: "idle",
  };
  const view = { k: 0.4, tx: 0, ty: 0, drag: null, touched: false };

  function matches(site) {
    const q = state.query.trim().toLowerCase();
    if (q) {
      const haystack = [site.name, site.city, site.state, site.region, site.morphology, site.buyerController, site.reuseType, site.transformation, site.notes]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (state.code && zoneOf(site) !== state.code) return false;
    if (state.group) {
      const group = AXIS.find((item) => item.key === state.group);
      if (group && !group.morphologies.includes(site.morphology)) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------- hero / foot

  function renderHero() {
    const freshness = (data.sourceFreshness || {}).fsaClosedSchoolSearch || {};
    const reported = freshness.reportedDate ? String(freshness.reportedDate).split(" ")[0] : "";
    const stats = [
      [formatNumber(sites.length), "Curated campus records"],
      [formatNumber(data.abyss.totalRecords), `Federal rows${reported ? ` · ${reported}` : ""}`],
      [String(Object.keys(typology).length), "Morphology classes"],
    ];
    if (extendedCount) stats.splice(1, 0, [formatNumber(extendedCount), "Extended records · coded, not curated"]);
    const list = $("#heroStats");
    clear(list);
    stats.forEach(([value, label]) =>
      list.appendChild(element("div", {}, [element("dt", { text: label }), element("dd", { text: value })])),
    );
    $("#modeCuratedCount").textContent = String(sites.length);
    $("#scopeCuratedN").textContent = String(sites.length);
    $("#scopeExtendedN").textContent = String(extendedCount);
    $("#federalSearch").placeholder = `Search ${formatNumber(data.abyss.totalRecords)} records…`;
  }

  // When the atlas is served at /atlas/ beside the dashboard, link back to it. A standalone
  // copy has no dashboard to return to, so the link stays hidden.
  const DASHBOARD_URL = window.location.pathname.endsWith("/atlas/") ? "../" : null;

  function renderFooter() {
    const freshness = (data.sourceFreshness || {}).fsaClosedSchoolSearch || {};
    const bar = data.releaseBar || {};
    const foot = $("#foot");
    clear(foot);
    const age = Number.isFinite(freshness.reportedAgeDays) ? `, ${freshness.reportedAgeDays} days old at refresh` : "";
    append(foot, [
      element("p", {
        text: `Federal layer: FSA Weekly Closed School Search File, report ${freshness.reportedDate ? String(freshness.reportedDate).split(" ")[0] : "unknown"}${age}; ${formatNumber(freshness.detailRows || data.abyss.totalRecords)} detail rows against an official total of ${formatNumber(freshness.reportedTotal || 0)}.`,
      }),
      element("p", {
        text: `Curated layer: ${sites.length} campus records; ${bar.releaseReady || 0} clear every release gate. Raw rows stay raw; interpretation is marked as reading.`,
      }),
      element("p", { text: "Terminal Education · Division of Institutional Withdrawal · Sector T.E-09 · private proof." }),
      DASHBOARD_URL ? element("p", {}, [element("a", { text: "Back to the Dead Campus Atlas dashboard", attrs: { href: DASHBOARD_URL } })]) : null,
    ]);
  }

  // -------------------------------------------------------------------- map

  const els = {
    viewport: $("#mapViewport"),
    world: $("#mapWorld"),
    frame: $("#mapFrame"),
    flows: $("#flows"),
    zoneLayer: $("#zoneLayer"),
    nodeLayer: $("#nodeLayer"),
    bubbleLayer: $("#bubbleLayer"),
    haze: $("#hazeCanvas"),
    caption: $("#zoneCaption"),
  };
  const nodeById = new Map();
  const flowById = new Map();
  const zoneByCode = new Map();

  function buildMap() {
    // zones
    ZONES.forEach((zone) => {
      const button = element(
        "button",
        {
          className: `zone${zone.code === "COUNTER-USE" ? " is-counter" : ""}`,
          style: { top: `${zoneY(zone.code)}px` },
          attrs: { type: "button", "aria-pressed": "false" },
        },
        [element("b", { text: zone.code }), element("span", { text: zone.note })],
      );
      button.addEventListener("click", () => {
        state.code = state.code === zone.code ? null : zone.code;
        refresh();
      });
      els.zoneLayer.appendChild(button);
      zoneByCode.set(zone.code, button);
    });

    // flows + nodes
    addMarkers(sites);
    addBubbles();
    addMinimap();
  }

  function addMarkers(list) {
    list.forEach((site) => {
      if (site.latitude === null || site.longitude === null || site.latitude === undefined) return;
      const { x, y } = sitePosition(site);
      const code = zoneOf(site);
      if (code) {
        const zy = zoneY(code) + 33;
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", `M${x} ${y} C${x + 420} ${y},${1500 - 380} ${zy},1500 ${zy}`);
        const flowClass = [code === "COUNTER-USE" ? "is-counter" : "", isExtended(site) ? "is-ext" : ""].filter(Boolean).join(" ");
        if (flowClass) path.setAttribute("class", flowClass);
        els.flows.appendChild(path);
        flowById.set(site.id, path);
      }

      const node = element(
        "button",
        {
          className: `node${code === "COUNTER-USE" ? " is-counter" : ""}${isExtended(site) ? " is-extended" : ""}${isExtended(site) && site.outcome === "closed-campus-unknown" ? " is-unknown" : ""}`,
          style: { left: `${x}px`, top: `${y}px` },
          attrs: {
            type: "button",
            "aria-label": `${site.name}, ${site.state}, closed ${site.closureYear || "year unknown"}${isExtended(site) ? ", extended record" : ""}`,
            "data-id": site.id,
          },
        },
        [element("span", { className: "node-dot" }), element("span", { className: "node-label", text: `${shortName(site)} · ${site.state}` })],
      );
      node.addEventListener("click", () => select(site.id, { drawer: true }));
      node.addEventListener("focus", () => ensureVisible(x, y));
      els.nodeLayer.appendChild(node);
      nodeById.set(site.id, node);
    });
  }

  function addBubbles() {
    // state-retreat bubbles (Abyss mode)
    const counts = (data.abyss.stateCounts || []).filter((row) => STATE_CENTROIDS[row.label]);
    const max = Math.max(1, ...counts.map((row) => row.count));
    counts.forEach((row) => {
      const [lat, lon] = STATE_CENTROIDS[row.label];
      const x = 60 + ((lon + 125) / 61) * 1250;
      const y = 80 + ((50 - lat) / 25) * 700;
      const d = 30 + Math.sqrt(row.count / max) * 120;
      els.bubbleLayer.appendChild(
        element(
          "div",
          { className: "bubble-state", style: { left: `${x}px`, top: `${y}px`, width: `${d}px`, height: `${d}px` }, attrs: { title: `${row.label}: ${formatNumber(row.count)} closure sites` } },
          [element("span", {}, [row.label, element("small", { text: formatNumber(row.count) })])],
        ),
      );
    });

  }

  function addMinimap() {
    const mm = $("#minimapWorld");
    mm.appendChild(element("div", { className: "mm-territory" }));
    mm.appendChild(element("div", { className: "mm-zones" }));
    sites.forEach((site) => {
      if (site.latitude === null) return;
      const { x, y } = sitePosition(site);
      mm.appendChild(element("div", { className: "mm-node", style: { left: `${x}px`, top: `${y}px` } }));
    });
  }

  function applyView(fly) {
    els.world.classList.toggle("is-flying", Boolean(fly) && !reducedMotion);
    els.world.style.transform = `translate(${view.tx}px, ${view.ty}px) scale(${view.k})`;
    const rect = els.viewport.getBoundingClientRect();
    const mmView = $("#minimapView");
    mmView.style.left = `${(-view.tx / view.k) * 0.075}px`;
    mmView.style.top = `${(-view.ty / view.k) * 0.075}px`;
    mmView.style.width = `${(rect.width / view.k) * 0.075}px`;
    mmView.style.height = `${(rect.height / view.k) * 0.075}px`;
    $("#minimapZoom").textContent = `${Math.round(view.k * 100)}%`;
    els.world.classList.toggle("labels-on", state.labels && view.k > 0.95);
  }

  function fit(fly, auto) {
    if (!auto) view.touched = false;
    const rect = els.viewport.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 40) return; // not laid out yet; the resize observer will call again
    const narrow = rect.width < 760;
    const pad = narrow ? 10 : 230;
    const k = Math.max(0.15, Math.min((rect.width - pad - 20) / 1900, (rect.height - 40) / 820));
    view.k = k;
    view.tx = pad - 40 * k;
    view.ty = 10 - 30 * k;
    applyView(fly);
  }

  function zoomAt(factor, cx, cy, fly) {
    view.touched = true;
    const k = clamp(view.k * factor, 0.3, 4);
    const ratio = k / view.k;
    view.tx = cx - (cx - view.tx) * ratio;
    view.ty = cy - (cy - view.ty) * ratio;
    view.k = k;
    applyView(fly);
  }

  function flyTo(x, y, k) {
    view.touched = true;
    const rect = els.viewport.getBoundingClientRect();
    view.k = k;
    view.tx = (rect.width + (rect.width < 760 ? 0 : 270)) / 2 - x * k;
    view.ty = rect.height / 2 - y * k;
    applyView(true);
  }

  function ensureVisible(x, y) {
    const rect = els.viewport.getBoundingClientRect();
    const sx = x * view.k + view.tx;
    const sy = y * view.k + view.ty;
    if (sx < 20 || sy < 20 || sx > rect.width - 20 || sy > rect.height - 20) flyTo(x, y, Math.max(view.k, 0.9));
  }

  function bindMap() {
    const viewport = els.viewport;
    viewport.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest(".node, .zone")) return;
      view.touched = true;
      view.drag = { x: event.clientX, y: event.clientY, tx: view.tx, ty: view.ty, id: event.pointerId };
      viewport.setPointerCapture(event.pointerId);
      viewport.classList.add("is-dragging");
      els.world.classList.remove("is-flying");
    });
    viewport.addEventListener("pointermove", (event) => {
      if (!view.drag || view.drag.id !== event.pointerId) return;
      view.tx = view.drag.tx + event.clientX - view.drag.x;
      view.ty = view.drag.ty + event.clientY - view.drag.y;
      applyView(false);
    });
    const end = (event) => {
      if (!view.drag || view.drag.id !== event.pointerId) return;
      view.drag = null;
      viewport.classList.remove("is-dragging");
    };
    viewport.addEventListener("pointerup", end);
    viewport.addEventListener("pointercancel", end);
    // Wheel zooms only with a modifier (pinch sends ctrl) or once the map has focus, so the
    // page itself stays scrollable.
    viewport.addEventListener(
      "wheel",
      (event) => {
        if (!(event.ctrlKey || event.metaKey || document.activeElement === viewport)) return;
        event.preventDefault();
        view.touched = true;
        const rect = viewport.getBoundingClientRect();
        zoomAt(event.deltaY < 0 ? 1.12 : 1 / 1.12, event.clientX - rect.left, event.clientY - rect.top, false);
      },
      { passive: false },
    );
    viewport.addEventListener("keydown", (event) => {
      const rect = viewport.getBoundingClientRect();
      const step = 48;
      const handled = { "+": () => zoomAt(1.3, rect.width / 2, rect.height / 2, true), "=": () => zoomAt(1.3, rect.width / 2, rect.height / 2, true),
        "-": () => zoomAt(1 / 1.3, rect.width / 2, rect.height / 2, true), "0": () => fit(true),
        ArrowLeft: () => { view.tx += step; applyView(false); }, ArrowRight: () => { view.tx -= step; applyView(false); },
        ArrowUp: () => { view.ty += step; applyView(false); }, ArrowDown: () => { view.ty -= step; applyView(false); },
        Escape: () => { $("#mapDrawer").hidden = true; } }[event.key];
      if (!handled) return;
      event.preventDefault();
      handled();
    });
    // Focus can scroll an overflow-hidden container; keep the map pinned.
    [els.frame, viewport].forEach((container) =>
      container.addEventListener("scroll", () => {
        container.scrollTop = 0;
        container.scrollLeft = 0;
      }),
    );
    $("#zoomIn").addEventListener("click", () => { const r = viewport.getBoundingClientRect(); zoomAt(1.3, r.width / 2, r.height / 2, true); });
    $("#zoomOut").addEventListener("click", () => { const r = viewport.getBoundingClientRect(); zoomAt(1 / 1.3, r.width / 2, r.height / 2, true); });
    $("#zoomFit").addEventListener("click", () => { state.code = null; state.group = null; refresh(); fit(true); });
    $("#drawerClose").addEventListener("click", () => { $("#mapDrawer").hidden = true; });
    $("#panelToggle").addEventListener("click", () => { state.panelOpen = !state.panelOpen; renderPanel(); });
    $("#modeCurated").addEventListener("click", () => setMode("curated"));
    $("#modeAbyss").addEventListener("click", () => setMode("abyss"));
    if (typeof ResizeObserver === "function") {
      new ResizeObserver(() => {
        if (view.touched) applyView(false);
        else fit(false, true);
      }).observe(viewport);
    }
  }

  const JUMPS = [
    { n: "01", t: "National retreat", go: () => { state.code = null; state.group = null; refresh(); fit(true); } },
    { n: "02", t: "Replacement matrix", go: () => { state.code = null; flyTo(1710, 430, 0.9); } },
    { n: "04", t: "Rust Belt Catholic", go: () => flyTo(60 + ((-82.5 + 125) / 61) * 1250, 80 + ((50 - 42.2) / 25) * 700, 1.7) },
    { n: "05", t: "New England", go: () => flyTo(60 + ((-73 + 125) / 61) * 1250, 80 + ((50 - 42.8) / 25) * 700, 2.2) },
    { n: "06", t: "Campus → Cloud", code: "CLOUD", go: () => { state.code = state.code === "CLOUD" ? null : "CLOUD"; refresh(); flyTo(1300, zoneY("CLOUD") + 33, 1.1); } },
    { n: "09", t: "Counter-uses", code: "COUNTER-USE", go: () => { state.code = state.code === "COUNTER-USE" ? null : "COUNTER-USE"; refresh(); flyTo(1300, zoneY("COUNTER-USE") + 33, 1.1); } },
  ];

  function renderPanel() {
    $("#mapPanel").classList.toggle("is-collapsed", !state.panelOpen);
    $("#panelToggle").setAttribute("aria-expanded", String(state.panelOpen));
    $("#panelIcon").textContent = state.panelOpen ? "▾" : "▸";
    const jump = $("#jumpList");
    clear(jump);
    JUMPS.forEach((item) => {
      const button = element("button", { className: state.code && item.code === state.code ? "is-on" : "", attrs: { type: "button", "data-focus": `jump:${item.n}` } }, [
        element("b", { text: item.n }),
        element("span", { text: item.t }),
      ]);
      button.addEventListener("click", item.go);
      jump.appendChild(element("li", {}, [button]));
    });
    const layers = $("#layerList");
    clear(layers);
    [
      ["flows", "Replacement flows"],
      ["haze", "Federal haze (PEPS) · loads ~13 MB"],
      ["labels", "Campus labels"],
      ...(extendedCount ? [["ext", `Extended records · ${extendedCount}`]] : []),
    ].forEach(([key, label]) => {
      const button = element("button", { attrs: { type: "button", "aria-pressed": String(state[key]), "data-focus": `layer:${key}` }, text: `${state[key] ? "■" : "□"} ${label}` });
      button.addEventListener("click", () => {
        state[key] = !state[key];
        if (key === "haze" && state.haze) ensureFederal();
        if (key === "ext" && state.ext) loadExtended();
        refresh();
      });
      layers.appendChild(element("li", {}, [button]));
    });
  }

  function setMode(mode) {
    state.mode = mode;
    if (mode === "abyss") {
      state.haze = true;
      ensureFederal();
    }
    refresh();
    fit(true);
  }

  function renderMapState() {
    const abyss = state.mode === "abyss";
    $("#modeCurated").setAttribute("aria-pressed", String(!abyss));
    $("#modeAbyss").setAttribute("aria-pressed", String(abyss));
    els.flows.classList.toggle("is-off", abyss || !state.flows);
    els.zoneLayer.hidden = abyss;
    els.nodeLayer.hidden = abyss;
    els.bubbleLayer.hidden = !abyss;
    els.haze.style.display = state.haze ? "block" : "none";
    els.caption.textContent = abyss ? "State retreat · federal closure sites per state" : state.code ? `Replacement economy → ${state.code}` : "Replacement economy → CLOUD";
    zoneByCode.forEach((button, code) => {
      const on = state.code === code;
      button.classList.toggle("is-on", on);
      button.classList.toggle("is-dim", Boolean(state.code) && !on);
      button.setAttribute("aria-pressed", String(on));
    });
    everything.forEach((site) => {
      const node = nodeById.get(site.id);
      const flow = flowById.get(site.id);
      if (!node) return;
      const visible = matches(site);
      const active = site.id === state.activeId;
      node.classList.toggle("is-hidden", isExtended(site) && !state.ext && !active);
      node.classList.toggle("is-active", active);
      node.classList.toggle("is-dim", !visible);
      if (flow) {
        flow.classList.toggle("is-active", active || (!isExtended(site) && Boolean(state.code) && zoneOf(site) === state.code));
        flow.classList.toggle("is-dim", !visible && !active);
      }
    });
    const shown = sites.filter(matches).length;
    const shownExt = extended.filter(matches).length;
    $("#mapStatus").textContent = abyss
      ? state.haze && federalRecords.length
        ? `${formatNumber(federalRecords.filter((r) => typeof r.latitude === "number").length)} geocoded federal sites shown as haze.`
        : state.federalStatus === "loading" ? "Loading federal records…" : "State bubbles show federal closure sites per state."
      : `${shown} of ${sites.length} curated campuses${extended.length && state.ext ? ` and ${shownExt} of ${extended.length} extended records` : extendedCount && state.ext ? " (extended records loading)" : ""} shown${state.code ? ` · zone ${state.code}` : ""}${state.group ? ` · ${state.group}` : ""}.`;
  }

  function drawHaze() {
    const canvas = els.haze;
    if (!federalRecords.length) return;
    const scale = 2;
    canvas.width = 1250 * scale;
    canvas.height = 700 * scale;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(20,17,14,0.22)";
    federalRecords.forEach((record) => {
      if (typeof record.latitude !== "number") return;
      const x = ((record.longitude + 125) / 61) * canvas.width;
      const y = ((50 - record.latitude) / 25) * canvas.height;
      if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) return;
      ctx.fillRect(x - 1, y - 1, 3, 3);
    });
  }

  // ------------------------------------------------------------ index + axis

  function loadExtended() {
    if (!extendedCount) return Promise.resolve([]);
    if (extendedLoad) return extendedLoad;
    extendedLoad = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = versioned(EXTENDED_RECORDS_URL, "extended");
      script.async = true;
      script.onload = () => {
        extended = window.DEAD_CAMPUS_EXTENDED || [];
        delete window.DEAD_CAMPUS_EXTENDED;
        everything = sites.concat(extended);
        resolve(extended);
      };
      script.onerror = () => reject(new Error(`Could not load ${EXTENDED_RECORDS_URL}`));
      document.head.appendChild(script);
    })
      .then((records) => {
        addMarkers(records);
        refresh();
        return records;
      })
      .catch((error) => {
        extendedLoad = null;
        console.error(error);
        const status = $("#mapStatus");
        if (status) status.textContent = "Extended records could not be loaded. Reload to try again.";
        return [];
      });
    return extendedLoad;
  }

  function scopeSites() {
    return state.scope === "curated" ? sites : state.scope === "extended" ? extended : everything;
  }

  function renderAxis() {
    const list = $("#axisStrip");
    clear(list);
    AXIS.forEach((group) => {
      const count = scopeSites().filter((site) => group.morphologies.includes(site.morphology)).length;
      const on = state.group === group.key;
      const button = element("button", { attrs: { type: "button", "aria-pressed": String(on), "data-focus": `axis:${group.key}` } }, [
        `${group.key} · ${count}`,
        element("small", { text: group.note }),
      ]);
      button.addEventListener("click", () => {
        state.group = on ? null : group.key;
        refresh();
      });
      list.appendChild(element("li", { className: `${group.cloud ? "is-cloud" : ""}${on ? " is-on" : ""}` }, [button]));
    });
  }

  function renderIndex() {
    const list = $("#recordList");
    clear(list);
    const pool = scopeSites();
    const shown = pool.filter(matches);
    $("#resultCount").textContent = `${shown.length} of ${pool.length} records`;
    $("#scopeNote").textContent =
      state.scope === "curated"
        ? ""
        : "Extended records are coded from public sources with an evidence URL per claim. They are not curated or edited.";
    document.querySelectorAll("#scopeSeg button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.scope === state.scope)));
    if (!shown.length) {
      list.appendChild(element("li", { className: "empty-state", text: "No record matches. Clear a filter or search." }));
      return;
    }
    shown.forEach((site) => {
      const current = site.id === state.activeId;
      const button = element("button", { attrs: { type: "button", "aria-current": current ? "true" : null, "data-focus": `idx:${site.id}` } }, [
        element("b", { text: site.state }),
        element("span", { text: site.name }),
        element("span", { className: "yr", text: String(site.closureYear || "—") }),
      ]);
      button.addEventListener("click", () => select(site.id, { drawer: true }));
      list.appendChild(element("li", { className: isExtended(site) ? "is-extended" : "" }, [button]));
    });
  }

  // --------------------------------------------------------------- case file

  function stageSummary(site) {
    const events = site.events || [];
    const closure = events.find((event) => event.type === "CLOSURE-EVENT");
    const transfers = events.filter((event) => TRANSFER_TYPES.has(event.type));
    const done = transfers.find((event) => event.ownershipChange !== false);
    const pending = transfers.find((event) => event.ownershipChange === false);
    const closureText = closure
      ? `${eventDateLabel(closure.date)} · ${closure.label}`
      : site.verification === "Non-closure sale"
        ? "No closure. Asset sale only."
        : String(site.closureYear || "Undated");
    const transferText = done
      ? `${eventDateLabel(done.date)} · ${done.label}`
      : pending
        ? `Not completed · ${eventDateLabel(pending.date)} · ${pending.label}`
        : "No completed transfer on record.";
    const afterlife = [site.matrix && site.matrix.replacementSystem ? site.matrix.replacementSystem : site.afterlife, site.buyerController]
      .filter(Boolean)
      .join(" · ");
    return { closureText, transferText, afterlife };
  }

  function sourceLinkItem(url) {
    const safe = safeHttpUrl(url);
    let label = url;
    try {
      label = new URL(safe).hostname.replace(/^www\./, "");
    } catch {
      label = url;
    }
    return element("li", {}, [
      safe ? element("a", { text: label, attrs: { href: safe, target: "_blank", rel: "noreferrer noopener", title: safe } }) : String(url),
    ]);
  }

  function evidenceItem(item) {
    const safe = safeHttpUrl(item.sourceUrl);
    return element("li", {}, [
      element("b", { text: item.sourceSheet || "Unknown source" }),
      ` line ${item.line || "?"}: `,
      safe ? element("a", { text: "source URL", attrs: { href: safe, target: "_blank", rel: "noreferrer noopener" } }) : item.sourceNote || "source needed",
    ]);
  }

  function timelineBlock(site) {
    const events = site.events || [];
    if (!events.length) return null;
    let limbo = "";
    if (typeof site.limboDays === "number") {
      const months = Math.round(Math.abs(site.limboDays) / 30.4);
      limbo = site.limboDays < 0 ? `Transfer agreed ${months} month${months === 1 ? "" : "s"} before closure.` : `${months} month${months === 1 ? "" : "s"} from closure to first completed transfer.`;
    }
    return element("div", {}, [
      element("h4", { text: "Status sequence" }),
      limbo ? element("p", { className: "trajectory-lead", text: limbo }) : null,
      element(
        "ol",
        { className: "event-list", attrs: { style: "list-style:none;margin:0;padding:0" } },
        events.map((event) => {
          const safe = safeHttpUrl(event.sourceUrl);
          return element("li", {}, [
            element("span", { className: "event-date", text: eventDateLabel(event.date) }),
            element("span", { className: "event-type", text: `${event.type}${event.ownershipChange === false ? " · NOT AN OWNERSHIP CHANGE" : ""}` }),
            safe ? element("a", { text: event.label, attrs: { href: safe, target: "_blank", rel: "noreferrer noopener" } }) : element("span", { text: event.label }),
          ]);
        }),
      ),
    ]);
  }

  // How the closure happened, where the SHEEO closed-college file covers the institution.
  function processBlock(site) {
    const process = site.closureProcess;
    const text = processText(process);
    if (!text) return null;
    return element("p", { className: "closure-process" }, [
      element("b", { text: "How it closed. " }),
      text + (process.sites > 1 ? ` (main site of ${process.sites} in the file)` : "") + " ",
      element("span", { className: "evidence-claim", text: "SHEEO closed-college file, researcher-coded" }),
    ]);
  }

  function trajectoryBlock(site) {
    const points = site.trajectory || [];
    const summary = site.trajectorySummary || {};
    if (!points.length || !summary.peakYear) return null;
    const recent = points.slice(-10);
    const max = Math.max(...points.map((p) => p.enrollment || 0), 1);
    const lead =
      `Fall enrollment peaked at ${formatNumber(summary.peakEnrollment)} in ${summary.peakYear}` +
      (summary.lastYear !== summary.peakYear ? ` and was ${formatNumber(summary.lastEnrollment)} in ${summary.lastYear}, down ${summary.declinePct}%.` : ".") +
      (summary.financeYearsOfLastFive ? ` Expenses exceeded revenue in ${summary.deficitYearsOfLastFive} of the last ${summary.financeYearsOfLastFive} reported years.` : "");
    return element("div", {}, [
      element("h4", { text: "Decline curve · IPEDS" }),
      element("p", { className: "trajectory-lead", text: lead }),
      element(
        "ol",
        { className: "trajectory-bars", attrs: { "aria-label": "Fall enrollment by year" } },
        recent.map((p) =>
          element(
            "li",
            {
              attrs: { title: `${p.year}: ${p.enrollment ? `${formatNumber(p.enrollment)} students` : "no enrollment reported"}${p.revenue && p.expenses ? `, revenue ${money(p.revenue)}, expenses ${money(p.expenses)}` : ""}` },
              style: { "--bar-height": `${p.enrollment ? Math.max(6, (p.enrollment / max) * 100) : 2}%`, "--bar-tone": p.revenue && p.expenses && p.expenses > p.revenue ? "#14110e" : "#1d3b5c" },
            },
            [element("span", { text: String(p.year).slice(2) })],
          ),
        ),
      ),
      element("p", { className: "note", text: "Black bars: expenses exceeded revenue that year. Blue: they did not, or finance was not reported." }),
    ]);
  }

  const RECHECK_LABEL = { confirmed: "first coding confirmed", revised: "coding revised", unresolved: "still unresolved" };

  function renderExtendedCase(site, main, props) {
    const fate = OUTCOME_LABEL[site.outcome] || site.outcome;
    const closed = site.closureDate ? eventDateLabel(site.closureDate) : String(site.closureYear || "Undated");
    const transfer = site.transferDate
      ? `${eventDateLabel(site.transferDate)} · ${site.buyerName || "new holder"}`
      : site.buyerName
        ? `Date not found · ${site.buyerName}`
        : "No transfer found.";
    const afterlife = [site.replacementSystem, site.buyerName].filter(Boolean).join(" · ") || fate;
    append(main, [
      element("p", { className: "ext-notice" }, [
        element("b", { text: "Extended record. " }),
        `Coded from public sources, one evidence URL per claim; not curated or edited. Confidence: ${site.confidence || "unrated"}.`,
      ]),
      element("div", { className: "case-head" }, [
        element("div", { className: "label-lg", text: `Extended record · ${site.id}` }),
        element("div", { className: "stamp is-sampled", text: site.tier === "census" ? "CENSUS" : "SAMPLED" }),
      ]),
      element("h2", { text: site.name, attrs: { id: "case-name" } }),
      element("div", { className: "stages" }, [
        element("div", { className: "stage" }, [element("b", { text: "Closure" }), element("div", { text: `${closed} · IPEDS: ${site.ipeds && site.ipeds.status ? site.ipeds.status : "closed"}` })]),
        element("div", { className: "stage" }, [element("b", { text: "Transfer" }), element("div", { text: transfer })]),
        element("div", { className: "stage" }, [element("b", { text: "Afterlife" }), element("div", { text: afterlife })]),
      ]),
      element("p", { className: "case-summary", text: site.campusFate || "The closure is documented; what became of the campus was not found in public sources." }),
      element("section", { className: "case-block is-evidence", attrs: { "aria-label": "Evidence, sourced" } }, [
        element("h3", {}, ["Evidence (sourced)", element("i", { text: "pages opened by the coder" })]),
        trajectoryBlock(site),
        processBlock(site),
        element("h4", { text: "Sources" }),
        element(
          "ul",
          {},
          site.evidence.length
            ? site.evidence.map((item) => {
                const safe = safeHttpUrl(item.url);
                let label = item.url;
                try {
                  label = new URL(safe).hostname.replace(/^www\./, "");
                } catch {
                  label = item.url;
                }
                return element("li", {}, [
                  safe ? element("a", { text: label, attrs: { href: safe, target: "_blank", rel: "noreferrer noopener", title: safe } }) : label,
                  element("span", { className: "evidence-claim", text: item.claim }),
                ]);
              })
            : [element("li", { text: "No page establishing the closure was opened; the closure rests on the IPEDS record." })],
        ),
      ]),
      element("section", { className: "case-block is-reading", attrs: { "aria-label": "Reading, interpretive" } }, [
        element("h3", {}, ["Reading (interpretive)", element("i", { text: "the coder's classification" })]),
        site.buyerSector || site.replacementSystem
          ? element("ol", { className: "matrix-steps", attrs: { "aria-label": "Replacement matrix" } },
              [["Was", site.originalSystem || "—"], ["Taken by", site.buyerSector || "—"], ["Became", site.replacementSystem || "—"]].map(([label, value]) =>
                element("li", {}, [element("span", { className: "matrix-label", text: label }), element("span", { className: "matrix-value", text: value })]),
              ))
          : element("p", { className: "note", text: "No buyer or replacement system established, so there is no classification to show." }),
        site.notes ? element("p", { className: "editorial-note" }, [element("b", { text: "Coding notes. " }), site.notes]) : null,
        site.recheck
          ? element("p", { className: "editorial-note" }, [
              element("b", { text: `Second pass, ${site.recheck.checkedOn}: ${RECHECK_LABEL[site.recheck.verdict] || site.recheck.verdict}. ` }),
              site.recheck.note || "",
            ])
          : null,
      ]),
    ]);
    [
      ["State", site.state],
      ["Closed", String(site.closureYear || "Undated")],
      ["Outcome", fate],
      ["Confidence", site.confidence],
      ["Record set", site.tier === "census" ? "Census of closures" : "Random sample"],
      ["Morphology", site.morphology],
      ["IPEDS", `UNITID ${site.unitid}${site.ipeds && site.ipeds.status ? ` · ${site.ipeds.status}` : ""}`],
    ]
      .filter(([, value]) => value)
      .forEach(([key, value]) => props.appendChild(element("div", {}, [element("dt", { text: key }), element("dd", { text: value })])));
    $("#caseCite").textContent = `Cite this record: ${window.location.origin === "null" ? "" : window.location.origin}${window.location.pathname}#campus/${site.id}`;
  }

  function renderCase() {
    const site = byId(state.activeId);
    const main = $("#caseMain");
    const props = $("#caseProps");
    clear(main);
    clear(props);
    if (!site) {
      main.appendChild(element("p", { className: "empty-state", text: "Select a record from the index or the map." }));
      return;
    }
    if (isExtended(site)) {
      renderExtendedCase(site, main, props);
      return;
    }
    const stage = stageSummary(site);
    const disputed = /disputed/i.test(site.verification || "");
    append(main, [
      element("div", { className: "case-head" }, [
        element("div", { className: "label-lg", text: `Case file · ${site.id}` }),
        element("div", { className: `stamp${disputed ? " is-disputed" : ""}`, text: (site.verification || "Pending").toUpperCase() }),
      ]),
      element("h2", { text: site.name, attrs: { id: "case-name" } }),
      element("div", { className: "stages" }, [
        element("div", { className: "stage" }, [element("b", { text: "Closure" }), element("div", { text: stage.closureText })]),
        element("div", { className: "stage" }, [element("b", { text: "Transfer" }), element("div", { text: stage.transferText })]),
        element("div", { className: "stage" }, [element("b", { text: "Afterlife" }), element("div", { text: stage.afterlife || "Pending" })]),
      ]),
      element("p", { className: "case-summary", text: site.publicSummary || `${site.city ? `${site.city}, ` : ""}${site.state}. Closed ${site.closureYear}.` }),

      element("section", { className: "case-block is-evidence", attrs: { "aria-label": "Evidence, sourced" } }, [
        element("h3", {}, ["Evidence (sourced)", element("i", { text: "every line carries a source" })]),
        timelineBlock(site),
        trajectoryBlock(site),
        processBlock(site),
        element("h4", { text: "Sources" }),
        element("ul", {}, site.sourceUrls && site.sourceUrls.length ? site.sourceUrls.map(sourceLinkItem) : [element("li", { text: "Source URL pending." })]),
        element("details", {}, [
          element("summary", { text: `Archive trail · ${site.evidence.length} queue rows` }),
          element("ul", {}, site.evidence.length ? site.evidence.map(evidenceItem) : [element("li", { text: "Source trail pending." })]),
        ]),
      ]),

      element("section", { className: "case-block is-reading", attrs: { "aria-label": "Reading, interpretive" } }, [
        element("h3", {}, ["Reading (interpretive)", element("i", { text: "the atlas's argument, kept apart from evidence" })]),
        site.matrix && site.matrix.originalSystem
          ? element("ol", { className: "matrix-steps", attrs: { "aria-label": "Replacement matrix", style: "list-style:none;padding:0;margin:0" } },
              [["Was", site.matrix.originalSystem], ["Taken by", site.matrix.buyerSector], ["Became", site.matrix.replacementSystem]].map(([label, value]) =>
                element("li", {}, [element("span", { className: "matrix-label", text: label }), element("span", { className: "matrix-value", text: value })]),
              ))
          : null,
        site.transformation ? element("p", { className: "case-summary", text: site.transformation }) : null,
        site.editorialNote ? element("p", { className: "editorial-note" }, [element("b", { text: "Editorial note. " }), site.editorialNote]) : null,
        site.releaseGaps && site.releaseGaps.length ? element("ul", { className: "gap-list", attrs: { "aria-label": "Release gaps" } }, site.releaseGaps.map((gap) => element("li", { text: gap }))) : null,
      ]),
    ]);

    const ipeds = site.ipeds || {};
    const rows = [
      ["State", `${site.state}${site.region ? ` · ${site.region}` : ""}`],
      ["Closed", String(site.closureYear || "Undated")],
      ["Sector", site.sector],
      ["Campus type", site.campusType],
      ["Scale", site.scale],
      ["Buyer type", site.buyerType],
      ["Morphology", site.morphology],
      ["Status code", (site.events && site.events.length ? site.events[site.events.length - 1].type : "CLOSURE-EVENT")],
      ["Priority", site.atlasPriority],
      ["IPEDS", ipeds.unitid ? `UNITID ${ipeds.unitid}${ipeds.status ? ` · ${ipeds.status}` : ""}` : ipeds.parentUnitid ? `branch of ${ipeds.parentUnitid}` : ""],
      ["Sale price", site.salePrice],
    ].filter(([, value]) => value);
    rows.forEach(([key, value]) => props.appendChild(element("div", {}, [element("dt", { text: key }), element("dd", { text: value })])));
    const citation = `${window.location.origin === "null" ? "" : window.location.origin}${window.location.pathname}#campus/${site.id}`;
    $("#caseCite").textContent = `Cite this record: ${citation}`;
  }

  function renderDrawer(site) {
    const drawer = $("#mapDrawer");
    if (!site) {
      drawer.hidden = true;
      return;
    }
    const body = $("#drawerBody");
    clear(body);
    const ext = isExtended(site);
    append(body, [
      element("div", { className: "drawer-name", text: site.name }),
      element("div", { className: "drawer-meta", text: `${site.state} · closed ${site.closureYear || "—"}${ext ? " · extended record" : ""}` }),
      element("div", { className: "drawer-flow" }, [element("span", { text: "Campus" }), "→", element("span", { text: (ext ? site.buyerName : site.buyerController) || "not found" })]),
      element("div", { className: "drawer-label", text: "Replacement system" }),
      element("div", { text: (ext ? site.replacementSystem : site.matrix && site.matrix.replacementSystem) || site.afterlife || "—", style: { marginBottom: "8px" } }),
      element("div", { className: "drawer-label", text: "Status code" }),
      element("b", { className: "drawer-code", text: zoneOf(site) || "—" }),
      element("div", { className: "drawer-note", text: ext ? "Coded from public sources, not curated. Open the full record for the evidence." : "Interpretive layer, kept apart from sourced evidence. Open the full case file for sources." }),
      element("a", { className: "btn drawer-open", text: "Open full case file ↓", attrs: { href: `#campus/${site.id}` } }),
    ]);
    drawer.hidden = false;
  }

  // ------------------------------------------------------------------ select

  function select(id, options = {}) {
    if (!byId(id)) return;
    state.activeId = id;
    refresh();
    if (options.drawer) renderDrawer(byId(id));
    try {
      history.replaceState(null, "", `#campus/${id}`);
    } catch {
      /* file:// previews can refuse replaceState */
    }
  }

  function refresh() {
    // Lists are rebuilt on every change; put keyboard focus back on the same control.
    const active = document.activeElement;
    const focusKey = active && active.dataset ? active.dataset.focus : null;
    renderMapState();
    renderPanel();
    renderAxis();
    renderIndex();
    renderCase();
    applyView(false);
    if (focusKey) {
      const again = document.querySelector(`[data-focus="${focusKey}"]`);
      if (again) again.focus({ preventScroll: true });
    }
  }

  // ------------------------------------------------------------------- abyss

  function renderBubbles() {
    const list = $("#stateBubbles");
    clear(list);
    const rows = (data.abyss.stateCounts || []).filter((row) => /^[A-Z]{2}$/.test(row.label)).slice(0, 10);
    const max = Math.max(1, ...rows.map((row) => row.count));
    rows.forEach((row) => {
      // Area is proportional to the count; the largest bubble stays inside its slot.
      const d = 12 + Math.sqrt(row.count / max) * 54;
      list.appendChild(
        element("li", {}, [
          element("span", { className: "dot", style: { width: `${d}px`, height: `${d}px` } }),
          element("b", { text: row.label }),
          element("small", { text: formatNumber(row.count) }),
        ]),
      );
    });
    const freshness = (data.sourceFreshness || {}).fsaClosedSchoolSearch || {};
    $("#abyssSource").textContent = freshness.reportedDate
      ? `FSA Weekly Closed School Search File · report ${String(freshness.reportedDate).split(" ")[0]} · ${formatNumber(freshness.detailRows || data.abyss.totalRecords)} detail rows`
      : "FSA Weekly Closed School Search File";
  }

  function setFederalStatus(status, message) {
    state.federalStatus = status;
    const node = $("#federalStatus");
    node.textContent = message || "";
    node.hidden = !message;
  }

  function indexFederalRecord(record) {
    return {
      ...record,
      searchText: [record.name, record.location, record.address, record.city, record.state, record.country, record.opeid, record.rootOpeid, record.siteType, record.classification]
        .join(" ")
        .toLowerCase(),
    };
  }

  function ensureFederal() {
    if (federalLoad) return federalLoad;
    setFederalStatus("loading", `Loading ${formatNumber(data.abyss.totalRecords)} federal records (about 13 MB)…`);
    federalLoad = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = versioned(FEDERAL_RECORDS_URL, "federal");
      script.async = true;
      script.onload = () => {
        federalRecords = (window.DEAD_CAMPUS_FEDERAL_RECORDS || []).map(indexFederalRecord);
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
        buildRetreat();
        drawRetreat();
        drawHaze();
        renderMapState();
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

  const FATE_LABEL = {
    active: "Parent still reporting",
    closed: "Institution closed",
    combined: "Combined",
    dropped: "Left IPEDS, no close date",
  };
  const NOT_IN_IPEDS = data.ipedsYears ? `Not in IPEDS ${data.ipedsYears[0]}-${String(data.ipedsYears[1]).slice(2)}` : "Not in IPEDS";
  const fateOf = (record) => (record.ipedsStatus ? FATE_LABEL[record.ipedsStatus] || record.ipedsStatus : NOT_IN_IPEDS);

  // How a closure happened, from the SHEEO closed-college file: abrupt or orderly, notice, teach-out.
  const PROCESS_ALL = "All closures";
  function processText(process) {
    if (!process) return "";
    const parts = [];
    if (process.abrupt === true) parts.push("Abrupt");
    else if (process.abrupt === false) parts.push("Orderly");
    if (process.leadDays != null) parts.push(process.leadDays === 0 ? "announced the day it closed" : `${formatNumber(process.leadDays)} days notice`);
    if (process.teachOut === "yes") parts.push("teach-out plan");
    else if (process.teachOut === "no") parts.push("no teach-out");
    if (process.merged) parts.push(process.merged === "attempted" ? "merger attempted" : String(process.merged).toLowerCase());
    return parts.join(" · ");
  }
  const processKind = (record) => {
    if (!record.sheeo) return "Not in SHEEO file";
    if (record.sheeo.abrupt === true) return "Abrupt";
    if (record.sheeo.abrupt === false) return "Orderly";
    return "In SHEEO file";
  };
  const fateText = (record) => (record.ipedsStatus === "combined" && record.successor ? `Combined into ${record.successor}` : fateOf(record));

  // A federal site whose institution has a curated or extended record links to that case file.
  const caseLink = (record) =>
    record.record ? element("a", { className: "case-link", text: "Case file →", attrs: { href: `#campus/${record.record}` } }) : "";
  const federalPlace = (record) => [record.city, record.state].filter(Boolean).join(", ") || record.country || "Unknown";
  const federalRecordState = (record) => record.state || "Foreign/unknown";

  function filteredFederal() {
    const query = state.federalQuery.trim().toLowerCase();
    return federalRecords.filter((record) => {
      if (query && !record.searchText.includes(query)) return false;
      if (state.federalState !== "All states" && federalRecordState(record) !== state.federalState) return false;
      if (state.federalYear !== "All years" && String(record.closureYear || "Unknown") !== state.federalYear) return false;
      if (state.federalSiteType !== "All types" && (record.siteType || "Unclassified") !== state.federalSiteType) return false;
      if (state.federalFate !== "All fates" && fateOf(record) !== state.federalFate) return false;
      if (state.federalProcess !== PROCESS_ALL) {
        const kind = processKind(record);
        if (state.federalProcess === "In SHEEO file" ? !record.sheeo : kind !== state.federalProcess) return false;
      }
      return true;
    });
  }

  function renderFederalFilters() {
    const fill = (select, first, values) => {
      clear(select);
      [first, ...values].forEach((value) => select.appendChild(element("option", { text: value, attrs: { value } })));
    };
    const states = [...new Set(federalRecords.map(federalRecordState))].sort();
    const years = [...new Set(federalRecords.map((r) => String(r.closureYear || "Unknown")))].sort((a, b) => (a === "Unknown" ? 1 : b === "Unknown" ? -1 : Number(b) - Number(a)));
    const types = [...new Set(federalRecords.map((r) => r.siteType || "Unclassified"))].sort();
    fill($("#federalState"), "All states", states);
    fill($("#federalYear"), "All years", years);
    fill($("#federalSiteType"), "All types", types);
    fill($("#federalFate"), "All fates", [...Object.values(FATE_LABEL), NOT_IN_IPEDS]);
    fill($("#federalProcess"), PROCESS_ALL, ["Abrupt", "Orderly", "In SHEEO file", "Not in SHEEO file"]);
  }

  function renderFederalTable() {
    const records = filteredFederal();
    const totalPages = Math.max(1, Math.ceil(records.length / state.federalPageSize));
    state.federalPage = clamp(state.federalPage, 1, totalPages);
    $("#federalResultCount").textContent = `${formatNumber(records.length)} shown`;
    const start = (state.federalPage - 1) * state.federalPageSize;
    const body = $("#federalTableBody");
    clear(body);
    const page = records.slice(start, start + state.federalPageSize);
    if (!page.length) {
      body.appendChild(element("tr", {}, [element("td", { className: "federal-empty", text: federalRecords.length ? "No federal records match the current filters." : "Records load when this section is opened.", attrs: { colspan: "6" } })]));
    } else {
      page.forEach((record) =>
        body.appendChild(
          element("tr", {}, [
            element("td", {}, [element("div", { className: "federal-school" }, [element("strong", { text: record.name || "Unnamed school" }), element("span", { text: record.location || record.address || "Location pending" }), caseLink(record)])]),
            element("td", {}, [federalPlace(record), element("div", { className: "federal-muted", text: record.address || record.zip || "" })]),
            element("td", { text: compactDate(record.closureDate, record.closureYear) }),
            element("td", {}, [record.opeid || "Pending", element("div", { className: "federal-muted", text: record.branchSuffix ? `Branch ${record.branchSuffix}` : "" })]),
            element("td", {}, [record.siteType || "Unclassified", element("div", { className: "federal-muted", text: record.classification || "" })]),
            element("td", {}, [fateText(record), element("div", { className: "federal-muted", text: record.ipedsMatch ? `matched on ${record.ipedsMatch}` : "" }), record.sheeo ? element("div", { className: `federal-process${record.sheeo.abrupt === true ? " is-abrupt" : ""}`, text: processText(record.sheeo) }) : null]),
          ]),
        ),
      );
    }
    const pager = $("#federalPager");
    clear(pager);
    const first = records.length ? start + 1 : 0;
    const last = Math.min(start + state.federalPageSize, records.length);
    const prev = element("button", { text: "Previous", attrs: { type: "button", disabled: state.federalPage <= 1 } });
    const next = element("button", { text: "Next", attrs: { type: "button", disabled: state.federalPage >= totalPages } });
    prev.addEventListener("click", () => { state.federalPage = Math.max(1, state.federalPage - 1); renderFederalTable(); });
    next.addEventListener("click", () => { state.federalPage = Math.min(totalPages, state.federalPage + 1); renderFederalTable(); });
    append(pager, [element("span", { text: `${formatNumber(first)}-${formatNumber(last)} of ${formatNumber(records.length)}` }), element("div", { className: "pager-buttons" }, [prev, next])]);
  }

  // ------------------------------------------- year-slider retreat map (Fig. 03)

  const RETREAT_MAIN = 0.84;
  const RETREAT_ASPECT = ((59 * Math.cos((38 * Math.PI) / 180)) / 26) * RETREAT_MAIN;
  const RETREAT_INSETS = {
    AK: { lon: [-170, -130], lat: [51, 72], box: [0.015, 0.865, 0.085, 0.985] },
    HI: { lon: [-161, -154], lat: [18.5, 22.5], box: [0.12, 0.92, 0.19, 0.9837] },
    PR: { lon: [-67.6, -65], lat: [17.8, 18.7], box: [0.23, 0.945, 0.31, 0.985] },
  };
  const retreat = { points: [], mainPrefix: [], minYear: 1984, maxYear: 2026, year: 2026, branches: true, playing: false, timer: null, ready: false };

  function projectRetreat(lon, lat, code) {
    const inset = RETREAT_INSETS[code];
    if (inset) {
      const nx = (lon - inset.lon[0]) / (inset.lon[1] - inset.lon[0]);
      const ny = (inset.lat[1] - lat) / (inset.lat[1] - inset.lat[0]);
      if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null;
      return [inset.box[0] + nx * (inset.box[2] - inset.box[0]), inset.box[1] + ny * (inset.box[3] - inset.box[1])];
    }
    const x = (lon + 125) / 59;
    const y = (50 - lat) / 26;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return [x, y * RETREAT_MAIN];
  }

  function buildRetreat() {
    const points = [];
    federalRecords.forEach((record, index) => {
      if (typeof record.latitude !== "number") return;
      const p = projectRetreat(record.longitude, record.latitude, record.state);
      if (p) points.push({ x: p[0], y: p[1], year: record.closureYear || 0, main: record.siteType === "Main/Root", index });
    });
    points.sort((a, b) => a.year - b.year);
    const years = points.map((p) => p.year).filter(Boolean);
    retreat.points = points;
    retreat.minYear = years.length ? Math.min(...years) : 1984;
    retreat.maxYear = years.length ? Math.max(...years) : 2026;
    retreat.year = retreat.maxYear;
    retreat.mainPrefix = new Array(points.length + 1).fill(0);
    points.forEach((p, i) => { retreat.mainPrefix[i + 1] = retreat.mainPrefix[i] + (p.main ? 1 : 0); });
    const range = $("#retreatRange");
    range.min = String(retreat.minYear);
    range.max = String(retreat.maxYear);
    range.value = String(retreat.year);
    retreat.ready = true;
  }

  function retreatVisible(year) {
    let lo = 0;
    let hi = retreat.points.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (retreat.points[mid].year <= year) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  const cssVar = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

  function drawRetreat() {
    const canvas = $("#retreatCanvas");
    if (!retreat.ready) return;
    const width = Math.max(320, Math.floor(canvas.clientWidth || canvas.parentElement.clientWidth || 800));
    const height = Math.round(width / RETREAT_ASPECT);
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ink = cssVar("--ink", "#14110e");
    const blue = cssVar("--blue", "#1d3b5c");
    const paper = cssVar("--paper", "#efebe0");
    const muted = cssVar("--muted", "#5b564b");
    const faint = cssVar("--faint-line", "rgba(20,17,14,0.14)");
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = faint;
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    for (let lon = -120; lon <= -70; lon += 10) {
      const x = ((lon + 125) / 59) * width;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, RETREAT_MAIN * height);
    }
    for (let lat = 25; lat < 50; lat += 5) {
      const y = ((50 - lat) / 26) * RETREAT_MAIN * height;
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
    ctx.strokeStyle = muted;
    ctx.fillStyle = muted;
    ctx.font = "11px 'IBM Plex Mono', monospace";
    Object.entries(RETREAT_INSETS).forEach(([code, inset]) => {
      const [x0, y0, x1, y1] = inset.box;
      ctx.strokeRect(x0 * width - 4, y0 * height - 4, (x1 - x0) * width + 8, (y1 - y0) * height + 8);
      ctx.fillText(code, x0 * width - 4, y0 * height - 8);
    });
    const visible = retreatVisible(retreat.year);
    const group = (predicate, size, color, alpha) => {
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      for (let i = 0; i < visible; i += 1) {
        const p = retreat.points[i];
        if (p.year === retreat.year || !predicate(p)) continue;
        ctx.fillRect(p.x * width - size / 2, p.y * height - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
    };
    if (retreat.branches) group((p) => !p.main, 1.7, ink, 0.2);
    group((p) => p.main, 2.5, ink, 0.85);
    ctx.fillStyle = blue;
    for (let i = 0; i < visible; i += 1) {
      const p = retreat.points[i];
      if (p.year !== retreat.year || (!p.main && !retreat.branches)) continue;
      const size = p.main ? 4.6 : 3.2;
      ctx.fillRect(p.x * width - size / 2, p.y * height - size / 2, size, size);
    }
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = blue;
    sites.forEach((site) => {
      if (site.latitude === null || !site.closureYear || site.closureYear > retreat.year) return;
      const p = projectRetreat(Number(site.longitude), Number(site.latitude), site.state);
      if (!p) return;
      ctx.beginPath();
      ctx.arc(p[0] * width, p[1] * height, 5.2, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.save();
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.14;
    ctx.font = `700 ${Math.round(height * 0.14)}px 'Old Standard TT', serif`;
    ctx.textAlign = "right";
    ctx.fillText(String(retreat.year), width - 14, height - 12);
    ctx.restore();
    const mains = retreat.mainPrefix[visible];
    const branches = retreat.branches ? visible - mains : 0;
    const thisYear = retreat.points.filter((p, i) => i < visible && p.year === retreat.year && (p.main || retreat.branches)).length;
    $("#retreatYear").textContent = String(retreat.year);
    $("#retreatCount").textContent = `${formatNumber(mains + branches)} sites through ${retreat.year}`;
    canvas.setAttribute("aria-label", `Map of ${formatNumber(mains)} main campuses and ${formatNumber(branches)} branches closed through ${retreat.year}; ${formatNumber(thisYear)} closed in ${retreat.year}.`);
  }

  function setRetreatYear(year) {
    retreat.year = clamp(year, retreat.minYear, retreat.maxYear);
    $("#retreatRange").value = String(retreat.year);
    drawRetreat();
  }

  function stopRetreat() {
    retreat.playing = false;
    if (retreat.timer) window.clearInterval(retreat.timer);
    retreat.timer = null;
    $("#retreatPlay").textContent = "Play";
    $("#retreatPlay").setAttribute("aria-pressed", "false");
  }

  function startRetreat() {
    if (!retreat.ready) {
      ensureFederal().then(() => { if (retreat.ready) startRetreat(); });
      return;
    }
    if (retreat.year >= retreat.maxYear) setRetreatYear(retreat.minYear);
    retreat.playing = true;
    $("#retreatPlay").textContent = "Pause";
    $("#retreatPlay").setAttribute("aria-pressed", "true");
    retreat.timer = window.setInterval(() => {
      if (retreat.year >= retreat.maxYear) { stopRetreat(); return; }
      setRetreatYear(retreat.year + 1);
    }, 320);
  }

  function bindRetreat() {
    const canvas = $("#retreatCanvas");
    $("#retreatRange").addEventListener("input", (event) => { stopRetreat(); setRetreatYear(Number(event.target.value)); });
    $("#retreatPlay").addEventListener("click", () => (retreat.playing ? stopRetreat() : startRetreat()));
    $("#retreatBranches").addEventListener("change", (event) => { retreat.branches = event.target.checked; drawRetreat(); });
    canvas.addEventListener("pointermove", (event) => {
      if (!retreat.ready) return;
      const rect = canvas.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const visible = retreatVisible(retreat.year);
      let best = null;
      let bestD = 64;
      for (let i = 0; i < visible; i += 1) {
        const p = retreat.points[i];
        if (!p.main && !retreat.branches) continue;
        const dx = p.x * rect.width - px;
        const dy = p.y * rect.height - py;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = p; }
      }
      const out = $("#retreatReadout");
      if (!best) { out.textContent = "Move across the map to identify a site."; return; }
      const record = federalRecords[best.index];
      out.textContent = `${record.name || "Unnamed school"} — ${federalPlace(record)}, closed ${record.closureYear || "unknown"}, ${best.main ? "main campus" : "branch or annex"}; ${fateText(record).toLowerCase()}.`;
    });
    canvas.addEventListener("pointerleave", () => { $("#retreatReadout").textContent = "Move across the map to identify a site."; });
    if (typeof ResizeObserver === "function") new ResizeObserver(() => drawRetreat()).observe(canvas.parentElement);
    else window.addEventListener("resize", drawRetreat);
  }

  // ------------------------------------------------- queue / timeline / method

  function renderQueue() {
    const items = [];
    const bar = data.releaseBar || { sitesWithGaps: [] };
    (bar.sitesWithGaps || []).forEach((entry) => items.push({ id: entry.id, title: entry.name, note: `Release gap: ${entry.gaps.join(", ")}` }));
    sites.forEach((site) => {
      if (site.editorialNote) items.push({ id: site.id, title: site.name, note: site.editorialNote });
    });
    sites.forEach((site) => {
      const done = (site.events || []).some((e) => TRANSFER_TYPES.has(e.type) && e.ownershipChange !== false);
      if (!done && site.verification !== "Non-closure sale") items.push({ id: site.id, title: site.name, note: "No completed transfer on record." });
    });
    $("#queueCount").textContent = String(items.length);
    $("#queueLead").textContent = (bar.sitesWithGaps || []).length
      ? `${bar.sitesWithGaps.length} public sites fail a release gate.`
      : `All ${sites.length} public sites have a source URL and clear every release gate. What remains is editorial: classifications the sources contradict, and transfers not yet documented.`;
    const list = $("#queueList");
    clear(list);
    items.forEach((item) => {
      const button = element("button", { text: item.title, attrs: { type: "button" } });
      button.addEventListener("click", () => {
        select(item.id, { drawer: false });
        $("#records").scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
      });
      list.appendChild(element("li", {}, [element("span", { text: "☐ " }), button, element("small", { text: item.note })]));
    });
  }

  // The three layers are one table: institutions and the sites under them, with a `layer` column.
  function renderDataset() {
    const info = data.dataset;
    if (!info) return;
    const layers = [
      ["curated", "Curated", "Written for visitors, every claim sourced."],
      ["extended", "Extended", "Campus closed; coded from public pages with an evidence URL per claim."],
      ["coded", "Coded, not drawn", "Still operating, merged with the campus continuing, not a closure, or unresolved."],
      ["federal", "Federal only", "Known from the federal closure file and the IPEDS directory, not yet coded."],
    ];
    $("#datasetLead").textContent =
      `${formatNumber(info.records)} records in one table: ${formatNumber(info.institutions)} institutions and the ` +
      `${formatNumber(info.sites)} federal closure sites beneath them. A site row points to its institution; a layer column says how much is known.`;
    const list = $("#datasetLayers");
    clear(list);
    layers.forEach(([key, title, text]) =>
      list.appendChild(
        element("li", {}, [
          element("b", { text: `${title} · ${formatNumber(info.institutionsByLayer[key] || 0)}` }),
          text,
        ]),
      ),
    );
    $("#datasetNote").textContent =
      `Count institutions or sites, not both: filter on kind. ${formatNumber(info.institutionsWithFate)} institutions carry a coded campus fate.`;
    const links = $("#datasetLinks");
    clear(links);
    const mb = info.bytes ? ` · ${(info.bytes / 1048576).toFixed(1)} MB` : "";
    append(links, [
      element("a", { className: "btn", text: `Download atlas-records.csv${mb}`, attrs: { href: versioned(info.file, "records"), download: "atlas-records.csv" } }),
      element("a", { text: "Column guide (JSON)", attrs: { href: info.schema, target: "_blank", rel: "noopener" } }),
    ]);
  }

  function renderDecades() {
    const rows = (data.abyss.timeline || []).filter((row) => /^\d{4}$/.test(String(row.label)));
    const decades = new Map();
    rows.forEach((row) => {
      const decade = Math.floor(Number(row.label) / 10) * 10;
      decades.set(decade, (decades.get(decade) || 0) + Number(row.count || 0));
    });
    const entries = [...decades.entries()].sort((a, b) => a[0] - b[0]);
    const max = Math.max(1, ...entries.map(([, count]) => count));
    const list = $("#decadeBars");
    clear(list);
    const last = entries.length ? entries[entries.length - 1][0] : 0;
    entries.forEach(([decade, count]) =>
      list.appendChild(
        element("li", {}, [
          element("span", { text: `${decade}s` }),
          element("span", { className: "track" }, [element("span", { className: `fill${decade === last ? " is-current" : ""}`, style: { width: `${(count / max) * 100}%` } })]),
          element("span", { className: "n", text: formatNumber(count) }),
        ]),
      ),
    );
    const freshness = (data.sourceFreshness || {}).fsaClosedSchoolSearch || {};
    $("#decadeNote").textContent = `Federal closure sites by decade of closure. The ${last}s run only through the ${freshness.reportedDate ? String(freshness.reportedDate).split(" ")[0] : "latest"} report. Counts are sites, not institutions.`;
  }

  function renderReadings() {
    const list = $("#readingsList");
    clear(list);
    (data.readings || []).forEach((reading) =>
      list.appendChild(
        element("article", { className: `reading is-${reading.status}` }, [
          element("span", { className: "reading-status", text: reading.status }),
          element("h4", { text: reading.claim }),
          element("dl", {}, [
            element("div", {}, [element("dt", { text: "Test" }), element("dd", { text: reading.test })]),
            element("div", {}, [element("dt", { text: "Evidence" }), element("dd", { text: reading.evidence })]),
            reading.counter ? element("div", {}, [element("dt", { text: "Against" }), element("dd", { text: reading.counter })]) : null,
          ]),
        ]),
      ),
    );
    const bar = data.releaseBar || { gapCounts: {}, publicSites: sites.length, releaseReady: 0 };
    const box = $("#releaseBar");
    clear(box);
    const sample = data.afterlifeSample || {};
    const cells = [
      [`${bar.releaseReady} / ${bar.publicSites}`, "Campuses clearing every gate"],
      [String(Object.values(bar.gapCounts || {}).reduce((a, b) => a + b, 0)), "Open release gaps"],
      [sample.n ? String(sample.n) : "—", "Afterlife sample coded"],
      [sample.campusClosed ? `${sample.campusClosed.sharePct}%` : "—", "Of sampled exits were closures"],
    ];
    cells.forEach(([value, label]) => box.appendChild(element("div", {}, [element("b", { text: value }), element("span", { text: label })])));
  }

  // ------------------------------------------------------------------ routing

  const SECTION_TARGET = { atlas: "#atlas", archive: "#atlas", records: "#records", abyss: "#abyss", queue: "#queue", timeline: "#timeline", method: "#method", readings: "#readings" };

  function scrollToSection(target) {
    const node = target && $(target);
    if (node) node.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  }

  function applyRoute(initial) {
    const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    const [kind, value] = hash.split("/");
    if (kind === "campus" && !byId(value) && extendedCount && !extendedLoad) {
      loadExtended().then(() => {
        if (byId(value)) applyRoute(false);
      });
      return true;
    }
    if (kind === "campus" && byId(value)) {
      state.query = "";
      state.code = null;
      state.group = null;
      $("#searchInput").value = "";
      state.activeId = value;
      if (isExtended(byId(value)) && state.scope === "curated") state.scope = "all";
      refresh();
      scrollToSection("#records");
      return true;
    }
    if (kind === "view" && SECTION_TARGET[value]) {
      scrollToSection(SECTION_TARGET[value]);
      if (value === "abyss") ensureFederal();
      return true;
    }
    return false;
  }

  function trackSections() {
    const links = [...document.querySelectorAll(".offices a[data-section]")];
    const sections = links.map((link) => $(`#${link.dataset.section}`)).filter(Boolean);
    let ticking = false;
    const update = () => {
      ticking = false;
      let current = sections[0];
      sections.forEach((section) => {
        if (section.getBoundingClientRect().top <= 140) current = section;
      });
      links.forEach((link) => link.setAttribute("aria-current", String(current && link.dataset.section === current.id)));
    };
    window.addEventListener("scroll", () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }, { passive: true });
    update();
  }

  function bindChrome() {
    const toggle = $("#menuToggle");
    const nav = $("#offices");
    toggle.addEventListener("click", () => {
      const open = !nav.classList.contains("is-open");
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
    });
    nav.addEventListener("click", (event) => {
      if (event.target.closest("a")) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
    $("#searchInput").addEventListener("input", (event) => { state.query = event.target.value; refresh(); });
    document.querySelectorAll("#scopeSeg button").forEach((button) =>
      button.addEventListener("click", () => {
        state.scope = button.dataset.scope;
        refresh();
        if (state.scope !== "curated") loadExtended();
      }),
    );
    $("#federalSearch").addEventListener("focus", () => ensureFederal());
    $("#federalSearch").addEventListener("input", (event) => {
      ensureFederal();
      state.federalQuery = event.target.value;
      state.federalPage = 1;
      renderFederalTable();
    });
    [["#federalState", "federalState"], ["#federalYear", "federalYear"], ["#federalSiteType", "federalSiteType"], ["#federalFate", "federalFate"], ["#federalProcess", "federalProcess"]].forEach(([selector, key]) =>
      $(selector).addEventListener("change", (event) => { state[key] = event.target.value; state.federalPage = 1; renderFederalTable(); }),
    );
    window.addEventListener("hashchange", () => applyRoute(false));
    $("#drawerBody").addEventListener("click", (event) => {
      const link = event.target.closest("a.drawer-open");
      if (!link) return;
      event.preventDefault();
      scrollToSection("#records");
    });
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          ensureFederal();
          observer.disconnect();
        }
      }, { rootMargin: "300px" });
      observer.observe($("#abyss"));
    }
  }

  // --------------------------------------------------------------------- init

  function init() {
    // The jump panel starts collapsed under 1100px wide, as the handoff specifies.
    state.panelOpen = window.innerWidth >= 1100;
    // Honest hint about wheel behaviour.
    const hint = document.querySelector("#fig1-title .hint");
    if (hint) hint.textContent = "· drag · ctrl/⌘ + scroll, or focus the map, to zoom · click a zone";
    const dashboardLink = $("#dashboardLink");
    if (dashboardLink && DASHBOARD_URL) dashboardLink.hidden = false;
    renderHero();
    renderFooter();
    buildMap();
    bindMap();
    bindRetreat();
    bindChrome();
    renderBubbles();
    renderQueue();
    renderDataset();
    renderDecades();
    renderReadings();
    refresh();
    renderFederalTable();
    fit(false);
    trackSections();
    if (!applyRoute(true)) renderDrawer(null);
    // The extended records are not needed for first paint; fetch them once the page is idle.
    if (extendedCount) {
      const idle = window.requestIdleCallback || ((fn) => window.setTimeout(fn, 400));
      idle(() => loadExtended(), { timeout: 2000 });
    }
  }

  init();
})();
