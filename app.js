(() => {
  "use strict";

  const STORAGE_KEY = "supervisor-status-report-v1";

  const defaults = {
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

  const $ = (id) => document.getElementById(id);
  const savedFields = [...document.querySelectorAll("[data-save]")];

  function loadState() {
    let state = { ...defaults };
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      state = { ...state, ...saved };
    } catch (_) {}

    for (const field of savedFields) {
      if (field.type === "checkbox") {
        field.checked = Boolean(state[field.id]);
      } else {
        field.value = state[field.id] ?? "";
      }
    }

    updateConditionalFields();
    updateRuntimePreview();
  }

  function collectState() {
    const state = {};
    for (const field of savedFields) {
      state[field.id] = field.type === "checkbox" ? field.checked : field.value;
    }
    return state;
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collectState()));
  }

  function resetState() {
    localStorage.removeItem(STORAGE_KEY);

    for (const field of savedFields) {
      const value = defaults[field.id];
      if (field.type === "checkbox") {
        field.checked = Boolean(value);
      } else {
        field.value = value ?? "";
      }
      field.classList.remove("invalid");
    }

    updateConditionalFields();
    updateRuntimePreview();
    $("validation-summary").hidden = true;
  }

  function updateConditionalFields() {
    for (const prefix of ["p3", "p4"]) {
      const mode = $(`${prefix}-mode`).value;
      const samples = $(`${prefix}-samples`);
      const noSamplesRequired = mode === "offline" || mode === "startup";
      const standby = mode === "standby";

      samples.hidden = noSamplesRequired;
      $(`${prefix}-b-sample`).hidden = mode !== "serial";
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
    if (a !== null && a > 100) return true;

    if (mode === "serial") {
      const b = numericSampleValue(`${prefix}-b-result`);
      if (b !== null && b > 100) return true;
    }

    return false;
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
      if (level === null) continue;
      total += tankRuntimeDays(level);
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

    if (mode === "offline") {
      return `${label} offline`;
    }

    if (mode === "startup") {
      return `${label} starting up`;
    }

    const modeText = mode === "standby" ? "in standby" : "in serial";
    const a = Number($(`${prefix}-a-result`).value);
    const aTime = $(`${prefix}-a-time`).value;
    let sentence;

    if (mode === "standby") {
      sentence = `${label} ${modeText}. Standby sample, ${Math.round(a)}ppm @ ${aTime}.`;
    } else {
      const b = Number($(`${prefix}-b-result`).value);
      const bTime = $(`${prefix}-b-time`).value;
      sentence = `${label} ${modeText}. A-side, ${Math.round(a)}ppm @ ${aTime}. B-side, ${Math.round(b)}ppm @ ${bTime}.`;
    }

    if (hasOutOfSpecSample(prefix, mode)) {
      sentence += ` ${trendSentence($(`${prefix}-trend`).value)}`;
    }

    return sentence;
  }

  function trendSentence(trend) {
    switch (trend) {
      case "first":
        return "This was the first sample collected after startup.";
      case "increasing":
        return "Water content since last report appears to be increasing.";
      case "decreasing":
        return "Water content since last report appears to be decreasing.";
      case "stable":
        return "Water content since last report appears stable.";
      case "unclear":
        return "Water content since last report appears unstable or the trend is not clear.";
      default:
        return "";
    }
  }

  function validate() {
    const errors = [];
    document.querySelectorAll(".invalid").forEach(el => el.classList.remove("invalid"));

    for (const [label, prefix] of [["3P", "p3"], ["4P", "p4"]]) {
      const mode = $(`${prefix}-mode`).value;
      if (mode === "standby" || mode === "serial") {
        const requiredFields = mode === "standby"
          ? [["a-result", "standby sample result"], ["a-time", "standby sample time"]]
          : [
              ["a-result", "A-side result"],
              ["a-time", "A-side time"],
              ["b-result", "B-side result"],
              ["b-time", "B-side time"]
            ];

        for (const [fieldSuffix, fieldName] of requiredFields) {
          const field = $(`${prefix}-${fieldSuffix}`);
          if (field.value === "") {
            errors.push(`${label}: ${fieldName} is required.`);
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
      const field = $(`${tank}-level`);
      const value = parseLevel(`${tank}-level`);

      if (value === null) {
        errors.push(`${tank.toUpperCase()}: level is required.`);
        field.classList.add("invalid");
      } else if (value < 0 || value > 100) {
        errors.push(`${tank.toUpperCase()}: level must be between 0.0% and 100.0%.`);
        field.classList.add("invalid");
      }
    }

    const wt = parseLevel("wt-level");
    if (wt === null) {
      errors.push("WT: level is required.");
      $("wt-level").classList.add("invalid");
    } else if (wt < 0 || wt > 100) {
      errors.push("WT: level must be between 0.0% and 100.0%.");
      $("wt-level").classList.add("invalid");
    }

    const summary = $("validation-summary");
    if (errors.length) {
      summary.textContent = errors[0] + (errors.length > 1 ? ` (+${errors.length - 1} more)` : "");
      summary.hidden = false;
      const firstInvalid = document.querySelector(".invalid");
      firstInvalid?.scrollIntoView({ behavior: "smooth", block: "center" });
      firstInvalid?.focus({ preventScroll: true });
      return false;
    }

    summary.hidden = true;
    return true;
  }

  function buildReport() {
    const lines = [
      modeSentence("3P", "p3"),
      modeSentence("4P", "p4"),
      "",
      `WT – ${formatPercent(parseLevel("wt-level"))}`
    ];

    for (const tank of ["st5", "st6", "st7", "st8"]) {
      const level = parseLevel(`${tank}-level`);
      const active = $(`${tank}-active`).checked ? "active" : "inactive";
      lines.push(`${tank.toUpperCase()} – ${formatPercent(level)} – ${active}`);
    }

    lines.push(`Current NMP supply: ${formatDuration(totalRuntimeDays())}`);
    return lines.join("\n");
  }

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach(screen => screen.classList.remove("active"));
    $(id).classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
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
      try {
        success = document.execCommand("copy");
      } catch (_) {}
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

  savedFields.forEach(field => {
    field.addEventListener("input", () => {
      saveState();
      updateConditionalFields();
      updateRuntimePreview();
      field.classList.remove("invalid");
    });

    field.addEventListener("change", () => {
      saveState();
      updateConditionalFields();
      updateRuntimePreview();
      field.classList.remove("invalid");
    });
  });

  $("clear-btn").addEventListener("click", () => {
    if (confirm("Clear all saved report values and restore defaults?")) {
      resetState();
    }
  });

  $("generate-btn").addEventListener("click", () => {
    saveState();
    if (!validate()) return;
    $("report-output").textContent = buildReport();
    $("copy-status").textContent = "";
    showScreen("output-screen");
  });

  $("back-btn").addEventListener("click", () => showScreen("input-screen"));
  $("copy-btn").addEventListener("click", copyReport);

  loadState();

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch(() => {});
    });
  }
})();
