(function () {
  let currentConfig = null;
  let currentResults = [];
  let currentYTraces = [];
  let currentYLayout = null;
  let currentPhaseLayout = null;
  let currentPhaseBaseShapes = [];
  let currentOverlayKey = "";
  let clearOverlayTimer = null;
  let pinnedStep = null;
  let activeZoomView = "y";
  const STEP_ZOOM_RATIO_THRESHOLD = 0.06;

  function setupSecondOrderLab() {
    populateMethodControls();
    bindEvents();
    setDefaults();
    plotSecondOrderMethods();
  }

  function populateMethodControls() {
    const container = document.getElementById("ode2MethodControls");
    if (!container) return;

    const groups = ["Euler", "Runge-Kutta", "Verlet"];
    groups.forEach(group => {
      const row = document.createElement("div");
      row.className = "controls-row";

      const rowLabel = document.createElement("span");
      rowLabel.className = "label";
      rowLabel.textContent = group;
      row.appendChild(rowLabel);

      window.SecondOrderMethods.METHOD_DEFS
        .filter(method => method.family === group)
        .forEach(method => {
          const item = document.createElement("label");
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.dataset.ode2Method = method.key;
          item.appendChild(checkbox);
          item.appendChild(document.createTextNode(method.label));
          row.appendChild(item);
        });

      container.appendChild(row);
    });
  }

  function bindEvents() {
    document.getElementById("ode2PlotBtn").addEventListener("click", plotSecondOrderMethods);

    document.querySelectorAll("#secondOrderPanel input, #secondOrderPanel textarea").forEach(el => {
      el.addEventListener("change", plotSecondOrderMethods);
    });

    document.querySelectorAll("[data-ode2-method]").forEach(el => {
      el.addEventListener("input", plotSecondOrderMethods);
    });

    document.getElementById("ode2ShowStepView").addEventListener("input", () => {
      clearStepOverlay();
      plotSecondOrderMethods();
    });

    document.getElementById("ode2FocusHover").addEventListener("input", () => {
      clearStepOverlay();
      resetTraceOpacity();
    });

    document.getElementById("ode2PrevStep").addEventListener("click", () => movePinnedStep(-1));
    document.getElementById("ode2NextStep").addEventListener("click", () => movePinnedStep(1));
    document.querySelectorAll("[data-ode2-zoom-view]").forEach(button => {
      button.addEventListener("click", () => setActiveZoomView(button.dataset.ode2ZoomView));
    });
  }

  function setDefaults() {
    const defaults = ["euler2", "eulerCromer", "midpoint2", "rk4System", "velocityVerlet"];
    document.querySelectorAll("[data-ode2-method]").forEach(el => {
      el.checked = defaults.includes(el.dataset.ode2Method);
    });

    document.getElementById("ode2T0").value = "0";
    document.getElementById("ode2T1").value = "12";
    document.getElementById("ode2H").value = "0.25";
  }

  function plotSecondOrderMethods() {
    const config = readConfig();
    const selectedMethods = getSelectedMethods();
    updateMethodHint(selectedMethods);

    const results = [];
    const status = [];
    selectedMethods.forEach(methodKey => {
      try {
        const result = window.SecondOrderMethods.simulateSecondOrder(config, methodKey);
        results.push(result);
        if (result.limited) status.push(`h limited to ${formatNumber(Math.abs(result.h))}`);
      } catch (error) {
        status.push(`${methodKey}: ${error.message}`);
      }
    });

    document.getElementById("ode2Status").textContent = [...new Set(status)].join("; ");
    drawPlots(config, results);
    currentConfig = config;
    currentResults = results;
  }

  function drawPlots(config, results) {
    resetStepOverlayState();
    const showPoints = document.getElementById("ode2ShowPoints").checked;
    const showStepView = document.getElementById("ode2ShowStepView").checked;
    const exactYTrace = buildExactTrace(config, "y");

    const yTraces = results.map(result => ({
      x: result.points.map(point => point.t),
      y: result.points.map(point => point.y),
      name: result.method.label,
      mode: showPoints ? "lines+markers" : "lines",
      line: { color: result.method.color },
      marker: { size: 5, color: result.method.color },
      hoverinfo: showStepView ? "none" : "x+y+name"
    }));

    if (exactYTrace) {
      exactYTrace.hoverinfo = showStepView ? "none" : "x+y+name";
      yTraces.unshift(exactYTrace);
    }

    currentYTraces = yTraces;
    currentYLayout = getPlotLayout(yTraces, "y(t)", "y");

    window.Plotly.newPlot("ode2TimePlot", yTraces, currentYLayout, { responsive: true })
      .then(attachTimePlotHover);

    drawVelocityPlot(config, results, showPoints);
    drawPhasePlot(config, results, showPoints);
    drawErrorPlot(config, results, showPoints);
  }

  function drawVelocityPlot(config, results, showPoints) {
    const velocityPlot = document.getElementById("ode2VelocityPlot");
    const showVelocity = document.getElementById("ode2ShowVelocity").checked;
    velocityPlot.style.display = showVelocity ? "block" : "none";
    if (!showVelocity) return;

    const exactTrace = buildExactTrace(config, "v");
    const traces = results.map(result => ({
      x: result.points.map(point => point.t),
      y: result.points.map(point => point.v),
      name: result.method.label,
      mode: showPoints ? "lines+markers" : "lines",
      line: { color: result.method.color },
      marker: { size: 4, color: result.method.color },
      hoverinfo: "x+y+name"
    }));

    if (exactTrace) traces.unshift(exactTrace);
    window.Plotly.newPlot("ode2VelocityPlot", traces, getPlotLayout(traces, "v(t)", "v"), { responsive: true });
  }

  function drawPhasePlot(config, results, showPoints) {
    const phasePlot = document.getElementById("ode2PhasePlot");
    const showPhase = document.getElementById("ode2ShowPhase").checked;
    phasePlot.style.display = showPhase ? "block" : "none";
    if (!showPhase) return;

    const traces = results.map(result => ({
      x: result.points.map(point => point.y),
      y: result.points.map(point => point.v),
      customdata: result.points.map(point => point.t),
      name: result.method.label,
      mode: showPoints ? "lines+markers" : "lines",
      line: { color: result.method.color },
      marker: { size: 4, color: result.method.color },
      hovertemplate: `${result.method.label}<br>t=%{customdata:.6g}<br>y=%{x:.6g}<br>v=%{y:.6g}<extra></extra>`
    }));

    const exactTrace = buildExactPhaseTrace(config);
    if (exactTrace) traces.unshift(exactTrace);

    const fieldT = finiteOr(config.t0, 0);
    const layout = getPlotLayout(traces, `phase path (field at t=${formatNumber(fieldT)})`, "v");
    layout.xaxis.title = "y";
    layout.shapes = buildPhaseFieldShapes(config, layout.xaxis.range, layout.yaxis.range, fieldT);
    currentPhaseLayout = layout;
    currentPhaseBaseShapes = layout.shapes || [];
    window.Plotly.newPlot("ode2PhasePlot", traces, layout, { responsive: true })
      .then(attachPhasePlotHover);
  }

  function buildExactPhaseTrace(config) {
    if (!config.exactY || !config.exactV) return null;
    const t0 = finiteOr(config.t0, 0);
    const t1 = finiteOr(config.t1, 12);
    const x = [];
    const y = [];
    const customdata = [];
    for (let i = 0; i <= 500; i++) {
      const t = t0 + (t1 - t0) * i / 500;
      const exactY = window.SecondOrderMethods.evaluateExactY(config, t);
      const exactV = window.SecondOrderMethods.evaluateExactV(config, t);
      if (!isFinite(exactY) || !isFinite(exactV)) continue;
      x.push(exactY);
      y.push(exactV);
      customdata.push(t);
    }

    if (x.length < 2) return null;
    return {
      x,
      y,
      customdata,
      name: "known solution",
      mode: "lines",
      line: { color: "#000000", dash: "dot", width: 2 },
      hovertemplate: "known solution<br>t=%{customdata:.6g}<br>y=%{x:.6g}<br>v=%{y:.6g}<extra></extra>"
    };
  }

  function buildPhaseFieldShapes(config, xRange, yRange, t) {
    let accelFn;
    try {
      const compiled = window.math.compile(config.equation || "0");
      accelFn = (y, v) => compiled.evaluate({ t, y, v });
    } catch {
      return [];
    }

    const ySpan = Math.abs(xRange[1] - xRange[0]) || 1;
    const vSpan = Math.abs(yRange[1] - yRange[0]) || 1;
    const xCount = 15;
    const yCount = 9;
    const length = ySpan / xCount * 0.42;
    const shapes = [];

    for (let i = 0; i <= xCount; i++) {
      const y = xRange[0] + ySpan * i / xCount;
      for (let j = 0; j <= yCount; j++) {
        const v = yRange[0] + vSpan * j / yCount;
        const a = accelFn(y, v);
        if (!isFinite(a)) continue;

        const scaledDv = a * (ySpan / vSpan);
        const norm = Math.sqrt(v * v + scaledDv * scaledDv) || 1;
        const halfY = length * v / norm / 2;
        const halfV = length * scaledDv / norm / 2 * (vSpan / ySpan);
        shapes.push({
          type: "line",
          x0: y - halfY,
          y0: v - halfV,
          x1: y + halfY,
          y1: v + halfV,
          line: { color: "rgba(37, 99, 235, 0.36)", width: 1.25 }
        });
      }
    }

    return shapes;
  }

  function drawErrorPlot(config, results, showPoints) {
    const hasExact = Boolean(config.exactY);
    const traces = hasExact
      ? results.map(result => ({
        x: result.points.map(point => point.t),
        y: result.points.map(point => {
          const exact = window.SecondOrderMethods.evaluateExactY(config, point.t);
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

    window.Plotly.newPlot("ode2ErrorPlot", traces, {
      title: "absolute error in y",
      margin: { t: 42, r: 16, b: 42, l: 52 },
      xaxis: {
        title: "t",
        range: currentYLayout.xaxis.range,
        autorange: false
      },
      yaxis: { title: "error", type: "log", autorange: true }
    }, { responsive: true });
  }

  function attachTimePlotHover() {
    const timePlot = document.getElementById("ode2TimePlot");
    if (typeof timePlot.removeAllListeners === "function") {
      timePlot.removeAllListeners("plotly_hover");
      timePlot.removeAllListeners("plotly_unhover");
      timePlot.removeAllListeners("plotly_click");
    }

    if (typeof timePlot.on === "function") {
      timePlot.on("plotly_hover", handleTimePlotHover);
      timePlot.on("plotly_unhover", clearStepOverlay);
      timePlot.on("plotly_click", handleTimePlotClick);
    }
  }

  function attachPhasePlotHover() {
    const phasePlot = document.getElementById("ode2PhasePlot");
    if (!phasePlot) return;
    if (typeof phasePlot.removeAllListeners === "function") {
      phasePlot.removeAllListeners("plotly_hover");
      phasePlot.removeAllListeners("plotly_unhover");
    }

    if (typeof phasePlot.on === "function") {
      phasePlot.on("plotly_hover", handlePhasePlotHover);
      phasePlot.on("plotly_unhover", resetPhaseOverlay);
    }
  }

  function handlePhasePlotHover(event) {
    if (!event.points || !event.points.length || !currentPhaseLayout) return;
    const t = event.points[0].customdata;
    if (!isFinite(t)) return;

    const phasePlot = document.getElementById("ode2PhasePlot");
    const xRange = currentPhaseLayout.xaxis.range;
    const yRange = currentPhaseLayout.yaxis.range;
    const shapes = buildPhaseFieldShapes(currentConfig, xRange, yRange, t);
    window.Plotly.relayout(phasePlot, {
      title: `phase path (field at t=${formatNumber(t)})`,
      shapes,
      annotations: []
    });
  }

  function handleTimePlotHover(event) {
    if (pinnedStep) return;
    if (!document.getElementById("ode2ShowStepView").checked) return;
    if (!event.points || !event.points.length) return;
    if (clearOverlayTimer) {
      window.clearTimeout(clearOverlayTimer);
      clearOverlayTimer = null;
    }

    const point = event.points[0];
    const exactOffset = currentYTraces[0]?.name === "known solution" ? 1 : 0;
    const resultIndex = point.curveNumber - exactOffset;
    const result = currentResults[resultIndex];
    if (!result || point.pointIndex >= result.points.length - 1) return;

    renderSelectedStep(result, point.pointIndex, point.curveNumber, false);
  }

  function handleTimePlotClick(event) {
    if (!document.getElementById("ode2ShowStepView").checked) return;
    if (!event.points || !event.points.length) return;

    const point = event.points[0];
    const exactOffset = currentYTraces[0]?.name === "known solution" ? 1 : 0;
    const resultIndex = point.curveNumber - exactOffset;
    const result = currentResults[resultIndex];
    if (!result || point.pointIndex >= result.points.length - 1) return;
    renderSelectedStep(result, point.pointIndex, point.curveNumber, true);
  }

  function renderSelectedStep(result, pointIndex, curveNumber, pinStep) {
    try {
      const stepIndex = clamp(Math.floor(pointIndex), 0, Math.max(result.points.length - 2, 0));
      const overlayKey = `${result.method.key}:${stepIndex}:${pinStep ? "pinned" : "hover"}`;
      if (overlayKey === currentOverlayKey) return;

      const detail = window.SecondOrderMethods.explainSecondOrderStep(currentConfig, result.method.key, stepIndex);
      currentOverlayKey = overlayKey;
      if (pinStep) {
        pinnedStep = { methodKey: result.method.key, stepIndex };
      }
      updatePinnedStepLabel(detail, Boolean(pinStep || pinnedStep));
      focusTrace(curveNumber);
      if (pinStep || shouldUseStepZoom(detail)) {
        window.Plotly.relayout(document.getElementById("ode2TimePlot"), { shapes: [], annotations: [] });
        renderStepZoom(detail, result);
      } else {
        hideStepZoom();
        window.Plotly.relayout(document.getElementById("ode2TimePlot"), buildStepOverlayLayout(detail));
      }
      renderPhaseStepOverlay(detail);
      renderStepText(detail);
    } catch (error) {
      document.getElementById("ode2StepText").textContent = error.message;
    }
  }

  function movePinnedStep(direction) {
    if (!pinnedStep && currentResults.length) {
      pinnedStep = { methodKey: currentResults[0].method.key, stepIndex: 0 };
    }
    if (!pinnedStep) return;

    const result = currentResults.find(item => item.method.key === pinnedStep.methodKey) || currentResults[0];
    if (!result) return;

    const nextIndex = clamp(pinnedStep.stepIndex + direction, 0, Math.max(result.points.length - 2, 0));
    pinnedStep = { methodKey: result.method.key, stepIndex: nextIndex };
    currentOverlayKey = "";
    renderSelectedStep(result, nextIndex, getCurveNumberForResult(result), true);
  }

  function getCurveNumberForResult(result) {
    const exactOffset = currentYTraces[0]?.name === "known solution" ? 1 : 0;
    const resultIndex = currentResults.findIndex(item => item.method.key === result.method.key);
    return Math.max(resultIndex, 0) + exactOffset;
  }

  function updatePinnedStepLabel(detail, isPinned) {
    const label = document.getElementById("ode2PinnedStepLabel");
    if (!label) return;
    if (!detail) {
      label.textContent = "tap a step";
      return;
    }
    label.textContent = isPinned
      ? `step ${detail.index}/${detail.maxIndex}`
      : `hover ${detail.index}/${detail.maxIndex}`;
  }

  function clearStepOverlay() {
    if (pinnedStep) return;
    if (clearOverlayTimer) window.clearTimeout(clearOverlayTimer);
    clearOverlayTimer = window.setTimeout(() => {
      currentOverlayKey = "";
      const timePlot = document.getElementById("ode2TimePlot");
      if (timePlot && timePlot.data) {
        window.Plotly.relayout(timePlot, { shapes: [], annotations: [] });
      }
      resetPhaseOverlay();
      resetTraceOpacity();
      document.getElementById("ode2StepText").textContent = "";
      hideStepZoom();
      clearOverlayTimer = null;
    }, 120);
  }

  function renderPhaseStepOverlay(detail) {
    const phasePlot = document.getElementById("ode2PhasePlot");
    if (!phasePlot || phasePlot.style.display === "none" || !currentPhaseLayout) return;

    const xRange = currentPhaseLayout.xaxis.range;
    const yRange = currentPhaseLayout.yaxis.range;
    const fieldShapes = buildPhaseFieldShapes(currentConfig, xRange, yRange, detail.current.t);
    const stepShapes = buildPhaseStepShapes(detail, xRange, yRange);
    window.Plotly.relayout(phasePlot, {
      title: `phase view at t=${formatNumber(detail.current.t)}`,
      shapes: [...fieldShapes, ...stepShapes],
      annotations: buildPhaseStepAnnotations(detail)
    });
  }

  function resetPhaseOverlay() {
    const phasePlot = document.getElementById("ode2PhasePlot");
    if (!phasePlot || phasePlot.style.display === "none" || !currentPhaseLayout) return;

    window.Plotly.relayout(phasePlot, {
      title: currentPhaseLayout.title,
      shapes: currentPhaseBaseShapes,
      annotations: []
    });
  }

  function buildPhaseStepShapes(detail, xRange, yRange) {
    const pointRadiusX = Math.abs(xRange[1] - xRange[0]) * 0.01;
    const pointRadiusY = Math.abs(yRange[1] - yRange[0]) * 0.01;
    const pathShapes = detail.stages
      .filter(stage => isFinite(stage.y) && isFinite(stage.v))
      .slice(0, -1)
      .map((stage, index) => {
        const nextStage = detail.stages[index + 1];
        return {
          type: "line",
          x0: stage.y,
          y0: stage.v,
          x1: nextStage.y,
          y1: nextStage.v,
          line: {
            color: withAlpha(stageColor(index), 0.42),
            dash: "dot",
            width: 1.3
          }
        };
      });

    const finalShape = {
      type: "line",
      x0: detail.current.y,
      y0: detail.current.v,
      x1: detail.nextY,
      y1: detail.nextV,
      line: { color: "rgba(220, 38, 38, 0.86)", width: 2.4 }
    };

    const pointShapes = detail.stages.map((stage, index) => ({
      type: "circle",
      x0: stage.y - pointRadiusX,
      x1: stage.y + pointRadiusX,
      y0: stage.v - pointRadiusY,
      y1: stage.v + pointRadiusY,
      fillcolor: stageColor(index),
      line: { color: "#ffffff", width: 1 }
    }));

    const startRing = {
      type: "circle",
      x0: detail.current.y - pointRadiusX * 1.8,
      x1: detail.current.y + pointRadiusX * 1.8,
      y0: detail.current.v - pointRadiusY * 1.8,
      y1: detail.current.v + pointRadiusY * 1.8,
      fillcolor: "rgba(255, 255, 255, 0)",
      line: { color: "#dc2626", width: 2.2 }
    };

    return [...pathShapes, finalShape, ...pointShapes, startRing];
  }

  function buildPhaseStepAnnotations(detail) {
    const startAnnotation = {
      x: detail.current.y,
      y: detail.current.v,
      text: "(y_n,v_n)",
      showarrow: false,
      xanchor: "right",
      yanchor: "bottom",
      xshift: -9,
      yshift: 9,
      bgcolor: "rgba(255, 255, 255, 0.88)",
      bordercolor: "rgba(220, 38, 38, 0.72)",
      borderpad: 2,
      font: { size: 11, color: "#dc2626" }
    };

    return [startAnnotation, ...detail.stages.map((stage, index) => ({
      x: stage.y,
      y: stage.v,
      text: escapeHtml(compactStageLabel(stage.label, index)),
      showarrow: false,
      xanchor: "left",
      yanchor: "bottom",
      xshift: 7,
      yshift: 7,
      bgcolor: "rgba(255, 255, 255, 0.82)",
      bordercolor: withAlpha(stageColor(index), 0.62),
      borderpad: 2,
      font: { size: 10, color: stageColor(index) }
    }))];
  }

  function buildStepOverlayLayout(detail) {
    const xRange = currentYLayout?.xaxis?.range || [detail.current.t, detail.next.t];
    const yRange = currentYLayout?.yaxis?.range || [0, 1];
    return {
      shapes: buildStepShapes(detail, xRange, yRange),
      annotations: buildStepAnnotations(detail)
    };
  }

  function buildStepShapes(detail, xRange, yRange) {
    const pointRadiusX = Math.max(Math.abs(xRange[1] - xRange[0]) * 0.006, Math.abs(detail.h) * 0.018);
    const pointRadiusY = Math.abs(yRange[1] - yRange[0]) * 0.012;
    const guideShapes = detail.guides.map((guide, index) => {
      const isFinalGuide = index === detail.guides.length - 1;
      return {
        type: "line",
        x0: guide.from.t,
        y0: guide.from.y,
        x1: guide.to.t,
        y1: guide.to.y,
        line: {
          color: isFinalGuide ? "rgba(220, 38, 38, 0.86)" : withAlpha(stageColor(index), 0.34),
          dash: isFinalGuide ? "solid" : "dot",
          width: isFinalGuide ? 2.4 : 1.1
        }
      };
    });

    const velocityShapes = detail.stages
      .filter(stage => isFinite(stage.v))
      .map((stage, index) => {
        const width = Math.abs(detail.h) * 0.18;
        const left = stage.t - width;
        const right = stage.t + width;
        return {
          type: "line",
          x0: left,
          y0: stage.y + stage.v * (left - stage.t),
          x1: right,
          y1: stage.y + stage.v * (right - stage.t),
          line: { color: stageColor(index), width: 2.2 }
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

    const startRing = {
      type: "circle",
      x0: detail.current.t - pointRadiusX * 1.7,
      x1: detail.current.t + pointRadiusX * 1.7,
      y0: detail.current.y - pointRadiusY * 1.7,
      y1: detail.current.y + pointRadiusY * 1.7,
      fillcolor: "rgba(255, 255, 255, 0)",
      line: { color: "#dc2626", width: 2.2 }
    };

    return [...guideShapes, ...velocityShapes, ...pointShapes, startRing];
  }

  function buildStepAnnotations(detail) {
    const startAnnotation = {
      x: detail.current.t,
      y: detail.current.y,
      text: "y_n",
      showarrow: false,
      xanchor: "right",
      yanchor: "bottom",
      xshift: -9,
      yshift: 9,
      bgcolor: "rgba(255, 255, 255, 0.88)",
      bordercolor: "rgba(220, 38, 38, 0.72)",
      borderpad: 2,
      font: { size: 11, color: "#dc2626" }
    };

    const annotations = [startAnnotation, ...detail.stages.map((stage, index) => ({
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
      font: { size: 10, color: stageColor(index) }
    }))];

    if (!detail.stages.some(stage => stage.label === "next")) {
      annotations.push({
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
        font: { size: 10, color: "#dc2626" }
      });
    }

    return annotations;
  }

  function buildVelocityStepShapes(detail, xRange, vRange) {
    const pointRadiusX = Math.max(Math.abs(xRange[1] - xRange[0]) * 0.006, Math.abs(detail.h) * 0.018);
    const pointRadiusY = Math.abs(vRange[1] - vRange[0]) * 0.012;
    const guideShapes = detail.stages
      .filter(stage => isFinite(stage.v))
      .slice(0, -1)
      .map((stage, index) => {
        const nextStage = detail.stages[index + 1];
        return {
          type: "line",
          x0: stage.t,
          y0: stage.v,
          x1: nextStage.t,
          y1: nextStage.v,
          line: {
            color: withAlpha(stageColor(index), 0.34),
            dash: "dot",
            width: 1.1
          }
        };
      });

    const accelerationShapes = detail.stages
      .filter(stage => isFinite(stage.a))
      .map((stage, index) => {
        const width = Math.abs(detail.h) * 0.18;
        const left = stage.t - width;
        const right = stage.t + width;
        return {
          type: "line",
          x0: left,
          y0: stage.v + stage.a * (left - stage.t),
          x1: right,
          y1: stage.v + stage.a * (right - stage.t),
          line: { color: stageColor(index), width: 2.2 }
        };
      });

    const pointShapes = detail.stages.map((stage, index) => ({
      type: "circle",
      x0: stage.t - pointRadiusX,
      x1: stage.t + pointRadiusX,
      y0: stage.v - pointRadiusY,
      y1: stage.v + pointRadiusY,
      fillcolor: stageColor(index),
      line: { color: "#ffffff", width: 1 }
    }));

    const startRing = {
      type: "circle",
      x0: detail.current.t - pointRadiusX * 1.7,
      x1: detail.current.t + pointRadiusX * 1.7,
      y0: detail.current.v - pointRadiusY * 1.7,
      y1: detail.current.v + pointRadiusY * 1.7,
      fillcolor: "rgba(255, 255, 255, 0)",
      line: { color: "#dc2626", width: 2.2 }
    };

    return [...guideShapes, ...accelerationShapes, ...pointShapes, startRing];
  }

  function buildVelocityStepAnnotations(detail) {
    const startAnnotation = {
      x: detail.current.t,
      y: detail.current.v,
      text: "v_n",
      showarrow: false,
      xanchor: "right",
      yanchor: "bottom",
      xshift: -9,
      yshift: 9,
      bgcolor: "rgba(255, 255, 255, 0.88)",
      bordercolor: "rgba(220, 38, 38, 0.72)",
      borderpad: 2,
      font: { size: 11, color: "#dc2626" }
    };

    return [startAnnotation, ...detail.stages.map((stage, index) => ({
      x: stage.t,
      y: stage.v,
      text: escapeHtml(compactVelocityLabel(stage.label, index)),
      showarrow: false,
      xanchor: "left",
      yanchor: "bottom",
      xshift: 7,
      yshift: 7,
      bgcolor: "rgba(255, 255, 255, 0.82)",
      bordercolor: withAlpha(stageColor(index), 0.62),
      borderpad: 2,
      font: { size: 10, color: stageColor(index) }
    }))];
  }

  function shouldUseStepZoom(detail) {
    const span = Math.abs((currentConfig?.t1 || 0) - (currentConfig?.t0 || 0));
    if (!span) return false;
    return Math.abs(detail.h) / span < STEP_ZOOM_RATIO_THRESHOLD;
  }

  function renderStepZoom(detail, result) {
    const panel = document.getElementById("ode2StepZoomPanel");
    const yPlot = document.getElementById("ode2StepZoomYPlot");
    const vPlot = document.getElementById("ode2StepZoomVPlot");
    const phasePlot = document.getElementById("ode2StepZoomPhasePlot");
    if (!panel || !yPlot || !vPlot || !phasePlot) return;

    panel.classList.add("active");
    const yTraces = buildStepZoomTraces(detail, result, "y");
    const yBounds = getStepDetailBounds(detail, yTraces, "y");
    const xRange = paddedRange(yBounds.xMin, yBounds.xMax, 0.24);
    const yRange = paddedRange(yBounds.yMin, yBounds.yMax, 0.26);

    window.Plotly.newPlot(yPlot, yTraces, {
      title: `y step: ${detail.method.label}`,
      margin: { t: 34, r: 12, b: 34, l: 46 },
      xaxis: { title: "t", range: xRange, autorange: false, zeroline: false },
      yaxis: { title: "y", range: yRange, autorange: false, zeroline: false },
      hovermode: false,
      showlegend: false,
      shapes: buildStepShapes(detail, xRange, yRange),
      annotations: buildStepAnnotations(detail)
    }, { responsive: true, displayModeBar: false });

    const vTraces = buildStepZoomTraces(detail, result, "v");
    const vBounds = getStepDetailBounds(detail, vTraces, "v");
    const vRange = paddedRange(vBounds.yMin, vBounds.yMax, 0.26);
    window.Plotly.newPlot(vPlot, vTraces, {
      title: `v step: ${detail.method.label}`,
      margin: { t: 34, r: 12, b: 34, l: 46 },
      xaxis: { title: "t", range: xRange, autorange: false, zeroline: false },
      yaxis: { title: "v", range: vRange, autorange: false, zeroline: false },
      hovermode: false,
      showlegend: false,
      shapes: buildVelocityStepShapes(detail, xRange, vRange),
      annotations: buildVelocityStepAnnotations(detail)
    }, { responsive: true, displayModeBar: false });

    const phaseRanges = getStepPhaseRanges(detail);
    window.Plotly.newPlot(phasePlot, buildStepPhaseZoomTraces(detail, result), {
      title: "state step: (y, v)",
      margin: { t: 34, r: 12, b: 34, l: 46 },
      xaxis: { title: "y", range: phaseRanges.xRange, autorange: false, zeroline: false },
      yaxis: { title: "v", range: phaseRanges.yRange, autorange: false, zeroline: false },
      hovermode: false,
      showlegend: false,
      shapes: [
        ...buildPhaseFieldShapes(currentConfig, phaseRanges.xRange, phaseRanges.yRange, detail.current.t),
        ...buildPhaseStepShapes(detail, phaseRanges.xRange, phaseRanges.yRange)
      ],
      annotations: buildPhaseStepAnnotations(detail)
    }, { responsive: true, displayModeBar: false });

    setActiveZoomView(activeZoomView);
  }

  function buildStepZoomTraces(detail, result, variable) {
    const stepWindow = Math.abs(detail.h) || 1;
    const minT = Math.min(detail.current.t, detail.next.t) - stepWindow;
    const maxT = Math.max(detail.current.t, detail.next.t) + stepWindow;
    const localPoints = result.points.filter(point => point.t >= minT && point.t <= maxT);
    const visiblePoints = localPoints.length >= 2 ? localPoints : [detail.current, detail.next];
    const traces = [{
      x: visiblePoints.map(point => point.t),
      y: visiblePoints.map(point => variable === "v" ? point.v : point.y),
      name: result.method.label,
      mode: "lines+markers",
      line: { color: result.method.color, width: 2 },
      marker: { color: result.method.color, size: 6 },
      hoverinfo: "skip"
    }];

    const exactTrace = buildExactZoomTrace(minT, maxT, variable);
    if (exactTrace) traces.unshift(exactTrace);
    return traces;
  }

  function buildStepPhaseZoomTraces(detail, result) {
    const stepWindow = Math.abs(detail.h) || 1;
    const minT = Math.min(detail.current.t, detail.next.t) - stepWindow;
    const maxT = Math.max(detail.current.t, detail.next.t) + stepWindow;
    const localPoints = result.points.filter(point => point.t >= minT && point.t <= maxT);
    const visiblePoints = localPoints.length >= 2 ? localPoints : [detail.current, detail.next];
    const traces = [{
      x: visiblePoints.map(point => point.y),
      y: visiblePoints.map(point => point.v),
      name: result.method.label,
      mode: "lines+markers",
      line: { color: result.method.color, width: 2 },
      marker: { color: result.method.color, size: 6 },
      hoverinfo: "skip"
    }];

    const exactTrace = buildExactPhaseZoomTrace(minT, maxT);
    if (exactTrace) traces.unshift(exactTrace);
    return traces;
  }

  function buildExactPhaseZoomTrace(minT, maxT) {
    if (!currentConfig?.exactY || !currentConfig?.exactV || !isFinite(minT) || !isFinite(maxT) || minT === maxT) return null;
    const x = [];
    const y = [];
    for (let i = 0; i <= 48; i++) {
      const t = minT + (maxT - minT) * i / 48;
      const exactY = window.SecondOrderMethods.evaluateExactY(currentConfig, t);
      const exactV = window.SecondOrderMethods.evaluateExactV(currentConfig, t);
      if (!isFinite(exactY) || !isFinite(exactV)) continue;
      x.push(exactY);
      y.push(exactV);
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

  function getStepPhaseRanges(detail) {
    const bounds = { xMin: Infinity, xMax: -Infinity, yMin: Infinity, yMax: -Infinity };
    addBoundsPoint(bounds, detail.current.y, detail.current.v);
    addBoundsPoint(bounds, detail.nextY, detail.nextV);
    detail.stages.forEach(stage => addBoundsPoint(bounds, stage.y, stage.v));

    if (!isFinite(bounds.xMin) || !isFinite(bounds.xMax)) {
      bounds.xMin = -1;
      bounds.xMax = 1;
    }
    if (!isFinite(bounds.yMin) || !isFinite(bounds.yMax)) {
      bounds.yMin = -1;
      bounds.yMax = 1;
    }

    return {
      xRange: paddedRange(bounds.xMin, bounds.xMax, 0.34),
      yRange: paddedRange(bounds.yMin, bounds.yMax, 0.34)
    };
  }

  function buildExactZoomTrace(minT, maxT, variable) {
    const exactExpr = variable === "v" ? currentConfig?.exactV : currentConfig?.exactY;
    if (!exactExpr || !isFinite(minT) || !isFinite(maxT) || minT === maxT) return null;
    const x = [];
    const y = [];
    for (let i = 0; i <= 48; i++) {
      const t = minT + (maxT - minT) * i / 48;
      const value = variable === "v"
        ? window.SecondOrderMethods.evaluateExactV(currentConfig, t)
        : window.SecondOrderMethods.evaluateExactY(currentConfig, t);
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

  function renderStepText(detail) {
    document.getElementById("ode2StepText").innerHTML = [
      `<strong>${escapeHtml(detail.method.label)}: step ${detail.index}</strong>`,
      "red ring = start state (y_n, v_n)",
      `<div>${formatStageSummaryHtml(detail.stages)}</div>`,
      ...detail.formulas.map(line => escapeHtml(line))
    ].join("<br>");
  }

  function formatStageSummaryHtml(stages) {
    return stages.map((stage, index) =>
      `<span class="stage-chip"><span class="stage-dot" style="background:${stageColor(index)}"></span>${escapeHtml(compactStageLabel(stage.label, index))}: y=${formatNumber(stage.y)}, v=${formatNumber(stage.v)}, a=${formatNumber(stage.a)}</span>`
    ).join(" | ");
  }

  function focusTrace(curveNumber) {
    if (!document.getElementById("ode2FocusHover").checked) return;
    const timePlot = document.getElementById("ode2TimePlot");
    if (!timePlot || !timePlot.data) return;
    const opacities = timePlot.data.map((_, index) => index === curveNumber ? 1 : 0.18);
    window.Plotly.restyle(timePlot, { opacity: opacities });
  }

  function resetTraceOpacity() {
    const timePlot = document.getElementById("ode2TimePlot");
    if (!timePlot || !timePlot.data) return;
    window.Plotly.restyle(timePlot, { opacity: timePlot.data.map(() => 1) });
  }

  function resetStepOverlayState() {
    if (clearOverlayTimer) {
      window.clearTimeout(clearOverlayTimer);
      clearOverlayTimer = null;
    }
    currentOverlayKey = "";
    pinnedStep = null;
    document.getElementById("ode2StepText").textContent = "";
    updatePinnedStepLabel(null, false);
    hideStepZoom();
  }

  function hideStepZoom() {
    const panel = document.getElementById("ode2StepZoomPanel");
    if (panel) panel.classList.remove("active");
  }

  function setActiveZoomView(view) {
    activeZoomView = view || "y";
    document.querySelectorAll("[data-ode2-zoom-view]").forEach(button => {
      button.classList.toggle("active", button.dataset.ode2ZoomView === activeZoomView);
    });
    document.querySelectorAll("#ode2StepZoomPanel [data-zoom-panel]").forEach(panel => {
      panel.classList.toggle("active", panel.dataset.zoomPanel === activeZoomView);
    });
  }

  function getSelectedMethods() {
    return Array.from(document.querySelectorAll("[data-ode2-method]:checked"))
      .map(el => el.dataset.ode2Method);
  }

  function updateMethodHint(selectedMethods) {
    const hint = document.getElementById("ode2MethodHint");
    const selected = window.SecondOrderMethods.METHOD_DEFS.filter(method =>
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
      equation: document.getElementById("ode2Equation").value.trim(),
      t0: parseFloat(document.getElementById("ode2T0").value),
      t1: parseFloat(document.getElementById("ode2T1").value),
      h: parseFloat(document.getElementById("ode2H").value),
      y0: parseFloat(document.getElementById("ode2Y0").value),
      v0: parseFloat(document.getElementById("ode2V0").value),
      exactY: document.getElementById("ode2ExactY").value.trim(),
      exactV: document.getElementById("ode2ExactV").value.trim()
    };
  }

  function buildExactTrace(config, variable) {
    const expr = variable === "v" ? config.exactV : config.exactY;
    if (!expr) return null;
    const t0 = finiteOr(config.t0, 0);
    const t1 = finiteOr(config.t1, 12);
    const samples = 500;
    const x = [];
    const y = [];
    for (let i = 0; i <= samples; i++) {
      const t = t0 + (t1 - t0) * i / samples;
      const value = variable === "v"
        ? window.SecondOrderMethods.evaluateExactV(config, t)
        : window.SecondOrderMethods.evaluateExactY(config, t);
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
      line: { color: "#000000", dash: "dot", width: 2 },
      hoverinfo: "x+y+name"
    };
  }

  function getPlotLayout(traces, title, yTitle) {
    const bounds = getTraceBounds(traces);
    return {
      title,
      margin: { t: 42, r: 16, b: 42, l: 52 },
      xaxis: { title: "t", range: paddedRange(bounds.xMin, bounds.xMax, 0.02), autorange: false },
      yaxis: { title: yTitle, range: paddedRange(bounds.yMin, bounds.yMax, 0.1), autorange: false },
      hovermode: "closest",
      shapes: [],
      annotations: []
    };
  }

  function getStepDetailBounds(detail, traces, variable = "y") {
    const bounds = getTraceBounds(traces);
    addBoundsPoint(bounds, detail.current.t, variable === "v" ? detail.current.v : detail.current.y);
    addBoundsPoint(bounds, detail.next.t, variable === "v" ? detail.nextV : detail.next.y);
    detail.stages.forEach(stage => addBoundsPoint(bounds, stage.t, variable === "v" ? stage.v : stage.y));
    if (variable === "y") {
      detail.guides.forEach(guide => {
        addBoundsPoint(bounds, guide.from.t, guide.from.y);
        addBoundsPoint(bounds, guide.to.t, guide.to.y);
      });
    }
    return bounds;
  }

  function getTraceBounds(traces) {
    const bounds = { xMin: Infinity, xMax: -Infinity, yMin: Infinity, yMax: -Infinity };
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

  function paddedRange(min, max, paddingRatio) {
    const width = max - min || 1;
    const padding = width * paddingRatio;
    return [min - padding, max + padding];
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function compactStageLabel(label, index) {
    if (/^k\d+$/i.test(label)) return label;
    if (label === "start") return "y_n";
    if (label === "previous") return "y_(n-1)";
    if (label === "new v") return "v_(n+1)";
    if (label === "position") return "y_(n+1)";
    if (label === "next") return "next";
    if (label === "Euler") return "Euler";
    if (label === "Euler-Cromer") return "EC";
    return label.split(/\s+/).slice(0, 2).join(" ");
  }

  function compactVelocityLabel(label, index) {
    if (/^k\d+$/i.test(label)) return `a_${label.slice(1)}`;
    if (label === "start") return "v_n";
    if (label === "previous") return "v_(n-1)";
    if (label === "new v") return "v_(n+1)";
    if (label === "position") return "a_(n+1)";
    if (label === "next") return "v_(n+1)";
    if (label === "Euler") return "v_(n+1)";
    if (label === "Euler-Cromer") return "v_(n+1)";
    if (label === "mid") return "v_mid";
    return `v_${index}`;
  }

  function stageColor(index) {
    const colors = ["#111827", "#2563eb", "#16a34a", "#f97316", "#7c3aed", "#dc2626", "#0891b2", "#a16207"];
    return colors[index % colors.length];
  }

  function withAlpha(hexColor, alpha) {
    const normalized = hexColor.replace("#", "");
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function finiteOr(value, fallback) {
    return isFinite(value) ? value : fallback;
  }

  function formatNumber(value) {
    if (!isFinite(value)) return "0";
    return String(Math.round(value * 1000000) / 1000000);
  }

  window.setupSecondOrderLab = setupSecondOrderLab;
  window.plotSecondOrderMethods = plotSecondOrderMethods;
})();
