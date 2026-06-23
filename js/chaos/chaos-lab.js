(function () {
  let currentModel = null;
  let currentResult = null;
  let isPlaying = false;
  let animationT = 0;
  let lastFrameTime = null;
  let lastPlotUpdateTime = 0;
  let animationFrameId = null;
  let logisticBifurcationCache = { sampleIndex: -1, keepIndex: -1, mode: "" };
  const MAX_LIOUVILLE_FRAMES = 520;
  const FEIGENBAUM_DELTA = 4.669201609;
  const LOGISTIC_PERIOD_DOUBLINGS = [
    { label: "r\u2081", r: 3 },
    { label: "r\u2082", r: 3.449489743 },
    { label: "r\u2083", r: 3.54409035 },
    { label: "r\u2084", r: 3.564407266 },
    { label: "r\u2085", r: 3.5687594 },
    { label: "r\u221e", r: 3.569945672 }
  ];
  const lorenzView = {
    yaw: 0.55,
    pitch: 0.28,
    dragging: false,
    pointerId: null,
    lastX: 0,
    lastY: 0
  };

  function setupChaosLab() {
    bindChaosEvents();
    updateChaosControls();
    if (isChaosSelected()) runChaosSimulation();
  }

  function bindChaosEvents() {
    document.querySelectorAll("#chaosControlsBody input, #chaosControlsBody select").forEach(el => {
      if (el.id === "chaosSpeed" || el.id === "chaosTimeSlider") return;
      el.addEventListener("change", runChaosSimulation);
    });

    const speed = document.getElementById("chaosSpeed");
    if (speed) speed.addEventListener("change", () => {
      if (!isPlaying) drawChaosFrame(animationT, { forcePlotUpdate: true });
    });

    const playButton = document.getElementById("chaosPlayBtn");
    if (playButton) playButton.addEventListener("click", () => {
      isPlaying = !isPlaying;
      playButton.textContent = isPlaying ? "Pause" : "Play";
      lastFrameTime = null;
      if (isPlaying) animationFrameId = requestAnimationFrame(stepChaosAnimation);
      else if (animationFrameId) cancelAnimationFrame(animationFrameId);
    });

    const slider = document.getElementById("chaosTimeSlider");
    if (slider) slider.addEventListener("input", event => {
      if (!currentModel) return;
      const fraction = finiteOr(parseFloat(event.target.value), 0);
      animationT = currentModel.t0 + fraction * (currentModel.t1 - currentModel.t0);
      stopChaosAnimation();
      drawChaosFrame(animationT, { forcePlotUpdate: true });
    });

    bindLorenzViewDrag();

    const dynamicsTab = document.querySelector('[data-tab="physics"]');
    if (dynamicsTab) dynamicsTab.addEventListener("click", () => {
      setTimeout(() => {
        if (!isChaosSelected()) return;
        ["chaosPhasePlot", "chaosTimePlot", "chaosSeparationPlot", "chaosEnergyPlot"].forEach(id => {
          const el = document.getElementById(id);
          if (el && window.Plotly) window.Plotly.Plots.resize(el);
        });
        drawChaosFrame(animationT, { forcePlotUpdate: true });
      }, 80);
    });
  }

  function bindLorenzViewDrag() {
    const canvas = document.getElementById("chaosCanvas");
    if (!canvas) return;
    canvas.style.touchAction = "none";

    canvas.addEventListener("pointerdown", event => {
      if (!canDragLorenz3D()) return;
      lorenzView.dragging = true;
      lorenzView.pointerId = event.pointerId;
      lorenzView.lastX = event.clientX;
      lorenzView.lastY = event.clientY;
      canvas.style.cursor = "grabbing";
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch (_) {}
      event.preventDefault();
    });

    canvas.addEventListener("pointermove", event => {
      if (!lorenzView.dragging || lorenzView.pointerId !== event.pointerId || !canDragLorenz3D()) return;
      const dx = event.clientX - lorenzView.lastX;
      const dy = event.clientY - lorenzView.lastY;
      lorenzView.lastX = event.clientX;
      lorenzView.lastY = event.clientY;
      lorenzView.yaw += dx * 0.01;
      lorenzView.pitch = clamp(lorenzView.pitch - dy * 0.01, -0.85, 0.85);
      drawChaosFrame(animationT, { forcePlotUpdate: false });
      event.preventDefault();
    });

    const release = event => {
      if (lorenzView.pointerId !== event.pointerId) return;
      lorenzView.dragging = false;
      lorenzView.pointerId = null;
      canvas.style.cursor = canDragLorenz3D() ? "grab" : "default";
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch (_) {}
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("pointerleave", event => {
      if (lorenzView.dragging && lorenzView.pointerId === event.pointerId) release(event);
    });
  }

  function canDragLorenz3D() {
    return currentModel?.type === "lorenz";
  }

  function runChaosSimulation() {
    try {
      updateChaosControls();
      currentModel = readChaosModel();
      currentResult = simulateChaosModel(currentModel);
      animationT = currentModel.t0;
      lastPlotUpdateTime = 0;
      logisticBifurcationCache = { sampleIndex: -1, keepIndex: -1, mode: "" };
      stopChaosAnimation();
      renderChaosEquation(currentModel);
      drawChaosPlots(currentModel, currentResult);
      drawChaosFrame(animationT, { forcePlotUpdate: true });
      updateChaosStatus(currentModel, currentResult);
    } catch (error) {
      const status = document.getElementById("chaosStatus");
      if (status) status.textContent = error.message;
    }
  }

  function updateChaosControls() {
    const type = selectedChaosSystem();
    const liouvilleFlow = document.getElementById("chaosLiouvilleFlow")?.value || "hamiltonian";
    const logisticMode = document.getElementById("chaosLogisticBifurcationMode")?.value || "build";
    const duffingView = "trajectory";
    const show = {
      flow: type === "lorenz" || type === "doublePendulum" || type === "duffing" || type === "liouvilleFlow",
      method: type === "lorenz" || type === "doublePendulum" || type === "duffing" || type === "liouvilleFlow",
      lorenz: type === "lorenz",
      initial: type === "lorenz",
      logistic: type === "logisticMap",
      logisticMode: type === "logisticMap",
      logisticBase: type === "logisticMap",
      logisticRange: type === "logisticMap" && logisticMode === "build",
      logisticSelected: type === "logisticMap" && logisticMode === "complete",
      doublePendulum: type === "doublePendulum",
      duffing: type === "duffing",
      duffingSweep: false,
      liouville: type === "liouvilleFlow",
      liouvilleOscillator: type === "liouvilleFlow" && (liouvilleFlow === "hamiltonian" || liouvilleFlow === "damped" || liouvilleFlow === "driven"),
      liouvilleDamped: type === "liouvilleFlow" && liouvilleFlow === "damped",
      liouvilleDriven: type === "liouvilleFlow" && liouvilleFlow === "driven",
      liouvilleDuffing: type === "liouvilleFlow" && liouvilleFlow === "duffing",
      liouvilleDouble: type === "liouvilleFlow" && liouvilleFlow === "doublePendulum"
    };
    document.querySelectorAll("#chaosControlsBody [data-chaos-param]").forEach(block => {
      const key = block.dataset.chaosParam;
      block.classList.toggle("hidden", !show[key]);
    });
    const duffingDriveLabel = document.getElementById("chaosDuffingDriveAmpLabel");
    if (duffingDriveLabel) duffingDriveLabel.textContent = "F";
    if (type === "duffing") syncDuffingPresetControls();

    const t1 = document.getElementById("chaosT1");
    const h = document.getElementById("chaosH");
    const liouvilleRadius = document.getElementById("chaosLiouvilleRadius");
    if (type === "doublePendulum") {
      if (t1 && (!t1.dataset.lastChaosType || t1.dataset.lastChaosType !== type)) t1.value = "25";
      if (h && (!h.dataset.lastChaosType || h.dataset.lastChaosType !== type)) h.value = "0.01";
    } else if (type === "duffing") {
      if (t1 && (!t1.dataset.lastChaosType || t1.dataset.lastChaosType !== type)) t1.value = "80";
      if (h && (!h.dataset.lastChaosType || h.dataset.lastChaosType !== type)) h.value = "0.02";
    } else if (type === "liouvilleFlow") {
      const flowChanged = h && h.dataset.lastLiouvilleFlow !== liouvilleFlow;
      if (t1 && (!t1.dataset.lastChaosType || t1.dataset.lastChaosType !== type || flowChanged)) t1.value = liouvilleFlow === "doublePendulum" ? "8" : "18";
      if (h && (!h.dataset.lastChaosType || h.dataset.lastChaosType !== type || flowChanged)) h.value = liouvilleFlow === "doublePendulum" ? "0.0025" : "0.02";
      if (liouvilleRadius && flowChanged) liouvilleRadius.value = liouvilleFlow === "doublePendulum" ? "0.16" : "0.32";
    } else if (type === "lorenz") {
      if (t1 && (!t1.dataset.lastChaosType || t1.dataset.lastChaosType !== type)) t1.value = "35";
      if (h && (!h.dataset.lastChaosType || h.dataset.lastChaosType !== type)) h.value = "0.01";
    }
    if (t1) t1.dataset.lastChaosType = type;
    if (h) {
      h.dataset.lastChaosType = type;
      h.dataset.lastLiouvilleFlow = liouvilleFlow;
    }
  }

  function syncDuffingPresetControls() {
    const presetSelect = document.getElementById("chaosDuffingPreset");
    const preset = presetSelect?.value || "chaotic";
    if (preset === "custom") {
      if (presetSelect) presetSelect.dataset.lastSyncedPreset = preset;
      return;
    }
    if (presetSelect?.dataset.lastSyncedPreset === preset) return;
    const values = preset === "regular"
      ? { delta: "0.2", alpha: "-1", beta: "1", driveAmp: "0.18", driveOmega: "1.2" }
      : { delta: "0.2", alpha: "-1", beta: "1", driveAmp: "0.3", driveOmega: "1.2" };
    setInputValue("chaosDuffingDelta", values.delta);
    setInputValue("chaosDuffingAlpha", values.alpha);
    setInputValue("chaosDuffingBeta", values.beta);
    setInputValue("chaosDuffingDriveAmp", values.driveAmp);
    setInputValue("chaosDuffingDriveOmega", values.driveOmega);
    if (presetSelect) presetSelect.dataset.lastSyncedPreset = preset;
  }

  function setInputValue(id, value) {
    const input = document.getElementById(id);
    if (input) input.value = value;
  }

  function selectedChaosSystem() {
    const value = document.getElementById("physicsSystem")?.value;
    if (value === "logisticMap" || value === "doublePendulum" || value === "duffing" || value === "liouvilleFlow") return value;
    return "lorenz";
  }

  function isChaosSelected() {
    return document.getElementById("physicsCategory")?.value === "chaos";
  }

  function readChaosModel() {
    const type = selectedChaosSystem();
    if (type === "logisticMap") return readLogisticModel();
    if (type === "doublePendulum") return readDoublePendulumModel();
    if (type === "duffing") return readDuffingModel();
    if (type === "liouvilleFlow") return readLiouvilleModel();
    return readLorenzModel();
  }

  function readFlowBase(defaultT1 = 35) {
    const t0 = finiteOr(parseFloat(document.getElementById("chaosT0")?.value), 0);
    const t1 = finiteOr(parseFloat(document.getElementById("chaosT1")?.value), defaultT1);
    const h = Math.max(finiteOr(parseFloat(document.getElementById("chaosH")?.value), 0.01), 0.0005);
    if (t1 <= t0) throw new Error("t1 must be greater than t0");
    return { t0, t1, h, method: document.getElementById("chaosMethod")?.value || "rk4" };
  }

  function readLorenzModel() {
    const base = readFlowBase(35);
    const sigma = finiteOr(parseFloat(document.getElementById("chaosSigma")?.value), 10);
    const rho = finiteOr(parseFloat(document.getElementById("chaosRho")?.value), 28);
    const beta = finiteOr(parseFloat(document.getElementById("chaosBeta")?.value), 8 / 3);
    const x0 = finiteOr(parseFloat(document.getElementById("chaosX0")?.value), 1);
    const y0 = finiteOr(parseFloat(document.getElementById("chaosY0")?.value), 1);
    const z0 = finiteOr(parseFloat(document.getElementById("chaosZ0")?.value), 1);
    const delta = finiteOr(parseFloat(document.getElementById("chaosDelta")?.value), 0.0001);
    return {
      type: "lorenz",
      ...base,
      sigma,
      rho,
      beta,
      initialA: { x: x0, y: y0, z: z0 },
      initialB: { x: x0 + delta, y: y0, z: z0 },
      delta,
      phaseProjection: document.getElementById("chaosLorenzPhaseProjection")?.value || "x-z"
    };
  }

  function readLogisticModel() {
    const iterations = clamp(Math.round(finiteOr(parseFloat(document.getElementById("chaosLogisticIterations")?.value), 180)), 20, 2000);
    const discard = clamp(Math.round(finiteOr(parseFloat(document.getElementById("chaosLogisticDiscard")?.value), 80)), 0, 1000);
    const rMin = clamp(finiteOr(parseFloat(document.getElementById("chaosLogisticRMin")?.value), 2.8), 0, 4);
    const rMax = clamp(finiteOr(parseFloat(document.getElementById("chaosLogisticRMax")?.value), 4), 0, 4);
    const bifurcationMode = document.getElementById("chaosLogisticBifurcationMode")?.value || "build";
    const bifurcationSamples = clamp(Math.round(finiteOr(parseFloat(document.getElementById("chaosLogisticSamples")?.value), 260)), 40, 800);
    const displaySettle = clamp(Math.round(discard * 0.42), 18, 56);
    const displayKeep = clamp(Math.round((iterations - discard) * 0.48), 22, 58);
    const buildCycle = displaySettle + displayKeep;
    return {
      type: "logisticMap",
      t0: 0,
      t1: bifurcationMode === "build" ? bifurcationSamples * buildCycle : iterations,
      r: clamp(finiteOr(parseFloat(document.getElementById("chaosLogisticR")?.value), 3.72), 0, 4),
      x0: clamp(finiteOr(parseFloat(document.getElementById("chaosLogisticX0")?.value), 0.21), 0, 1),
      iterations,
      discard,
      displaySettle,
      displayKeep,
      buildCycle,
      rMin: Math.min(rMin, rMax),
      rMax: Math.max(rMin, rMax),
      bifurcationSamples,
      bifurcationMode
    };
  }

  function readDoublePendulumModel() {
    const base = readFlowBase(25);
    const theta1 = finiteOr(parseFloat(document.getElementById("chaosDoubleTheta1")?.value), 120) * Math.PI / 180;
    const theta2 = finiteOr(parseFloat(document.getElementById("chaosDoubleTheta2")?.value), -10) * Math.PI / 180;
    const omega1 = finiteOr(parseFloat(document.getElementById("chaosDoubleOmega1")?.value), 0);
    const omega2 = finiteOr(parseFloat(document.getElementById("chaosDoubleOmega2")?.value), 0);
    const delta = finiteOr(parseFloat(document.getElementById("chaosDoubleDelta")?.value), 0.0001);
    return {
      type: "doublePendulum",
      ...base,
      l1: Math.max(finiteOr(parseFloat(document.getElementById("chaosDoubleL1")?.value), 1), 0.05),
      l2: Math.max(finiteOr(parseFloat(document.getElementById("chaosDoubleL2")?.value), 1), 0.05),
      m1: Math.max(finiteOr(parseFloat(document.getElementById("chaosDoubleM1")?.value), 1), 0.05),
      m2: Math.max(finiteOr(parseFloat(document.getElementById("chaosDoubleM2")?.value), 1), 0.05),
      g: finiteOr(parseFloat(document.getElementById("chaosDoubleG")?.value), 9.81),
      initialA: { theta1, theta2, omega1, omega2 },
      initialB: { theta1: theta1 + delta, theta2, omega1, omega2 },
      delta,
      phaseProjection: document.getElementById("chaosDoublePhaseProjection")?.value || "theta1-omega1"
    };
  }

  function readDuffingModel() {
    const base = readFlowBase(80);
    const params = readDuffingParams("chaosDuffing", document.getElementById("chaosDuffingPreset")?.value || "chaotic");
    const q0 = finiteOr(parseFloat(document.getElementById("chaosDuffingQ0")?.value), 0.2);
    const p0 = finiteOr(parseFloat(document.getElementById("chaosDuffingP0")?.value), 0);
    const delta = finiteOr(parseFloat(document.getElementById("chaosDuffingDelta0")?.value), 0.0001);
    const sweepMin = finiteOr(parseFloat(document.getElementById("chaosDuffingSweepMin")?.value), 0.20);
    const sweepMax = finiteOr(parseFloat(document.getElementById("chaosDuffingSweepMax")?.value), 0.38);
    return {
      type: "duffing",
      ...base,
      ...params,
      initialA: { q: q0, p: p0, phi: 0 },
      initialB: { q: q0 + delta, p: p0, phi: 0 },
      delta,
      phaseProjection: "q-p",
      view: "trajectory",
      sweepMin: Math.min(sweepMin, sweepMax),
      sweepMax: Math.max(sweepMin, sweepMax),
      sweepSamples: clamp(Math.round(finiteOr(parseFloat(document.getElementById("chaosDuffingSweepSamples")?.value), 120)), 20, 240),
      sweepPeriods: clamp(Math.round(finiteOr(parseFloat(document.getElementById("chaosDuffingSweepPeriods")?.value), 130)), 30, 240)
    };
  }

  function readLiouvilleModel() {
    const base = readFlowBase(18);
    const flow = document.getElementById("chaosLiouvilleFlow")?.value || "hamiltonian";
    const omega = Math.max(finiteOr(parseFloat(document.getElementById("chaosLiouvilleOmega")?.value), 1), 0.05);
    const gamma = flow === "damped"
      ? Math.max(finiteOr(parseFloat(document.getElementById("chaosLiouvilleGamma")?.value), 0.18), 0)
      : 0;
    return {
      type: "liouvilleFlow",
      ...base,
      flow,
      omega,
      gamma,
      driveAmp: flow === "driven" ? finiteOr(parseFloat(document.getElementById("chaosLiouvilleDriveAmp")?.value), 0.7) : 0,
      driveOmega: flow === "driven" ? Math.max(finiteOr(parseFloat(document.getElementById("chaosLiouvilleDriveOmega")?.value), 1.35), 0.05) : 0,
      duffing: readLiouvilleDuffingParams(flow),
      doublePendulum: readLiouvilleDoubleParams(flow),
      radius: Math.max(finiteOr(parseFloat(document.getElementById("chaosLiouvilleRadius")?.value), 0.32), 0.02),
      cloudCount: clamp(Math.round(finiteOr(parseFloat(document.getElementById("chaosLiouvillePoints")?.value), 420)), 24, 3000)
    };
  }

  function readDuffingParams(prefix, preset) {
    if (preset === "regular") {
      return { deltaDamp: 0.2, alpha: -1, beta: 1, driveAmp: 0.18, driveOmega: 1.2, preset };
    }
    if (preset === "chaotic") {
      return { deltaDamp: 0.2, alpha: -1, beta: 1, driveAmp: 0.3, driveOmega: 1.2, preset };
    }
    return {
      deltaDamp: Math.max(finiteOr(parseFloat(document.getElementById(`${prefix}Delta`)?.value), 0.2), 0),
      alpha: finiteOr(parseFloat(document.getElementById(`${prefix}Alpha`)?.value), -1),
      beta: finiteOr(parseFloat(document.getElementById(`${prefix}Beta`)?.value), 1),
      driveAmp: finiteOr(parseFloat(document.getElementById(`${prefix}DriveAmp`)?.value), 0.3),
      driveOmega: Math.max(finiteOr(parseFloat(document.getElementById(`${prefix}DriveOmega`)?.value), 1.2), 0.05),
      preset
    };
  }

  function readLiouvilleDuffingParams(flow) {
    if (flow !== "duffing") return null;
    return {
      deltaDamp: Math.max(finiteOr(parseFloat(document.getElementById("chaosLiouvilleDuffingDelta")?.value), 0.2), 0),
      alpha: -1,
      beta: 1,
      driveAmp: finiteOr(parseFloat(document.getElementById("chaosLiouvilleDuffingDriveAmp")?.value), 0.3),
      driveOmega: Math.max(finiteOr(parseFloat(document.getElementById("chaosLiouvilleDuffingDriveOmega")?.value), 1.2), 0.05)
    };
  }

  function readLiouvilleDoubleParams(flow) {
    if (flow !== "doublePendulum") return null;
    return {
      l1: 1,
      l2: 1,
      m1: 1,
      m2: 1,
      g: 9.81,
      theta1: finiteOr(parseFloat(document.getElementById("chaosLiouvilleDoubleTheta1")?.value), 120) * Math.PI / 180,
      theta2: finiteOr(parseFloat(document.getElementById("chaosLiouvilleDoubleTheta2")?.value), -10) * Math.PI / 180,
      omega1: 0,
      omega2: 0,
      projection: document.getElementById("chaosLiouvilleDoubleProjection")?.value || "theta1-omega1"
    };
  }

  function simulateChaosModel(model) {
    if (model.type === "logisticMap") return simulateLogisticMap(model);
    if (model.type === "doublePendulum") return simulateDoublePendulumPair(model);
    if (model.type === "duffing") return simulateDuffingPair(model);
    if (model.type === "liouvilleFlow") return simulateLiouvilleFlow(model);
    return simulateLorenzPair(model);
  }

  function simulateLorenzPair(model) {
    const points = [];
    let a = { ...model.initialA };
    let b = { ...model.initialB };
    let t = model.t0;
    const maxSteps = Math.ceil((model.t1 - model.t0) / model.h);
    let maxDistance = 0;
    for (let step = 0; step <= maxSteps; step++) {
      const distance = stateDistance3(a, b);
      maxDistance = Math.max(maxDistance, distance);
      points.push({ t, a: { ...a }, b: { ...b }, distance });
      if (step === maxSteps) break;
      const dt = Math.min(model.h, model.t1 - t);
      a = stepVector(a, dt, model, lorenzDerivative);
      b = stepVector(b, dt, model, lorenzDerivative);
      t += dt;
    }
    return { points, maxDistance };
  }

  function simulateLogisticMap(model) {
    const points = [];
    let x = model.x0;
    for (let n = 0; n <= model.iterations; n++) {
      points.push({ t: n, n, x });
      x = logisticNext(x, model.r);
    }
    const bifurcation = buildLogisticBifurcation(model);
    return {
      points,
      cobweb: buildCobweb(points),
      bifurcation: bifurcation.points,
      bifurcationColumns: bifurcation.columns,
      maxDistance: 0
    };
  }

  function simulateDoublePendulumPair(model) {
    const points = [];
    let a = { ...model.initialA };
    let b = { ...model.initialB };
    let t = model.t0;
    const maxSteps = Math.ceil((model.t1 - model.t0) / model.h);
    let maxDistance = 0;
    for (let step = 0; step <= maxSteps; step++) {
      const distance = doublePendulumDistance(a, b, model);
      maxDistance = Math.max(maxDistance, distance);
      points.push({ t, a: { ...a }, b: { ...b }, distance });
      if (step === maxSteps) break;
      const dt = Math.min(model.h, model.t1 - t);
      a = stepVector(a, dt, model, doublePendulumDerivative);
      b = stepVector(b, dt, model, doublePendulumDerivative);
      t += dt;
    }
    return { points, maxDistance };
  }

  function simulateDuffingPair(model) {
    const points = [];
    let a = { ...model.initialA };
    let b = { ...model.initialB };
    let t = model.t0;
    const maxSteps = Math.ceil((model.t1 - model.t0) / model.h);
    let maxDistance = 0;
    for (let step = 0; step <= maxSteps; step++) {
      const distance = Math.hypot(a.q - b.q, a.p - b.p, wrapAngle(a.phi - b.phi));
      maxDistance = Math.max(maxDistance, distance);
      points.push({ t, a: { ...a }, b: { ...b }, distance });
      if (step === maxSteps) break;
      const dt = Math.min(model.h, model.t1 - t);
      a = stepVector(a, dt, model, duffingDerivative);
      b = stepVector(b, dt, model, duffingDerivative);
      a.phi = normalizePhase(a.phi);
      b.phi = normalizePhase(b.phi);
      t += dt;
    }
    const bifurcation = model.view === "periodDoubling" ? buildDuffingPoincareBifurcation(model) : null;
    return { points, maxDistance, bifurcation };
  }

  function buildDuffingPoincareBifurcation(model) {
    const points = [];
    const columns = [];
    const period = 2 * Math.PI / Math.max(model.driveOmega, 1e-9);
    const stepsPerPeriod = 64;
    const discardPeriods = Math.max(10, Math.floor(model.sweepPeriods * 0.55));
    for (let i = 0; i < model.sweepSamples; i++) {
      const driveAmp = model.sweepMin + (model.sweepMax - model.sweepMin) * i / Math.max(model.sweepSamples - 1, 1);
      const sweepModel = { ...model, driveAmp };
      let state = { q: model.initialA.q, p: model.initialA.p, phi: 0 };
      const column = [];
      for (let periodIndex = 0; periodIndex < model.sweepPeriods; periodIndex++) {
        state = integrateDuffingPeriod(state, sweepModel, period, stepsPerPeriod);
        if (periodIndex >= discardPeriods) {
          const point = { F: driveAmp, q: state.q, p: state.p, periodIndex, sampleIndex: i };
          points.push(point);
          column.push(point);
        }
      }
      columns.push(column);
    }
    return { points, columns, period, discardPeriods };
  }

  function duffingSweepProgress(t, model, bifurcation) {
    const count = Math.max(bifurcation.columns?.length || model.sweepSamples || 1, 1);
    const fraction = clamp((t - model.t0) / Math.max(model.t1 - model.t0, 1e-9), 0, 1);
    const position = fraction * count;
    const sampleIndex = clamp(Math.floor(position), 0, count - 1);
    const localFraction = fraction >= 1 ? 1 : clamp(position - sampleIndex, 0, 1);
    const fullActiveColumn = bifurcation.columns?.[sampleIndex] || [];
    const activeCount = fullActiveColumn.length
      ? clamp(Math.max(1, Math.ceil(fullActiveColumn.length * localFraction)), 1, fullActiveColumn.length)
      : 0;
    const activeColumn = fullActiveColumn.slice(0, activeCount);
    const visibleColumns = bifurcation.columns?.slice(0, sampleIndex) || [];
    const visiblePoints = visibleColumns.flat().concat(activeColumn);
    const F = activeColumn[0]?.F ?? model.sweepMin + (model.sweepMax - model.sweepMin) * sampleIndex / Math.max(count - 1, 1);
    return { sampleIndex, count, F, activeColumn, visiblePoints, activeCount, activeTotal: fullActiveColumn.length };
  }

  function integrateDuffingPeriod(state, model, period, stepsPerPeriod) {
    let next = { ...state };
    const dt = period / stepsPerPeriod;
    for (let i = 0; i < stepsPerPeriod; i++) {
      next = stepVector(next, dt, model, duffingDerivative);
      next.phi = normalizePhase(next.phi);
    }
    return next;
  }

  function simulateLiouvilleFlow(model) {
    const points = [];
    const initial = generateLiouvilleInitial(model);
    let cloud = initial.cloud;
    let volumeProbe = initial.volumeProbe;
    let t = model.t0;
    const maxSteps = Math.ceil((model.t1 - model.t0) / model.h);
    const firstArea = Math.max(cloudArea(cloud, model, initial.mesh), 1e-12);
    const firstVolume = volumeProbe ? Math.max(localPhaseVolume(volumeProbe, model), 1e-12) : null;
    const firstEnergy = meanLiouvilleEnergy(cloud, model);
    const firstCentralEnergy = volumeProbe ? doublePendulumEnergy(volumeProbe[0], model.doublePendulum) : firstEnergy;
    const storeEvery = Math.max(1, Math.ceil(maxSteps / MAX_LIOUVILLE_FRAMES));
    for (let step = 0; step <= maxSteps; step++) {
      const shouldStore = step % storeEvery === 0 || step === maxSteps;
      if (shouldStore) {
        const area = cloudArea(cloud, model, initial.mesh);
        const volume = volumeProbe ? localPhaseVolume(volumeProbe, model) : null;
        const energy = meanLiouvilleEnergy(cloud, model);
        const centralEnergy = volumeProbe ? doublePendulumEnergy(volumeProbe[0], model.doublePendulum) : energy;
        points.push({
          t,
          cloud: cloud.map(point => ({ ...point })),
          area,
          areaRatio: area / firstArea,
          volumeRatio: firstVolume ? volume / firstVolume : null,
          energy,
          energyDelta: centralEnergy - firstCentralEnergy,
          meanEnergyDelta: energy - firstEnergy,
          centroid: cloudCentroid(cloud, model)
        });
      }
      if (step === maxSteps) break;
      const dt = Math.min(model.h, model.t1 - t);
      cloud = cloud.map(point => stepVector(point, dt, model, liouvilleDerivative));
      if (volumeProbe) volumeProbe = volumeProbe.map(point => stepVector(point, dt, model, liouvilleDerivative));
      if (model.flow === "driven" || model.flow === "duffing") cloud.forEach(point => {
        point.phi = normalizePhase(point.phi);
      });
      t += dt;
    }
    return {
      points,
      initialArea: firstArea,
      initialVolume: firstVolume,
      initialEnergy: firstEnergy,
      initialCentralEnergy: firstCentralEnergy,
      mesh: initial.mesh,
      phaseBounds: liouvillePhaseBounds(points, model),
      maxDistance: 0
    };
  }

  function lorenzDerivative(state, model) {
    return {
      x: model.sigma * (state.y - state.x),
      y: state.x * (model.rho - state.z) - state.y,
      z: state.x * state.y - model.beta * state.z
    };
  }

  function doublePendulumDerivative(state, model) {
    const { theta1, theta2, omega1, omega2 } = state;
    const { m1, m2, l1, l2, g } = model;
    const delta = theta1 - theta2;
    const denom = 2 * m1 + m2 - m2 * Math.cos(2 * delta);
    const theta1Accel = (
      -g * (2 * m1 + m2) * Math.sin(theta1)
      - m2 * g * Math.sin(theta1 - 2 * theta2)
      - 2 * Math.sin(delta) * m2 * (omega2 * omega2 * l2 + omega1 * omega1 * l1 * Math.cos(delta))
    ) / (l1 * denom);
    const theta2Accel = (
      2 * Math.sin(delta) * (
        omega1 * omega1 * l1 * (m1 + m2)
        + g * (m1 + m2) * Math.cos(theta1)
        + omega2 * omega2 * l2 * m2 * Math.cos(delta)
      )
    ) / (l2 * denom);
    return {
      theta1: omega1,
      theta2: omega2,
      omega1: theta1Accel,
      omega2: theta2Accel
    };
  }

  function liouvilleDerivative(state, model) {
    if (model.flow === "duffing") return duffingDerivative(state, model.duffing);
    if (model.flow === "doublePendulum") return doublePendulumDerivative(state, model.doublePendulum);
    return {
      q: state.p,
      p: -model.omega * model.omega * state.q - model.gamma * state.p + model.driveAmp * Math.cos(state.phi),
      phi: model.driveOmega
    };
  }

  function duffingDerivative(state, model) {
    return {
      q: state.p,
      p: -model.deltaDamp * state.p - model.alpha * state.q - model.beta * state.q * state.q * state.q + model.driveAmp * Math.cos(state.phi),
      phi: model.driveOmega
    };
  }

  function stepVector(state, h, model, derivative) {
    if (model.method === "euler") return eulerStep(state, h, model, derivative);
    if (model.method === "midpoint") return midpointStep(state, h, model, derivative);
    if (model.method === "heun") return heunStep(state, h, model, derivative);
    return rk4Step(state, h, model, derivative);
  }

  function eulerStep(state, h, model, derivative) {
    return addScaledState(state, derivative(state, model), h);
  }

  function midpointStep(state, h, model, derivative) {
    const k1 = derivative(state, model);
    const k2 = derivative(addScaledState(state, k1, h * 0.5), model);
    return addScaledState(state, k2, h);
  }

  function heunStep(state, h, model, derivative) {
    const k1 = derivative(state, model);
    const predictor = addScaledState(state, k1, h);
    const k2 = derivative(predictor, model);
    const next = {};
    Object.keys(state).forEach(key => {
      next[key] = state[key] + h * 0.5 * (k1[key] + k2[key]);
    });
    return next;
  }

  function rk4Step(state, h, model, derivative) {
    const k1 = derivative(state, model);
    const k2 = derivative(addScaledState(state, k1, h * 0.5), model);
    const k3 = derivative(addScaledState(state, k2, h * 0.5), model);
    const k4 = derivative(addScaledState(state, k3, h), model);
    const next = {};
    Object.keys(state).forEach(key => {
      next[key] = state[key] + h / 6 * (k1[key] + 2 * k2[key] + 2 * k3[key] + k4[key]);
    });
    return next;
  }

  function addScaledState(state, derivative, scale) {
    const next = {};
    Object.keys(state).forEach(key => {
      next[key] = state[key] + derivative[key] * scale;
    });
    return next;
  }

  function logisticNext(x, r) {
    return r * x * (1 - x);
  }

  function buildCobweb(points) {
    const path = [];
    for (let i = 0; i < points.length - 1; i++) {
      const x = points[i].x;
      const next = points[i + 1].x;
      if (i === 0) path.push({ x, y: 0 });
      path.push({ x, y: next });
      path.push({ x: next, y: next });
    }
    return path;
  }

  function buildLogisticBifurcation(model) {
    const points = [];
    const columns = [];
    const samples = model.bifurcationSamples;
    const keep = 90;
    const settle = Math.max(model.discard, 120);
    for (let i = 0; i < samples; i++) {
      const r = model.rMin + (model.rMax - model.rMin) * i / Math.max(samples - 1, 1);
      const column = [];
      let x = model.x0;
      for (let n = 0; n < settle + keep; n++) {
        x = logisticNext(x, r);
        if (n >= settle) {
          const point = { r, x, sampleIndex: i, keepIndex: n - settle, n };
          points.push(point);
          column.push(point);
        }
      }
      columns.push(column);
    }
    return { points, columns };
  }

  function buildLogisticOrbit(r, x0, iterations) {
    const points = [];
    let x = x0;
    for (let n = 0; n <= iterations; n++) {
      points.push({ t: n, n, x });
      x = logisticNext(x, r);
    }
    return points;
  }

  function logisticSweepR(t, model) {
    if (model.bifurcationMode !== "build") {
      const fraction = clamp((t - model.t0) / Math.max(model.t1 - model.t0, 1), 0, 1);
      return model.rMin + (model.rMax - model.rMin) * fraction;
    }
    return logisticRForSample(logisticBuildProgress(t, model).sampleIndex, model);
  }

  function logisticBifurcationVisiblePoints(result, model, t) {
    if (model.bifurcationMode !== "build") return result.bifurcation;
    const progress = logisticBuildProgress(t, model);
    const visible = result.bifurcationColumns.slice(0, progress.sampleIndex).flat();
    if (progress.keepIndex >= 0) {
      const currentColumn = result.bifurcationColumns[progress.sampleIndex] || [];
      visible.push(...currentColumn.filter(point => point.keepIndex <= progress.keepIndex));
    }
    return visible;
  }

  function logisticSweepSampleIndex(t, model) {
    return logisticBuildProgress(t, model).sampleIndex;
  }

  function logisticRForSample(sampleIndex, model) {
    return model.rMin + (model.rMax - model.rMin) * sampleIndex / Math.max(model.bifurcationSamples - 1, 1);
  }

  function logisticBuildProgress(t, model) {
    const cycle = Math.max(model.buildCycle || model.iterations, 1);
    const clamped = clamp(t - model.t0, 0, Math.max(model.t1 - model.t0, 0));
    const rawIndex = Math.floor(clamped / cycle);
    const sampleIndex = clamp(rawIndex, 0, model.bifurcationSamples - 1);
    const localN = clamp(Math.round(clamped - sampleIndex * cycle), 0, cycle);
    const displaySettle = Math.max(model.displaySettle || 1, 1);
    const displayKeep = Math.max(model.displayKeep || 1, 1);
    const settleFraction = clamp(localN / displaySettle, 0, 1);
    const keepFraction = clamp((localN - displaySettle) / displayKeep, 0, 1);
    const n = localN < displaySettle
      ? Math.round(model.discard * settleFraction)
      : Math.round(model.discard + (model.iterations - model.discard) * keepFraction);
    const keepIndex = localN >= displaySettle
      ? Math.floor((model.iterations - model.discard) * keepFraction)
      : -1;
    return {
      sampleIndex,
      localN,
      n,
      displaySettle,
      keepIndex,
      r: logisticRForSample(sampleIndex, model)
    };
  }

  function logisticDisplayR(t, model) {
    return model.bifurcationMode === "build" ? logisticBuildProgress(t, model).r : model.r;
  }

  function logisticDisplayOrbit(t, model) {
    const n = model.bifurcationMode === "build"
      ? logisticBuildProgress(t, model).n
      : clamp(Math.round(t), 0, model.iterations);
    const r = logisticDisplayR(t, model);
    return { r, points: buildLogisticOrbit(r, model.x0, n) };
  }

  function logisticMapCurve(r, samples = 200) {
    const curve = [];
    for (let i = 0; i <= samples; i++) {
      const x = i / samples;
      curve.push({ x, y: logisticNext(x, r) });
    }
    return curve;
  }

  function drawChaosPlots(model, result) {
    if (!window.Plotly) return;
    setChaosEnergyPlotVisible(model.type === "doublePendulum");
    if (model.type === "logisticMap") return drawLogisticPlots(model, result);
    if (model.type === "doublePendulum") return drawDoublePendulumPlots(model, result);
    if (model.type === "duffing") return drawDuffingPlots(model, result);
    if (model.type === "liouvilleFlow") return drawLiouvillePlots(model, result);
    return drawLorenzPlots(model, result);
  }

  function setChaosEnergyPlotVisible(visible) {
    const el = document.getElementById("chaosEnergyPlot");
    if (!el) return;
    el.classList.toggle("hidden", !visible);
    if (!visible && window.Plotly && el.data) window.Plotly.purge(el);
  }

  function drawLorenzPlots(model, result) {
    const t = result.points.map(point => point.t);
    const a = result.points.map(point => point.a);
    const b = result.points.map(point => point.b);
    const projection = lorenzPhaseProjection(model.phaseProjection);

    window.Plotly.newPlot("chaosPhasePlot", [
      phaseTrace(a, projection, "A full", "rgba(37, 99, 235, 0.16)", { width: 1.1, showlegend: false }),
      phaseTrace(b, projection, "B full", "rgba(220, 38, 38, 0.12)", { width: 1, showlegend: false }),
      phaseTrace([], projection, "A", "#2563eb", { width: 2.1 }),
      phaseTrace([], projection, "B", "#dc2626", { width: 1.7 }),
      markerTrace([], [], "A", "#2563eb"),
      markerTrace([], [], "B", "#dc2626")
    ], plotLayout(`${projection.x} vs ${projection.y}`, projection.x, projection.y), { responsive: true });

    window.Plotly.newPlot("chaosTimePlot", [
      timeTrace(t, a.map(point => point.x), "x_A full", "rgba(37, 99, 235, 0.14)", { width: 1, showlegend: false }),
      timeTrace(t, a.map(point => point.y), "y_A full", "rgba(14, 165, 233, 0.13)", { width: 1, showlegend: false }),
      timeTrace(t, a.map(point => point.z), "z_A full", "rgba(124, 58, 237, 0.13)", { width: 1, showlegend: false }),
      timeTrace([], [], "x_A", "#2563eb", { width: 1.9 }),
      timeTrace([], [], "y_A", "#0ea5e9", { width: 1.7 }),
      timeTrace([], [], "z_A", "#7c3aed", { width: 1.7 })
    ], plotLayout("Lorenz variables", "t", "state"), { responsive: true });

    window.Plotly.newPlot("chaosSeparationPlot", [
      timeTrace(t, result.points.map(point => Math.max(point.distance, 1e-12)), "|A-B| full", "rgba(249, 115, 22, 0.16)", { width: 1, showlegend: false }),
      timeTrace([], [], "|A-B|", "#f97316", { width: 2 })
    ], logPlotLayout("trajectory separation", "t", "distance"), { responsive: true });
  }

  function drawLogisticPlots(model, result) {
    const n = result.points.map(point => point.n);
    const xs = result.points.map(point => point.x);
    const visibleBifurcation = model.bifurcationMode === "build" ? [] : result.bifurcation;
    const curveX = [];
    const curveY = [];
    for (let i = 0; i <= 200; i++) {
      const x = i / 200;
      curveX.push(x);
      curveY.push(logisticNext(x, model.r));
    }
    window.Plotly.newPlot("chaosPhasePlot", [
      { x: curveX, y: curveY, mode: "lines", name: "f(x)", line: { color: "#2563eb", width: 2 } },
      { x: [0, 1], y: [0, 1], mode: "lines", name: "y=x", line: { color: "#64748b", width: 1.4, dash: "dot" } },
      { x: result.cobweb.map(point => point.x), y: result.cobweb.map(point => point.y), mode: "lines", name: "cobweb", line: { color: "#f97316", width: 1.4 } }
    ], plotLayout("cobweb diagram", "x_n", "x_{n+1}"), { responsive: true });

    window.Plotly.newPlot("chaosTimePlot", [
      timeTrace(n, xs, "x_n full", "rgba(37, 99, 235, 0.16)", { width: 1, showlegend: false }),
      timeTrace([], [], "x_n", "#2563eb", {
        width: 1.7,
        mode: "lines+markers",
        marker: { color: "#2563eb", size: 7, line: { color: "#ffffff", width: 1.2 } }
      })
    ], plotLayout("iteration time series", "n", "x_n"), { responsive: true });

    window.Plotly.newPlot("chaosSeparationPlot", [
      {
        type: "scattergl",
        x: [],
        y: [],
        mode: "markers",
        name: "background",
        marker: { color: "rgba(15, 23, 42, 0.12)", size: 2 },
        showlegend: false
      },
      {
        type: "scattergl",
        x: visibleBifurcation.map(point => point.r),
        y: visibleBifurcation.map(point => point.x),
        mode: "markers",
        name: model.bifurcationMode === "build" ? "building diagram" : "bifurcation",
        marker: { color: "rgba(15, 23, 42, 0.48)", size: 2 }
      },
      {
        x: [model.r, model.r],
        y: [0, 1],
        mode: "lines",
        name: "selected r",
        line: { color: "#dc2626", width: 2 }
      },
      {
        x: [null, null],
        y: [0, 1],
        mode: "lines",
        name: "canvas / sweep r",
        line: { color: "#f97316", width: 2, dash: "dot" },
        showlegend: model.bifurcationMode === "build"
      }
    ], logisticBifurcationLayout(model), { responsive: true });
  }

  function drawDoublePendulumPlots(model, result) {
    const t = result.points.map(point => point.t);
    const a = result.points.map(point => point.a);
    const b = result.points.map(point => point.b);
    const projection = doublePendulumPhaseProjection(model.phaseProjection);
    window.Plotly.newPlot("chaosPhasePlot", [
      { x: a.map(point => point[projection.x]), y: a.map(point => point[projection.y]), mode: "lines", name: "A full", line: { color: "rgba(37, 99, 235, 0.15)", width: 1 }, showlegend: false },
      { x: b.map(point => point[projection.x]), y: b.map(point => point[projection.y]), mode: "lines", name: "B full", line: { color: "rgba(220, 38, 38, 0.12)", width: 1 }, showlegend: false },
      { x: [], y: [], mode: "lines", name: "A", line: { color: "#2563eb", width: 2 } },
      { x: [], y: [], mode: "lines", name: "B", line: { color: "#dc2626", width: 1.6 } },
      markerTrace([], [], "A", "#2563eb"),
      markerTrace([], [], "B", "#dc2626")
    ], plotLayout("phase projection", projection.xLabel, projection.yLabel), { responsive: true });

    window.Plotly.newPlot("chaosTimePlot", [
      timeTrace(t, a.map(point => point.theta1), "\u03b8\u2081 A full", "rgba(37, 99, 235, 0.13)", { width: 1, showlegend: false }),
      timeTrace(t, a.map(point => point.theta2), "\u03b8\u2082 A full", "rgba(124, 58, 237, 0.13)", { width: 1, showlegend: false }),
      timeTrace(t, b.map(point => point.theta1), "\u03b8\u2081 B full", "rgba(220, 38, 38, 0.11)", { width: 1, showlegend: false }),
      timeTrace(t, b.map(point => point.theta2), "\u03b8\u2082 B full", "rgba(249, 115, 22, 0.11)", { width: 1, showlegend: false }),
      timeTrace([], [], "\u03b8\u2081 A", "#2563eb", { width: 1.9 }),
      timeTrace([], [], "\u03b8\u2082 A", "#7c3aed", { width: 1.8 }),
      timeTrace([], [], "\u03b8\u2081 B", "#dc2626", { width: 1.6 }),
      timeTrace([], [], "\u03b8\u2082 B", "#f97316", { width: 1.6 })
    ], plotLayout("angles over time: A and B", "t", "angle"), { responsive: true });

    window.Plotly.newPlot("chaosSeparationPlot", [
      timeTrace(t, result.points.map(point => Math.max(point.distance, 1e-12)), "tip separation full", "rgba(249, 115, 22, 0.16)", { width: 1, showlegend: false }),
      timeTrace([], [], "tip separation", "#f97316", { width: 2 })
    ], logPlotLayout("nearby-start separation", "t", "distance"), { responsive: true });

    drawDoublePendulumEnergyPlot(t, a, b, model);
  }

  function drawDoublePendulumEnergyPlot(t, statesA, statesB, model) {
    const energyA = statesA.map(state => doublePendulumEnergyParts(state, model));
    const energyB = statesB.map(state => doublePendulumEnergyParts(state, model));
    window.Plotly.newPlot("chaosEnergyPlot", [
      timeTrace(t, energyA.map(item => item.kinetic), "K<sub>A</sub> full", "rgba(37, 99, 235, 0.13)", { width: 1, showlegend: false }),
      timeTrace(t, energyB.map(item => item.kinetic), "K<sub>B</sub> full", "rgba(14, 165, 233, 0.12)", { width: 1, showlegend: false }),
      timeTrace(t, energyA.map(item => item.potential), "U<sub>A</sub> full", "rgba(249, 115, 22, 0.13)", { width: 1, showlegend: false }),
      timeTrace(t, energyB.map(item => item.potential), "U<sub>B</sub> full", "rgba(245, 158, 11, 0.12)", { width: 1, showlegend: false }),
      timeTrace(t, energyA.map(item => item.total), "E<sub>A</sub> full", "rgba(22, 163, 74, 0.16)", { width: 1, showlegend: false }),
      timeTrace(t, energyB.map(item => item.total), "E<sub>B</sub> full", "rgba(132, 204, 22, 0.13)", { width: 1, showlegend: false }),
      timeTrace([], [], "K<sub>A</sub>", "#2563eb", { width: 1.7 }),
      timeTrace([], [], "K<sub>B</sub>", "#0ea5e9", { width: 1.7 }),
      timeTrace([], [], "U<sub>A</sub>", "#f97316", { width: 1.7 }),
      timeTrace([], [], "U<sub>B</sub>", "#f59e0b", { width: 1.7 }),
      timeTrace([], [], "E<sub>A</sub>", "#16a34a", { width: 2.3 }),
      timeTrace([], [], "E<sub>B</sub>", "#84cc16", { width: 2.1 })
    ], bottomLegendLayout("double-pendulum mechanical energy", "t", "energy"), { responsive: true });
  }

  function drawDuffingPlots(model, result) {
    const t = result.points.map(point => point.t);
    const a = result.points.map(point => point.a);
    const b = result.points.map(point => point.b);
    const projection = { x: "q", y: "p" };

    window.Plotly.newPlot("chaosPhasePlot", [
      phaseTrace(a, projection, "A full", "rgba(37, 99, 235, 0.16)", { width: 1.1, showlegend: false }),
      phaseTrace(b, projection, "B full", "rgba(220, 38, 38, 0.12)", { width: 1, showlegend: false }),
      phaseTrace([], projection, "A", "#2563eb", { width: 2.1 }),
      phaseTrace([], projection, "B", "#dc2626", { width: 1.7 }),
      markerTrace([], [], "A", "#2563eb"),
      markerTrace([], [], "B", "#dc2626")
    ], plotLayout("Duffing phase projection", "q", "p"), { responsive: true });

    window.Plotly.newPlot("chaosTimePlot", [
      timeTrace(t, a.map(point => point.q), "q_A full", "rgba(37, 99, 235, 0.14)", { width: 1, showlegend: false }),
      timeTrace(t, a.map(point => point.p), "p_A full", "rgba(14, 165, 233, 0.13)", { width: 1, showlegend: false }),
      timeTrace([], [], "q_A", "#2563eb", { width: 1.9 }),
      timeTrace([], [], "p_A", "#0ea5e9", { width: 1.7 })
    ], plotLayout("Duffing variables", "t", "state"), { responsive: true });

    if (model.view === "periodDoubling" && result.bifurcation) {
      drawDuffingBifurcationPlot(model, result.bifurcation);
    } else {
      window.Plotly.newPlot("chaosSeparationPlot", [
        timeTrace(t, result.points.map(point => Math.max(point.distance, 1e-12)), "|A-B| full", "rgba(249, 115, 22, 0.16)", { width: 1, showlegend: false }),
        timeTrace([], [], "|A-B|", "#f97316", { width: 2 })
      ], logPlotLayout("nearby-start separation", "t", "distance"), { responsive: true });
    }
  }

  function drawDuffingBifurcationPlot(model, bifurcation) {
    const selectedColumn = duffingSelectedBifurcationColumn(model, bifurcation);
    const yRange = duffingBifurcationYRange(bifurcation.points);
    window.Plotly.newPlot("chaosSeparationPlot", [
      {
        type: "scattergl",
        x: [],
        y: [],
        mode: "markers",
        name: "built Poincare q",
        marker: { color: "rgba(15, 23, 42, 0.48)", size: 2 }
      },
      {
        type: "scattergl",
        x: [],
        y: [],
        mode: "markers",
        name: "current F samples",
        marker: { color: "rgba(249, 115, 22, 0.82)", size: 5 }
      },
      {
        x: [model.sweepMin, model.sweepMin],
        y: yRange,
        mode: "lines",
        name: "current sweep F",
        line: { color: "#f97316", width: 2 }
      },
      {
        x: [selectedColumn.F, selectedColumn.F],
        y: yRange,
        mode: "lines",
        name: "selected F",
        line: { color: "#dc2626", width: 1.6, dash: "dash" }
      }
    ], duffingBifurcationLayout(model, bifurcation), { responsive: true });
  }

  function drawLiouvillePlots(model, result) {
    const t = result.points.map(point => point.t);
    const areaRatio = result.points.map(point => Math.max(point.areaRatio, 1e-12));
    const volumeRatio = result.points.map(point => point.volumeRatio == null ? null : Math.max(point.volumeRatio, 1e-12));
    const hasVolume = volumeRatio.some(value => value != null);
    const energy = result.points.map(point => point.energyDelta);
    const initial = result.points[0]?.cloud || [];
    const projection = liouvilleProjection(model);
    const initialProjected = projectLiouvilleCloud(initial, model);
    const initialMesh = meshLineCoordinates(initialProjected, result.mesh?.edges || []);
    window.Plotly.newPlot("chaosPhasePlot", [
      {
        x: initialProjected.map(point => point.x),
        y: initialProjected.map(point => point.y),
        mode: "markers",
        name: "initial cloud",
        marker: { color: "rgba(100, 116, 139, 0.28)", size: 5 },
        showlegend: false
      },
      {
        x: [],
        y: [],
        mode: "markers",
        name: "cloud trail",
        marker: { color: "rgba(37, 99, 235, 0.16)", size: 3 },
        showlegend: false
      },
      {
        x: initialMesh.x,
        y: initialMesh.y,
        mode: "lines",
        name: "material mesh",
        line: { color: "rgba(249, 115, 22, 0.34)", width: 1 },
        showlegend: false
      },
      {
        x: [],
        y: [],
        mode: "markers",
        name: "current cloud",
        marker: { color: "#2563eb", size: 5 }
      },
      {
        x: [],
        y: [],
        mode: "lines",
        name: "outer hull (visual)",
        line: { color: "rgba(100, 116, 139, 0.7)", width: 1.4, dash: "dot" }
      }
    ], plotLayout("phase-cloud projection", projection.xLabel, projection.yLabel), { responsive: true });

    const areaLayout = dualAxisLayout("material area / local volume", "t", "projected area", "local 4D volume");
    areaLayout.yaxis.range = stableAwareRange(areaRatio, [0, 2], 0);
    areaLayout.yaxis2.range = stableAwareRange(volumeRatio.filter(value => value != null), [0, 2], 0);
    window.Plotly.newPlot("chaosTimePlot", [
      timeTrace(t, areaRatio, "projected material area full", "rgba(249, 115, 22, 0.16)", { width: 1, showlegend: false }),
      timeTrace([], [], "projected material area", "#f97316", { width: 2 }),
      timeTrace(hasVolume ? t : [], hasVolume ? volumeRatio : [], "local 4D volume (\u03b8,p) full", "rgba(37, 99, 235, 0.14)", { width: 1, showlegend: false, yaxis: "y2" }),
      timeTrace([], [], "local 4D volume (\u03b8,p)", "#2563eb", { width: 2, yaxis: "y2" })
    ], areaLayout, { responsive: true });

    const energyLayout = plotLayout(liouvilleEnergyTitle(model), "t", "\u0394E");
    energyLayout.yaxis.range = stableAwareRange(energy, stableDefaultRange(energy));
    window.Plotly.newPlot("chaosSeparationPlot", [
      timeTrace(t, energy, `${liouvilleEnergyTraceName(model)} full`, "rgba(37, 99, 235, 0.14)", { width: 1, showlegend: false }),
      timeTrace([], [], liouvilleEnergyTraceName(model), "#2563eb", { width: 2 })
    ], energyLayout, { responsive: true });
  }

  function drawChaosFrame(t, options = {}) {
    if (!currentResult || !currentModel) return;
    const canvas = document.getElementById("chaosCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const state = chaosStateAt(currentResult.points, t, currentModel);
    if (!canDragLorenz3D()) canvas.style.cursor = "default";
    if (currentModel.type === "logisticMap") drawLogisticCanvas(ctx, canvas.width, canvas.height, currentModel, currentResult, state);
    else if (currentModel.type === "doublePendulum") drawDoublePendulumCanvas(ctx, canvas.width, canvas.height, currentModel, currentResult, state);
    else if (currentModel.type === "duffing") drawDuffingCanvas(ctx, canvas.width, canvas.height, currentModel, currentResult, state);
    else if (currentModel.type === "liouvilleFlow") drawLiouvilleCanvas(ctx, canvas.width, canvas.height, currentModel, currentResult, state);
    else drawLorenzCanvas(ctx, canvas.width, canvas.height, currentModel, currentResult, state);
    updateChaosTimeControls(t);
    const now = window.performance ? window.performance.now() : Date.now();
    const shouldUpdatePlots = options.forcePlotUpdate || (isPlaying && now - lastPlotUpdateTime > 80);
    if (shouldUpdatePlots) {
      try {
        updateChaosPlotCursors(t, state);
      } catch (error) {
        const status = document.getElementById("chaosStatus");
        if (status) status.textContent = `Plot update skipped: ${error.message}`;
      }
      lastPlotUpdateTime = now;
    }
  }

  function drawLorenzCanvas(ctx, width, height, model, result, state) {
    const visible = result.points.filter(point => point.t <= state.t);
    const allStates = result.points.flatMap(point => [point.a, point.b]);
    const projected = allStates.map(point => projectLorenz3D(point, lorenzView));
    const bounds = bounds2D(projected, 0.08, 1);
    const map = makeProjectionMapper(bounds, width, height);

    ctx.canvas.style.cursor = lorenzView.dragging ? "grabbing" : "grab";
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    draw3DAxes(ctx, width, height, lorenzView, bounds, map);
    drawLorenz3DPath(ctx, result.points.map(point => point.a), lorenzView, bounds, map, "rgba(37, 99, 235,", 1.1);
    drawLorenz3DPath(ctx, result.points.map(point => point.b), lorenzView, bounds, map, "rgba(220, 38, 38,", 0.9);
    drawLorenz3DPath(ctx, visible.map(point => point.a), lorenzView, bounds, map, "rgba(37, 99, 235,", 2.1);
    drawLorenz3DPath(ctx, visible.map(point => point.b), lorenzView, bounds, map, "rgba(220, 38, 38,", 1.8);

    const a = map(projectLorenz3D(state.a, lorenzView));
    const b = map(projectLorenz3D(state.b, lorenzView));
    drawChaosPoint(ctx, a.x, a.y, "#2563eb", "A");
    drawChaosPoint(ctx, b.x, b.y, "#dc2626", "B");
    drawLorenzHud(ctx, state, "pseudo-3D");
  }

  function drawLorenzHud(ctx, state, viewLabel) {
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.strokeStyle = "rgba(148, 163, 184, 0.8)";
    ctx.lineWidth = 1;
    ctx.fillRect(16, 16, 314, 104);
    ctx.strokeRect(16, 16, 314, 104);
    ctx.fillStyle = "#0f172a";
    ctx.font = "12px Arial";
    ctx.fillText(`t=${formatChaosNumber(state.t)}  view ${viewLabel}`, 28, 38);
    ctx.fillText(`A: x=${formatChaosNumber(state.a.x)} y=${formatChaosNumber(state.a.y)} z=${formatChaosNumber(state.a.z)}`, 28, 58);
    ctx.fillText(`B: x=${formatChaosNumber(state.b.x)} y=${formatChaosNumber(state.b.y)} z=${formatChaosNumber(state.b.z)}`, 28, 78);
    ctx.fillText(`|A-B|=${formatChaosNumber(state.distance)}`, 28, 98);
  }

  function drawLogisticCanvas(ctx, width, height, model, result, state) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    if (model.bifurcationMode === "build") {
      const gap = 22;
      const leftWidth = Math.floor(width * 0.49);
      drawLogisticCobwebPanel(ctx, { x: 0, y: 0, width: leftWidth, height }, model, state);
      drawLogisticBifurcationPanel(ctx, {
        x: leftWidth + gap,
        y: 0,
        width: width - leftWidth - gap,
        height
      }, model, result, state);
      return;
    }
    drawLogisticCobwebPanel(ctx, { x: 0, y: 0, width, height }, model, state);
  }

  function drawLogisticCobwebPanel(ctx, rect, model, state) {
    const margin = { left: rect.x + 54, right: rect.x + rect.width - 34, top: rect.y + 28, bottom: rect.y + rect.height - 48 };
    const map = point => ({
      x: margin.left + point.x * (margin.right - margin.left),
      y: margin.bottom - point.y * (margin.bottom - margin.top)
    });
    const orbit = logisticDisplayOrbit(state.t, model);
    const displayState = orbit.points[orbit.points.length - 1] || state;
    const curve = logisticMapCurve(orbit.r, 220);
    const cobweb = buildCobweb(orbit.points);
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.strokeRect(margin.left, margin.top, margin.right - margin.left, margin.bottom - margin.top);
    drawPointPath(ctx, curve.map(map), "#2563eb", 2);
    drawPointPath(ctx, [{ x: 0, y: 0 }, { x: 1, y: 1 }].map(map), "rgba(100, 116, 139, 0.75)", 1.4, [5, 5]);
    drawPointPath(ctx, cobweb.map(map), "#f97316", 1.8);
    const current = map({ x: displayState.x, y: logisticNext(displayState.x, orbit.r) });
    drawChaosPoint(ctx, current.x, current.y, "#dc2626", "x");
    ctx.fillStyle = "#475569";
    ctx.font = "12px Arial";
    ctx.fillText("x_n", margin.right - 18, margin.bottom + 26);
    ctx.fillText("x_{n+1}", rect.x + 12, margin.top - 4);
    const hudLines = [
      `n=${displayState.n}`,
      `r=${formatChaosNumber(orbit.r)}  x=${formatChaosNumber(displayState.x)}`,
      `rule: x_next = r x (1-x)`
    ];
    if (model.bifurcationMode === "build") {
      const progress = logisticBuildProgress(state.t, model);
      hudLines.push(progress.keepIndex < 0 ? "transient: not plotted yet" : "long-run samples: plotted as dots");
    }
    drawSimpleHud(ctx, hudLines, rect.x + 16, rect.y + 16, Math.min(274, rect.width - 34), model.bifurcationMode === "build" ? 104 : 84);
  }

  function drawLogisticBifurcationPanel(ctx, rect, model, result, state) {
    const margin = { left: rect.x + 44, right: rect.x + rect.width - 22, top: rect.y + 28, bottom: rect.y + rect.height - 48 };
    const map = point => ({
      x: margin.left + (point.r - model.rMin) / Math.max(model.rMax - model.rMin, 1e-9) * (margin.right - margin.left),
      y: margin.bottom - point.x * (margin.bottom - margin.top)
    });
    const sampleIndex = logisticSweepSampleIndex(state.t, model);
    const visible = logisticBifurcationVisiblePoints(result, model, state.t);
    const progress = logisticBuildProgress(state.t, model);
    const stride = Math.max(1, Math.ceil(visible.length / 12000));

    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.strokeRect(margin.left, margin.top, margin.right - margin.left, margin.bottom - margin.top);

    LOGISTIC_PERIOD_DOUBLINGS.forEach(marker => {
      if (marker.r < model.rMin || marker.r > model.rMax) return;
      const x = map({ r: marker.r, x: 0 }).x;
      ctx.strokeStyle = "rgba(124, 58, 237, 0.38)";
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, margin.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#6d28d9";
      ctx.font = "10px Arial";
      ctx.fillText(marker.label, x + 3, margin.top + 12);
    });

    ctx.fillStyle = "rgba(15, 23, 42, 0.46)";
    visible.forEach((point, index) => {
      if (index % stride !== 0) return;
      const mapped = map(point);
      ctx.fillRect(mapped.x, mapped.y, 1.5, 1.5);
    });

    const sweepX = map({ r: logisticSweepR(state.t, model), x: 0 }).x;
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(sweepX, margin.top);
    ctx.lineTo(sweepX, margin.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#475569";
    ctx.font = "12px Arial";
    ctx.fillText("bifurcation: long-run x", margin.left, margin.top - 8);
    ctx.fillText("r", margin.right - 8, margin.bottom + 26);
    ctx.fillText("x", rect.x + 14, margin.top - 4);
    ctx.font = "11px Arial";
    const phaseText = progress.keepIndex < 0 ? "discarding transient" : "recording long-run x";
    ctx.fillText(`column ${sampleIndex + 1}/${model.bifurcationSamples}; n=${progress.n}; ${phaseText}`, margin.left, margin.bottom + 26);
  }

  function drawDoublePendulumCanvas(ctx, width, height, model, result, state) {
    const centerX = width * 0.5;
    const pivotY = height * 0.2;
    const scale = Math.min(width, height) * 0.23 / Math.max(model.l1, model.l2);
    const visible = result.points.filter(point => point.t <= state.t);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "rgba(15, 23, 42, 0.06)";
    ctx.beginPath();
    ctx.ellipse(centerX, pivotY + scale * (model.l1 + model.l2) * 0.92, scale * 1.25, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    drawDoublePendulumTrail(ctx, visible.map(point => point.a), model, centerX, pivotY, scale, "rgba(37, 99, 235, 0.24)");
    drawDoublePendulumTrail(ctx, visible.map(point => point.b), model, centerX, pivotY, scale, "rgba(220, 38, 38, 0.20)");
    drawDoublePendulumState(ctx, state.b, model, centerX, pivotY, scale, "rgba(220, 38, 38, 0.62)", "B");
    drawDoublePendulumState(ctx, state.a, model, centerX, pivotY, scale, "#2563eb", "A");
    drawSimpleHud(ctx, [
      `t=${formatChaosNumber(state.t)}  |A-B|=${formatChaosNumber(state.distance)}`,
      `\u03b8\u2081=${formatChaosNumber(state.a.theta1)}  \u03b8\u2082=${formatChaosNumber(state.a.theta2)}`,
      `\u03c9\u2081=${formatChaosNumber(state.a.omega1)}  \u03c9\u2082=${formatChaosNumber(state.a.omega2)}`
    ], 16, 16, 302, 84);
  }

  function drawLiouvilleCanvas(ctx, width, height, model, result, state) {
    const initial = projectLiouvilleCloud(result.points[0]?.cloud || [], model);
    const current = projectLiouvilleCloud(state.cloud, model);
    const bounds = result.phaseBounds;
    const map = makeProjectionMapper(bounds, width, height);
    const hull = convexHull(current);
    const initialHull = convexHull(initial);
    const projection = liouvilleProjection(model);
    const meshEdges = result.mesh?.edges || [];

    ctx.canvas.style.cursor = "default";
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    drawPhaseFrame(ctx, width, height, bounds, map, projection.xLabel, projection.yLabel);

    drawMappedPolygon(ctx, initialHull, map, "rgba(100, 116, 139, 0.28)", 1.4, [5, 5]);
    drawMappedPolygon(ctx, hull, map, "rgba(100, 116, 139, 0.62)", 1.4, [4, 5]);
    drawMappedMesh(ctx, current, meshEdges, map, "rgba(249, 115, 22, 0.36)", 1);
    drawMappedCloud(ctx, initial, map, "rgba(100, 116, 139, 0.18)", 2.6);
    drawMappedCloud(ctx, current, map, "rgba(37, 99, 235, 0.78)", 3.4);

    const hudLines = [
      `t=${formatChaosNumber(state.t)}  flow=${liouvilleFlowLabel(model.flow)}`,
      `Aproj/A0=${formatChaosNumber(state.areaRatio)}  dE=${formatChaosNumber(state.energyDelta)}`,
      `divergence=${formatChaosNumber(liouvilleDivergence(model))}`
    ];
    if (state.volumeRatio != null) hudLines.push(`V4(theta,p)/V0=${formatChaosNumber(state.volumeRatio)}`);
    drawSimpleHud(ctx, hudLines, 16, 16, 360, state.volumeRatio == null ? 84 : 104);
  }

  function drawDuffingCanvas(ctx, width, height, model, result, state) {
    ctx.canvas.style.cursor = "default";
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    if (model.view === "periodDoubling" && result.bifurcation) {
      const gap = 22;
      const leftWidth = Math.floor(width * 0.52);
      const progress = duffingSweepProgress(state.t, model, result.bifurcation);
      drawDuffingPoincareSourcePanel(ctx, { x: 0, y: 0, width: leftWidth, height }, model, result.bifurcation, progress);
      drawDuffingPoincarePanel(ctx, {
        x: leftWidth + gap,
        y: 0,
        width: width - leftWidth - gap,
        height
      }, model, result.bifurcation, state);
      return;
    }
    drawDuffingPotentialPanel(ctx, { x: 0, y: 0, width, height }, model, result, state);
  }

  function drawDuffingPotentialPanel(ctx, rect, model, result, state, bifurcation = null, activeColumn = null) {
    const selectedColumn = bifurcation ? { F: activeColumn?.[0]?.F ?? model.driveAmp, points: activeColumn || [] } : null;
    const qValues = result.points.flatMap(point => [point.a.q, point.b.q, -1.6, 1.6]);
    if (selectedColumn) qValues.push(...selectedColumn.points.map(point => point.q));
    const minQ = Math.min(...qValues) - 0.4;
    const maxQ = Math.max(...qValues) + 0.4;
    const samples = [];
    for (let i = 0; i <= 180; i++) {
      const q = minQ + (maxQ - minQ) * i / 180;
      samples.push({ q, v: duffingPotential(q, model) });
    }
    const minV = Math.min(...samples.map(point => point.v));
    const maxV = Math.max(...samples.map(point => point.v));
    const plot = { left: rect.x + 58, right: rect.x + rect.width - 36, top: rect.y + 36, bottom: rect.y + rect.height - 46 };
    const map = point => ({
      x: plot.left + (point.q - minQ) / Math.max(maxQ - minQ, 1e-9) * (plot.right - plot.left),
      y: plot.bottom - (point.v - minV) / Math.max(maxV - minV, 1e-9) * (plot.bottom - plot.top)
    });
    const particleA = map({ q: state.a.q, v: duffingPotential(state.a.q, model) });
    const particleB = map({ q: state.b.q, v: duffingPotential(state.b.q, model) });
    const drive = model.driveAmp * Math.cos(state.a.phi);

    ctx.strokeStyle = "#cbd5e1";
    ctx.strokeRect(plot.left, plot.top, plot.right - plot.left, plot.bottom - plot.top);
    drawPointPath(ctx, samples.map(map), "#2563eb", 2.2);
    if (selectedColumn) {
      const markerStride = Math.max(1, Math.ceil(selectedColumn.points.length / 34));
      ctx.fillStyle = "rgba(249, 115, 22, 0.48)";
      selectedColumn.points.forEach((point, index) => {
        if (index % markerStride !== 0) return;
        const marker = map({ q: point.q, v: duffingPotential(point.q, model) });
        ctx.beginPath();
        ctx.arc(marker.x, marker.y, 3.2, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    drawDuffingDriveArrow(ctx, particleA.x, particleA.y - 34, drive);
    drawChaosPoint(ctx, particleB.x, particleB.y, "#dc2626", "B");
    drawChaosPoint(ctx, particleA.x, particleA.y, "#2563eb", "A");
    ctx.fillStyle = "#475569";
    ctx.font = "12px Arial";
    ctx.fillText("q", plot.right - 6, plot.bottom + 24);
    ctx.fillText("V(q)", rect.x + 18, plot.top - 4);
    const hudLines = [
      `t=${formatChaosNumber(state.t)}  preset=${model.preset}`,
      `q=${formatChaosNumber(state.a.q)}  p=${formatChaosNumber(state.a.p)}`,
      `F cos(phi)=${formatChaosNumber(drive)}`
    ];
    if (bifurcation) hudLines.push(`orange dots: strobe samples q(kT), F=${formatChaosNumber(selectedColumn.F)}`);
    drawSimpleHud(ctx, hudLines, rect.x + 16, rect.y + 16, Math.min(324, rect.width - 34), bifurcation ? 104 : 84);
  }

  function drawDuffingPoincareSourcePanel(ctx, rect, model, bifurcation, progress) {
    const allPoints = bifurcation.points.length ? bifurcation.points : [{ q: -2, p: -2 }, { q: 2, p: 2 }];
    const qValues = allPoints.map(point => point.q).filter(value => isFinite(value));
    const pValues = allPoints.map(point => point.p).filter(value => isFinite(value));
    const qRange = paddedRange(qValues, [-2, 2], 0.18);
    const pRange = paddedRange(pValues, [-2, 2], 0.18);
    const latest = progress.activeColumn[progress.activeColumn.length - 1];
    const well = { left: rect.x + 58, right: rect.x + rect.width - 34, top: rect.y + 116, bottom: rect.y + 176 };
    const plot = { left: rect.x + 58, right: rect.x + rect.width - 34, top: rect.y + 214, bottom: rect.y + rect.height - 52 };
    const map = point => ({
      x: plot.left + (point.q - qRange[0]) / Math.max(qRange[1] - qRange[0], 1e-9) * (plot.right - plot.left),
      y: plot.bottom - (point.p - pRange[0]) / Math.max(pRange[1] - pRange[0], 1e-9) * (plot.bottom - plot.top)
    });

    drawDuffingStrobeWell(ctx, well, model, qRange, latest);

    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.strokeRect(plot.left, plot.top, plot.right - plot.left, plot.bottom - plot.top);

    drawPointPath(ctx, progress.activeColumn.map(map), "rgba(249, 115, 22, 0.35)", 1.2);
    progress.activeColumn.forEach(point => {
      const mapped = map(point);
      ctx.beginPath();
      ctx.arc(mapped.x, mapped.y, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(249, 115, 22, 0.82)";
      ctx.fill();
    });

    if (latest) {
      const mapped = map(latest);
      ctx.strokeStyle = "rgba(249, 115, 22, 0.42)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(mapped.x, mapped.y);
      ctx.lineTo(mapped.x, plot.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      drawChaosPoint(ctx, mapped.x, mapped.y, "#f97316", "q(kT)");
    }

    ctx.fillStyle = "#475569";
    ctx.font = "12px Arial";
    ctx.fillText("local Poincare section for one F", plot.left, plot.top - 8);
    ctx.fillText("q", plot.right - 6, plot.bottom + 24);
    ctx.fillText("p", rect.x + 18, plot.top - 4);
    drawSimpleHud(ctx, [
      `F=${formatChaosNumber(progress.F)}  column ${progress.sampleIndex + 1}/${progress.count}`,
      `orange points: (q(kT), p(kT))`,
      `right plot uses only their q coordinates`
    ], rect.x + 16, rect.y + 16, Math.min(332, rect.width - 34), 84);
  }

  function drawDuffingStrobeWell(ctx, rect, model, qRange, latest) {
    const samples = [];
    for (let i = 0; i <= 120; i++) {
      const q = qRange[0] + (qRange[1] - qRange[0]) * i / 120;
      samples.push({ q, v: duffingPotential(q, model) });
    }
    const vValues = samples.map(point => point.v);
    const vRange = paddedRange(vValues, [-1, 1], 0.16);
    const map = point => ({
      x: rect.left + (point.q - qRange[0]) / Math.max(qRange[1] - qRange[0], 1e-9) * (rect.right - rect.left),
      y: rect.bottom - (point.v - vRange[0]) / Math.max(vRange[1] - vRange[0], 1e-9) * (rect.bottom - rect.top)
    });

    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.strokeRect(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top);
    drawPointPath(ctx, samples.map(map), "#2563eb", 2);

    if (latest) {
      const ball = map({ q: latest.q, v: duffingPotential(latest.q, model) });
      ctx.strokeStyle = "rgba(249, 115, 22, 0.46)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(ball.x, rect.top);
      ctx.lineTo(ball.x, rect.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      drawChaosPoint(ctx, ball.x, ball.y, "#f97316", "q");
    }

    ctx.fillStyle = "#475569";
    ctx.font = "12px Arial";
    ctx.fillText("strobe snapshot on V(q)", rect.left, rect.top - 8);
  }

  function drawDuffingPoincarePanel(ctx, rect, model, bifurcation, state) {
    const yRange = duffingBifurcationYRange(bifurcation.points);
    const progress = duffingSweepProgress(state.t, model, bifurcation);
    const selectedColumn = duffingSelectedBifurcationColumn(model, bifurcation);
    const plot = { left: rect.x + 46, right: rect.x + rect.width - 24, top: rect.y + 36, bottom: rect.y + rect.height - 46 };
    const map = point => ({
      x: plot.left + (point.F - model.sweepMin) / Math.max(model.sweepMax - model.sweepMin, 1e-9) * (plot.right - plot.left),
      y: plot.bottom - (point.q - yRange[0]) / Math.max(yRange[1] - yRange[0], 1e-9) * (plot.bottom - plot.top)
    });
    const stride = Math.max(1, Math.ceil(progress.visiblePoints.length / 14000));

    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.strokeRect(plot.left, plot.top, plot.right - plot.left, plot.bottom - plot.top);
    ctx.fillStyle = "rgba(15, 23, 42, 0.48)";
    progress.visiblePoints.forEach((point, index) => {
      if (index % stride !== 0) return;
      const mapped = map(point);
      ctx.fillRect(mapped.x, mapped.y, 1.5, 1.5);
    });
    ctx.fillStyle = "rgba(249, 115, 22, 0.78)";
    progress.activeColumn.forEach(point => {
      const mapped = map(point);
      ctx.beginPath();
      ctx.arc(mapped.x, mapped.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    const activeX = map({ F: progress.F, q: yRange[0] }).x;
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(activeX, plot.top);
    ctx.lineTo(activeX, plot.bottom);
    ctx.stroke();

    const selectedX = map({ F: selectedColumn.F, q: yRange[0] }).x;
    ctx.strokeStyle = "rgba(220, 38, 38, 0.68)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(selectedX, plot.top);
    ctx.lineTo(selectedX, plot.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#475569";
    ctx.font = "12px Arial";
    ctx.fillText("Poincare samples: q(kT), once per drive period", plot.left, plot.top - 8);
    ctx.fillText("F", plot.right - 8, plot.bottom + 24);
    ctx.fillText("q", rect.x + 16, plot.top - 4);
    ctx.font = "11px Arial";
    ctx.fillText(`F column ${progress.sampleIndex + 1}/${progress.count}; samples ${progress.activeCount}/${progress.activeTotal}`, plot.left, plot.bottom + 24);
  }

  function drawDuffingDriveArrow(ctx, x, y, force) {
    const length = clamp(force * 42, -70, 70);
    ctx.strokeStyle = "#f97316";
    ctx.fillStyle = "#f97316";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + length, y);
    ctx.stroke();
    const direction = Math.sign(length) || 1;
    ctx.beginPath();
    ctx.moveTo(x + length, y);
    ctx.lineTo(x + length - direction * 9, y - 5);
    ctx.lineTo(x + length - direction * 9, y + 5);
    ctx.closePath();
    ctx.fill();
  }

  function drawPhaseFrame(ctx, width, height, bounds, map, xLabel, yLabel) {
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.strokeRect(44, 28, width - 78, height - 70);
    const x0 = clamp(0, bounds.minX, bounds.maxX);
    const y0 = clamp(0, bounds.minY, bounds.maxY);
    const horizontal = map({ x: bounds.minX, y: y0 });
    const horizontalEnd = map({ x: bounds.maxX, y: y0 });
    const vertical = map({ x: x0, y: bounds.minY });
    const verticalEnd = map({ x: x0, y: bounds.maxY });
    ctx.strokeStyle = "rgba(100, 116, 139, 0.35)";
    ctx.beginPath();
    ctx.moveTo(horizontal.x, horizontal.y);
    ctx.lineTo(horizontalEnd.x, horizontalEnd.y);
    ctx.moveTo(vertical.x, vertical.y);
    ctx.lineTo(verticalEnd.x, verticalEnd.y);
    ctx.stroke();
    ctx.fillStyle = "#475569";
    ctx.font = "12px Arial";
    ctx.fillText(xLabel, width - 40, height - 34);
    ctx.fillText(yLabel, 20, 34);
  }

  function drawMappedCloud(ctx, cloud, map, color, radius) {
    ctx.fillStyle = color;
    cloud.forEach(point => {
      const mapped = map({ x: point.x, y: point.y });
      ctx.beginPath();
      ctx.arc(mapped.x, mapped.y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawMappedMesh(ctx, cloud, edges, map, color, lineWidth) {
    if (!edges.length) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    edges.forEach(([aIndex, bIndex]) => {
      const a = cloud[aIndex];
      const b = cloud[bIndex];
      if (!a || !b) return;
      const start = map(a);
      const end = map(b);
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
    });
    ctx.stroke();
  }

  function drawMappedPolygon(ctx, points, map, color, lineWidth, dash = null) {
    if (points.length < 2) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(dash || []);
    ctx.beginPath();
    points.forEach((point, index) => {
      const mapped = map({ x: point.x, y: point.y });
      if (index === 0) ctx.moveTo(mapped.x, mapped.y);
      else ctx.lineTo(mapped.x, mapped.y);
    });
    const first = map({ x: points[0].x, y: points[0].y });
    ctx.lineTo(first.x, first.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawDoublePendulumState(ctx, state, model, centerX, pivotY, scale, color, label) {
    const p = doublePendulumPoints(state, model, centerX, pivotY, scale);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(centerX, pivotY);
    ctx.lineTo(p.x1, p.y1);
    ctx.lineTo(p.x2, p.y2);
    ctx.stroke();
    ctx.lineCap = "butt";
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(centerX, pivotY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x1, p.y1, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x2, p.y2, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "bold 12px Arial";
    ctx.fillText(label, p.x2 + 10, p.y2 - 8);
  }

  function drawDoublePendulumTrail(ctx, states, model, centerX, pivotY, scale, color) {
    if (states.length < 2) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    states.slice(-800).forEach((state, index) => {
      const p = doublePendulumPoints(state, model, centerX, pivotY, scale);
      if (index === 0) ctx.moveTo(p.x2, p.y2);
      else ctx.lineTo(p.x2, p.y2);
    });
    ctx.stroke();
  }

  function doublePendulumPoints(state, model, centerX, pivotY, scale) {
    const x1 = centerX + Math.sin(state.theta1) * model.l1 * scale;
    const y1 = pivotY + Math.cos(state.theta1) * model.l1 * scale;
    const x2 = x1 + Math.sin(state.theta2) * model.l2 * scale;
    const y2 = y1 + Math.cos(state.theta2) * model.l2 * scale;
    return { x1, y1, x2, y2 };
  }

  function stepChaosAnimation(timestamp) {
    if (!isPlaying || !currentModel) return;
    if (lastFrameTime == null) lastFrameTime = timestamp;
    const dt = Math.min((timestamp - lastFrameTime) / 1000, 0.08);
    lastFrameTime = timestamp;
    const speed = finiteOr(parseFloat(document.getElementById("chaosSpeed")?.value), 1);
    const multiplier = currentModel.type === "logisticMap"
      ? (currentModel.bifurcationMode === "build" ? 45 : 8)
      : (currentModel.type === "duffing" && currentModel.view === "periodDoubling" ? 0.75 : 1);
    animationT += dt * speed * multiplier;
    if (animationT > currentModel.t1) animationT = currentModel.t0;
    drawChaosFrame(animationT);
    animationFrameId = requestAnimationFrame(stepChaosAnimation);
  }

  function stopChaosAnimation() {
    isPlaying = false;
    const play = document.getElementById("chaosPlayBtn");
    if (play) play.textContent = "Play";
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
    lastFrameTime = null;
  }

  function updateChaosTimeControls(t) {
    if (!currentModel) return;
    const slider = document.getElementById("chaosTimeSlider");
    if (slider) slider.value = String(clamp((t - currentModel.t0) / (currentModel.t1 - currentModel.t0 || 1), 0, 1));
    const label = document.getElementById("chaosTimeLabel");
    if (label) {
      if (currentModel.type === "logisticMap" && currentModel.bifurcationMode === "build") {
        const progress = logisticBuildProgress(t, currentModel);
        label.textContent = `r column ${progress.sampleIndex + 1}/${currentModel.bifurcationSamples}  n=${progress.n}  r=${formatChaosNumber(progress.r)}`;
      } else if (currentModel.type === "duffing" && currentModel.view === "periodDoubling" && currentResult?.bifurcation) {
        const progress = duffingSweepProgress(t, currentModel, currentResult.bifurcation);
        label.textContent = `F column ${progress.sampleIndex + 1}/${progress.count}  q(kT) samples ${progress.activeCount}/${progress.activeTotal}  F=${formatChaosNumber(progress.F)}`;
      } else {
        label.textContent = currentModel.type === "logisticMap" ? `n=${Math.round(t)}` : `t=${formatChaosNumber(t)}`;
      }
    }
  }

  function updateChaosPlotCursors(t, state) {
    if (!window.Plotly || !currentModel || !currentResult) return;
    if (currentModel.type === "logisticMap") {
      const n = currentModel.bifurcationMode === "build" ? logisticBuildProgress(t, currentModel).localN : Math.round(t);
      relayoutIfReady("chaosTimePlot", { shapes: [verticalShape(n)] });
      updateLogisticIterationProgress(t);
      updateLogisticBifurcationProgress(t);
      relayoutIfReady("chaosEnergyPlot", { shapes: [] });
      return;
    }
    relayoutIfReady("chaosTimePlot", { shapes: [verticalShape(t)] });
    relayoutIfReady("chaosSeparationPlot", {
      shapes: currentModel.type === "duffing" && currentModel.view === "periodDoubling" ? [] : [verticalShape(t)]
    });
    relayoutIfReady("chaosEnergyPlot", { shapes: [verticalShape(t)] });
    if (currentModel.type === "doublePendulum") {
      updateDoublePendulumPlotProgress(t, state);
      return;
    }
    if (currentModel.type === "duffing") {
      updateDuffingPlotProgress(t, state);
      return;
    }
    if (currentModel.type === "liouvilleFlow") {
      updateLiouvillePlotProgress(t, state);
      return;
    }
    updateLorenzPlotProgress(t, state);
  }

  function updateLogisticBifurcationProgress(t) {
    const progress = logisticBuildProgress(t, currentModel);
    const sampleIndex = progress.sampleIndex;
    const sweepR = logisticSweepR(t, currentModel);
    const shouldUpdatePoints = currentModel.bifurcationMode === "build"
      && (
        sampleIndex !== logisticBifurcationCache.sampleIndex
        || progress.keepIndex !== logisticBifurcationCache.keepIndex
        || logisticBifurcationCache.mode !== currentModel.bifurcationMode
      );
    if (shouldUpdatePoints) {
      const visible = logisticBifurcationVisiblePoints(currentResult, currentModel, t);
      restyleIfReady("chaosSeparationPlot", {
        x: [visible.map(point => point.r)],
        y: [visible.map(point => point.x)]
      }, [1]);
      logisticBifurcationCache = { sampleIndex, keepIndex: progress.keepIndex, mode: currentModel.bifurcationMode };
    }
    restyleIfReady("chaosSeparationPlot", {
      x: [[currentModel.r, currentModel.r]],
      y: [[0, 1]]
    }, [2]);
    restyleIfReady("chaosSeparationPlot", {
      x: currentModel.bifurcationMode === "build" ? [[sweepR, sweepR]] : [[null, null]],
      y: [[0, 1]]
    }, [3]);
  }

  function updateLogisticIterationProgress(t) {
    const orbit = logisticDisplayOrbit(t, currentModel);
    const curve = logisticMapCurve(orbit.r);
    const cobweb = buildCobweb(orbit.points);
    restyleIfReady("chaosPhasePlot", {
      x: [curve.map(point => point.x), cobweb.map(point => point.x)],
      y: [curve.map(point => point.y), cobweb.map(point => point.y)]
    }, [0, 2]);
    restyleIfReady("chaosTimePlot", {
      x: [orbit.points.map(point => point.n)],
      y: [orbit.points.map(point => point.x)]
    }, [1]);
  }

  function updateLorenzPlotProgress(t, state) {
    const history = pairHistoryUntil(currentResult.points, t, state);
    const a = history.map(point => point.a);
    const b = history.map(point => point.b);
    const times = history.map(point => point.t);
    const projection = lorenzPhaseProjection(currentModel.phaseProjection);
    const currentA = projectedPoint(state.a, projection);
    const currentB = projectedPoint(state.b, projection);

    restyleIfReady("chaosPhasePlot", {
      x: [a.map(point => point[projection.x]), b.map(point => point[projection.x]), [currentA.x], [currentB.x]],
      y: [a.map(point => point[projection.y]), b.map(point => point[projection.y]), [currentA.y], [currentB.y]]
    }, [2, 3, 4, 5]);

    restyleIfReady("chaosTimePlot", {
      x: [times, times, times],
      y: [a.map(point => point.x), a.map(point => point.y), a.map(point => point.z)]
    }, [3, 4, 5]);

    restyleIfReady("chaosSeparationPlot", {
      x: [times],
      y: [history.map(point => Math.max(point.distance, 1e-12))]
    }, [1]);
  }

  function updateDoublePendulumPlotProgress(t, state) {
    const history = pairHistoryUntil(currentResult.points, t, state);
    const a = history.map(point => point.a);
    const b = history.map(point => point.b);
    const times = history.map(point => point.t);
    const projection = doublePendulumPhaseProjection(currentModel.phaseProjection);

    restyleIfReady("chaosPhasePlot", {
      x: [a.map(point => point[projection.x]), b.map(point => point[projection.x]), [state.a[projection.x]], [state.b[projection.x]]],
      y: [a.map(point => point[projection.y]), b.map(point => point[projection.y]), [state.a[projection.y]], [state.b[projection.y]]]
    }, [2, 3, 4, 5]);

    restyleIfReady("chaosTimePlot", {
      x: [times, times, times, times],
      y: [
        a.map(point => point.theta1),
        a.map(point => point.theta2),
        b.map(point => point.theta1),
        b.map(point => point.theta2)
      ]
    }, [4, 5, 6, 7]);

    restyleIfReady("chaosSeparationPlot", {
      x: [times],
      y: [history.map(point => Math.max(point.distance, 1e-12))]
    }, [1]);

    const energyA = a.map(point => doublePendulumEnergyParts(point, currentModel));
    const energyB = b.map(point => doublePendulumEnergyParts(point, currentModel));
    restyleIfReady("chaosEnergyPlot", {
      x: [times, times, times, times, times, times],
      y: [
        energyA.map(item => item.kinetic),
        energyB.map(item => item.kinetic),
        energyA.map(item => item.potential),
        energyB.map(item => item.potential),
        energyA.map(item => item.total),
        energyB.map(item => item.total)
      ]
    }, [6, 7, 8, 9, 10, 11]);
  }

  function updateDuffingPlotProgress(t, state) {
    const history = pairHistoryUntil(currentResult.points, t, state);
    const a = history.map(point => point.a);
    const b = history.map(point => point.b);
    const times = history.map(point => point.t);

    restyleIfReady("chaosPhasePlot", {
      x: [a.map(point => point.q), b.map(point => point.q), [state.a.q], [state.b.q]],
      y: [a.map(point => point.p), b.map(point => point.p), [state.a.p], [state.b.p]]
    }, [2, 3, 4, 5]);

    restyleIfReady("chaosTimePlot", {
      x: [times, times],
      y: [a.map(point => point.q), a.map(point => point.p)]
    }, [2, 3]);

    if (currentModel.view === "periodDoubling") {
      updateDuffingBifurcationProgress(t);
      return;
    }

    restyleIfReady("chaosSeparationPlot", {
      x: [times],
      y: [history.map(point => Math.max(point.distance, 1e-12))]
    }, [1]);
  }

  function updateDuffingBifurcationProgress(t) {
    const bifurcation = currentResult.bifurcation;
    if (!bifurcation) return;
    const progress = duffingSweepProgress(t, currentModel, bifurcation);
    const yRange = duffingBifurcationYRange(bifurcation.points);
    restyleIfReady("chaosSeparationPlot", {
      x: [
        progress.visiblePoints.map(point => point.F),
        progress.activeColumn.map(point => point.F),
        [progress.F, progress.F],
        [duffingSelectedBifurcationColumn(currentModel, bifurcation).F, duffingSelectedBifurcationColumn(currentModel, bifurcation).F]
      ],
      y: [
        progress.visiblePoints.map(point => point.q),
        progress.activeColumn.map(point => point.q),
        yRange,
        yRange
      ]
    }, [0, 1, 2, 3]);
  }

  function updateLiouvillePlotProgress(t, state) {
    const history = scalarHistoryUntil(currentResult.points, t, state);
    const current = projectLiouvilleCloud(state.cloud, currentModel);
    const trail = liouvilleCloudTrail(currentResult.points, t, state, currentModel);
    const mesh = meshLineCoordinates(current, currentResult.mesh?.edges || []);
    const hull = closePolygon(convexHull(current));
    restyleIfReady("chaosPhasePlot", {
      x: [
        trail.map(point => point.x),
        mesh.x,
        current.map(point => point.x),
        hull.map(point => point.x)
      ],
      y: [
        trail.map(point => point.y),
        mesh.y,
        current.map(point => point.y),
        hull.map(point => point.y)
      ]
    }, [1, 2, 3, 4]);

    restyleIfReady("chaosTimePlot", {
      x: [history.map(point => point.t)],
      y: [history.map(point => point.areaRatio)]
    }, [1]);
    if (state.volumeRatio != null) {
      restyleIfReady("chaosTimePlot", {
        x: [history.map(point => point.t)],
        y: [history.map(point => point.volumeRatio)]
      }, [3]);
    }

    restyleIfReady("chaosSeparationPlot", {
      x: [history.map(point => point.t)],
      y: [history.map(point => point.energyDelta)]
    }, [1]);
  }

  function pairHistoryUntil(points, t, state) {
    const history = points.filter(point => point.t < t);
    if (state) history.push(state);
    return history;
  }

  function scalarHistoryUntil(points, t, state) {
    const history = points.filter(point => point.t < t).map(point => ({
      t: point.t,
      areaRatio: point.areaRatio,
      volumeRatio: point.volumeRatio,
      energy: point.energy,
      energyDelta: point.energyDelta,
      meanEnergyDelta: point.meanEnergyDelta
    }));
    if (state) history.push({
      t: state.t,
      areaRatio: state.areaRatio,
      volumeRatio: state.volumeRatio,
      energy: state.energy,
      energyDelta: state.energyDelta,
      meanEnergyDelta: state.meanEnergyDelta
    });
    return history;
  }

  function liouvilleCloudTrail(points, t, state, model) {
    const frames = points.filter(point => point.t < t);
    if (state) frames.push(state);
    if (!frames.length) return [];
    const frameStride = Math.max(1, Math.ceil(frames.length / 24));
    const sampleFrames = frames.filter((_, index) => index % frameStride === 0).slice(-24);
    const trail = [];
    sampleFrames.forEach(frame => {
      const cloud = frame.cloud || [];
      const pointStride = Math.max(1, Math.ceil(cloud.length / 80));
      cloud.forEach((point, index) => {
        if (index % pointStride === 0) trail.push(projectLiouvillePoint(point, model));
      });
    });
    return trail.slice(-1200);
  }

  function chaosStateAt(points, t, model) {
    if (model.type === "logisticMap") {
      if (model.bifurcationMode === "build") {
        const orbit = logisticDisplayOrbit(t, model);
        const point = orbit.points[orbit.points.length - 1] || { n: 0, x: model.x0 };
        return { ...point, t };
      }
      const index = clamp(Math.round(t), 0, points.length - 1);
      return points[index];
    }
    if (model.type === "liouvilleFlow") return interpolateLiouvilleFrame(points, t);
    return interpolatePairPoint(points, t);
  }

  function interpolateLiouvilleFrame(points, t) {
    if (!points.length) return null;
    if (t <= points[0].t) return points[0];
    if (t >= points[points.length - 1].t) return points[points.length - 1];
    let low = 0;
    let high = points.length - 1;
    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2);
      if (points[mid].t <= t) low = mid;
      else high = mid;
    }
    const a = points[low];
    const b = points[high];
    const f = (t - a.t) / (b.t - a.t || 1);
    const cloud = a.cloud.map((point, index) => lerpObject(point, b.cloud[index], f));
    if (currentModel.flow === "driven" || currentModel.flow === "duffing") cloud.forEach(point => {
      point.phi = normalizePhase(point.phi);
    });
    const area = cloudArea(cloud, currentModel, currentResult.mesh);
    return {
      t,
      cloud,
      area,
      areaRatio: area / Math.max(cloudArea(points[0].cloud, currentModel, currentResult.mesh), 1e-12),
      volumeRatio: interpolateNumber(a.volumeRatio, b.volumeRatio, f),
      energy: meanLiouvilleEnergy(cloud, currentModel),
      energyDelta: interpolateNumber(a.energyDelta, b.energyDelta, f),
      meanEnergyDelta: interpolateNumber(a.meanEnergyDelta, b.meanEnergyDelta, f),
      centroid: cloudCentroid(cloud, currentModel)
    };
  }

  function interpolatePairPoint(points, t) {
    if (!points.length) return null;
    if (t <= points[0].t) return points[0];
    if (t >= points[points.length - 1].t) return points[points.length - 1];
    let low = 0;
    let high = points.length - 1;
    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2);
      if (points[mid].t <= t) low = mid;
      else high = mid;
    }
    const a = points[low];
    const b = points[high];
    const f = (t - a.t) / (b.t - a.t || 1);
    return {
      t,
      a: lerpObject(a.a, b.a, f),
      b: lerpObject(a.b, b.b, f),
      distance: a.distance + (b.distance - a.distance) * f
    };
  }

  function lerpObject(a, b, f) {
    const result = {};
    Object.keys(a).forEach(key => {
      result[key] = a[key] + (b[key] - a[key]) * f;
    });
    return result;
  }

  function interpolateNumber(a, b, f) {
    if (a == null || b == null) return null;
    return a + (b - a) * f;
  }

  function projectLorenz3D(point, view) {
    const cy = Math.cos(view.yaw);
    const sy = Math.sin(view.yaw);
    const cp = Math.cos(view.pitch);
    const sp = Math.sin(view.pitch);
    const xYaw = point.x * cy - point.y * sy;
    const depthYaw = point.x * sy + point.y * cy;
    const y = point.z * cp - depthYaw * sp;
    const depth = point.z * sp + depthYaw * cp;
    const x = xYaw;
    return { x, y, depth };
  }

  function drawLorenz3DPath(ctx, points, view, bounds, map, colorPrefix, lineWidth) {
    if (!points.length) return;
    const projected = points.map(point => projectLorenz3D(point, view));
    for (let i = 1; i < projected.length; i++) {
      const a = map(projected[i - 1]);
      const b = map(projected[i]);
      const depthAlpha = clamp(0.22 + (projected[i].depth - bounds.minDepth) / Math.max(bounds.maxDepth - bounds.minDepth, 1e-9) * 0.68, 0.18, 0.92);
      ctx.strokeStyle = `${colorPrefix} ${depthAlpha})`;
      ctx.lineWidth = lineWidth * (0.75 + depthAlpha * 0.55);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  function draw3DAxes(ctx, width, height, view, bounds, map) {
    const origin = map(projectLorenz3D({ x: 0, y: 0, z: 0 }, view));
    const axes = [
      { label: "x", color: "#64748b", end: { x: 22, y: 0, z: 0 } },
      { label: "y", color: "#94a3b8", end: { x: 0, y: 22, z: 0 } },
      { label: "z", color: "#475569", end: { x: 0, y: 0, z: 42 } }
    ];
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.strokeRect(44, 28, width - 78, height - 70);
    axes.forEach(axis => {
      const end = map(projectLorenz3D(axis.end, view));
      ctx.strokeStyle = axis.color;
      ctx.fillStyle = axis.color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.font = "12px Arial";
      ctx.fillText(axis.label, end.x + 5, end.y - 5);
    });
  }

  function drawPointPath(ctx, points, color, lineWidth, dash = null) {
    if (points.length < 2) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(dash || []);
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawChaosPoint(ctx, x, y, color, label) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "bold 12px Arial";
    ctx.fillText(label, x + 7, y - 7);
  }

  function drawSimpleHud(ctx, lines, x, y, width, height) {
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.strokeStyle = "rgba(148, 163, 184, 0.8)";
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);
    ctx.fillStyle = "#0f172a";
    ctx.font = "12px Arial";
    lines.forEach((line, index) => ctx.fillText(line, x + 12, y + 22 + index * 20));
  }

  function projectionAxes(value) {
    if (value === "x-y") return { x: "x", y: "y" };
    if (value === "y-z") return { x: "y", y: "z" };
    return { x: "x", y: "z" };
  }

  function lorenzPhaseProjection(value) {
    return projectionAxes(value);
  }

  function doublePendulumPhaseProjection(value) {
    const projections = {
      "theta2-omega2": { x: "theta2", y: "omega2", xLabel: "\u03b8\u2082", yLabel: "\u03c9\u2082" },
      "theta1-theta2": { x: "theta1", y: "theta2", xLabel: "\u03b8\u2081", yLabel: "\u03b8\u2082" },
      "theta1-omega2": { x: "theta1", y: "omega2", xLabel: "\u03b8\u2081", yLabel: "\u03c9\u2082" },
      "theta2-omega1": { x: "theta2", y: "omega1", xLabel: "\u03b8\u2082", yLabel: "\u03c9\u2081" },
      "omega1-omega2": { x: "omega1", y: "omega2", xLabel: "\u03c9\u2081", yLabel: "\u03c9\u2082" }
    };
    return projections[value] || { x: "theta1", y: "omega1", xLabel: "\u03b8\u2081", yLabel: "\u03c9\u2081" };
  }

  function projectedPoint(point, projection) {
    return { x: point[projection.x], y: point[projection.y] };
  }

  function bounds2D(points, padFraction, minPad) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minDepth = Infinity;
    let maxDepth = -Infinity;
    points.forEach(point => {
      if (!isFinite(point.x) || !isFinite(point.y)) return;
      const depth = isFinite(point.depth) ? point.depth : 0;
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
      minDepth = Math.min(minDepth, depth);
      maxDepth = Math.max(maxDepth, depth);
    });
    if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) {
      minX = -1;
      maxX = 1;
      minY = -1;
      maxY = 1;
      minDepth = 0;
      maxDepth = 0;
    }
    const padX = Math.max((maxX - minX) * padFraction, minPad);
    const padY = Math.max((maxY - minY) * padFraction, minPad);
    return {
      minX: minX - padX,
      maxX: maxX + padX,
      minY: minY - padY,
      maxY: maxY + padY,
      minDepth,
      maxDepth
    };
  }

  function makeProjectionMapper(bounds, width, height) {
    const left = 44;
    const right = width - 34;
    const top = 28;
    const bottom = height - 42;
    return point => ({
      x: left + (point.x - bounds.minX) / Math.max(bounds.maxX - bounds.minX, 1e-9) * (right - left),
      y: bottom - (point.y - bounds.minY) / Math.max(bounds.maxY - bounds.minY, 1e-9) * (bottom - top)
    });
  }

  function doublePendulumDistance(a, b, model) {
    const pa = doublePendulumPoints(a, model, 0, 0, 1);
    const pb = doublePendulumPoints(b, model, 0, 0, 1);
    return Math.hypot(pa.x2 - pb.x2, pa.y2 - pb.y2);
  }

  function stateDistance3(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  }

  function generateLiouvilleInitial(model) {
    const generated = generateLiouvilleCloud(model);
    return {
      cloud: generated.cloud,
      mesh: generated.mesh,
      volumeProbe: generateLiouvilleVolumeProbe(model)
    };
  }

  function generateLiouvilleCloud(model) {
    const points = [];
    const side = Math.max(5, Math.ceil(Math.sqrt(model.cloudCount / 0.72)));
    const grid = Array.from({ length: side }, () => Array(side).fill(-1));
    for (let row = 0; row < side; row++) {
      const v = side === 1 ? 0 : row / (side - 1) * 2 - 1;
      for (let col = 0; col < side; col++) {
        const u = side === 1 ? 0 : col / (side - 1) * 2 - 1;
        if (u * u + v * v > 1) continue;
        grid[row][col] = points.length;
        points.push(liouvilleDiskPoint(model, u, v));
      }
    }
    return { cloud: points, mesh: buildGridMesh(grid) };
  }

  function liouvilleDiskPoint(model, u, v) {
    if (model.flow === "doublePendulum") {
      const base = model.doublePendulum;
      return {
        theta1: base.theta1 + model.radius * u,
        theta2: base.theta2 + 0.35 * model.radius * v,
        omega1: base.omega1 + model.radius * v,
        omega2: base.omega2 + 0.35 * model.radius * u
      };
    }
    const base = model.flow === "duffing" ? { q: 0.2, p: 0 } : { q: 1, p: 0 };
    return {
      q: base.q + model.radius * u,
      p: base.p + model.radius * v * (model.flow === "duffing" ? 1 : model.omega),
      phi: 0
    };
  }

  function buildGridMesh(grid) {
    const edges = [];
    const triangles = [];
    const edgeSet = new Set();
    const addEdge = (a, b) => {
      if (a < 0 || b < 0 || a === b) return;
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (edgeSet.has(key)) return;
      edgeSet.add(key);
      edges.push(a < b ? [a, b] : [b, a]);
    };
    for (let row = 0; row < grid.length - 1; row++) {
      for (let col = 0; col < grid[row].length - 1; col++) {
        const a = grid[row][col];
        const b = grid[row][col + 1];
        const c = grid[row + 1][col];
        const d = grid[row + 1][col + 1];
        if (a >= 0 && b >= 0) addEdge(a, b);
        if (a >= 0 && c >= 0) addEdge(a, c);
        if (b >= 0 && d >= 0) addEdge(b, d);
        if (c >= 0 && d >= 0) addEdge(c, d);
        if (a >= 0 && b >= 0 && c >= 0) {
          triangles.push([a, b, c]);
          addEdge(b, c);
        }
        if (b >= 0 && c >= 0 && d >= 0) {
          triangles.push([b, d, c]);
          addEdge(b, c);
        }
      }
    }
    return { edges, triangles };
  }

  function generateLiouvilleVolumeProbe(model) {
    if (model.flow !== "doublePendulum") return null;
    const base = model.doublePendulum;
    const eps = Math.max(model.radius * 0.04, 1e-4);
    return [
      { theta1: base.theta1, theta2: base.theta2, omega1: base.omega1, omega2: base.omega2 },
      { theta1: base.theta1 + eps, theta2: base.theta2, omega1: base.omega1, omega2: base.omega2 },
      { theta1: base.theta1, theta2: base.theta2 + eps, omega1: base.omega1, omega2: base.omega2 },
      { theta1: base.theta1, theta2: base.theta2, omega1: base.omega1 + eps, omega2: base.omega2 },
      { theta1: base.theta1, theta2: base.theta2, omega1: base.omega1, omega2: base.omega2 + eps }
    ];
  }

  function cloudCentroid(cloud, model) {
    const projected = projectLiouvilleCloud(cloud, model);
    const sum = projected.reduce((acc, point) => ({
      q: acc.q + point.x,
      p: acc.p + point.y
    }), { q: 0, p: 0 });
    const n = Math.max(cloud.length, 1);
    return { q: sum.q / n, p: sum.p / n };
  }

  function meanLiouvilleEnergy(cloud, model) {
    if (!cloud.length) return 0;
    if (model.flow === "duffing") return meanDuffingEnergy(cloud, model.duffing);
    if (model.flow === "doublePendulum") return meanDoublePendulumEnergy(cloud, model.doublePendulum);
    const total = cloud.reduce((sum, point) => (
      sum + 0.5 * (point.p * point.p + model.omega * model.omega * point.q * point.q)
    ), 0);
    return total / cloud.length;
  }

  function cloudArea(cloud, model, mesh = null) {
    const projected = projectLiouvilleCloud(cloud, model);
    if (mesh?.triangles?.length) return meshProjectedArea(projected, mesh.triangles);
    return polygonArea(convexHull(projected));
  }

  function meshProjectedArea(projected, triangles) {
    return triangles.reduce((sum, triangle) => {
      const a = projected[triangle[0]];
      const b = projected[triangle[1]];
      const c = projected[triangle[2]];
      if (!a || !b || !c) return sum;
      return sum + Math.abs(cross2D(a, b, c)) * 0.5;
    }, 0);
  }

  function meshLineCoordinates(projected, edges) {
    const x = [];
    const y = [];
    const stride = Math.max(1, Math.ceil(edges.length / 1600));
    edges.forEach(([aIndex, bIndex], index) => {
      if (index % stride !== 0) return;
      const a = projected[aIndex];
      const b = projected[bIndex];
      if (!a || !b) return;
      x.push(a.x, b.x, null);
      y.push(a.y, b.y, null);
    });
    return { x, y };
  }

  function localPhaseVolume(probe, model) {
    if (!probe || model.flow !== "doublePendulum" || probe.length < 5) return null;
    const canonicalProbe = probe.map(point => doublePendulumCanonicalState(point, model.doublePendulum));
    const origin = canonicalProbe[0];
    const keys = ["theta1", "theta2", "p1", "p2"];
    const matrix = keys.map(key => (
      [1, 2, 3, 4].map(index => canonicalProbe[index][key] - origin[key])
    ));
    return Math.abs(determinant4(matrix));
  }

  function doublePendulumCanonicalState(state, model) {
    const delta = state.theta1 - state.theta2;
    const cosDelta = Math.cos(delta);
    return {
      theta1: state.theta1,
      theta2: state.theta2,
      p1: (model.m1 + model.m2) * model.l1 * model.l1 * state.omega1
        + model.m2 * model.l1 * model.l2 * state.omega2 * cosDelta,
      p2: model.m2 * model.l2 * model.l2 * state.omega2
        + model.m2 * model.l1 * model.l2 * state.omega1 * cosDelta
    };
  }

  function determinant4(m) {
    let det = 0;
    for (let col = 0; col < 4; col++) {
      const minor = [];
      for (let row = 1; row < 4; row++) {
        const values = [];
        for (let c = 0; c < 4; c++) {
          if (c !== col) values.push(m[row][c]);
        }
        minor.push(values);
      }
      det += (col % 2 === 0 ? 1 : -1) * m[0][col] * determinant3(minor);
    }
    return det;
  }

  function determinant3(m) {
    return (
      m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
      - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
      + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
    );
  }

  function projectLiouvilleCloud(cloud, model) {
    return cloud.map(point => projectLiouvillePoint(point, model));
  }

  function projectLiouvillePoint(point, model) {
    if (model.flow === "doublePendulum") {
      const projection = doublePendulumPhaseProjection(model.doublePendulum.projection);
      return { x: point[projection.x], y: point[projection.y] };
    }
    return { x: point.q, y: point.p };
  }

  function liouvilleProjection(model) {
    if (model.flow === "doublePendulum") {
      const projection = doublePendulumPhaseProjection(model.doublePendulum.projection);
      return { xLabel: projection.xLabel, yLabel: projection.yLabel };
    }
    return { xLabel: "q", yLabel: "p" };
  }

  function liouvilleEnergyTitle(model) {
    if (model.flow === "doublePendulum") return "central double-pendulum energy drift";
    if (model.flow === "duffing") return "mean Duffing mechanical-energy change";
    return "mean oscillator energy change";
  }

  function liouvilleEnergyTraceName(model) {
    return model.flow === "doublePendulum" ? "\u0394 central energy" : "\u0394 mean energy";
  }

  function liouvillePhaseBounds(points, model) {
    return bounds2D(points.flatMap(frame => (
      projectLiouvilleCloud(frame.cloud, model)
    )), 0.12, 0.4);
  }

  function convexHull(cloud) {
    if (cloud.length <= 2) return cloud.slice();
    const sorted = cloud.slice().sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
    const lower = [];
    sorted.forEach(point => {
      while (lower.length >= 2 && cross2D(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
      lower.push(point);
    });
    const upper = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      const point = sorted[i];
      while (upper.length >= 2 && cross2D(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
      upper.push(point);
    }
    lower.pop();
    upper.pop();
    return lower.concat(upper);
  }

  function cross2D(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  }

  function polygonArea(points) {
    if (points.length < 3) return 0;
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      sum += a.x * b.y - b.x * a.y;
    }
    return Math.abs(sum) * 0.5;
  }

  function closePolygon(points) {
    if (!points.length) return [];
    return points.concat([points[0]]);
  }

  function liouvilleFlowLabel(flow) {
    if (flow === "damped") return "damped";
    if (flow === "driven") return "driven";
    if (flow === "duffing") return "Duffing";
    if (flow === "doublePendulum") return "double pendulum";
    return "Hamiltonian";
  }

  function liouvilleDivergence(model) {
    if (model.flow === "damped") return -model.gamma;
    if (model.flow === "duffing") return -model.duffing.deltaDamp;
    return 0;
  }

  function meanDuffingEnergy(cloud, model) {
    if (!cloud.length) return 0;
    const total = cloud.reduce((sum, point) => (
      sum + 0.5 * point.p * point.p + 0.5 * model.alpha * point.q * point.q + 0.25 * model.beta * Math.pow(point.q, 4)
    ), 0);
    return total / cloud.length;
  }

  function duffingPotential(q, model) {
    return 0.5 * model.alpha * q * q + 0.25 * model.beta * Math.pow(q, 4);
  }

  function meanDoublePendulumEnergy(cloud, model) {
    if (!cloud.length) return 0;
    const total = cloud.reduce((sum, point) => sum + doublePendulumEnergy(point, model), 0);
    return total / cloud.length;
  }

  function doublePendulumEnergyParts(state, model) {
    const { m1, m2, l1, l2, g } = model;
    const v1sq = l1 * l1 * state.omega1 * state.omega1;
    const v2sq = v1sq
      + l2 * l2 * state.omega2 * state.omega2
      + 2 * l1 * l2 * state.omega1 * state.omega2 * Math.cos(state.theta1 - state.theta2);
    const k1 = 0.5 * m1 * v1sq;
    const k2 = 0.5 * m2 * v2sq;
    const u1 = -m1 * g * l1 * Math.cos(state.theta1);
    const u2 = -m2 * g * (l1 * Math.cos(state.theta1) + l2 * Math.cos(state.theta2));
    const kinetic = k1 + k2;
    const potential = u1 + u2;
    const total = kinetic + potential;
    return { k1, k2, u1, u2, kinetic, potential, total };
  }

  function doublePendulumEnergy(state, model) {
    return doublePendulumEnergyParts(state, model).total;
  }

  function normalizePhase(phi) {
    const tau = Math.PI * 2;
    return ((phi % tau) + tau) % tau;
  }

  function wrapAngle(angle) {
    const tau = Math.PI * 2;
    return ((angle + Math.PI) % tau + tau) % tau - Math.PI;
  }

  function phaseTrace(points, projection, name, color, options = {}) {
    return {
      x: points.map(point => point[projection.x]),
      y: points.map(point => point[projection.y]),
      mode: "lines",
      name,
      line: { color, width: options.width || 1.8 },
      showlegend: options.showlegend
    };
  }

  function timeTrace(x, y, name, color, options = {}) {
    const trace = {
      x,
      y,
      mode: options.mode || "lines",
      name,
      line: { color, width: options.width || 1.8 },
      showlegend: options.showlegend
    };
    if (options.marker) trace.marker = options.marker;
    if (options.yaxis) trace.yaxis = options.yaxis;
    return trace;
  }

  function markerTrace(x, y, name, color) {
    return {
      x,
      y,
      mode: "markers",
      name,
      marker: { color, size: 8 },
      showlegend: false
    };
  }

  function plotLayout(title, xTitle, yTitle) {
    return {
      title: { text: title, font: { size: 14 } },
      margin: { l: 54, r: 20, t: 36, b: 42 },
      xaxis: { title: xTitle, fixedrange: true },
      yaxis: { title: yTitle, fixedrange: true },
      legend: { orientation: "h", x: 0, y: 1.12 },
      paper_bgcolor: "#ffffff",
      plot_bgcolor: "#ffffff"
    };
  }

  function bottomLegendLayout(title, xTitle, yTitle) {
    const layout = plotLayout(title, xTitle, yTitle);
    layout.margin.b = 72;
    layout.legend = { orientation: "h", x: 0, y: -0.28, xanchor: "left", yanchor: "top" };
    return layout;
  }

  function stableAwareRange(values, stableRange, floor = null) {
    const finite = values.filter(value => isFinite(value));
    if (!finite.length) return stableRange;
    const min = Math.min(...finite);
    const max = Math.max(...finite);
    const center = (min + max) * 0.5;
    const scale = Math.max(Math.abs(center), 1e-9);
    if ((max - min) / scale < 1e-4) return stableRange;
    const pad = Math.max((max - min) * 0.12, scale * 0.03);
    const low = floor == null ? min - pad : Math.min(min - pad, floor);
    return [low, max + pad];
  }

  function stableDefaultRange(values) {
    const finite = values.filter(value => isFinite(value));
    if (!finite.length) return [0, 1];
    const min = Math.min(...finite);
    const max = Math.max(...finite);
    const center = (min + max) * 0.5;
    const span = Math.max(Math.abs(center), Math.abs(min), Math.abs(max), 1) * 0.5;
    return [center - span, center + span];
  }

  function logPlotLayout(title, xTitle, yTitle) {
    return {
      ...plotLayout(title, xTitle, yTitle),
      yaxis: { title: yTitle, type: "log", fixedrange: true }
    };
  }

  function logisticBifurcationLayout(model) {
    const layout = plotLayout("bifurcation diagram", "r", "long-run x");
    const visibleMarkers = LOGISTIC_PERIOD_DOUBLINGS.filter(marker => marker.r >= model.rMin && marker.r <= model.rMax);
    layout.xaxis.range = [model.rMin, model.rMax];
    layout.yaxis.range = [0, 1];
    layout.margin.t = 48;
    layout.shapes = visibleMarkers.map(marker => ({
      type: "line",
      xref: "x",
      yref: "paper",
      x0: marker.r,
      x1: marker.r,
      y0: 0,
      y1: 1,
      line: { color: "rgba(124, 58, 237, 0.42)", width: 1, dash: "dot" }
    }));
    layout.annotations = [
      ...visibleMarkers.map(marker => ({
        x: marker.r,
        y: 1.02,
        xref: "x",
        yref: "paper",
        text: marker.label,
        showarrow: false,
        font: { size: 10, color: "#6d28d9" },
        yanchor: "bottom"
      })),
      {
        x: 0.99,
        y: 0.06,
        xref: "paper",
        yref: "paper",
        text: feigenbaumRatioText("<br>"),
        showarrow: false,
        xanchor: "right",
        font: { size: 11, color: "#475569" },
        bgcolor: "rgba(255,255,255,0.82)"
      }
    ];
    return layout;
  }

  function feigenbaumRatios() {
    const markers = LOGISTIC_PERIOD_DOUBLINGS.filter(marker => marker.label !== "r\u221e");
    const subscripts = ["\u2080", "\u2081", "\u2082", "\u2083", "\u2084", "\u2085", "\u2086"];
    const ratios = [];
    for (let i = 1; i < markers.length - 1; i++) {
      const prevGap = markers[i].r - markers[i - 1].r;
      const nextGap = markers[i + 1].r - markers[i].r;
      ratios.push({ label: `\u03b4${subscripts[i + 1] || ""}`, value: prevGap / nextGap });
    }
    return ratios;
  }

  function feigenbaumRatioText(separator = ", ") {
    const parts = feigenbaumRatios().slice(0, 3).map(item => `${item.label}\u2248${item.value.toFixed(3)}`);
    parts.push(`\u03b4_F\u2248${FEIGENBAUM_DELTA.toFixed(6)}`);
    return parts.join(separator);
  }

  function duffingBifurcationLayout(model, bifurcation) {
    const layout = plotLayout("Duffing period-doubling sweep", "F", "Poincare q");
    layout.xaxis.range = [model.sweepMin, model.sweepMax];
    layout.yaxis.range = duffingBifurcationYRange(bifurcation.points);
    layout.annotations = [{
      x: 0.99,
      y: 0.06,
      xref: "paper",
      yref: "paper",
      text: "one dot = q sampled once per drive period after transients",
      showarrow: false,
      xanchor: "right",
      font: { size: 11, color: "#475569" },
      bgcolor: "rgba(255,255,255,0.82)"
    }];
    return layout;
  }

  function duffingBifurcationYRange(points) {
    const qs = points.map(point => point.q).filter(value => isFinite(value));
    if (!qs.length) return [-2, 2];
    const min = Math.min(...qs);
    const max = Math.max(...qs);
    const pad = Math.max((max - min) * 0.12, 0.2);
    return [min - pad, max + pad];
  }

  function paddedRange(values, fallback, fraction = 0.12) {
    const finiteValues = values.filter(value => isFinite(value));
    if (!finiteValues.length) return fallback;
    const min = Math.min(...finiteValues);
    const max = Math.max(...finiteValues);
    const pad = Math.max((max - min) * fraction, 0.15);
    return [min - pad, max + pad];
  }

  function duffingSelectedBifurcationColumn(model, bifurcation) {
    if (!bifurcation.columns?.length) return { F: model.driveAmp, points: [] };
    let bestIndex = 0;
    let bestDistance = Infinity;
    bifurcation.columns.forEach((column, index) => {
      const point = column[0];
      const F = point?.F ?? model.sweepMin + (model.sweepMax - model.sweepMin) * index / Math.max(bifurcation.columns.length - 1, 1);
      const distance = Math.abs(F - model.driveAmp);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    const points = bifurcation.columns[bestIndex] || [];
    const F = points[0]?.F ?? model.driveAmp;
    return { F, points };
  }

  function dualAxisLayout(title, xTitle, leftTitle, rightTitle) {
    const layout = plotLayout(title, xTitle, leftTitle);
    layout.margin.r = 58;
    layout.yaxis2 = {
      title: rightTitle,
      overlaying: "y",
      side: "right",
      fixedrange: true
    };
    return layout;
  }

  function dualAxisLogLinearLayout(title, xTitle, leftTitle, rightTitle) {
    const layout = dualAxisLayout(title, xTitle, leftTitle, rightTitle);
    layout.yaxis.type = "log";
    return layout;
  }

  function verticalShape(x) {
    return {
      type: "line",
      x0: x,
      x1: x,
      y0: 0,
      y1: 1,
      xref: "x",
      yref: "paper",
      line: { color: "rgba(15, 23, 42, 0.45)", width: 1, dash: "dot" }
    };
  }

  function renderChaosEquation(model) {
    const el = document.getElementById("chaosEquation");
    if (!el) return;
    if (model.type === "logisticMap") {
      el.innerHTML = equationMarkup(
        "\\(x_{n+1}=r x_n(1-x_n),\\quad \\delta_n=\\frac{r_n-r_{n-1}}{r_{n+1}-r_n}\\to \\delta_F\\)",
        [
          ["r", model.r],
          ["x_0", model.x0],
          ["\\delta_2", feigenbaumRatios()[0]?.value || 0],
          ["\\delta_3", feigenbaumRatios()[1]?.value || 0],
          ["\\delta_F", FEIGENBAUM_DELTA]
        ],
        ["each bifurcation column is made from long-run x_n values after discarding the transient", "canvas: one map for one r; bifurcation plot: that same process repeated for many r", "purple markers show the period-doubling accumulation"]
      );
    } else if (model.type === "liouvilleFlow") {
      el.innerHTML = liouvilleEquationMarkup(model);
    } else if (model.type === "duffing") {
      el.innerHTML = equationMarkup(
        "\\(q''+\\delta q'+\\alpha q+\\beta q^3=F\\cos(\\Omega t)\\quad\\Rightarrow\\quad \\dot{q}=p,\\ \\dot{p}=-\\delta p-\\alpha q-\\beta q^3+F\\cos\\phi,\\ \\dot{\\phi}=\\Omega\\)",
        [
          ["\\delta", model.deltaDamp],
          ["\\alpha", model.alpha],
          ["\\beta", model.beta],
          ["F", model.driveAmp],
          ["\\Omega", model.driveOmega]
        ],
        model.view === "periodDoubling"
          ? ["sweep builds the diagram column by column; each F is integrated as a separate oscillator", "after the transient, q is sampled at t_k=kT where T=2pi/Omega, so one stable period gives one dot and period-2 gives two dots", "periodic windows inside chaos are normal for the driven Duffing oscillator"]
          : ["preset changes whether the driven double-well motion is regular or chaotic"]
      );
    } else if (model.type === "doublePendulum") {
      el.innerHTML = equationMarkup(
        "\\(\\dot{\\theta}_1=\\omega_1,\\quad \\dot{\\theta}_2=\\omega_2,\\quad \\dot{\\omega}_1=f_1(\\theta_1,\\theta_2,\\omega_1,\\omega_2),\\quad \\dot{\\omega}_2=f_2(\\theta_1,\\theta_2,\\omega_1,\\omega_2)\\)",
        [
          ["l_1", model.l1],
          ["l_2", model.l2],
          ["m_1", model.m1],
          ["m_2", model.m2],
          ["g", model.g],
          ["\\delta", model.delta]
        ],
        [`two almost identical initial angles are integrated with ${methodLabel(model.method)}`]
      );
    } else {
      el.innerHTML = equationMarkup(
        "\\(\\dot{x}=\\sigma(y-x),\\quad \\dot{y}=x(\\rho-z)-y,\\quad \\dot{z}=xy-\\beta z\\)",
        [
          ["\\sigma", model.sigma],
          ["\\rho", model.rho],
          ["\\beta", model.beta],
          ["\\delta", model.delta]
        ],
        [`two nearby deterministic trajectories are integrated with ${methodLabel(model.method)}`]
      );
    }
    if (window.MathJax?.typesetPromise) window.MathJax.typesetPromise([el]).catch(() => {});
  }

  function equationMarkup(equation, params, notes = []) {
    return [
      `<div class="equation-line">${equation}</div>`,
      '<div class="equation-params">',
      ...params.map(([name, value]) => `<span>\\(${name}=${formatChaosNumber(value)}\\)</span>`),
      "</div>",
      '<div class="equation-notes">',
      ...notes.map(note => `<span>${note}</span>`),
      "</div>"
    ].join("");
  }

  function liouvilleEquationMarkup(model) {
    if (model.flow === "duffing") {
      return equationMarkup(
        "\\(\\dot{q}=p,\\quad \\dot{p}=-\\delta p-\\alpha q-\\beta q^3+F\\cos\\phi,\\quad \\dot{\\phi}=\\Omega,\\quad \\nabla\\cdot F=-\\delta\\)",
        [
          ["\\delta", model.duffing.deltaDamp],
          ["\\alpha", model.duffing.alpha],
          ["\\beta", model.duffing.beta],
          ["F", model.duffing.driveAmp],
          ["\\Omega", model.duffing.driveOmega]
        ],
        ["the cloud is plotted in q-p; \\(\\phi\\) is the drive clock, not a visible axis"]
      );
    }
    if (model.flow === "doublePendulum") {
      return equationMarkup(
        "\\(\\dot{\\theta}_1=\\omega_1,\\quad \\dot{\\theta}_2=\\omega_2,\\quad \\dot{\\omega}_1=f_1,\\quad \\dot{\\omega}_2=f_2\\)",
        [
          ["l_1", model.doublePendulum.l1],
          ["l_2", model.doublePendulum.l2],
          ["g", model.doublePendulum.g],
          ["A_{proj}(0)", currentResult?.initialArea || 0]
        ],
        ["orange: triangulated projected sheet; blue: local 4D volume in canonical \\((\\theta,p)\\) coordinates"]
      );
    }
    if (model.flow === "damped") {
      return equationMarkup(
        "\\(\\dot{q}=p,\\quad \\dot{p}=-\\omega^2 q-\\gamma p,\\quad \\nabla\\cdot F=-\\gamma\\)",
        [
          ["\\omega", model.omega],
          ["\\gamma", model.gamma],
          ["A(0)", currentResult?.initialArea || 0]
        ],
        ["damping makes the phase cloud contract"]
      );
    }
    if (model.flow === "driven") {
      return equationMarkup(
        "\\(\\dot{q}=p,\\quad \\dot{p}=-\\omega^2 q+F\\cos\\phi,\\quad \\dot{\\phi}=\\Omega,\\quad \\nabla_{q,p}\\cdot F=0\\)",
        [
          ["\\omega", model.omega],
          ["F", model.driveAmp],
          ["\\Omega", model.driveOmega],
          ["A(0)", currentResult?.initialArea || 0]
        ],
        ["\\(\\phi\\) is the drive clock; the visible bubble is the q-p projection"]
      );
    }
    return equationMarkup(
      "\\(\\dot{q}=p,\\quad \\dot{p}=-\\omega^2 q,\\quad \\nabla\\cdot F=0\\)",
      [
        ["\\omega", model.omega],
        ["A(0)", currentResult?.initialArea || 0]
      ],
      ["Hamiltonian flow should preserve phase area"]
    );
  }

  function updateChaosStatus(model, result) {
    const status = document.getElementById("chaosStatus");
    if (!status) return;
    if (model.type === "logisticMap") {
      status.textContent = `Logistic map: ${result.points.length} iterates; ${model.bifurcationSamples} bifurcation columns; ${model.bifurcationMode} mode; Feigenbaum delta ${FEIGENBAUM_DELTA.toFixed(6)}`;
    } else if (model.type === "liouvilleFlow") {
      const last = result.points[result.points.length - 1];
      const pointCount = result.points[0]?.cloud?.length || model.cloudCount;
      const volumeText = last.volumeRatio == null ? "" : `; local 4D canonical volume ${formatChaosNumber(last.volumeRatio)}`;
      status.textContent = `Liouville flow: ${pointCount} mesh points, ${methodLabel(model.method)} steps; final projected area ${formatChaosNumber(last.areaRatio)}; dE ${formatChaosNumber(last.energyDelta)}${volumeText}`;
    } else if (model.type === "duffing") {
      const sweepText = model.view === "periodDoubling" && result.bifurcation
        ? `; Poincare sweep ${model.sweepSamples} F columns`
        : "";
      status.textContent = `Duffing: ${result.points.length} ${methodLabel(model.method)} steps; max separation ${formatChaosNumber(result.maxDistance)}${sweepText}`;
    } else if (model.type === "doublePendulum") {
      status.textContent = `Double pendulum: ${result.points.length} ${methodLabel(model.method)} steps; max tip separation ${formatChaosNumber(result.maxDistance)}`;
    } else {
      status.textContent = `Lorenz: ${result.points.length} ${methodLabel(model.method)} steps; max separation ${formatChaosNumber(result.maxDistance)}`;
    }
  }

  function relayoutIfReady(id, update) {
    const el = document.getElementById(id);
    if (el && el.data && window.Plotly) window.Plotly.relayout(el, update);
  }

  function restyleIfReady(id, update, traces) {
    const el = document.getElementById(id);
    if (el && el.data && window.Plotly) window.Plotly.restyle(el, update, traces);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function finiteOr(value, fallback) {
    return isFinite(value) ? value : fallback;
  }

  function formatChaosNumber(value) {
    if (!isFinite(value)) return "0";
    const abs = Math.abs(value);
    if (abs > 0 && (abs < 0.001 || abs >= 10000)) return value.toExponential(2);
    if (abs >= 100) return value.toFixed(1);
    if (abs >= 10) return value.toFixed(2);
    return value.toFixed(3);
  }

  function methodLabel(method) {
    if (method === "euler") return "Euler";
    if (method === "midpoint") return "midpoint RK2";
    if (method === "heun") return "Heun RK2";
    return "RK4";
  }

  window.setupChaosLab = setupChaosLab;
  window.runChaosSimulation = runChaosSimulation;
  window.refreshChaosFrame = () => drawChaosFrame(animationT, { forcePlotUpdate: true });
  window.stopChaosAnimation = stopChaosAnimation;
})();
