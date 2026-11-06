(() => {
  "use strict";

  const SRP_STORAGE_KEY = "supervisor-status-report-v1";
  const CESS_STORAGE_KEY = "supervisor-status-report-cess-v1";
  const ACTIVE_TAB_KEY = "supervisor-status-report-active-tab";
  const CESS_TANKS = ["st1a", "st1b", "st2a", "st2b", "st3a", "st3b"];

  const srpDefaults = {
    "p3-mode": "offline",
    "p3-a-result": "",
    "p3-a-time": "",
    "p3-b-result": "",
    "p3-b-time": "",
    "p3-trend": "",
    "p4-mode": "offline",
    "p4-a-result": "",
    "p4-a-time": "",
    "p4-b-result": "",
    "p4-b-time": "",
    "p4-trend": "",
    "st5-level": "",
    "st5-active": true,
    "st6-level": "",
    "st6-active": true,
    "st7-level": "",
    "st7-active": true,
    "st8-level": "",
    "st8-active": true,
    "wt-level": ""
  };

  const electrolyteStatuses = [
    ["arrived", "Arrived (no inbound/sample)"],
    ["inbounded", "GSC inbounded (no sample)"],
    ["sample_collection", "Sample collection in progress"],
    ["awaiting_quality_pickup", "Sample awaiting Quality pickup"],
    ["with_quality", "Sample with Quality team"],
    ["qc_passed_waiting", "QC passed, waiting for system to allow unload"],
    ["unload_delayed", "Unload delayed"],
    ["unloading", "Unload in progress"],
    ["unload_interrupted", "Unload interrupted"],
    ["empty_awaiting_pickup", "Empty, awaiting pickup"]
  ];

  const otherStatuses = [
    ["arrived", "Arrived"],
    ["setup_delayed", "Setup delayed"],
    ["setup_in_progress", "Setup in progress"],
    ["unloading", "Unloading"],
    ["unload_delayed_paused", "Unload delayed/paused"],
    ["empty_awaiting_pickup", "Empty, awaiting pickup"],
    ["empty_prepping_removal", "Empty, prepping for removal"]
  ];

  const $ = (id) => document.getElementById(id);
  const srpSavedFields = [...document.querySelectorAll("[data-save]")];
  const cessSavedFields = [...document.querySelectorAll("[data-cess-save]")];
  let activeReport = "srp";
  let cessTankers = [];
  let nextTankerId = 1;

  function loadSrpState() {
    let state = { ...srpDefaults };
    try {
      const saved = JSON.parse(localStorage.getItem(SRP_STORAGE_KEY) || "{}");
      state = { ...state, ...saved };
    } catch (_) {}

    for (const field of srpSavedFields) {
      if (field.type === "checkbox") {
        field.checked = Boolean(state[field.id]);
      } else {
        field.value = state[field.id] ?? "";
      }
    }

    for (const prefix of ["p3", "p4"]) {
      $(`${prefix}-b-not-collected`).checked = false;
    }

    updateSrpConditionalFields();
    updateRuntimePreview();
  }

  function collectSrpState() {
    const state = {};
    for (const field of srpSavedFields) {
      state[field.id] = field.type === "checkbox" ? field.checked : field.value;
    }
    return state;
  }

  function saveSrpState() {
    localStorage.setItem(SRP_STORAGE_KEY, JSON.stringify(collectSrpState()));
  }

  function resetSrpState() {
    localStorage.removeItem(SRP_STORAGE_KEY);
    for (const field of srpSavedFields) {
      const value = srpDefaults[field.id];
      if (field.type === "checkbox") {
        field.checked = Boolean(value);
      } else {
        field.value = value ?? "";
      }
      field.classList.remove("invalid");
    }

    for (const prefix of ["p3", "p4"]) {
      $(`${prefix}-b-not-collected`).checked = false;
    }
    updateSrpConditionalFields();
    updateRuntimePreview();
    hideValidation();
  }

  function updateSrpConditionalFields() {
    for (const prefix of ["p3", "p4"]) {
      const mode = $(`${prefix}-mode`).value;
      const noSamplesRequired = mode === "offline" || mode === "startup";
      const standby = mode === "standby";

      $(`${prefix}-samples`).hidden = noSamplesRequired;
      $(`${prefix}-b-sample`).hidden = mode !== "serial";
      $(`${prefix}-b-fields`).hidden = isBNotCollected(prefix);
      $(`${prefix}-a-heading`).textContent = standby ? "Standby sample" : "A-side sample";

      const note = $(`${prefix}-mode-note`);
      if (noSamplesRequired) {
        note.textContent = "No sample data required for this operational mode.";
      } else if (standby) {
        note.textContent = "Most recent sample data (within the past 3hr) required.";
      } else {
        note.textContent = "Most recent sample data for A-side and B-side required.";
      }

      $(`${prefix}-trend-field`).hidden = !hasOutOfSpecSample(prefix, mode);
    }
  }

  function numericSampleValue(id) {
    const raw = $(id).value.trim();
    if (raw === "") return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  function hasOutOfSpecSample(prefix, mode = $(`${prefix}-mode`).value) {
    if (mode !== "standby" && mode !== "serial") return false;
    const a = numericSampleValue(`${prefix}-a-result`);
    if (a !== null && a >= 100) return true;

    if (mode === "serial" && !isBNotCollected(prefix)) {
      const b = numericSampleValue(`${prefix}-b-result`);
      if (b !== null && b >= 100) return true;
    }
    return false;
  }

  function isBNotCollected(prefix) {
    return $(`${prefix}-b-not-collected`).checked;
  }

  function handleBNotCollectedChange(prefix) {
    if (isBNotCollected(prefix)) {
      for (const suffix of ["b-result", "b-time"]) {
        const field = $(`${prefix}-${suffix}`);
        field.value = "";
        field.classList.remove("invalid");
      }
      saveSrpState();
    }
    updateSrpConditionalFields();
  }

  function parseLevel(id) {
    const raw = $(id).value.trim();
    if (raw === "") return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  function tankRuntimeDays(level) {
    return ((1.037 * level + 3.502) - 6.613) / 58;
  }

  function totalRuntimeDays() {
    let total = 0;
    for (const tank of ["st5", "st6", "st7", "st8"]) {
      if (!$(`${tank}-active`).checked) continue;
      const level = parseLevel(`${tank}-level`);
      if (level !== null) total += tankRuntimeDays(level);
    }
    return total;
  }

  function formatDuration(days) {
    const totalHours = Math.round(days * 24);
    const wholeDays = Math.floor(totalHours / 24);
    const hours = Math.abs(totalHours % 24);
    return `${wholeDays}d ${hours}hr`;
  }

  function updateRuntimePreview() {
    $("runtime-preview").textContent = formatDuration(totalRuntimeDays());
  }

  function formatPercent(value) {
    return `${Number(value).toFixed(1)}%`;
  }

  function modeSentence(label, prefix) {
    const mode = $(`${prefix}-mode`).value;
    if (mode === "offline") return `${label} offline`;
    if (mode === "startup") return `${label} starting up`;

    const modeText = mode === "standby" ? "in standby" : "in serial";
    const a = Number($(`${prefix}-a-result`).value);
    const aTime = $(`${prefix}-a-time`).value;
    let sentence;

    if (mode === "standby") {
      sentence = `${label} ${modeText}. Standby sample, ${Math.round(a)}ppm @ ${aTime}.`;
    } else if (isBNotCollected(prefix)) {
      sentence = `${label} ${modeText}. A-side, ${Math.round(a)}ppm @ ${aTime}. B-side not collected yet.`;
    } else {
      const b = Number($(`${prefix}-b-result`).value);
      const bTime = $(`${prefix}-b-time`).value;
      sentence = `${label} ${modeText}. A-side, ${Math.round(a)}ppm @ ${aTime}. B-side, ${Math.round(b)}ppm @ ${bTime}.`;
    }

    if (hasOutOfSpecSample(prefix, mode)) sentence += ` ${trendSentence($(`${prefix}-trend`).value)}`;
    return sentence;
  }

  function trendSentence(trend) {
    switch (trend) {
      case "first": return "This was the first sample collected after startup.";
      case "increasing": return "Water content since last report appears to be increasing.";
      case "decreasing": return "Water content since last report appears to be decreasing.";
      case "stable": return "Water content since last report appears stable.";
      case "unclear": return "Water content since last report appears unstable or the trend is not clear.";
      default: return "";
    }
  }

  function validateSrp() {
    const errors = [];
    clearInvalid("srp-panel");

    for (const [label, prefix] of [["3P", "p3"], ["4P", "p4"]]) {
      const mode = $(`${prefix}-mode`).value;
      if (mode === "standby" || mode === "serial") {
        const requiredFields = mode === "standby"
          ? [["a-result", "standby sample result"], ["a-time", "standby sample time"]]
          : [["a-result", "A-side result"], ["a-time", "A-side time"]];

        if (mode === "serial" && !isBNotCollected(prefix)) {
          requiredFields.push(["b-result", "B-side result"], ["b-time", "B-side time"]);
        }

        for (const [suffix, name] of requiredFields) {
          const field = $(`${prefix}-${suffix}`);
          if (field.value === "") {
            errors.push(`${label}: ${name} is required.`);
            field.classList.add("invalid");
          }
        }

        if (hasOutOfSpecSample(prefix, mode) && $(`${prefix}-trend`).value === "") {
          errors.push(`${label}: select the out-of-spec water-content trend.`);
          $(`${prefix}-trend`).classList.add("invalid");
        }
      }
    }

    for (const tank of ["st5", "st6", "st7", "st8"]) {
      validateLevelField(`${tank}-level`, tank.toUpperCase(), errors);
    }
    validateLevelField("wt-level", "WT", errors);
    return showValidationErrors(errors, "srp-panel");
  }

  function buildSrpReport() {
    const lines = [modeSentence("3P", "p3"), modeSentence("4P", "p4"), "", `WT – ${formatPercent(parseLevel("wt-level"))}`];
    for (const tank of ["st5", "st6", "st7", "st8"]) {
      const active = $(`${tank}-active`).checked ? "active" : "inactive";
      lines.push(`${tank.toUpperCase()} – ${formatPercent(parseLevel(`${tank}-level`))} – ${active}`);
    }
    lines.push(`Current NMP supply: ${formatDuration(totalRuntimeDays())}`);
    return lines.join("\n");
  }

  function newTanker() {
    return {
      id: nextTankerId++,
      type: "electrolyte",
      supplier: "geo_czech",
      otherSupplier: "",
      destination: "",
      status: "arrived",
      reason: "",
      contents: "",
      destinations: []
    };
  }

  function normalizeTanker(raw) {
    const type = raw?.type === "other" ? "other" : "electrolyte";
    return {
      id: Number.isInteger(Number(raw?.id)) ? Number(raw.id) : nextTankerId++,
      type,
      supplier: raw?.supplier || "geo_czech",
      otherSupplier: String(raw?.otherSupplier || ""),
      destination: String(raw?.destination || ""),
      status: raw?.status || "arrived",
      reason: String(raw?.reason || ""),
      contents: String(raw?.contents || ""),
      destinations: Array.isArray(raw?.destinations) ? raw.destinations.filter(value => CESS_TANKS.includes(value)) : []
    };
  }

  function loadCessState() {
    let state = {};
    try {
      state = JSON.parse(localStorage.getItem(CESS_STORAGE_KEY) || "{}");
    } catch (_) {}

    for (const field of cessSavedFields) field.value = state.levels?.[field.id] ?? "";
    nextTankerId = 1;
    cessTankers = Array.isArray(state.tankers) ? state.tankers.map(normalizeTanker) : [];
    nextTankerId = Math.max(1, ...cessTankers.map(tanker => tanker.id + 1));
    renderTankers();
  }

  function saveCessState() {
    const levels = {};
    for (const field of cessSavedFields) levels[field.id] = field.value;
    localStorage.setItem(CESS_STORAGE_KEY, JSON.stringify({ levels, tankers: cessTankers }));
  }

  function resetCessState() {
    localStorage.removeItem(CESS_STORAGE_KEY);
    for (const field of cessSavedFields) {
      field.value = "";
      field.classList.remove("invalid");
    }
    cessTankers = [];
    nextTankerId = 1;
    renderTankers();
    hideValidation();
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function optionHtml(value, label, selected) {
    return `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`;
  }

  function tankerStatusOptions(tanker) {
    const statuses = tanker.type === "electrolyte" ? electrolyteStatuses : otherStatuses;
    return statuses.map(([value, label]) => optionHtml(value, label, tanker.status)).join("");
  }

  function tankerReasonLabel(tanker) {
    if (tanker.type === "electrolyte") {
      if (tanker.status === "unload_delayed") return "Reason for unload delay";
      if (tanker.status === "unload_interrupted") return "Reason for interruption";
    } else {
      if (tanker.status === "setup_delayed") return "Reason for setup delay";
      if (tanker.status === "unload_delayed_paused") return "Reason for unload delay/pause";
    }
    return "";
  }

  function renderTankers() {
    $("no-tankers-message").hidden = cessTankers.length > 0;
    $("tanker-list").innerHTML = cessTankers.map((tanker, index) => {
      const reasonLabel = tankerReasonLabel(tanker);
      const electrolyteFields = `
        <label class="field">
          <span>Supplier</span>
          <select data-tanker-field="supplier">
            ${optionHtml("geo_czech", "GEO Czech", tanker.supplier)}
            ${optionHtml("geo_memphis", "GEO Memphis", tanker.supplier)}
            ${optionHtml("capchem", "CapChem", tanker.supplier)}
            ${optionHtml("other", "Other", tanker.supplier)}
          </select>
        </label>
        <label class="field conditional-field"${tanker.supplier === "other" ? "" : " hidden"}>
          <span>Other supplier</span>
          <input type="text" data-tanker-field="otherSupplier" value="${escapeHtml(tanker.otherSupplier)}" placeholder="Enter supplier" />
        </label>
        <label class="field">
          <span>Destination tank</span>
          <select data-tanker-field="destination">
            <option value="">Select destination</option>
            ${CESS_TANKS.map(tank => optionHtml(tank, tank.toUpperCase(), tanker.destination)).join("")}
          </select>
        </label>`;

      const otherFields = `
        <label class="field">
          <span>Contents</span>
          <input type="text" data-tanker-field="contents" value="${escapeHtml(tanker.contents)}" placeholder="Enter tanker contents" />
        </label>
        <fieldset class="destination-fieldset" data-tanker-group="destinations">
          <legend>Destination tank(s)</legend>
          <div class="destination-options">
            ${CESS_TANKS.map(tank => `<label class="destination-option"><input type="checkbox" data-tanker-field="destinations" value="${tank}"${tanker.destinations.includes(tank) ? " checked" : ""} /><span>${tank.toUpperCase()}</span></label>`).join("")}
          </div>
        </fieldset>`;

      return `
        <article class="tanker-card" data-tanker-id="${tanker.id}">
          <div class="tanker-card-heading">
            <div><p class="section-kicker">On-site tanker</p><h3>Tanker ${index + 1}</h3></div>
            <button class="btn btn-remove" type="button" data-remove-tanker="${tanker.id}" aria-label="Remove tanker ${index + 1}">Remove</button>
          </div>
          <label class="field">
            <span>Type</span>
            <select data-tanker-field="type">
              ${optionHtml("electrolyte", "Electrolyte", tanker.type)}
              ${optionHtml("other", "Other", tanker.type)}
            </select>
          </label>
          <div class="tanker-fields">
            ${tanker.type === "electrolyte" ? electrolyteFields : otherFields}
            <label class="field">
              <span>Status</span>
              <select data-tanker-field="status">${tankerStatusOptions(tanker)}</select>
            </label>
            <label class="field conditional-field"${reasonLabel ? "" : " hidden"}>
              <span>${escapeHtml(reasonLabel)}</span>
              <input type="text" data-tanker-field="reason" value="${escapeHtml(tanker.reason)}" placeholder="Enter reason" />
            </label>
          </div>
        </article>`;
    }).join("");
  }

  function tankerByElement(element) {
    const card = element.closest("[data-tanker-id]");
    if (!card) return null;
    return cessTankers.find(tanker => tanker.id === Number(card.dataset.tankerId)) || null;
  }

  function handleTankerField(event) {
    const field = event.target.closest("[data-tanker-field]");
    if (!field) return;
    const tanker = tankerByElement(field);
    if (!tanker) return;
    const name = field.dataset.tankerField;

    field.classList.remove("invalid");
    field.closest("[data-tanker-group]")?.classList.remove("invalid-group");

    if (name === "destinations") {
      tanker.destinations = field.checked
        ? [...new Set([...tanker.destinations, field.value])]
        : tanker.destinations.filter(value => value !== field.value);
    } else if (name === "type") {
      tanker.type = field.value;
      tanker.status = "arrived";
      tanker.reason = "";
      tanker.destination = "";
      tanker.destinations = [];
      renderTankers();
    } else {
      tanker[name] = field.value;
      if (event.type === "change" && (name === "supplier" || name === "status")) renderTankers();
    }

    saveCessState();
  }

  function validateLevelField(id, label, errors) {
    const field = $(id);
    const value = parseLevel(id);
    if (value === null) {
      errors.push(`${label}: level is required.`);
      field.classList.add("invalid");
    } else if (value < 0 || value > 100) {
      errors.push(`${label}: level must be between 0.0% and 100.0%.`);
      field.classList.add("invalid");
    }
  }

  function invalidateTankerField(tanker, fieldName, message, errors) {
    const card = document.querySelector(`[data-tanker-id="${tanker.id}"]`);
    const field = card?.querySelector(`[data-tanker-field="${fieldName}"]`);
    field?.classList.add("invalid");
    errors.push(message);
  }

  function validateCess() {
    const errors = [];
    clearInvalid("cess-panel");
    for (const tank of CESS_TANKS) validateLevelField(`cess-${tank}-level`, tank.toUpperCase(), errors);

    cessTankers.forEach((tanker, index) => {
      const label = `Tanker ${index + 1}`;
      if (tanker.type === "electrolyte") {
        if (tanker.supplier === "other" && !tanker.otherSupplier.trim()) {
          invalidateTankerField(tanker, "otherSupplier", `${label}: other supplier is required.`, errors);
        }
        if (!tanker.destination) {
          invalidateTankerField(tanker, "destination", `${label}: destination tank is required.`, errors);
        }
      } else {
        if (!tanker.contents.trim()) {
          invalidateTankerField(tanker, "contents", `${label}: contents are required.`, errors);
        }
        if (!tanker.destinations.length) {
          const group = document.querySelector(`[data-tanker-id="${tanker.id}"] [data-tanker-group="destinations"]`);
          group?.classList.add("invalid-group");
          errors.push(`${label}: select at least one destination tank.`);
        }
      }

      if (tankerReasonLabel(tanker) && !tanker.reason.trim()) {
        invalidateTankerField(tanker, "reason", `${label}: reason is required for the selected status.`, errors);
      }
    });

    return showValidationErrors(errors, "cess-panel");
  }

  function supplierLabel(tanker) {
    const labels = { geo_czech: "GEO Czech", geo_memphis: "GEO Memphis", capchem: "CapChem" };
    return tanker.supplier === "other" ? `Other (${tanker.otherSupplier.trim()})` : labels[tanker.supplier];
  }

  function statusLabel(tanker) {
    const statuses = tanker.type === "electrolyte" ? electrolyteStatuses : otherStatuses;
    return statuses.find(([value]) => value === tanker.status)?.[1] || tanker.status;
  }

  function buildCessReport() {
    const lines = ["CESS tank levels"];
    for (const tank of CESS_TANKS) lines.push(`${tank.toUpperCase()} – ${formatPercent(parseLevel(`cess-${tank}-level`))}`);
    lines.push("", "On-site tankers");

    if (!cessTankers.length) {
      lines.push("No on-site tankers.");
    } else {
      cessTankers.forEach((tanker, index) => {
        const status = tankerReasonLabel(tanker) ? `${statusLabel(tanker)}: ${tanker.reason.trim()}` : statusLabel(tanker);
        if (tanker.type === "electrolyte") {
          lines.push(`Tanker ${index + 1} – Electrolyte – ${supplierLabel(tanker)} – destination ${tanker.destination.toUpperCase()} – ${status}`);
        } else {
          const destinationWord = tanker.destinations.length === 1 ? "destination" : "destinations";
          const destinations = tanker.destinations.map(value => value.toUpperCase()).join(", ");
          lines.push(`Tanker ${index + 1} – Other (${tanker.contents.trim()}) – ${destinationWord} ${destinations} – ${status}`);
        }
      });
    }
    return lines.join("\n");
  }

  function clearInvalid(panelId) {
    $(`${panelId}`).querySelectorAll(".invalid").forEach(element => element.classList.remove("invalid"));
    $(`${panelId}`).querySelectorAll(".invalid-group").forEach(element => element.classList.remove("invalid-group"));
  }

  function hideValidation() {
    $("validation-summary").hidden = true;
  }

  function showValidationErrors(errors, panelId) {
    if (!errors.length) {
      hideValidation();
      return true;
    }

    const summary = $("validation-summary");
    summary.textContent = errors[0] + (errors.length > 1 ? ` (+${errors.length - 1} more)` : "");
    summary.hidden = false;
    const firstInvalid = $(`${panelId}`).querySelector(".invalid, .invalid-group");
    firstInvalid?.scrollIntoView({ behavior: "smooth", block: "center" });
    const focusTarget = firstInvalid?.matches("input, select") ? firstInvalid : firstInvalid?.querySelector("input, select");
    focusTarget?.focus({ preventScroll: true });
    return false;
  }

  function setActiveReport(report) {
    activeReport = report === "cess" ? "cess" : "srp";
    for (const tab of document.querySelectorAll("[data-report-tab]")) {
      const active = tab.dataset.reportTab === activeReport;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    }
    $("srp-panel").hidden = activeReport !== "srp";
    $("srp-panel").classList.toggle("active", activeReport === "srp");
    $("cess-panel").hidden = activeReport !== "cess";
    $("cess-panel").classList.toggle("active", activeReport === "cess");
    localStorage.setItem(ACTIVE_TAB_KEY, activeReport);
    hideValidation();
  }

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach(screen => screen.classList.remove("active"));
    $(id).classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showReport(title, text) {
    $("output-title").textContent = title;
    $("report-output").textContent = text;
    $("copy-status").textContent = "";
    showScreen("output-screen");
  }

  async function copyReport() {
    const text = $("report-output").textContent;
    let success = false;
    try {
      await navigator.clipboard.writeText(text);
      success = true;
    } catch (_) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try { success = document.execCommand("copy"); } catch (_) {}
      textarea.remove();
    }

    $("copy-status").textContent = success ? "Copied to clipboard." : "Copy failed — press and hold the text to copy manually.";
    if (success) {
      $("copy-btn").textContent = "Copied ✓";
      setTimeout(() => {
        $("copy-btn").textContent = "Copy text";
        $("copy-status").textContent = "";
      }, 1800);
    }
  }

  srpSavedFields.forEach(field => {
    const handleChange = () => {
      saveSrpState();
      updateSrpConditionalFields();
      updateRuntimePreview();
      field.classList.remove("invalid");
    };
    field.addEventListener("input", handleChange);
    field.addEventListener("change", handleChange);
  });

  cessSavedFields.forEach(field => {
    const handleChange = () => {
      saveCessState();
      field.classList.remove("invalid");
    };
    field.addEventListener("input", handleChange);
    field.addEventListener("change", handleChange);
  });

  for (const prefix of ["p3", "p4"]) {
    $(`${prefix}-b-not-collected`).addEventListener("change", () => handleBNotCollectedChange(prefix));
  }

  document.querySelectorAll("[data-report-tab]").forEach(tab => {
    tab.addEventListener("click", () => setActiveReport(tab.dataset.reportTab));
  });

  $("add-tanker-btn").addEventListener("click", () => {
    cessTankers.push(newTanker());
    renderTankers();
    saveCessState();
    document.querySelector(".tanker-card:last-child")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  $("tanker-list").addEventListener("input", handleTankerField);
  $("tanker-list").addEventListener("change", handleTankerField);
  $("tanker-list").addEventListener("click", event => {
    const button = event.target.closest("[data-remove-tanker]");
    if (!button) return;
    const id = Number(button.dataset.removeTanker);
    const index = cessTankers.findIndex(tanker => tanker.id === id);
    if (index < 0 || !confirm(`Remove Tanker ${index + 1}?`)) return;
    cessTankers.splice(index, 1);
    renderTankers();
    saveCessState();
  });

  $("clear-btn").addEventListener("click", () => {
    const label = activeReport === "srp" ? "SRP" : "CESS";
    if (!confirm(`Clear all saved ${label} report values and restore defaults?`)) return;
    if (activeReport === "srp") resetSrpState();
    else resetCessState();
  });

  $("generate-srp-btn").addEventListener("click", () => {
    saveSrpState();
    if (!validateSrp()) return;
    showReport("SRP report", buildSrpReport());
    for (const prefix of ["p3", "p4"]) $(`${prefix}-b-not-collected`).checked = false;
    updateSrpConditionalFields();
  });

  $("generate-cess-btn").addEventListener("click", () => {
    saveCessState();
    if (!validateCess()) return;
    showReport("CESS report", buildCessReport());
  });

  $("back-btn").addEventListener("click", () => showScreen("input-screen"));
  $("copy-btn").addEventListener("click", copyReport);

  loadSrpState();
  loadCessState();
  setActiveReport(localStorage.getItem(ACTIVE_TAB_KEY) || "srp");

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
  }
})();
