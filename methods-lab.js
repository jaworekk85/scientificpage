(function () {
  let currentConfig = null;
  let currentResults = [];
  let currentTimeTraces = [];
  let currentTimeLayout = null;
  let currentBaseShapes = [];
  let currentOverlayKey = "";
  let clearOverlayTimer = null;
  const STEP_ZOOM_RATIO_THRESHOLD = 0.06;

  function setupMethodsLab() {
    populateMethodControls();
    bindMethodsEvents();
    setDefaultMethods();
    plotOdeMethods();
  }

  function populateMethodControls() {
    const container = document.getElementById("odeMethodControls");
    const groups = ["Euler", "Runge-Kutta", "Richardson"];

    groups.forEach(group => {
      const row = document.createElement("div");
      row.className = "controls-row";

      const rowLabel = document.createElement("span");
      rowLabel.className = "label";
      rowLabel.textContent = group;
      row.appendChild(rowLabel);

      window.OdeMethods.METHOD_DEFS
        .filter(method => method.family === group)
        .forEach(method => {
          const item = document.createElement("label");
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.dataset.odeMethod = method.key;
          item.appendChild(checkbox);
          item.appendChild(document.createTextNode(method.label));
          row.appendChild(item);
        });

      container.appendChild(row);
    });
  }

  function bindMethodsEvents() {
    document.getElementById("odePlotBtn").addEventListener("click", plotOdeMethods);

    document.querySelectorAll("#methods input, #methods textarea").forEach(el => {
      el.addEventListener("change", plotOdeMethods);
    });

    document.querySelectorAll("[data-ode-method]").forEach(el => {
      el.addEventListener("input", plotOdeMethods);
    });

    document.getElementById("odeShowPoints").addEventListener("input", plotOdeMethods);
    document.getElementById("odeShowStepView").addEventListener("input", () => {
      clearStepOverlay();
      plotOdeMethods();
    });
    document.getElementById("odeFocusHover").addEventListener("input", () => {
      clearStepOverlay();
      resetTraceOpacity();
    });
    document.getElementById("odeSlopeField").addEventListener("input", plotOdeMethods);

    document.querySelector('[data-tab="methods"]').addEventListener("click", () => {
      window.setTimeout(() => {
        plotOdeMethods();
        ["odeTimePlot", "odeStepZoomPlot", "odeErrorPlot"].forEach(id => {
          const el = document.getElementById(id);
          if (el) window.Plotly.Plots.resize(el);
        });
      }, 0);
    });
  }

  function setDefaultMethods() {
    const defaults = ["euler", "midpoint", "heun", "rk4", "richardsonEuler"];
    document.querySelectorAll("[data-ode-method]").forEach(el => {
      el.checked = defaults.includes(el.dataset.odeMethod);
    });

    document.getElementById("odeT0").value = "0";
    document.getElementById("odeT1").value = "5";
    document.getElementById("odeH").value = "0.25";
  }

  function plotOdeMethods() {
    const config = readConfig();
    const selectedMethods = getSelectedMethods();
    updateMethodHint(selectedMethods);

    const results = [];
    const status = [];

    selectedMethods.forEach(methodKey => {
      try {
        const result = window.OdeMethods.simulateOde(config, methodKey);
        results.push(result);
        if (result.limited) status.push(`h limited to ${formatNumber(Math.abs(result.h))}`);
      } catch (error) {
        status.push(`${methodKey}: ${error.message}`);
      }
    });

    document.getElementById("odeStatus").textContent = [...new Set(status)].join("; ");
    drawOdePlots(config, results);
    currentConfig = config;
    currentResults = results;
  }

  function drawOdePlots(config, results) {
    resetStepOverlayState();
    const showPoints = document.getElementById("odeShowPoints").checked;
    const showStepView = document.getElementById("odeShowStepView").checked;
    const exactTrace = buildExactTrace(config);
    const timeTraces = results.map(result => ({
      x: result.points.map(point => point.t),
      y: result.points.map(point => point.y),
      name: result.method.label,
      mode: showPoints ? "lines+markers" : "lines",
      line: { color: result.method.color },
      marker: { size: 5, color: result.method.color },
      hoverinfo: showStepView ? "none" : "x+y+name"
    }));

    if (exactTrace) {
      exactTrace.hoverinfo = showStepView ? "none" : "x+y+name";
      timeTraces.unshift(exactTrace);
    }
    currentTimeTraces = timeTraces;
    currentTimeLayout = getTimePlotLayout(timeTraces);
    currentBaseShapes = currentTimeLayout.shapes || [];

    window.Plotly.newPlot("odeTimePlot", timeTraces, currentTimeLayout, { responsive: true })
      .then(attachTimePlotHover);

    const errorTraces = exactTrace
      ? results.map(result => ({
        x: result.points.map(point => point.t),
        y: result.points.map(point => {
          const exact = window.OdeMethods.evaluateExact(config, point.t);
          if (exact === null) return null;
          return Math.max(Math.abs(point.y - exact), 1e-14);
        }),
        name: result.method.label,
        mode: showPoints ? "lines+markers" : "lines",
        line: { color: result.method.color },
        marker: { size: 4, color: result.method.color },
        hoverinfo: "x+y+name"
      }))
      : [];

    window.Plotly.newPlot("odeErrorPlot", errorTraces, {
      title: "absolute error",
      margin: { t: 42, r: 16, b: 42, l: 52 },
      xaxis: {
        title: "t",
        range: currentTimeLayout.xaxis.range,
        autorange: false
      },
      yaxis: { title: "error", type: "log", autorange: true }
    }, { responsive: true });
  }

  function resetStepOverlayState() {
    if (clearOverlayTimer) {
      window.clearTimeout(clearOverlayTimer);
      clearOverlayTimer = null;
    }

    currentOverlayKey = "";
    document.getElementById("odeStepText").textContent = "";
    hideStepZoom();
  }

  function handleTimePlotHover(event) {
    if (!document.getElementById("odeShowStepView").checked) return;
    if (!event.points || !event.points.length) return;
    if (clearOverlayTimer) {
      window.clearTimeout(clearOverlayTimer);
      clearOverlayTimer = null;
    }

    const point = event.points[0];
    const exactOffset = currentTimeTraces[0]?.name === "known solution" ? 1 : 0;
    const resultIndex = point.curveNumber - exactOffset;
    const result = currentResults[resultIndex];

    if (!result || point.pointIndex >= result.points.length - 1) return;

    try {
      const overlayKey = `${result.method.key}:${point.pointIndex}`;
      if (overlayKey === currentOverlayKey) return;

      const detail = window.OdeMethods.explainStep(currentConfig, result.method.key, point.pointIndex);
      const useZoom = shouldUseStepZoom(detail);
      currentOverlayKey = overlayKey;
      focusTrace(point.curveNumber);
      if (useZoom) {
        window.Plotly.relayout(document.getElementById("odeTimePlot"), { shapes: currentBaseShapes, annotations: [] });
        renderStepZoom(detail, result);
      } else {
        hideStepZoom();
        const overlay = buildStepOverlayLayout(detail);
        window.Plotly.relayout(document.getElementById("odeTimePlot"), overlay);
      }
      renderStepText(detail);
    } catch (error) {
      document.getElementById("odeStepText").textContent = error.message;
    }
  }

  function attachTimePlotHover() {
    const timePlot = document.getElementById("odeTimePlot");
    if (typeof timePlot.removeAllListeners === "function") {
      timePlot.removeAllListeners("plotly_hover");
      timePlot.removeAllListeners("plotly_unhover");
    }

    if (typeof timePlot.on === "function") {
      timePlot.on("plotly_hover", handleTimePlotHover);
      timePlot.on("plotly_unhover", clearStepOverlay);
    }
  }

  function clearStepOverlay() {
    if (clearOverlayTimer) window.clearTimeout(clearOverlayTimer);
    clearOverlayTimer = window.setTimeout(() => {
      currentOverlayKey = "";
      const timePlot = document.getElementById("odeTimePlot");
      if (timePlot && timePlot.data) {
        window.Plotly.relayout(timePlot, { shapes: currentBaseShapes, annotations: [] });
      }
      resetTraceOpacity();
      document.getElementById("odeStepText").textContent = "";
      hideStepZoom();
      clearOverlayTimer = null;
    }, 120);
  }

  function buildStepOverlayLayout(detail) {
    const xRange = currentTimeLayout?.xaxis?.range || [detail.current.t, detail.next.t];
    const yRange = currentTimeLayout?.yaxis?.range || [0, 1];
    return {
      shapes: [
        ...currentBaseShapes,
        ...buildStepShapes(detail, xRange, yRange)
      ],
      annotations: buildStepAnnotations(detail)
    };
  }

  function buildStepShapes(detail, xRange, yRange) {
    const pointRadiusX = Math.max(Math.abs(xRange[1] - xRange[0]) * 0.006, Math.abs(detail.h) * 0.018);
    const pointRadiusY = Math.abs(yRange[1] - yRange[0]) * 0.012;
    const guideShapes = detail.guides.map((guide, index) => {
      const isFinalGuide = index === detail.guides.length - 1;
      const guideColor = isFinalGuide ? "rgba(220, 38, 38, 0.86)" : withAlpha(stageColor(index), 0.32);
      return {
        type: "line",
        x0: guide.from.t,
        y0: guide.from.y,
        x1: guide.to.t,
        y1: guide.to.y,
        line: {
          color: guideColor,
          dash: isFinalGuide ? "solid" : "dot",
          width: isFinalGuide ? 2.4 : 1.1
        }
      };
    });

    const slopeShapes = detail.stages
      .filter(stage => isFinite(stage.slope))
      .map((stage, index) => {
        const width = Math.abs(detail.h) * 0.18;
        const left = stage.t - width;
        const right = stage.t + width;
        return {
          type: "line",
          x0: left,
          y0: stage.y + stage.slope * (left - stage.t),
          x1: right,
          y1: stage.y + stage.slope * (right - stage.t),
          line: { color: stageColor(index), width: 2.4 }
        };
      });

    const pointShapes = detail.stages.map((stage, index) => ({
      type: "circle",
      x0: stage.t - pointRadiusX,
      x1: stage.t + pointRadiusX,
      y0: stage.y - pointRadiusY,
      y1: stage.y + pointRadiusY,
      fillcolor: stageColor(index),
      line: { color: "#ffffff", width: 1 }
    }));

    return [...guideShapes, ...slopeShapes, ...pointShapes];
  }

  function buildStepAnnotations(detail) {
    const stageAnnotations = detail.stages.map((stage, index) => ({
      x: stage.t,
      y: stage.y,
      text: escapeHtml(compactStageLabel(stage.label, index)),
      showarrow: false,
      xanchor: "left",
      yanchor: "bottom",
      xshift: 7,
      yshift: 7,
      bgcolor: "rgba(255, 255, 255, 0.82)",
      bordercolor: withAlpha(stageColor(index), 0.62),
      borderpad: 2,
      font: {
        size: 10,
        color: stageColor(index)
      }
    }));

    if (!hasFinalStageLabel(detail)) {
      stageAnnotations.push({
        x: detail.next.t,
        y: detail.nextY,
        text: "y_(n+1)",
        showarrow: false,
        xanchor: "right",
        yanchor: "top",
        xshift: -7,
        yshift: -7,
        bgcolor: "rgba(255, 255, 255, 0.82)",
        bordercolor: "rgba(220, 38, 38, 0.62)",
        borderpad: 2,
        font: {
          size: 10,
          color: "#dc2626"
        }
      });
    }

    return stageAnnotations;
  }

  function compactStageLabel(label, index) {
    if (/^k\d+$/i.test(label)) return label;
    if (label === "start") return "y_n";
    if (label.startsWith("guess ")) return `g${index}`;
    if (label === "one full step") return "full";
    if (label === "half step") return "half";
    if (label === "two half steps") return "fine";
    if (label === "extrapolated") return "R";
    return label.split(/\s+/).slice(0, 2).join(" ");
  }

  function hasFinalStageLabel(detail) {
    return detail.stages.some(stage =>
      stage.label === "extrapolated" &&
      Math.abs(stage.t - detail.next.t) < 1e-10 &&
      Math.abs(stage.y - detail.nextY) < 1e-10
    );
  }

  function shouldUseStepZoom(detail) {
    const span = Math.abs((currentConfig?.t1 || 0) - (currentConfig?.t0 || 0));
    if (!span) return false;
    return Math.abs(detail.h) / span < STEP_ZOOM_RATIO_THRESHOLD;
  }

  function renderStepZoom(detail, result) {
    const panel = document.getElementById("odeStepZoomPanel");
    const plot = document.getElementById("odeStepZoomPlot");
    if (!panel || !plot) return;

    panel.classList.add("active");
    const traces = buildStepZoomTraces(detail, result);
    const bounds = getStepDetailBounds(detail, traces);
    const xRange = paddedRange(bounds.xMin, bounds.xMax, 0.24);
    const yRange = paddedRange(bounds.yMin, bounds.yMax, 0.26);
    const zoomSlopeFieldShapes = document.getElementById("odeSlopeField")?.checked
      ? buildSlopeFieldShapes({ xMin: xRange[0], xMax: xRange[1], yMin: yRange[0], yMax: yRange[1] })
      : [];
    const shapes = [
      ...zoomSlopeFieldShapes,
      ...buildStepShapes(detail, xRange, yRange)
    ];

    window.Plotly.newPlot(plot, traces, {
      title: `step zoom: ${detail.method.label}`,
      margin: { t: 34, r: 12, b: 34, l: 46 },
      xaxis: {
        title: "t",
        range: xRange,
        autorange: false,
        zeroline: false
      },
      yaxis: {
        title: "y",
        range: yRange,
        autorange: false,
        zeroline: false
      },
      hovermode: false,
      showlegend: false,
      shapes,
      annotations: buildStepAnnotations(detail)
    }, {
      responsive: true,
      displayModeBar: false
    });
  }

  function buildStepZoomTraces(detail, result) {
    const stepWindow = Math.abs(detail.h) || 1;
    const minT = Math.min(detail.current.t, detail.next.t) - stepWindow;
    const maxT = Math.max(detail.current.t, detail.next.t) + stepWindow;
    const localPoints = result.points.filter(point => point.t >= minT && point.t <= maxT);
    const visiblePoints = localPoints.length >= 2 ? localPoints : [detail.current, detail.next];
    const traces = [
      {
        x: visiblePoints.map(point => point.t),
        y: visiblePoints.map(point => point.y),
        name: result.method.label,
        mode: "lines+markers",
        line: { color: result.method.color, width: 2 },
        marker: { color: result.method.color, size: 6 },
        hoverinfo: "skip"
      }
    ];

    const exactTrace = buildExactZoomTrace(minT, maxT);
    if (exactTrace) traces.unshift(exactTrace);
    return traces;
  }

  function buildExactZoomTrace(minT, maxT) {
    if (!currentConfig?.exact || !isFinite(minT) || !isFinite(maxT) || minT === maxT) return null;

    const samples = 48;
    const x = [];
    const y = [];
    for (let i = 0; i <= samples; i++) {
      const t = minT + (maxT - minT) * i / samples;
      const value = window.OdeMethods.evaluateExact(currentConfig, t);
      if (!isFinite(value)) continue;
      x.push(t);
      y.push(value);
    }

    if (x.length < 2) return null;
    return {
      x,
      y,
      name: "known solution",
      mode: "lines",
      line: { color: "#000000", dash: "dot", width: 1.8 },
      hoverinfo: "skip"
    };
  }

  function getStepDetailBounds(detail, traces) {
    const bounds = getTraceBounds(traces);
    addBoundsPoint(bounds, detail.current.t, detail.current.y);
    addBoundsPoint(bounds, detail.next.t, detail.next.y);

    detail.stages.forEach(stage => addBoundsPoint(bounds, stage.t, stage.y));
    detail.guides.forEach(guide => {
      addBoundsPoint(bounds, guide.from.t, guide.from.y);
      addBoundsPoint(bounds, guide.to.t, guide.to.y);
    });

    return bounds;
  }

  function addBoundsPoint(bounds, x, y) {
    if (isFinite(x)) {
      bounds.xMin = Math.min(bounds.xMin, x);
      bounds.xMax = Math.max(bounds.xMax, x);
    }
    if (isFinite(y)) {
      bounds.yMin = Math.min(bounds.yMin, y);
      bounds.yMax = Math.max(bounds.yMax, y);
    }
  }

  function hideStepZoom() {
    const panel = document.getElementById("odeStepZoomPanel");
    if (panel) panel.classList.remove("active");
  }

  function focusTrace(curveNumber) {
    if (!document.getElementById("odeFocusHover").checked) return;

    const timePlot = document.getElementById("odeTimePlot");
    if (!timePlot || !timePlot.data) return;

    const opacities = timePlot.data.map((_, index) => index === curveNumber ? 1 : 0.18);
    window.Plotly.restyle(timePlot, { opacity: opacities });
  }

  function resetTraceOpacity() {
    const timePlot = document.getElementById("odeTimePlot");
    if (!timePlot || !timePlot.data) return;

    window.Plotly.restyle(timePlot, { opacity: timePlot.data.map(() => 1) });
  }

  function renderStepText(detail) {
    document.getElementById("odeStepText").innerHTML = [
      `<strong>${escapeHtml(detail.method.label)}: step ${detail.index}</strong>`,
      formatStageSummaryHtml(detail.stages),
      ...detail.formulas.map(line => escapeHtml(line))
    ].map(line => `<div>${line}</div>`).join("");
  }

  function formatStageSummaryHtml(stages) {
    return stages.map((stage, index) =>
      `<span class="stage-chip"><span class="stage-dot" style="background:${stageColor(index)}"></span>${escapeHtml(stage.label)}=(${formatNumber(stage.t)}, ${formatNumber(stage.y)})</span>`
    ).join(" | ");
  }

  function stageColor(index) {
    const colors = [
      "#111827",
      "#2563eb",
      "#16a34a",
      "#f97316",
      "#7c3aed",
      "#dc2626",
      "#0891b2",
      "#a16207"
    ];

    return colors[index % colors.length];
  }

  function withAlpha(hexColor, alpha) {
    const normalized = hexColor.replace("#", "");
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function getTimePlotLayout(traces = currentTimeTraces) {
    const bounds = getTraceBounds(traces);
    const baseShapes = document.getElementById("odeSlopeField")?.checked
      ? buildSlopeFieldShapes(bounds)
      : [];

    return {
      title: "y(t)",
      margin: { t: 42, r: 16, b: 42, l: 52 },
      xaxis: {
        title: "t",
        range: paddedRange(bounds.xMin, bounds.xMax, 0.02),
        autorange: false
      },
      yaxis: {
        title: "y",
        range: paddedRange(bounds.yMin, bounds.yMax, 0.1),
        autorange: false
      },
      hovermode: "closest",
      shapes: baseShapes,
      annotations: []
    };
  }

  function buildSlopeFieldShapes(bounds) {
    const equation = currentConfig?.equation || document.getElementById("odeEquation").value.trim();
    let slopeFn;

    try {
      const compiled = window.math.compile(equation || "0");
      slopeFn = (t, y) => compiled.evaluate({ t, y });
    } catch {
      return [];
    }

    const xRange = bounds.xMax - bounds.xMin || 1;
    const yRange = bounds.yMax - bounds.yMin || 1;
    const xCount = 16;
    const yCount = 9;
    const dx = xRange / xCount;
    const dy = yRange / yCount;
    const length = dx * 0.32;
    const shapes = [];

    for (let i = 0; i <= xCount; i++) {
      const t = bounds.xMin + xRange * i / xCount;
      for (let j = 0; j <= yCount; j++) {
        const y = bounds.yMin + yRange * j / yCount;
        const slope = slopeFn(t, y);
        if (!isFinite(slope)) continue;

        const scaledSlope = slope * (dx / dy);
        const norm = Math.sqrt(1 + scaledSlope * scaledSlope) || 1;
        const halfDt = length / norm / 2;
        const halfDy = slope * halfDt;

        shapes.push({
          type: "line",
          x0: t - halfDt,
          y0: y - halfDy,
          x1: t + halfDt,
          y1: y + halfDy,
          line: {
            color: "rgba(37, 99, 235, 0.48)",
            width: 1.4
          }
        });
      }
    }

    return shapes;
  }

  function getTraceBounds(traces) {
    const bounds = {
      xMin: Infinity,
      xMax: -Infinity,
      yMin: Infinity,
      yMax: -Infinity
    };

    traces.forEach(trace => {
      (trace.x || []).forEach(value => {
        if (isFinite(value)) {
          bounds.xMin = Math.min(bounds.xMin, value);
          bounds.xMax = Math.max(bounds.xMax, value);
        }
      });

      (trace.y || []).forEach(value => {
        if (isFinite(value)) {
          bounds.yMin = Math.min(bounds.yMin, value);
          bounds.yMax = Math.max(bounds.yMax, value);
        }
      });
    });

    if (!isFinite(bounds.xMin) || !isFinite(bounds.xMax)) {
      bounds.xMin = 0;
      bounds.xMax = 1;
    }

    if (!isFinite(bounds.yMin) || !isFinite(bounds.yMax)) {
      bounds.yMin = -1;
      bounds.yMax = 1;
    }

    return bounds;
  }

  function paddedRange(min, max, paddingRatio) {
    const width = max - min || 1;
    const padding = width * paddingRatio;
    return [min - padding, max + padding];
  }

  function buildExactTrace(config) {
    if (!config.exact) return null;

    const t0 = finiteOr(config.t0, 0);
    const t1 = finiteOr(config.t1, 5);
    const samples = 500;
    const x = [];
    const y = [];

    for (let i = 0; i <= samples; i++) {
      const t = t0 + (t1 - t0) * i / samples;
      const value = window.OdeMethods.evaluateExact(config, t);
      if (value === null) return null;
      x.push(t);
      y.push(value);
    }

    return {
      x,
      y,
      name: "known solution",
      line: { color: "#000000", dash: "dot", width: 2 },
      hoverinfo: "x+y+name"
    };
  }

  function updateMethodHint(selectedMethods) {
    const hint = document.getElementById("odeMethodHint");
    const selected = window.OdeMethods.METHOD_DEFS.filter(method =>
      selectedMethods.includes(method.key)
    );

    if (!selected.length) {
      hint.textContent = "Choose at least one method to see its formula.";
      return;
    }

    hint.innerHTML = selected
      .map(method => `<div><strong>${escapeHtml(method.label)}</strong>: <code>${escapeHtml(method.formula)}</code></div>`)
      .join("");
  }

  function readConfig() {
    return {
      equation: document.getElementById("odeEquation").value.trim(),
      y0: parseFloat(document.getElementById("odeY0").value),
      t0: parseFloat(document.getElementById("odeT0").value),
      t1: parseFloat(document.getElementById("odeT1").value),
      h: parseFloat(document.getElementById("odeH").value),
      exact: document.getElementById("odeExact").value.trim()
    };
  }

  function getSelectedMethods() {
    return Array.from(document.querySelectorAll("[data-ode-method]:checked"))
      .map(el => el.dataset.odeMethod);
  }

  function finiteOr(value, fallback) {
    return isFinite(value) ? value : fallback;
  }

  function formatNumber(value) {
    if (!isFinite(value)) return "0";
    return String(Math.round(value * 1000000) / 1000000);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  window.setupMethodsLab = setupMethodsLab;
})();
