(function () {
  let currentModel = null;
  let currentResult = null;
  let currentCompareModel = null;
  let currentCompareResult = null;
  let currentResonanceScan = null;
  let animationFrame = null;
  let isPlaying = false;
  let animationStart = 0;
  let animationT = 0;
  let lastPlotCursorUpdate = 0;
  const animalIcons = {
    sheep: loadPhysicsImage("assets/physics/sheep-icon.png"),
    wolf: loadPhysicsImage("assets/physics/wolf-icon.png")
  };
  const neuronSprite = loadPhysicsImage("assets/physics/neuron-sprite.png");

  function setupPhysicsLab() {
    populateMethodSelect();
    bindEvents();
    updatePhysicsControls();
    runPhysicsSimulation();
  }

  function loadPhysicsImage(src) {
    const image = new Image();
    image.src = src;
    image.onload = () => {
      if (currentModel?.type === "predatorPrey" || currentModel?.type === "neuron") drawFrame(animationT);
    };
    return image;
  }

  function populateMethodSelect() {
    const select = document.getElementById("physicsMethod");
    if (!select || !window.SecondOrderMethods) return;

    const preferred = ["euler2", "eulerCromer", "midpoint2", "rk4System", "verlet", "velocityVerlet"];
    preferred.forEach(key => {
      const method = window.SecondOrderMethods.METHOD_DEFS.find(item => item.key === key);
      if (!method) return;
      const option = document.createElement("option");
      option.value = method.key;
      option.textContent = method.label;
      select.appendChild(option);
    });
    select.value = "velocityVerlet";
  }

  function bindEvents() {
    const plotButton = document.getElementById("physicsPlotBtn");
    if (plotButton) plotButton.addEventListener("click", runPhysicsSimulation);
    const systemSelect = document.getElementById("physicsSystem");
    if (systemSelect) {
      systemSelect.addEventListener("change", () => {
        applySystemDefaults(systemSelect.value);
        updatePhysicsControls();
        runPhysicsSimulation();
      });
    }
    const oscillatorModeSelect = document.getElementById("physicsOscillatorMode");
    if (oscillatorModeSelect) {
      oscillatorModeSelect.addEventListener("change", () => {
        const driveInput = document.getElementById("physicsDriveA");
        if (oscillatorModeSelect.value === "resonance" && Math.abs(parseFloat(driveInput.value) || 0) < 1e-9) {
          driveInput.value = 1;
        }
        updatePhysicsControls();
      });
    }
    document.querySelectorAll("#physics .physics-controls-panel input:not(#physicsSpeed), #physics .physics-controls-panel select:not(#physicsSystem)").forEach(el => {
      el.addEventListener("change", runPhysicsSimulation);
    });
    document.getElementById("physicsSpeed").addEventListener("change", () => {
      if (!currentResult || !isPlaying) return;
      const t0 = currentResult.points[0].t;
      animationStart = performance.now() - (animationT - t0) * 1000 / getSpeed();
    });

    document.getElementById("physicsPlayBtn").addEventListener("click", () => {
      if (!currentResult) return;
      isPlaying = !isPlaying;
      document.getElementById("physicsPlayBtn").textContent = isPlaying ? "Pause" : "Play";
      if (isPlaying) {
        const t0 = currentResult?.points?.[0]?.t || 0;
        animationStart = performance.now() - (animationT - t0) * 1000 / getSpeed();
        startAnimation();
      }
    });

    document.getElementById("physicsTimeSlider").addEventListener("input", event => {
      if (!currentResult) return;
      const t0 = currentResult.points[0].t;
      const t1 = currentResult.points[currentResult.points.length - 1].t;
      animationT = t0 + (t1 - t0) * parseFloat(event.target.value);
      isPlaying = false;
      document.getElementById("physicsPlayBtn").textContent = "Play";
      lastPlotCursorUpdate = 0;
      drawFrame(animationT, { forcePlotUpdate: true });
    });

    const physicsTab = document.querySelector('[data-tab="physics"]');
    if (physicsTab) physicsTab.addEventListener("click", () => {
      window.setTimeout(() => {
        resizeCanvasToDisplay();
        lastPlotCursorUpdate = 0;
        drawFrame(animationT);
        ["physicsTimePlot", "physicsPhasePlot", "physicsEnergyPlot", "physicsExtraPlot"].forEach(id => {
          const el = document.getElementById(id);
          if (el) window.Plotly.Plots.resize(el);
        });
      }, 0);
    });
  }

  function runPhysicsSimulation() {
    if (!window.SecondOrderMethods) return;

    const wasPlaying = isPlaying;
    const previousT = animationT;
    const model = readModel();
    const methodKey = document.getElementById("physicsMethod").value;

    try {
      if (model.analysisMode === "resonance") {
        currentModel = resonanceVariantModel(model, model.resonance.omegaA, "A");
        const displayTime = model.resonance.measureCycles * Math.max(
          resonancePeriod(model, model.resonance.omegaA),
          model.resonance.compare ? resonancePeriod(model, model.resonance.omegaB) : resonancePeriod(model, model.resonance.omegaA)
        );
        currentCompareModel = model.resonance.compare ? resonanceVariantModel(model, model.resonance.omegaB, "B") : null;
        currentResult = simulateResonanceResponse(currentModel, methodKey, displayTime);
        currentCompareResult = currentCompareModel ? simulateResonanceResponse(currentCompareModel, methodKey, displayTime) : null;
        currentResonanceScan = buildResonanceScan(model, methodKey);
      } else {
        currentResult = simulatePhysicsModel(model, methodKey);
        currentModel = model;
        currentCompareModel = buildCompareModel(model);
        currentCompareResult = currentCompareModel ? simulatePhysicsModel(currentCompareModel, methodKey) : null;
        currentResonanceScan = null;
      }
      updatePhysicsControls(model);
      renderEquation(model);
      document.getElementById("physicsStatus").textContent = physicsStatusText(model, currentResult);
      if (currentModel.analysisMode === "resonance") {
        drawResonancePlots(currentModel, currentCompareModel, currentResult, currentCompareResult, currentResonanceScan);
      } else {
        drawPhysicsPlots(model, currentResult);
      }
      const t0 = currentResult.points[0].t;
      const t1 = currentResult.points[currentResult.points.length - 1].t;
      animationT = wasPlaying ? clamp(previousT, t0, t1) : t0;
      animationStart = performance.now() - (animationT - t0) * 1000 / getSpeed();
      isPlaying = wasPlaying;
      document.getElementById("physicsPlayBtn").textContent = isPlaying ? "Pause" : "Play";
      document.getElementById("physicsTimeSlider").value = String(clamp((animationT - t0) / (t1 - t0 || 1), 0, 1));
      lastPlotCursorUpdate = 0;
      resizeCanvasToDisplay();
      drawFrame(animationT);
      if (isPlaying) startAnimation();
    } catch (error) {
      document.getElementById("physicsStatus").textContent = error.message;
    }
  }

  function simulatePhysicsModel(model, methodKey) {
    if (model.mode === "planar") return simulatePlanarSystem(model, methodKey);
    if (model.mode === "particle2d") return simulateParticle2D(model, methodKey);
    if (model.mode === "coupled") return simulateCoupledOscillators(model, methodKey);
    if (model.mode === "circuitFirstOrder") return simulateCircuitFirstOrder(model, methodKey);
    return window.SecondOrderMethods.simulateSecondOrder({
      equation: model.equation,
      t0: model.t0,
      t1: model.t1,
      h: model.h,
      y0: model.y0,
      v0: model.v0
    }, methodKey);
  }

  function resonanceVariantModel(base, driveOmega, label = "") {
    const w2 = base.omega * base.omega;
    const forcing = Math.abs(base.driveA) > 1e-9 ? base.driveA : 1;
    return {
      ...base,
      resonanceLabel: label,
      driveA: forcing,
      driveOmega,
      equation: `-(${w2})*y - (${base.gamma})*v + (${forcing})*cos((${driveOmega})*t)`,
      latex: buildOscillatorLatex(base.omega, base.gamma, forcing, driveOmega)
    };
  }

  function simulateResonanceResponse(model, methodKey, displayTime = null) {
    const period = resonancePeriod(model, model.driveOmega);
    const measureTime = displayTime || model.resonance.measureCycles * period;
    const requestedSettleTime = model.resonance.settleCycles * period;
    const dampingSettleTime = model.gamma > 1e-9 ? 6 / model.gamma : 0;
    const settleTime = Math.max(requestedSettleTime, dampingSettleTime);
    const totalTime = settleTime + measureTime;
    const h = Math.min(Math.abs(model.h || 0.03), period / 60);
    const result = simulatePhysicsModel({
      ...model,
      t0: 0,
      t1: totalTime,
      h
    }, methodKey);
    const start = Math.max(totalTime - measureTime, 0);
    const visibleRaw = result.points.filter(point => point.t >= start);
    const visibleStart = visibleRaw[0]?.t ?? start;
    const visible = visibleRaw.map(point => ({ ...point, t: point.t - visibleStart }));
    return {
      ...result,
      points: visible.length ? visible : result.points,
      h: result.h,
      driveOmega: model.driveOmega
    };
  }

  function buildResonanceScan(base, methodKey) {
    const samples = base.resonance.samples;
    const minOmega = base.resonance.omegaMin;
    const maxOmega = base.resonance.omegaMax;
    const omegaValues = resonanceScanFrequencies(base, minOmega, maxOmega, samples);
    const points = omegaValues.map(omegaDrive => {
      const variant = resonanceVariantModel(base, omegaDrive, "");
      const response = simulateResonanceResponse(variant, methodKey);
      return {
        omega: omegaDrive,
        amplitude: responseAmplitude(response.points)
      };
    });
    const peak = points.reduce((best, point) => point.amplitude > best.amplitude ? point : best, points[0] || { omega: 0, amplitude: 0 });
    const predictedSquared = base.gamma > 1e-9 ? base.omega * base.omega - base.gamma * base.gamma / 2 : -1;
    return {
      points,
      peak,
      naturalOmega: base.omega,
      predictedOmega: predictedSquared > 0 ? Math.sqrt(predictedSquared) : null
    };
  }

  function resonanceScanFrequencies(base, minOmega, maxOmega, samples) {
    const span = maxOmega - minOmega;
    const values = [];
    for (let i = 0; i < samples; i++) {
      values.push(samples === 1 ? minOmega : minOmega + span * i / (samples - 1));
    }
    const predictedSquared = base.gamma > 1e-9 ? base.omega * base.omega - base.gamma * base.gamma / 2 : -1;
    const important = [
      base.omega,
      predictedSquared > 0 ? Math.sqrt(predictedSquared) : null
    ];
    important.forEach(value => {
      if (value != null && value >= minOmega && value <= maxOmega) values.push(value);
    });
    return [...new Map(values.map(value => [formatFrequencyKey(value), value])).values()]
      .sort((a, b) => a - b);
  }

  function formatFrequencyKey(value) {
    return Number(value).toFixed(6);
  }

  function resonancePeriod(model, driveOmega) {
    const fallbackOmega = Math.max(Math.abs(model.omega), 0.1);
    const omegaDrive = Math.max(Math.abs(driveOmega), 1e-6);
    return 2 * Math.PI / (driveOmega > 1e-6 ? omegaDrive : fallbackOmega);
  }

  function responseAmplitude(points) {
    if (!points.length) return 0;
    const values = points.map(point => point.y);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return (max - min) / 2;
  }

  function readModel() {
    const type = document.getElementById("physicsSystem").value;
    const omega = finiteOr(parseFloat(document.getElementById("physicsOmega").value), 1);
    const oscillatorMode = document.getElementById("physicsOscillatorMode")?.value || "simulation";
    const oscillatorAnimation = document.getElementById("physicsOscillatorAnimation")?.value || "spring";
    const gamma = finiteOr(parseFloat(document.getElementById("physicsGamma").value), 0);
    const driveA = finiteOr(parseFloat(document.getElementById("physicsDriveA").value), 0);
    const driveOmega = finiteOr(parseFloat(document.getElementById("physicsDriveOmega").value), 1);
    const length = Math.max(finiteOr(parseFloat(document.getElementById("physicsLength").value), 1), 0.05);
    const g = finiteOr(parseFloat(document.getElementById("physicsG").value), 9.81);
    const t0 = finiteOr(parseFloat(document.getElementById("physicsT0").value), 0);
    const t1 = finiteOr(parseFloat(document.getElementById("physicsT1").value), 20);
    const h = finiteOr(parseFloat(document.getElementById("physicsH").value), 0.03);
    const y0 = finiteOr(parseFloat(document.getElementById("physicsY0").value), 1);
    const v0 = finiteOr(parseFloat(document.getElementById("physicsV0").value), 0);
    const compareEnabled = !!document.getElementById("physicsCompareEnabled")?.checked;
    const compareY0 = finiteOr(parseFloat(document.getElementById("physicsCompareY0")?.value), y0);
    const compareV0 = finiteOr(parseFloat(document.getElementById("physicsCompareV0")?.value), v0);
    const compareOmega = finiteOr(parseFloat(document.getElementById("physicsCompareOmega")?.value), omega);
    const compareLength = Math.max(finiteOr(parseFloat(document.getElementById("physicsCompareLength")?.value), length), 0.05);
    const pendulumCompareMode = document.getElementById("physicsPendulumCompareMode")?.value || "custom";
    const circuitL = Math.max(finiteOr(parseFloat(document.getElementById("physicsCircuitL").value), 1), 0);
    const circuitC = Math.max(finiteOr(parseFloat(document.getElementById("physicsCircuitC").value), 1), 0);
    const circuitR = Math.max(finiteOr(parseFloat(document.getElementById("physicsCircuitR").value), 0.2), 0);
    const circuitV = finiteOr(parseFloat(document.getElementById("physicsCircuitV").value), 0);
    const circuitOmega = finiteOr(parseFloat(document.getElementById("physicsCircuitOmega").value), 0);
    const compareCircuitL = Math.max(finiteOr(parseFloat(document.getElementById("physicsCompareCircuitL")?.value), circuitL), 0);
    const compareCircuitC = Math.max(finiteOr(parseFloat(document.getElementById("physicsCompareCircuitC")?.value), circuitC), 0);
    const compareCircuitR = Math.max(finiteOr(parseFloat(document.getElementById("physicsCompareCircuitR")?.value), circuitR), 0);
    const compareCircuitV = finiteOr(parseFloat(document.getElementById("physicsCompareCircuitV")?.value), circuitV);
    const compareCircuitOmega = finiteOr(parseFloat(document.getElementById("physicsCompareCircuitOmega")?.value), circuitOmega);
    const predAlpha = Math.max(finiteOr(parseFloat(document.getElementById("physicsPredAlpha").value), 0.55), 0);
    const predBeta = Math.max(finiteOr(parseFloat(document.getElementById("physicsPredBeta").value), 0.02), 0);
    const predDelta = Math.max(finiteOr(parseFloat(document.getElementById("physicsPredDelta").value), 0.01), 0);
    const predGamma = Math.max(finiteOr(parseFloat(document.getElementById("physicsPredGamma").value), 0.4), 0);
    const comparePredAlpha = Math.max(finiteOr(parseFloat(document.getElementById("physicsComparePredAlpha")?.value), predAlpha), 0);
    const comparePredBeta = Math.max(finiteOr(parseFloat(document.getElementById("physicsComparePredBeta")?.value), predBeta), 0);
    const comparePredDelta = Math.max(finiteOr(parseFloat(document.getElementById("physicsComparePredDelta")?.value), predDelta), 0);
    const comparePredGamma = Math.max(finiteOr(parseFloat(document.getElementById("physicsComparePredGamma")?.value), predGamma), 0);
    const resOmegaMin = Math.max(finiteOr(parseFloat(document.getElementById("physicsResOmegaMin")?.value), 0.1), 0);
    const resOmegaMax = Math.max(finiteOr(parseFloat(document.getElementById("physicsResOmegaMax")?.value), 2.5), 0);
    const resSamples = clamp(Math.round(finiteOr(parseFloat(document.getElementById("physicsResSamples")?.value), 48)), 8, 80);
    const resOmegaA = Math.max(finiteOr(parseFloat(document.getElementById("physicsResOmegaA")?.value), 0.6), 0);
    const resOmegaB = Math.max(finiteOr(parseFloat(document.getElementById("physicsResOmegaB")?.value), 1), 0);
    const resSettleCycles = clamp(Math.round(finiteOr(parseFloat(document.getElementById("physicsResSettleCycles")?.value), 20)), 0, 80);
    const resMeasureCycles = clamp(Math.round(finiteOr(parseFloat(document.getElementById("physicsResMeasureCycles")?.value), 8)), 2, 40);
    const neuronA = finiteOr(parseFloat(document.getElementById("physicsNeuronA").value), 0.7);
    const neuronB = finiteOr(parseFloat(document.getElementById("physicsNeuronB").value), 0.8);
    const neuronTau = Math.max(finiteOr(parseFloat(document.getElementById("physicsNeuronTau").value), 12.5), 0.1);
    const neuronI = finiteOr(parseFloat(document.getElementById("physicsNeuronI").value), 0.7);
    const particleX0 = finiteOr(parseFloat(document.getElementById("physicsParticleX0")?.value), 0);
    const particleY0 = finiteOr(parseFloat(document.getElementById("physicsParticleY0")?.value), 0);
    const particleVx0 = finiteOr(parseFloat(document.getElementById("physicsParticleVx0")?.value), 5);
    const particleVy0 = finiteOr(parseFloat(document.getElementById("physicsParticleVy0")?.value), 6);
    const particleDrag = Math.max(finiteOr(parseFloat(document.getElementById("physicsParticleDrag")?.value), 0), 0);
    const projectileG = finiteOr(parseFloat(document.getElementById("physicsProjectileG")?.value), 9.81);
    const bounceY0 = Math.max(finiteOr(parseFloat(document.getElementById("physicsBounceY0")?.value), 3), 0);
    const bounceVy0 = finiteOr(parseFloat(document.getElementById("physicsBounceVy0")?.value), 8);
    const bounceRestitution = clamp(finiteOr(parseFloat(document.getElementById("physicsBounceRestitution")?.value), 0.8), 0, 1);
    const particleCharge = finiteOr(parseFloat(document.getElementById("physicsParticleCharge")?.value), 1);
    const particleMass = Math.max(finiteOr(parseFloat(document.getElementById("physicsParticleMass")?.value), 1), 0.05);
    const electricEx = finiteOr(parseFloat(document.getElementById("physicsElectricEx")?.value), 1);
    const electricEy = finiteOr(parseFloat(document.getElementById("physicsElectricEy")?.value), 0);
    const magneticB = finiteOr(parseFloat(document.getElementById("physicsMagneticB")?.value), 1);
    const phaseProjection = document.getElementById("physicsPhaseProjection")?.value || defaultPhaseProjection(type);
    const coupledOmega = finiteOr(parseFloat(document.getElementById("physicsCoupledOmega")?.value), 1);
    const coupledKappa = finiteOr(parseFloat(document.getElementById("physicsCoupledKappa")?.value), 0.35);
    const coupledGamma = Math.max(finiteOr(parseFloat(document.getElementById("physicsCoupledGamma")?.value), 0), 0);
    const coupledX1 = finiteOr(parseFloat(document.getElementById("physicsCoupledX1")?.value), 1);
    const coupledV1 = finiteOr(parseFloat(document.getElementById("physicsCoupledV1")?.value), 0);
    const coupledX2 = finiteOr(parseFloat(document.getElementById("physicsCoupledX2")?.value), 0);
    const coupledV2 = finiteOr(parseFloat(document.getElementById("physicsCoupledV2")?.value), 0);

    const forcing = Math.abs(driveA) > 1e-9 ? driveA : 0;
    const compare = {
      enabled: compareEnabled && (type === "oscillator" || type === "pendulum" || type === "rlc" || type === "predatorPrey"),
      y0: compareY0,
      v0: compareV0,
      omega: compareOmega,
      length: compareLength,
      pendulumMode: pendulumCompareMode,
      circuitL: compareCircuitL,
      circuitC: compareCircuitC,
      circuitR: compareCircuitR,
      circuitV: compareCircuitV,
      circuitOmega: compareCircuitOmega,
      predAlpha: comparePredAlpha,
      predBeta: comparePredBeta,
      predDelta: comparePredDelta,
      predGamma: comparePredGamma
    };

    if (type === "pendulum") {
      const w2 = g / length;
      return {
        type: "pendulum",
        mode: "secondOrder",
        t0,
        t1,
        h,
        y0,
        v0,
        omega: Math.sqrt(w2),
        gamma,
        driveA: forcing,
        driveOmega,
        length,
        g,
        equation: `-(${w2})*sin(y) - (${gamma})*v + (${forcing})*cos((${driveOmega})*t)`,
        latex: buildPendulumLatex(g, length, gamma, forcing, driveOmega),
        compare,
        description: modelDescription(type)
      };
    }

    if (type === "rlc") {
      return buildRlcModel({
        t0,
        t1,
        h,
        y0,
        v0,
        circuitL,
        circuitC,
        circuitR,
        circuitV,
        circuitOmega,
        compare
      });
    }

    if (type === "predatorPrey") {
      return buildPredatorModel({
        t0,
        t1,
        h,
        y0: Math.max(y0, 0),
        v0: Math.max(v0, 0),
        predAlpha,
        predBeta,
        predDelta,
        predGamma,
        compare
      });
    }

    if (type === "neuron") {
      return {
        type: "neuron",
        mode: "planar",
        t0,
        t1,
        h,
        y0,
        v0,
        neuronA,
        neuronB,
        neuronTau,
        neuronI,
        derivative: (t, u, w) => ({
          y: u - (u * u * u) / 3 - w + neuronI,
          v: (u + neuronA - neuronB * w) / neuronTau
        }),
        latex: buildNeuronLatex(neuronA, neuronB, neuronTau, neuronI),
        description: modelDescription(type)
      };
    }

    if (type === "projectile") {
      return buildParticleModel({
        type,
        t0,
        t1,
        h,
        x0: particleX0,
        y0: particleY0,
        vx0: particleVx0,
        vy0: particleVy0,
        drag: particleDrag,
        ax: () => 0,
        ay: () => -projectileG,
        params: { g: projectileG },
        phaseProjection: normalizePhaseProjection("particle", phaseProjection, defaultPhaseProjection(type)),
        latex: buildProjectileLatex(projectileG, particleDrag)
      });
    }

    if (type === "verticalBounce") {
      return buildParticleModel({
        type,
        t0,
        t1,
        h,
        x0: 0,
        y0: bounceY0,
        vx0: 0,
        vy0: bounceVy0,
        drag: particleDrag,
        ax: () => 0,
        ay: () => -projectileG,
        params: { g: projectileG, restitution: bounceRestitution },
        groundBounce: true,
        restitution: bounceRestitution,
        phaseProjection: normalizePhaseProjection("particle", phaseProjection, defaultPhaseProjection(type)),
        latex: buildVerticalBounceLatex(projectileG, particleDrag, bounceRestitution)
      });
    }

    if (type === "chargedParticle") {
      return buildParticleModel({
        type,
        t0,
        t1,
        h,
        x0: particleX0,
        y0: particleY0,
        vx0: particleVx0,
        vy0: particleVy0,
        drag: particleDrag,
        ax: state => particleCharge * (electricEx + state.vy * magneticB) / particleMass,
        ay: state => particleCharge * (electricEy - state.vx * magneticB) / particleMass,
        params: { q: particleCharge, m: particleMass, ex: electricEx, ey: electricEy, bz: magneticB },
        phaseProjection: normalizePhaseProjection("particle", phaseProjection, defaultPhaseProjection(type)),
        latex: buildChargedParticleLatex(particleCharge, particleMass, electricEx, electricEy, magneticB, particleDrag)
      });
    }

    if (type === "coupledOscillators") {
      return {
        type,
        mode: "coupled",
        t0,
        t1,
        h,
        omega: coupledOmega,
        kappa: coupledKappa,
        gamma: coupledGamma,
        x1: coupledX1,
        v1: coupledV1,
        x2: coupledX2,
        v2: coupledV2,
        y0: coupledX1,
        v0: coupledV1,
        phaseProjection: normalizePhaseProjection("coupled", phaseProjection, defaultPhaseProjection(type)),
        latex: buildCoupledOscillatorsLatex(coupledOmega, coupledKappa, coupledGamma),
        description: modelDescription(type)
      };
    }

    const w2 = omega * omega;
    const oscillatorAnalysisMode = type === "oscillator" ? oscillatorMode : "simulation";
    return {
      type: "oscillator",
      mode: "secondOrder",
      analysisMode: oscillatorAnalysisMode,
      t0,
      t1,
      h,
      y0,
      v0,
      omega,
      gamma,
      oscillatorAnimation,
      driveA: forcing,
      driveOmega,
      length,
      g,
      equation: `-(${w2})*y - (${gamma})*v + (${forcing})*cos((${driveOmega})*t)`,
      latex: oscillatorAnalysisMode === "resonance"
        ? buildResonanceOscillatorLatex(omega, gamma, Math.abs(driveA) > 1e-9 ? driveA : 1)
        : buildOscillatorLatex(omega, gamma, forcing, driveOmega),
      resonance: {
        omegaMin: Math.min(resOmegaMin, resOmegaMax),
        omegaMax: Math.max(resOmegaMin, resOmegaMax),
        samples: resSamples,
        omegaA: resOmegaA,
        omegaB: resOmegaB,
        compare: compareEnabled,
        settleCycles: resSettleCycles,
        measureCycles: resMeasureCycles
      },
      compare,
      description: modelDescription(type)
    };
  }

  function buildRlcModel(config) {
    const voltage = Math.abs(config.circuitV) > 1e-9 ? config.circuitV : 0;
    const hasL = config.circuitL > 1e-9;
    const hasC = config.circuitC > 1e-9;
    const dampingTerm = hasL ? config.circuitR / config.circuitL : 0;
    const capacitorTerm = hasL && hasC ? 1 / (config.circuitL * config.circuitC) : 0;
    const driveTerm = hasL ? voltage / config.circuitL : 0;
    return {
      type: "rlc",
      mode: hasL ? "secondOrder" : "circuitFirstOrder",
      t0: config.t0,
      t1: config.t1,
      h: config.h,
      y0: config.y0,
      v0: config.v0,
      circuitL: config.circuitL,
      circuitC: config.circuitC,
      circuitR: config.circuitR,
      circuitV: voltage,
      circuitOmega: config.circuitOmega,
      hasL,
      hasC,
      hasR: config.circuitR > 1e-9,
      omega: hasL && hasC ? 1 / Math.sqrt(config.circuitL * config.circuitC) : 0,
      gamma: dampingTerm,
      driveA: driveTerm,
      driveOmega: config.circuitOmega,
      equation: `-(${dampingTerm})*v - (${capacitorTerm})*y + (${driveTerm})*cos((${config.circuitOmega})*t)`,
      latex: buildRlcLatex(config.circuitL, config.circuitC, config.circuitR, voltage, config.circuitOmega),
      compare: config.compare || null,
      isCompare: !!config.isCompare,
      description: modelDescription("rlc")
    };
  }

  function buildPredatorModel(config) {
    return {
      type: "predatorPrey",
      mode: "planar",
      positiveState: true,
      t0: config.t0,
      t1: config.t1,
      h: config.h,
      y0: Math.max(config.y0, 0),
      v0: Math.max(config.v0, 0),
      predAlpha: config.predAlpha,
      predBeta: config.predBeta,
      predDelta: config.predDelta,
      predGamma: config.predGamma,
      derivative: (t, prey, wolves) => ({
        y: config.predAlpha * prey - config.predBeta * prey * wolves,
        v: config.predDelta * prey * wolves - config.predGamma * wolves
      }),
      latex: buildPredatorPreyLatex(config.predAlpha, config.predBeta, config.predDelta, config.predGamma),
      compare: config.compare || null,
      isCompare: !!config.isCompare,
      description: modelDescription("predatorPrey")
    };
  }

  function buildParticleModel(config) {
    return {
      type: config.type,
      mode: "particle2d",
      t0: config.t0,
      t1: config.t1,
      h: config.h,
      x0: config.x0,
      yParticle0: config.y0,
      vx0: config.vx0,
      vy0: config.vy0,
      y0: config.x0,
      v0: config.vx0,
      drag: config.drag,
      params: config.params || {},
      acceleration: config,
      phaseProjection: config.phaseProjection || "vx-vy",
      groundBounce: !!config.groundBounce,
      restitution: config.restitution ?? 1,
      postStep: config.groundBounce
        ? (before, predicted, tStart, tEnd, step, methodKey, derivative, keys) => bounceParticleAtGround(config, before, predicted, tStart, step, methodKey, derivative, keys)
        : null,
      latex: config.latex,
      description: modelDescription(config.type)
    };
  }

  function bounceParticleAtGround(model, before, predicted, tStart, step, methodKey, derivative, keys) {
    if (predicted.y >= 0) return predicted;
    const restitution = model.restitution ?? 1;
    if (Math.abs(model.drag || 0) < 1e-12 && before.y >= 0) {
      const ay = model.ay(before, tStart);
      const impactDt = solveGroundImpactTime(before.y, before.vy, ay, step);
      if (impactDt != null) {
        const remaining = step - impactDt;
        const impactX = before.x + before.vx * impactDt;
        const impactVx = before.vx;
        const impactVy = before.vy + ay * impactDt;
        const bouncedVy = Math.abs(impactVy) * restitution;
        const preImpactState = {
          x: impactX,
          y: 0,
          vx: impactVx,
          vy: impactVy,
          t: tStart + impactDt
        };
        const impactState = {
          x: impactX,
          y: 0,
          vx: impactVx,
          vy: bouncedVy,
          t: tStart + impactDt
        };
        const yAfter = bouncedVy * remaining + 0.5 * ay * remaining * remaining;
        const vyAfter = bouncedVy + ay * remaining;
        return {
          state: {
            x: impactX + impactVx * remaining,
            y: Math.max(0, yAfter),
            vx: impactVx,
            vy: yAfter < 0 && vyAfter < 0 ? Math.abs(vyAfter) * restitution : vyAfter
          },
          inserts: [preImpactState, impactState]
        };
      }
    }

    const fraction = before.y > predicted.y ? clamp(before.y / (before.y - predicted.y), 0, 1) : 0;
    const impact = interpolateVectorState(before, predicted, fraction, keys);
    impact.y = 0;
    const preImpactState = { ...impact, t: tStart + step * fraction };
    if (impact.vy < 0) impact.vy = -impact.vy * restitution;
    const remaining = step * (1 - fraction);
    const impactState = { ...impact, t: tStart + step * fraction };
    if (Math.abs(remaining) < 1e-12) return { state: impact, inserts: [preImpactState, impactState] };
    const after = stepVectorMethod(methodKey, derivative, tStart + step * fraction, impact, remaining, null, keys);
    if (after.y < 0) {
      after.y = 0;
      if (after.vy < 0) after.vy = -after.vy * restitution;
    }
    return { state: after, inserts: [preImpactState, impactState] };
  }

  function solveGroundImpactTime(y, vy, ay, step) {
    const maxDt = Math.abs(step);
    if (Math.abs(ay) < 1e-12) {
      if (Math.abs(vy) < 1e-12) return null;
      const dt = -y / vy;
      return dt >= 0 && dt <= maxDt ? dt : null;
    }
    const discriminant = vy * vy - 2 * ay * y;
    if (discriminant < 0) return null;
    const sqrtD = Math.sqrt(discriminant);
    const candidates = [
      (-vy - sqrtD) / ay,
      (-vy + sqrtD) / ay
    ].filter(dt => dt >= -1e-12 && dt <= maxDt + 1e-12);
    if (!candidates.length) return null;
    return Math.max(0, Math.min(...candidates));
  }

  function interpolateVectorState(a, b, fraction, keys) {
    const state = {};
    keys.forEach(key => {
      state[key] = a[key] + (b[key] - a[key]) * fraction;
    });
    return state;
  }

  function buildCompareModel(model) {
    if (!model.compare?.enabled) return null;
    if (model.type === "pendulum") {
      const useLinear = model.compare.pendulumMode === "linear";
      const length = useLinear ? model.length : Math.max(model.compare.length, 0.05);
      const w2 = model.g / length;
      return {
        ...model,
        compare: null,
        isCompare: true,
        isLinearCompare: useLinear,
        y0: useLinear ? model.y0 : model.compare.y0,
        v0: useLinear ? model.v0 : model.compare.v0,
        length,
        omega: Math.sqrt(w2),
        equation: useLinear
          ? `-(${w2})*y - (${model.gamma})*v + (${model.driveA})*cos((${model.driveOmega})*t)`
          : `-(${w2})*sin(y) - (${model.gamma})*v + (${model.driveA})*cos((${model.driveOmega})*t)`,
        latex: useLinear
          ? buildLinearPendulumLatex(model.g, length, model.gamma, model.driveA, model.driveOmega)
          : buildPendulumLatex(model.g, length, model.gamma, model.driveA, model.driveOmega)
      };
    }
    if (model.type === "rlc") {
      return buildRlcModel({
        t0: model.t0,
        t1: model.t1,
        h: model.h,
        y0: model.compare.y0,
        v0: model.compare.v0,
        circuitL: model.compare.circuitL,
        circuitC: model.compare.circuitC,
        circuitR: model.compare.circuitR,
        circuitV: model.compare.circuitV,
        circuitOmega: model.compare.circuitOmega,
        isCompare: true
      });
    }
    if (model.type === "predatorPrey") {
      return buildPredatorModel({
        t0: model.t0,
        t1: model.t1,
        h: model.h,
        y0: model.compare.y0,
        v0: model.compare.v0,
        predAlpha: model.compare.predAlpha,
        predBeta: model.compare.predBeta,
        predDelta: model.compare.predDelta,
        predGamma: model.compare.predGamma,
        isCompare: true
      });
    }
    const omega = model.compare.omega;
    return {
      ...model,
      compare: null,
      isCompare: true,
      y0: model.compare.y0,
      v0: model.compare.v0,
      omega,
      equation: `-(${omega * omega})*y - (${model.gamma})*v + (${model.driveA})*cos((${model.driveOmega})*t)`,
      latex: buildOscillatorLatex(omega, model.gamma, model.driveA, model.driveOmega)
    };
  }

  function modelDescription(type) {
    if (type === "oscillator") return "oscillator: x'' = -omega^2 x, with optional damping and drive";
    if (type === "pendulum") return "pendulum: theta'' = -(g/L) sin(theta)";
    if (type === "projectile") return "projectile motion: gravity bends a 2D trajectory";
    if (type === "verticalBounce") return "vertical projectile motion with energy loss at the floor";
    if (type === "chargedParticle") return "charged particle in uniform electric and magnetic fields";
    if (type === "coupledOscillators") return "two linear oscillators connected by a coupling spring";
    if (type === "rlc") return "RLC circuit: charge and current behave like a damped oscillator";
    if (type === "predatorPrey") return "predator-prey: two populations coupled by feedback";
    if (type === "neuron") return "FitzHugh-Nagumo neuron: voltage and recovery variable";
    return "";
  }

  function updatePhysicsControls(model = readModel()) {
    const type = document.getElementById("physicsSystem").value;
    const oscillator = type === "oscillator";
    const resonance = oscillator && (document.getElementById("physicsOscillatorMode")?.value || "simulation") === "resonance";
    const pendulum = type === "pendulum";
    const particle = type === "projectile" || type === "verticalBounce" || type === "chargedParticle";
    const bounce = type === "verticalBounce";
    const chargedParticle = type === "chargedParticle";
    const coupled = type === "coupledOscillators";
    const rlc = type === "rlc";
    const predator = type === "predatorPrey";
    const compare = oscillator || pendulum || rlc || predator;
    const compareEnabled = !!document.getElementById("physicsCompareEnabled")?.checked;
    const pendulumCompareMode = document.getElementById("physicsPendulumCompareMode")?.value || "custom";
    const linearPendulumCompare = pendulum && pendulumCompareMode === "linear";
    const visibility = {
      secondMethod: true,
      initial: !resonance && !particle && !coupled,
      omega: oscillator,
      oscillatorMode: oscillator,
      oscillatorAnimation: oscillator && !resonance,
      damping: type === "oscillator" || type === "pendulum",
      drive: type === "oscillator" || type === "pendulum",
      driveOmega: (type === "oscillator" || type === "pendulum") && !resonance,
      resonance,
      resonanceCompare: compareEnabled && resonance,
      pendulum,
      compare,
      compareInitial: compareEnabled && !resonance && (type === "oscillator" || rlc || predator || !linearPendulumCompare),
      compareOscillator: compareEnabled && type === "oscillator" && !resonance,
      comparePendulum: compareEnabled && pendulum,
      comparePendulumCustom: compareEnabled && pendulum && !linearPendulumCompare,
      compareRlc: compareEnabled && rlc,
      comparePredator: compareEnabled && predator,
      phaseProjection: particle || coupled,
      particleInitial: particle && !bounce,
      bounceInitial: bounce,
      particleDrag: particle,
      projectile: type === "projectile" || bounce,
      bounce,
      chargedParticle,
      electricField: chargedParticle,
      magneticField: chargedParticle,
      coupled,
      coupledInitial: coupled,
      rlc,
      predator,
      neuron: type === "neuron"
    };

    document.querySelectorAll("[data-physics-param]").forEach(group => {
      group.classList.toggle("hidden", !visibility[group.dataset.physicsParam]);
    });
    updatePhaseProjectionOptions(type);

    const labels = variableLabels(model || { type });
    document.getElementById("physicsY0Label").textContent = `${labels.y}(0)`;
    document.getElementById("physicsV0Label").textContent = `${labels.v}(0)`;
    document.getElementById("physicsCompareY0Label").textContent = `${labels.y}B(0)`;
    document.getElementById("physicsCompareV0Label").textContent = `${labels.v}B(0)`;
    const pickTarget = document.getElementById("physicsResPickTarget");
    const pickB = pickTarget?.querySelector('option[value="B"]');
    if (pickB) {
      pickB.disabled = !compareEnabled;
      if (!compareEnabled && pickTarget.value === "B") pickTarget.value = "A";
    }
    renderEquation(model);
  }

  function renderEquation(model) {
    const el = document.getElementById("physicsEquation");
    if (!el || !model) return;
    el.innerHTML = model.latex || "";
    if (window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise([el]).catch(() => {});
    }
  }

  function updatePhaseProjectionOptions(type) {
    const select = document.getElementById("physicsPhaseProjection");
    if (!select) return;
    const options = phaseProjectionOptions(type);
    const previous = select.value || defaultPhaseProjection(type);
    select.innerHTML = options
      .map(option => `<option value="${option.value}">${option.label}</option>`)
      .join("");
    select.value = options.some(option => option.value === previous)
      ? previous
      : defaultPhaseProjection(type);
  }

  function phaseProjectionOptions(type) {
    if (type === "coupledOscillators") {
      return [
        { value: "coupledBoth", label: "x1-v1 and x2-v2" },
        { value: "x1-v1", label: "x1 vs v1" },
        { value: "x2-v2", label: "x2 vs v2" },
        { value: "x1-x2", label: "x1 vs x2" },
        { value: "v1-v2", label: "v1 vs v2" },
        { value: "x1-v2", label: "x1 vs v2" },
        { value: "x2-v1", label: "x2 vs v1" }
      ];
    }
    return [
      { value: "particleCompare", label: "x-vx and y-vy" },
      { value: "x-y", label: "x vs y" },
      { value: "x-vx", label: "x vs vx" },
      { value: "x-vy", label: "x vs vy" },
      { value: "y-vx", label: "y vs vx" },
      { value: "y-vy", label: "y vs vy" },
      { value: "vx-vy", label: "vx vs vy" },
    ];
  }

  function defaultPhaseProjection(type) {
    if (type === "verticalBounce") return "y-vy";
    if (type === "coupledOscillators") return "coupledBoth";
    return "particleCompare";
  }

  function normalizePhaseProjection(kind, value, fallback) {
    const type = kind === "coupled" ? "coupledOscillators" : "projectile";
    const allowed = phaseProjectionOptions(type).map(option => option.value);
    return allowed.includes(value) ? value : fallback;
  }

  function buildOscillatorLatex(omega, gamma, driveA, driveOmega) {
    let equation = "\\ddot{x} = -\\omega^2 x";
    const params = [
      ["\\omega", omega]
    ];
    if (Math.abs(gamma) > 1e-9) {
      equation += " - \\gamma\\dot{x}";
      params.push(["\\gamma", gamma]);
    }
    if (Math.abs(driveA) > 1e-9) {
      equation += " + A\\cos(\\Omega t)";
      params.push(["A", driveA], ["\\Omega", driveOmega]);
    }
    return equationMarkup(equation, params);
  }

  function buildResonanceOscillatorLatex(omega, gamma, driveA) {
    let equation = "\\ddot{x} = -\\omega_0^2 x";
    const params = [
      ["\\omega_0", omega],
      ["A", driveA]
    ];
    if (Math.abs(gamma) > 1e-9) {
      equation += " - \\gamma\\dot{x}";
      params.push(["\\gamma", gamma]);
    }
    equation += " + A\\cos(\\Omega t)";
    return equationMarkup(equation, params, [
      "Omega is scanned; A and B choose two drive frequencies from the scan"
    ]);
  }

  function buildPendulumLatex(g, length, gamma, driveA, driveOmega) {
    let equation = "\\ddot{\\theta} = -\\frac{g}{L}\\sin\\theta";
    const params = [
      ["g", g],
      ["L", length]
    ];
    if (Math.abs(gamma) > 1e-9) {
      equation += " - \\gamma\\dot{\\theta}";
      params.push(["\\gamma", gamma]);
    }
    if (Math.abs(driveA) > 1e-9) {
      equation += " + A\\cos(\\Omega t)";
      params.push(["A", driveA], ["\\Omega", driveOmega]);
    }
    return equationMarkup(equation, params);
  }

  function buildLinearPendulumLatex(g, length, gamma, driveA, driveOmega) {
    let equation = "\\ddot{\\theta} = -\\frac{g}{L}\\theta";
    const params = [
      ["g", g],
      ["L", length]
    ];
    if (Math.abs(gamma) > 1e-9) {
      equation += " - \\gamma\\dot{\\theta}";
      params.push(["\\gamma", gamma]);
    }
    if (Math.abs(driveA) > 1e-9) {
      equation += " + A\\cos(\\Omega t)";
      params.push(["A", driveA], ["\\Omega", driveOmega]);
    }
    return equationMarkup(equation, params, [
      "linearized pendulum: sin(theta) is replaced by theta"
    ]);
  }

  function buildRlcLatex(circuitL, circuitC, circuitR, voltage, circuitOmega) {
    const hasL = circuitL > 1e-9;
    const hasC = circuitC > 1e-9;
    const hasR = circuitR > 1e-9;
    let equation = "0=0";
    const params = [
      ["L", circuitL],
      ["C", circuitC],
      ["R", circuitR]
    ];

    if (hasL && hasC) equation = "L\\ddot{q} + R\\dot{q} + \\frac{q}{C} = 0";
    else if (hasL) equation = "L\\dot{i} + Ri = 0";
    else if (hasC && hasR) equation = "R\\dot{q} + \\frac{q}{C} = 0";
    else if (hasC) equation = "q = C V_{ext}(t)";
    else if (hasR) equation = "i = \\frac{V_{ext}(t)}{R}";

    if (Math.abs(voltage) > 1e-9) {
      if (hasL && hasC) equation = "L\\ddot{q} + R\\dot{q} + \\frac{q}{C} = V_0\\cos(\\Omega t)";
      else if (hasL) equation = "L\\dot{i} + Ri = V_0\\cos(\\Omega t)";
      else if (hasC && hasR) equation = "R\\dot{q} + \\frac{q}{C} = V_0\\cos(\\Omega t)";
      else if (hasC) equation = "q = C V_0\\cos(\\Omega t)";
      else if (hasR) equation = "i = \\frac{V_0\\cos(\\Omega t)}{R}";
      params.push(["V_0", voltage], ["\\Omega", circuitOmega]);
    }
    return equationMarkup(equation, params, [
      "q: charge on the capacitor",
      "i=dq/dt: current",
      "L: inductor stores magnetic-field energy",
      "C: capacitor stores electric-field energy",
      "R: resistor turns electrical energy into heat"
    ]);
  }

  function buildPredatorPreyLatex(alpha, beta, delta, gamma) {
    const equation = "\\text{Lotka-Volterra:}\\quad \\dot{s}=\\alpha s-\\beta sw,\\quad \\dot{w}=\\delta sw-\\gamma w";
    return equationMarkup(equation, [
      ["\\alpha", alpha],
      ["\\beta", beta],
      ["\\delta", delta],
      ["\\gamma", gamma]
    ], [
      "s: sheep / prey population",
      "w: wolves / predator population",
      "&alpha;: natural prey growth",
      "&beta;: encounters where predators eat prey",
      "&delta;: predator growth from successful hunting",
      "&gamma;: natural predator decline"
    ]);
  }

  function buildNeuronLatex(a, b, tau, input) {
    const equation = "\\text{FitzHugh-Nagumo:}\\quad \\dot{u}=u-\\frac{u^3}{3}-w+I,\\quad \\dot{w}=\\frac{u+a-bw}{\\tau}";
    return equationMarkup(equation, [
      ["a", a],
      ["b", b],
      ["\\tau", tau],
      ["I", input]
    ], [
      "u: membrane voltage-like variable",
      "w: recovery / inhibition variable, a slow stand-in for ion-channel effects",
      "I: external input current",
      "a,b: recovery curve shape",
      "&tau;: recovery time scale"
    ]);
  }

  function buildProjectileLatex(g, drag) {
    const equation = drag > 1e-9
      ? "\\dot{x}=v_x,\\quad \\dot{y}=v_y,\\quad \\dot{v}_x=-d v_x,\\quad \\dot{v}_y=-g-d v_y"
      : "\\dot{x}=v_x,\\quad \\dot{y}=v_y,\\quad \\dot{v}_x=0,\\quad \\dot{v}_y=-g";
    const params = [["g", g]];
    if (drag > 1e-9) params.push(["d", drag]);
    return equationMarkup(equation, params, [
      "x,y: position in the plane",
      "vx,vy: velocity components",
      "d: simple linear air resistance"
    ]);
  }

  function buildVerticalBounceLatex(g, drag, restitution) {
    const equation = drag > 1e-9
      ? "\\dot{y}=v_y,\\quad \\dot{v}_y=-g-dv_y,\\quad y=0:\\ v_y\\to -e v_y"
      : "\\dot{y}=v_y,\\quad \\dot{v}_y=-g,\\quad y=0:\\ v_y\\to -e v_y";
    const params = [["g", g], ["e", restitution]];
    if (drag > 1e-9) params.push(["d", drag]);
    return equationMarkup(equation, params, [
      "e: restitution coefficient at the floor",
      "e=1 keeps mechanical energy at bounce",
      "e<1 loses energy at every bounce"
    ]);
  }

  function buildElectricParticleLatex(q, m, ex, ey, drag) {
    const equation = drag > 1e-9
      ? "\\dot{\\vec r}=\\vec v,\\quad \\dot{\\vec v}=\\frac{q}{m}\\vec E-d\\vec v"
      : "\\dot{\\vec r}=\\vec v,\\quad \\dot{\\vec v}=\\frac{q}{m}\\vec E";
    const params = [["q", q], ["m", m], ["E_x", ex], ["E_y", ey]];
    if (drag > 1e-9) params.push(["d", drag]);
    return equationMarkup(equation, params, [
      "uniform electric field gives a constant acceleration",
      "positive and negative q accelerate in opposite directions"
    ]);
  }

  function buildMagneticParticleLatex(q, m, bz, drag) {
    const equation = drag > 1e-9
      ? "\\dot{\\vec r}=\\vec v,\\quad \\dot{\\vec v}=\\frac{q}{m}(\\vec v\\times\\vec B)-d\\vec v"
      : "\\dot{\\vec r}=\\vec v,\\quad \\dot{\\vec v}=\\frac{q}{m}(\\vec v\\times\\vec B)";
    const params = [["q", q], ["m", m], ["B_z", bz]];
    if (drag > 1e-9) params.push(["d", drag]);
    return equationMarkup(equation, params, [
      "Bz is perpendicular to the screen",
      "magnetic force turns the velocity instead of speeding along it"
    ]);
  }

  function buildChargedParticleLatex(q, m, ex, ey, bz, drag) {
    const equation = drag > 1e-9
      ? "\\dot{\\vec r}=\\vec v,\\quad \\dot{\\vec v}=\\frac{q}{m}(\\vec E+\\vec v\\times\\vec B)-d\\vec v"
      : "\\dot{\\vec r}=\\vec v,\\quad \\dot{\\vec v}=\\frac{q}{m}(\\vec E+\\vec v\\times\\vec B)";
    const params = [["q", q], ["m", m], ["E_x", ex], ["E_y", ey], ["B_z", bz]];
    if (drag > 1e-9) params.push(["d", drag]);
    return equationMarkup(equation, params, [
      "set Bz=0 for pure electric-field motion",
      "set Ex=Ey=0 for pure magnetic-field motion",
      "magnetic force changes direction of velocity; electric field can change speed"
    ]);
  }

  function buildCoupledOscillatorsLatex(omega, kappa, gamma) {
    let equation = "\\ddot{x}_1=-\\omega_0^2x_1-\\kappa(x_1-x_2),\\quad \\ddot{x}_2=-\\omega_0^2x_2-\\kappa(x_2-x_1)";
    const params = [["\\omega_0", omega], ["\\kappa", kappa]];
    if (gamma > 1e-9) {
      equation = "\\ddot{x}_1=-\\omega_0^2x_1-\\kappa(x_1-x_2)-\\gamma\\dot{x}_1,\\quad \\ddot{x}_2=-\\omega_0^2x_2-\\kappa(x_2-x_1)-\\gamma\\dot{x}_2";
      params.push(["\\gamma", gamma]);
    }
    return equationMarkup(equation, params, [
      "x1,x2: displacement of the two masses",
      "&kappa;: coupling strength between them",
      "linear coupled oscillators exchange energy but are not chaotic"
    ]);
  }

  function equationMarkup(equation, params, notes = []) {
    const paramMarkup = params
      .map(([name, value]) => `<span>\\(${name}=${formatHudNumber(value)}\\)</span>`)
      .join("");
    const notesMarkup = notes.length
      ? `<div class="equation-notes">${notes.map(note => `<span>${note}</span>`).join("")}</div>`
      : "";
    return `<div class="equation-line">\\(${equation}\\)</div><div class="equation-params">${paramMarkup}</div>${notesMarkup}`;
  }

  function variableLabels(model) {
    if (model.type === "pendulum") return { y: "\u03b8", v: "\u03b8'" };
    if (model.type === "rlc") return { y: "q", v: "i" };
    if (model.type === "predatorPrey") return { y: "sheep", v: "wolves" };
    if (model.type === "neuron") return { y: "u", v: "w" };
    if (model.mode === "particle2d") return { y: "x", v: "vx" };
    if (model.mode === "coupled") return { y: "x1", v: "v1" };
    return { y: "x", v: "v" };
  }

  function metricLabels(model) {
    if (model.type === "rlc") return {
      a: "inductor energy",
      b: "capacitor energy",
      total: "total energy",
      title: "electrical energy",
      axis: "E"
    };
    if (model.type === "predatorPrey") return {
      a: "sheep change",
      b: "wolf change",
      total: "net change",
      title: "instantaneous population change",
      axis: "rate"
    };
    if (model.type === "neuron") return {
      a: "voltage rate",
      b: "recovery rate",
      total: "combined rate",
      title: "instantaneous rates",
      axis: "rate"
    };
    return {
      a: "kinetic",
      b: "potential",
      total: "total energy",
      title: "energy",
      axis: "E"
    };
  }

  function setExtraPhysicsPlotVisible(visible) {
    const el = document.getElementById("physicsExtraPlot");
    if (!el) return;
    el.classList.toggle("hidden", !visible);
    if (!visible && window.Plotly?.purge) window.Plotly.purge(el);
  }

  function energyComponentSpecs(model) {
    if (model.mode === "particle2d") {
      const specs = [
        {
          key: "kinetic",
          name: hasElectricField(model) ? "kinetic energy" : "kinetic energy = total",
          color: "#2563eb",
          value: (m, point) => {
            const mass = particleMassForEnergy(m);
            return 0.5 * mass * (point.vx * point.vx + point.vy * point.vy);
          }
        }
      ];
      if (model.type === "projectile" || model.type === "verticalBounce") {
        specs.push({
          key: "potential",
          name: "gravitational potential",
          color: "#f97316",
          value: (m, point) => particleMassForEnergy(m) * (m.params.g || 0) * point.yPos
        });
      } else if (model.type === "chargedParticle" && hasElectricField(model)) {
        specs.push({
          key: "potential",
          name: "electric potential",
          color: "#f97316",
          value: (m, point) => -(m.params.q || 0) * ((m.params.ex || 0) * point.x + (m.params.ey || 0) * point.yPos)
        });
      }
      specs.push({
        key: "total",
        name: "total energy",
        color: "#16a34a",
        width: 2.6,
        value: (m, point) => specs
          .filter(spec => spec.key !== "total")
          .reduce((sum, spec) => sum + spec.value(m, point), 0)
      });
      return specs;
    }

    if (model.mode === "coupled") {
      return [
        {
          key: "kinetic1",
          name: "mass 1 kinetic",
          color: "#2563eb",
          value: (m, point) => 0.5 * point.v1 * point.v1
        },
        {
          key: "kinetic2",
          name: "mass 2 kinetic",
          color: "#0ea5e9",
          value: (m, point) => 0.5 * point.v2 * point.v2
        },
        {
          key: "wallSpring",
          name: "outer springs",
          color: "#f97316",
          value: (m, point) => 0.5 * m.omega * m.omega * (point.x1 * point.x1 + point.x2 * point.x2)
        },
        {
          key: "coupling",
          name: "coupling spring",
          color: "#a855f7",
          value: (m, point) => 0.5 * m.kappa * (point.x1 - point.x2) * (point.x1 - point.x2)
        },
        {
          key: "total",
          name: "total energy",
          color: "#16a34a",
          width: 2.8,
          value: (m, point) => 0.5 * point.v1 * point.v1
            + 0.5 * point.v2 * point.v2
            + 0.5 * m.omega * m.omega * (point.x1 * point.x1 + point.x2 * point.x2)
            + 0.5 * m.kappa * (point.x1 - point.x2) * (point.x1 - point.x2)
        }
      ];
    }
    return [];
  }

  function particleMassForEnergy(model) {
    return model.params?.m || 1;
  }

  function hasElectricField(model) {
    return Math.hypot(model.params?.ex || 0, model.params?.ey || 0) > 1e-9;
  }

  function drawExtraEnergyPlot(model, result) {
    const specs = energyComponentSpecs(model);
    if (!specs.length) {
      setExtraPhysicsPlotVisible(false);
      return;
    }
    setExtraPhysicsPlotVisible(true);
    const t = result.points.map(point => point.t);
    const fullTraces = specs.map(spec => ({
      x: t,
      y: result.points.map(point => spec.value(model, point)),
      name: spec.name,
      mode: "lines",
      line: { color: spec.color, width: spec.width || 1.5 },
      opacity: spec.key === "total" ? 0.34 : 0.22
    }));
    const elapsedTraces = specs.map(spec => ({
      x: [],
      y: [],
      name: `${spec.name} elapsed`,
      mode: "lines",
      showlegend: false,
      line: { color: spec.color, width: spec.width || 2.3 }
    }));
    const allValues = fullTraces.flatMap(trace => trace.y);
    window.Plotly.newPlot("physicsExtraPlot", [...fullTraces, ...elapsedTraces], {
      title: "energy",
      margin: { t: 42, r: 16, b: 42, l: 52 },
      xaxis: { title: "t", range: [model.t0, model.t1], autorange: false, fixedrange: true },
      yaxis: { title: "E", range: paddedRange(allValues), autorange: false, fixedrange: true },
      shapes: [timeCursorShape(model.t0)],
      annotations: [timeCursorAnnotation(model.t0)],
      uirevision: `${model.type}-extra-energy`
    }, { responsive: true });
  }

  function drawResonancePlots(modelA, modelB, resultA, resultB, scan) {
    setExtraPhysicsPlotVisible(false);
    const scanOmega = scan.points.map(point => point.omega);
    const scanAmplitude = scan.points.map(point => point.amplitude);
    const tA = resultA.points.map(point => point.t);
    const xA = resultA.points.map(point => point.y);
    const vA = resultA.points.map(point => point.v);
    const tB = resultB?.points.map(point => point.t) || [];
    const xB = resultB?.points.map(point => point.y) || [];
    const vB = resultB?.points.map(point => point.v) || [];
    const hasB = !!modelB && !!resultB;
    const shapes = [
      resonanceVerticalLine(scan.naturalOmega, "#2563eb", "dot")
    ];
    const annotations = [
      resonanceAnnotation(scan.naturalOmega, "omega0", "#2563eb")
    ];
    if (scan.predictedOmega != null) {
      shapes.push(resonanceVerticalLine(scan.predictedOmega, "#16a34a", "dash"));
      annotations.push(resonanceAnnotation(scan.predictedOmega, "damped peak approx", "#16a34a", 0.88));
    }

    const scanTraces = [
      {
        x: scanOmega,
        y: scanAmplitude,
        name: "steady amplitude",
        mode: "lines+markers",
        line: { color: "#111827", width: 2 },
        marker: { color: "#111827", size: 8 }
      },
      {
        x: [modelA.driveOmega],
        y: [nearestResonanceAmplitude(scan, modelA.driveOmega)],
        name: "Omega A",
        mode: "markers",
        marker: { color: "#2563eb", size: 12, line: { color: "#ffffff", width: 2 } }
      },
      {
        x: [scan.peak.omega],
        y: [scan.peak.amplitude],
        name: "numeric peak",
        mode: "markers",
        marker: { color: "#dc2626", size: 13, symbol: "star" }
      }
    ];
    if (hasB) {
      scanTraces.splice(2, 0, {
        x: [modelB.driveOmega],
        y: [nearestResonanceAmplitude(scan, modelB.driveOmega)],
        name: "Omega B",
        mode: "markers",
        marker: { color: "#f97316", size: 12, line: { color: "#ffffff", width: 2 } }
      });
    }

    window.Plotly.newPlot("physicsTimePlot", scanTraces, {
      title: "resonance scan: steady amplitude vs drive frequency",
      margin: { t: 42, r: 16, b: 42, l: 58 },
      xaxis: { title: "drive frequency Omega", range: paddedRange(scanOmega), fixedrange: true },
      yaxis: { title: "steady amplitude", range: paddedRange(scanAmplitude), fixedrange: true },
      shapes,
      annotations,
      clickmode: "event",
      hovermode: "closest",
      uirevision: "oscillator-resonance-scan"
    }, { responsive: true });
    bindResonanceScanClick();

    const responseTraces = [
      {
        x: tA,
        y: xA,
        name: `A: Omega=${formatHudNumber(modelA.driveOmega)}`,
        mode: "lines",
        line: { color: "#2563eb", width: 1.5 },
        opacity: 0.3
      },
      {
        x: [],
        y: [],
        name: "A elapsed",
        mode: "lines",
        showlegend: false,
        line: { color: "#2563eb", width: 2.7 }
      }
    ];
    if (hasB) {
      responseTraces.push(
        {
          x: tB,
          y: xB,
          name: `B: Omega=${formatHudNumber(modelB.driveOmega)}`,
          mode: "lines",
          line: { color: "#f97316", width: 1.5 },
          opacity: 0.3
        },
        {
          x: [],
          y: [],
          name: "B elapsed",
          mode: "lines",
          showlegend: false,
          line: { color: "#f97316", width: 2.7 }
        }
      );
    }

    window.Plotly.newPlot("physicsPhasePlot", responseTraces, {
      title: hasB ? "steady response x(t) for Omega A and Omega B" : "steady response x(t) for Omega A",
      margin: { t: 42, r: 16, b: 42, l: 52 },
      xaxis: { title: "t", range: [0, Math.max(tA[tA.length - 1] || 1, tB[tB.length - 1] || 1)], fixedrange: true },
      yaxis: { title: "x", range: paddedRange([...xA, ...xB]), fixedrange: true },
      shapes: [timeCursorShape(0)],
      annotations: [timeCursorAnnotation(0)],
      uirevision: "oscillator-resonance-response"
    }, { responsive: true });

    const phaseTraces = [
      {
        x: xA,
        y: vA,
        name: "A phase",
        mode: "lines",
        line: { color: "#2563eb", width: 1.5 },
        opacity: 0.35
      },
      {
        x: [],
        y: [],
        name: "A phase elapsed",
        mode: "lines",
        showlegend: false,
        line: { color: "#2563eb", width: 2.5 }
      },
      {
        x: [modelA.y0],
        y: [modelA.v0],
        name: "A current",
        mode: "markers",
        showlegend: false,
        marker: { color: "#2563eb", size: 11, line: { color: "#ffffff", width: 2 } }
      }
    ];
    if (hasB) {
      phaseTraces.push(
        {
          x: xB,
          y: vB,
          name: "B phase",
          mode: "lines",
          line: { color: "#f97316", width: 1.5 },
          opacity: 0.35
        },
        {
          x: [],
          y: [],
          name: "B phase elapsed",
          mode: "lines",
          showlegend: false,
          line: { color: "#f97316", width: 2.5 }
        },
        {
          x: [modelB.y0],
          y: [modelB.v0],
          name: "B current",
          mode: "markers",
          showlegend: false,
          marker: { color: "#f97316", size: 11, line: { color: "#ffffff", width: 2 } }
        }
      );
    }

    window.Plotly.newPlot("physicsEnergyPlot", phaseTraces, {
      title: hasB ? "phase comparison for the selected drive frequencies" : "phase path for the selected drive frequency",
      margin: { t: 42, r: 16, b: 42, l: 52 },
      xaxis: { title: "x", range: paddedRange([...xA, ...xB]), fixedrange: true },
      yaxis: { title: "v", range: paddedRange([...vA, ...vB]), fixedrange: true },
      uirevision: "oscillator-resonance-phase"
    }, { responsive: true });
  }

  function nearestResonanceAmplitude(scan, omega) {
    if (!scan.points.length) return 0;
    return scan.points.reduce((best, point) => Math.abs(point.omega - omega) < Math.abs(best.omega - omega) ? point : best, scan.points[0]).amplitude;
  }

  function resonanceVerticalLine(x, color, dash = "solid") {
    return {
      type: "line",
      x0: x,
      x1: x,
      y0: 0,
      y1: 1,
      yref: "paper",
      line: { color, width: 1.5, dash }
    };
  }

  function resonanceAnnotation(x, text, color, y = 1) {
    return {
      x,
      y,
      xref: "x",
      yref: "paper",
      text,
      showarrow: false,
      yanchor: "bottom",
      font: { color, size: 11 },
      bgcolor: "rgba(255,255,255,0.82)"
    };
  }

  function bindResonanceScanClick() {
    const plot = document.getElementById("physicsTimePlot");
    if (!plot || !plot.on) return;
    if (plot.removeAllListeners) plot.removeAllListeners("plotly_click");
    plot._physicsResonanceClickHandler = event => {
      if (currentModel?.analysisMode !== "resonance") return;
      const point = event?.points?.[0];
      if (!point || !isFinite(point.x)) return;
      const compareEnabled = !!document.getElementById("physicsCompareEnabled")?.checked;
      const target = compareEnabled ? (document.getElementById("physicsResPickTarget")?.value || "A") : "A";
      const input = document.getElementById(target === "B" ? "physicsResOmegaB" : "physicsResOmegaA");
      if (!input) return;
      input.value = String(Number(point.x).toFixed(4));
      runPhysicsSimulation();
    };
    plot.on("plotly_click", plot._physicsResonanceClickHandler);
  }

  function drawPhysicsPlots(model, result) {
    if (model.mode === "particle2d") {
      drawParticlePlots(model, result);
      return;
    }
    if (model.mode === "coupled") {
      drawCoupledPlots(model, result);
      return;
    }
    setExtraPhysicsPlotVisible(false);
    const t = result.points.map(point => point.t);
    const y = result.points.map(point => point.y);
    const v = result.points.map(point => point.v);
    const compareT = currentCompareResult?.points.map(point => point.t) || [];
    const compareY = currentCompareResult?.points.map(point => point.y) || [];
    const compareV = currentCompareResult?.points.map(point => point.v) || [];
    const labels = variableLabels(model);
    const metrics = result.points.map(point => metricParts(model, point));
    const compareMetrics = currentCompareResult && currentCompareModel
      ? currentCompareResult.points.map(point => metricParts(currentCompareModel, point))
      : [];
    const metricNames = metricLabels(model);
    const compareLabel = currentCompareModel?.isLinearCompare ? "B linear" : "B";
    const timeYRange = paddedRange([...y, ...v, ...compareY, ...compareV]);
    const phaseXRange = paddedRange([...y, ...compareY]);
    const phaseYRange = paddedRange([...v, ...compareV]);
    const timeTraces = [
      {
        x: t,
        y,
        name: `A: ${labels.y}(t)`,
        mode: "lines",
        line: { color: "#2563eb", width: 1.5 },
        opacity: 0.25
      },
      {
        x: t,
        y: v,
        name: `A: ${labels.v}(t)`,
        mode: "lines",
        line: { color: "#dc2626", width: 1.5 },
        opacity: 0.25
      },
      {
        x: [],
        y: [],
        name: `${labels.y} elapsed`,
        mode: "lines",
        showlegend: false,
        line: { color: "#2563eb", width: 2.6 }
      },
      {
        x: [],
        y: [],
        name: `${labels.v} elapsed`,
        mode: "lines",
        showlegend: false,
        line: { color: "#dc2626", width: 2.6 }
      }
    ];
    if (currentCompareResult) {
      timeTraces.push(
        {
          x: compareT,
          y: compareY,
          name: `${compareLabel}: ${labels.y}(t)`,
          mode: "lines",
          line: { color: "#0ea5e9", width: 1.6, dash: "dot" },
          opacity: 0.55
        },
        {
          x: compareT,
          y: compareV,
          name: `${compareLabel}: ${labels.v}(t)`,
          mode: "lines",
          line: { color: "#f97316", width: 1.6, dash: "dot" },
          opacity: 0.55
        },
        {
          x: [],
          y: [],
          name: `${compareLabel} ${labels.y} elapsed`,
          mode: "lines",
          showlegend: false,
          line: { color: "#0ea5e9", width: 2.5, dash: "dot" }
        },
        {
          x: [],
          y: [],
          name: `${compareLabel} ${labels.v} elapsed`,
          mode: "lines",
          showlegend: false,
          line: { color: "#f97316", width: 2.5, dash: "dot" }
        }
      );
    }
    window.Plotly.newPlot("physicsTimePlot", timeTraces, {
      title: `${labels.y}(t) and ${labels.v}(t)`,
      margin: { t: 42, r: 16, b: 42, l: 52 },
      xaxis: { title: "t", range: [model.t0, model.t1], autorange: false, fixedrange: true },
      yaxis: { title: `${labels.y}, ${labels.v}`, range: timeYRange, autorange: false, fixedrange: true },
      shapes: [timeCursorShape(model.t0)],
      annotations: [timeCursorAnnotation(model.t0)],
      uirevision: `${model.type}-time`
    }, { responsive: true });

    const phaseTraces = [
      {
        x: y,
        y: v,
        name: "A phase path",
        mode: "lines",
        line: { color: "#111827", width: 1.5 },
        opacity: 0.25
      },
      {
        x: [],
        y: [],
        name: "phase elapsed",
        mode: "lines",
        showlegend: false,
        line: { color: "#111827", width: 2.8 }
      },
      {
        x: [model.y0],
        y: [model.v0],
        name: "current state",
        mode: "markers",
        showlegend: false,
        marker: {
          color: "#dc2626",
          size: 12,
          line: { color: "#ffffff", width: 2 }
        }
      }
    ];
    if (currentCompareResult) {
      phaseTraces.push(
        {
          x: compareY,
          y: compareV,
          name: `${compareLabel} phase path`,
          mode: "lines",
          line: { color: "#0ea5e9", width: 1.7, dash: "dot" },
          opacity: 0.5
        },
        {
          x: [],
          y: [],
          name: `${compareLabel} phase elapsed`,
          mode: "lines",
          showlegend: false,
          line: { color: "#0ea5e9", width: 2.7, dash: "dot" }
        },
        {
          x: [currentCompareModel.y0],
          y: [currentCompareModel.v0],
          name: `${compareLabel} current state`,
          mode: "markers",
          showlegend: false,
          marker: {
            color: "#0ea5e9",
            size: 11,
            line: { color: "#ffffff", width: 2 }
          }
        }
      );
    }
    window.Plotly.newPlot("physicsPhasePlot", phaseTraces, {
      title: `phase path: (${labels.y}, ${labels.v})`,
      margin: { t: 42, r: 16, b: 42, l: 52 },
      xaxis: { title: labels.y, range: phaseXRange, autorange: false, fixedrange: true },
      yaxis: { title: labels.v, range: phaseYRange, autorange: false, fixedrange: true },
      uirevision: `${model.type}-phase`
    }, { responsive: true });

    const energyTraces = [
      {
        x: t,
        y: metrics.map(item => item.kinetic),
        name: metricNames.a,
        mode: "lines",
        line: { color: "#2563eb", width: 1.3 },
        opacity: 0.22
      },
      {
        x: t,
        y: metrics.map(item => item.potential),
        name: metricNames.b,
        mode: "lines",
        line: { color: "#f97316", width: 1.3 },
        opacity: 0.22
      },
      {
        x: t,
        y: metrics.map(item => item.total),
        name: metricNames.total,
        mode: "lines",
        line: { color: "#16a34a", width: 1.6 },
        opacity: 0.28
      },
      {
        x: [],
        y: [],
        name: "kinetic elapsed",
        mode: "lines",
        showlegend: false,
        line: { color: "#2563eb", width: 2.2 }
      },
      {
        x: [],
        y: [],
        name: "potential elapsed",
        mode: "lines",
        showlegend: false,
        line: { color: "#f97316", width: 2.2 }
      },
      {
        x: [],
        y: [],
        name: "total elapsed",
        mode: "lines",
        showlegend: false,
        line: { color: "#16a34a", width: 2.8 }
      }
    ];
    if (currentCompareResult) {
      energyTraces.push(
        {
          x: compareT,
          y: compareMetrics.map(item => item.total),
          name: `${compareLabel} ${metricNames.total}`,
          mode: "lines",
          line: { color: "#0ea5e9", width: 1.7, dash: "dot" },
          opacity: 0.65
        },
        {
          x: [],
          y: [],
          name: `${compareLabel} ${metricNames.total} elapsed`,
          mode: "lines",
          showlegend: false,
          line: { color: "#0ea5e9", width: 2.7, dash: "dot" }
        }
      );
    }
    window.Plotly.newPlot("physicsEnergyPlot", energyTraces, {
      title: metricNames.title,
      margin: { t: 42, r: 16, b: 42, l: 52 },
      xaxis: { title: "t" },
      yaxis: { title: metricNames.axis },
      shapes: [timeCursorShape(model.t0)],
      annotations: [timeCursorAnnotation(model.t0)]
    }, { responsive: true });
  }

  function projectionTrace(model, points, projection) {
    const [xKey, yKey] = projection.split("-");
    return {
      x: points.map(point => projectionValue(point, xKey)),
      y: points.map(point => projectionValue(point, yKey)),
      xLabel: projectionLabel(xKey),
      yLabel: projectionLabel(yKey)
    };
  }

  function projectionPoint(model, point, projection) {
    const [xKey, yKey] = projection.split("-");
    return {
      x: projectionValue(point, xKey),
      y: projectionValue(point, yKey)
    };
  }

  function projectionValue(point, key) {
    if (key === "y") return point.yPos;
    return point[key];
  }

  function projectionLabel(key) {
    if (key === "y") return "y";
    return key;
  }

  function drawParticlePlots(model, result) {
    drawExtraEnergyPlot(model, result);
    const points = result.points;
    const t = points.map(point => point.t);
    const x = points.map(point => point.x);
    const y = points.map(point => point.yPos);
    const vx = points.map(point => point.vx);
    const vy = points.map(point => point.vy);
    window.Plotly.newPlot("physicsTimePlot", [
      {
        x: t,
        y: vx,
        name: "vx(t)",
        mode: "lines",
        line: { color: "#dc2626", width: 1.5 },
        opacity: 0.25
      },
      {
        x: t,
        y: vy,
        name: "vy(t)",
        mode: "lines",
        line: { color: "#f97316", width: 1.5 },
        opacity: 0.25
      },
      {
        x: [],
        y: [],
        name: "vx elapsed",
        mode: "lines",
        showlegend: false,
        line: { color: "#dc2626", width: 2.6 }
      },
      {
        x: [],
        y: [],
        name: "vy elapsed",
        mode: "lines",
        showlegend: false,
        line: { color: "#f97316", width: 2.6 }
      }
    ], {
      title: "velocity components over time",
      margin: { t: 42, r: 16, b: 42, l: 52 },
      xaxis: { title: "t", range: [model.t0, model.t1], autorange: false, fixedrange: true },
      yaxis: { title: "vx, vy", range: paddedRange([...vx, ...vy]), autorange: false, fixedrange: true },
      shapes: [timeCursorShape(model.t0)],
      annotations: [timeCursorAnnotation(model.t0)],
      uirevision: `${model.type}-velocities`
    }, { responsive: true });

    window.Plotly.newPlot("physicsPhasePlot", [
      {
        x: t,
        y: x,
        name: "x(t)",
        mode: "lines",
        line: { color: "#2563eb", width: 1.5 },
        opacity: 0.25
      },
      {
        x: t,
        y,
        name: "y(t)",
        mode: "lines",
        line: { color: "#16a34a", width: 1.5 },
        opacity: 0.25
      },
      {
        x: [],
        y: [],
        name: "x elapsed",
        mode: "lines",
        showlegend: false,
        line: { color: "#2563eb", width: 2.6 }
      },
      {
        x: [],
        y: [],
        name: "y elapsed",
        mode: "lines",
        showlegend: false,
        line: { color: "#16a34a", width: 2.6 }
      }
    ], {
      title: "coordinates over time",
      margin: { t: 42, r: 16, b: 42, l: 52 },
      xaxis: { title: "t", range: [model.t0, model.t1], autorange: false, fixedrange: true },
      yaxis: { title: "x, y", range: paddedRange([...x, ...y]), autorange: false, fixedrange: true },
      shapes: [timeCursorShape(model.t0)],
      annotations: [timeCursorAnnotation(model.t0)],
      uirevision: `${model.type}-coordinates`
    }, { responsive: true });

    drawParticlePhaseProjectionPlot(model, points);
  }

  function drawParticlePhaseProjectionPlot(model, points) {
    if ((model.phaseProjection || defaultPhaseProjection(model.type)) === "particleCompare") {
      const xPhase = projectionTrace(model, points, "x-vx");
      const yPhase = projectionTrace(model, points, "y-vy");
      window.Plotly.newPlot("physicsEnergyPlot", [
        {
          x: xPhase.x,
          y: xPhase.y,
          name: "x-vx path",
          mode: "lines",
          line: { color: "#2563eb", width: 1.5 },
          opacity: 0.25
        },
        {
          x: yPhase.x,
          y: yPhase.y,
          name: "y-vy path",
          mode: "lines",
          line: { color: "#f97316", width: 1.5 },
          opacity: 0.25
        },
        {
          x: [],
          y: [],
          name: "x-vx elapsed",
          mode: "lines",
          showlegend: false,
          line: { color: "#2563eb", width: 2.6 }
        },
        {
          x: [],
          y: [],
          name: "y-vy elapsed",
          mode: "lines",
          showlegend: false,
          line: { color: "#f97316", width: 2.6 }
        },
        {
          x: [points[0].x],
          y: [points[0].vx],
          name: "x-vx current",
          mode: "markers",
          showlegend: false,
          marker: { color: "#2563eb", size: 11, line: { color: "#fff", width: 2 } }
        },
        {
          x: [points[0].yPos],
          y: [points[0].vy],
          name: "y-vy current",
          mode: "markers",
          showlegend: false,
          marker: { color: "#f97316", size: 11, line: { color: "#fff", width: 2 } }
        }
      ], {
        title: "phase comparison: x-vx and y-vy",
        margin: { t: 42, r: 16, b: 42, l: 52 },
        xaxis: { title: "position", range: paddedRange([...xPhase.x, ...yPhase.x]), autorange: false, fixedrange: true },
        yaxis: { title: "velocity", range: paddedRange([...xPhase.y, ...yPhase.y]), autorange: false, fixedrange: true },
        uirevision: `${model.type}-phase-compare`
      }, { responsive: true });
      return;
    }

    const projection = projectionTrace(model, points, model.phaseProjection || defaultPhaseProjection(model.type));
    const currentProjection = projectionPoint(model, points[0], model.phaseProjection || defaultPhaseProjection(model.type));
    window.Plotly.newPlot("physicsEnergyPlot", [
      {
        x: projection.x,
        y: projection.y,
        name: "phase path",
        mode: "lines",
        line: { color: "#111827", width: 1.5 },
        opacity: 0.25
      },
      {
        x: [],
        y: [],
        name: "phase elapsed",
        mode: "lines",
        showlegend: false,
        line: { color: "#111827", width: 2.8 }
      },
      {
        x: [currentProjection.x],
        y: [currentProjection.y],
        name: "current state",
        mode: "markers",
        showlegend: false,
        marker: { color: "#f97316", size: 12, line: { color: "#fff", width: 2 } }
      }
    ], {
      title: `phase projection: ${projection.xLabel} vs ${projection.yLabel}`,
      margin: { t: 42, r: 16, b: 42, l: 52 },
      xaxis: { title: projection.xLabel, range: paddedRange(projection.x), autorange: false, fixedrange: true },
      yaxis: { title: projection.yLabel, range: paddedRange(projection.y), autorange: false, fixedrange: true },
      uirevision: `${model.type}-phase-${model.phaseProjection}`
    }, { responsive: true });
  }

  function drawCoupledPlots(model, result) {
    drawExtraEnergyPlot(model, result);
    const points = result.points;
    const t = points.map(point => point.t);
    const x1 = points.map(point => point.x1);
    const x2 = points.map(point => point.x2);
    const v1 = points.map(point => point.v1);
    const v2 = points.map(point => point.v2);
    window.Plotly.newPlot("physicsTimePlot", [
      {
        x: t,
        y: x1,
        name: "x1(t)",
        mode: "lines",
        line: { color: "#2563eb", width: 1.5 },
        opacity: 0.25
      },
      {
        x: t,
        y: x2,
        name: "x2(t)",
        mode: "lines",
        line: { color: "#0ea5e9", width: 1.5 },
        opacity: 0.25
      },
      {
        x: [],
        y: [],
        name: "x1 elapsed",
        mode: "lines",
        showlegend: false,
        line: { color: "#2563eb", width: 2.6 }
      },
      {
        x: [],
        y: [],
        name: "x2 elapsed",
        mode: "lines",
        showlegend: false,
        line: { color: "#0ea5e9", width: 2.6 }
      }
    ], {
      title: "two displacements over time",
      margin: { t: 42, r: 16, b: 42, l: 52 },
      xaxis: { title: "t", range: [model.t0, model.t1], autorange: false, fixedrange: true },
      yaxis: { title: "x1, x2", range: paddedRange([...x1, ...x2]), autorange: false, fixedrange: true },
      shapes: [timeCursorShape(model.t0)],
      annotations: [timeCursorAnnotation(model.t0)],
      uirevision: `${model.type}-time`
    }, { responsive: true });

    window.Plotly.newPlot("physicsPhasePlot", [
      {
        x: t,
        y: v1,
        name: "v1(t)",
        mode: "lines",
        line: { color: "#dc2626", width: 1.5 },
        opacity: 0.25
      },
      {
        x: t,
        y: v2,
        name: "v2(t)",
        mode: "lines",
        line: { color: "#f97316", width: 1.5 },
        opacity: 0.25
      },
      {
        x: [],
        y: [],
        name: "v1 elapsed",
        mode: "lines",
        showlegend: false,
        line: { color: "#dc2626", width: 2.6 }
      },
      {
        x: [],
        y: [],
        name: "v2 elapsed",
        mode: "lines",
        showlegend: false,
        line: { color: "#f97316", width: 2.6 }
      }
    ], {
      title: "two velocities over time",
      margin: { t: 42, r: 16, b: 42, l: 52 },
      xaxis: { title: "t", range: [model.t0, model.t1], autorange: false, fixedrange: true },
      yaxis: { title: "v1, v2", range: paddedRange([...v1, ...v2]), autorange: false, fixedrange: true },
      shapes: [timeCursorShape(model.t0)],
      annotations: [timeCursorAnnotation(model.t0)],
      uirevision: `${model.type}-velocities`
    }, { responsive: true });

    if ((model.phaseProjection || "coupledBoth") === "coupledBoth") {
      window.Plotly.newPlot("physicsEnergyPlot", [
        {
          x: x1,
          y: v1,
          name: "mass 1 phase",
          mode: "lines",
          line: { color: "#2563eb", width: 1.5 },
          opacity: 0.25
        },
        {
          x: x2,
          y: v2,
          name: "mass 2 phase",
          mode: "lines",
          line: { color: "#0ea5e9", width: 1.5 },
          opacity: 0.25
        },
        {
          x: [],
          y: [],
          name: "mass 1 elapsed",
          mode: "lines",
          showlegend: false,
          line: { color: "#2563eb", width: 2.7 }
        },
        {
          x: [],
          y: [],
          name: "mass 2 elapsed",
          mode: "lines",
          showlegend: false,
          line: { color: "#0ea5e9", width: 2.7 }
        },
        {
          x: [model.x1],
          y: [model.v1],
          name: "mass 1 current",
          mode: "markers",
          showlegend: false,
          marker: { color: "#2563eb", size: 11, line: { color: "#fff", width: 2 } }
        },
        {
          x: [model.x2],
          y: [model.v2],
          name: "mass 2 current",
          mode: "markers",
          showlegend: false,
          marker: { color: "#0ea5e9", size: 11, line: { color: "#fff", width: 2 } }
        }
      ], {
        title: "phase spaces of both masses",
        margin: { t: 42, r: 16, b: 42, l: 52 },
        xaxis: { title: "x", range: paddedRange([...x1, ...x2]), autorange: false, fixedrange: true },
        yaxis: { title: "v", range: paddedRange([...v1, ...v2]), autorange: false, fixedrange: true },
        uirevision: `${model.type}-phase`
      }, { responsive: true });
    } else {
      const projection = projectionTrace(model, points, model.phaseProjection);
      const currentProjection = projectionPoint(model, points[0], model.phaseProjection);
      window.Plotly.newPlot("physicsEnergyPlot", [
        {
          x: projection.x,
          y: projection.y,
          name: "phase projection",
          mode: "lines",
          line: { color: "#111827", width: 1.5 },
          opacity: 0.25
        },
        {
          x: [],
          y: [],
          name: "phase elapsed",
          mode: "lines",
          showlegend: false,
          line: { color: "#111827", width: 2.8 }
        },
        {
          x: [currentProjection.x],
          y: [currentProjection.y],
          name: "current state",
          mode: "markers",
          showlegend: false,
          marker: { color: "#dc2626", size: 12, line: { color: "#fff", width: 2 } }
        }
      ], {
        title: `phase projection: ${projection.xLabel} vs ${projection.yLabel}`,
        margin: { t: 42, r: 16, b: 42, l: 52 },
        xaxis: { title: projection.xLabel, range: paddedRange(projection.x), autorange: false, fixedrange: true },
        yaxis: { title: projection.yLabel, range: paddedRange(projection.y), autorange: false, fixedrange: true },
        uirevision: `${model.type}-phase-${model.phaseProjection}`
      }, { responsive: true });
    }
  }

  function simulatePlanarSystem(model, methodKey) {
    const t0 = finiteOr(model.t0, 0);
    const t1 = finiteOr(model.t1, 20);
    const requestedH = Math.abs(finiteOr(model.h, 0.03));
    const direction = Math.sign(t1 - t0 || 1);
    const span = Math.max(Math.abs(t1 - t0), requestedH);
    const maxSteps = 6000;
    const h = Math.max(requestedH, span / maxSteps) * direction;
    const points = [];
    let t = t0;
    let y = finiteOr(model.y0, 1);
    let v = finiteOr(model.v0, 0);
    let previous = previousPlanarState(model, t, y, v, h);
    points.push({ t, y, v });

    let guard = 0;
    while ((h > 0 && t < t1) || (h < 0 && t > t1)) {
      const step = h > 0 ? Math.min(h, t1 - t) : Math.max(h, t1 - t);
      const next = stepPlanarMethod(model, methodKey, t, y, v, step, previous);
      previous = { y, v };
      t += step;
      y = model.positiveState ? Math.max(next.y, 0) : next.y;
      v = model.positiveState ? Math.max(next.v, 0) : next.v;
      points.push({ t, y, v });
      guard++;
      if (guard > maxSteps + 2) break;
    }

    return {
      method: planarMethodInfo(methodKey),
      points,
      h,
      limited: Math.abs(h) > requestedH
    };
  }

  function previousPlanarState(model, t, y, v, h) {
    const slope = model.derivative(t, y, v);
    return {
      y: y - h * slope.y,
      v: v - h * slope.v
    };
  }

  function stepPlanarMethod(model, methodKey, t, y, v, h, previous) {
    if (methodKey === "euler2") return eulerPlanarStep(model, t, y, v, h);
    if (methodKey === "eulerCromer") return semiImplicitPlanarStep(model, t, y, v, h);
    if (methodKey === "midpoint2") return midpointPlanarStep(model, t, y, v, h);
    if (methodKey === "verlet") return leapfrogPlanarStep(model, t, y, v, h, previous);
    if (methodKey === "velocityVerlet") return predictorCorrectorPlanarStep(model, t, y, v, h);
    return rk4PlanarStep(model, t, y, v, h);
  }

  function eulerPlanarStep(model, t, y, v, h) {
    const slope = model.derivative(t, y, v);
    return {
      y: y + h * slope.y,
      v: v + h * slope.v
    };
  }

  function semiImplicitPlanarStep(model, t, y, v, h) {
    const slope = model.derivative(t, y, v);
    const nextV = v + h * slope.v;
    const ySlope = model.derivative(t, y, nextV).y;
    return {
      y: y + h * ySlope,
      v: nextV
    };
  }

  function midpointPlanarStep(model, t, y, v, h) {
    const k1 = model.derivative(t, y, v);
    const k2 = model.derivative(t + h / 2, y + h * k1.y / 2, v + h * k1.v / 2);
    return {
      y: y + h * k2.y,
      v: v + h * k2.v
    };
  }

  function rk4PlanarStep(model, t, y, v, h) {
    const f = model.derivative;
    const k1 = f(t, y, v);
    const k2 = f(t + h / 2, y + h * k1.y / 2, v + h * k1.v / 2);
    const k3 = f(t + h / 2, y + h * k2.y / 2, v + h * k2.v / 2);
    const k4 = f(t + h, y + h * k3.y, v + h * k3.v);
    return {
      y: y + h * (k1.y + 2 * k2.y + 2 * k3.y + k4.y) / 6,
      v: v + h * (k1.v + 2 * k2.v + 2 * k3.v + k4.v) / 6
    };
  }

  function leapfrogPlanarStep(model, t, y, v, h, previous) {
    if (!previous) return midpointPlanarStep(model, t, y, v, h);
    const slope = model.derivative(t, y, v);
    return {
      y: previous.y + 2 * h * slope.y,
      v: previous.v + 2 * h * slope.v
    };
  }

  function predictorCorrectorPlanarStep(model, t, y, v, h) {
    const k1 = model.derivative(t, y, v);
    const predictor = {
      y: y + h * k1.y,
      v: v + h * k1.v
    };
    const k2 = model.derivative(t + h, predictor.y, predictor.v);
    return {
      y: y + h * (k1.y + k2.y) / 2,
      v: v + h * (k1.v + k2.v) / 2
    };
  }

  function planarMethodInfo(methodKey) {
    const base = window.SecondOrderMethods?.METHOD_DEFS?.find(item => item.key === methodKey);
    const notes = {
      euler2: "explicit Euler for a 2D first-order system",
      eulerCromer: "semi-implicit Euler analog for a 2D first-order system",
      midpoint2: "midpoint RK2 for a 2D first-order system",
      rk4System: "RK4 for a 2D first-order system",
      verlet: "leapfrog / central-difference analog for a 2D first-order system",
      velocityVerlet: "predictor-corrector RK2 analog for a 2D first-order system"
    };
    return {
      key: methodKey,
      label: base ? base.label : methodKey,
      note: notes[methodKey] || "RK4 for a 2D first-order system"
    };
  }

  function simulateParticle2D(model, methodKey) {
    const result = simulateVectorSystem(model, methodKey, {
      x: model.x0,
      y: model.yParticle0,
      vx: model.vx0,
      vy: model.vy0
    }, (t, state) => particleDerivative(model, t, state));
    result.points = result.points.map(point => ({
      ...point,
      yPos: point.y,
      y: point.x,
      v: point.vx
    }));
    result.method = systemMethodInfo(methodKey, "2D particle");
    return result;
  }

  function particleDerivative(model, t, state) {
    const ax = model.acceleration.ax(state, t) - model.drag * state.vx;
    const ay = model.acceleration.ay(state, t) - model.drag * state.vy;
    return {
      x: state.vx,
      y: state.vy,
      vx: ax,
      vy: ay
    };
  }

  function simulateCoupledOscillators(model, methodKey) {
    const omega2 = model.omega * model.omega;
    const result = simulateVectorSystem(model, methodKey, {
      x1: model.x1,
      v1: model.v1,
      x2: model.x2,
      v2: model.v2
    }, (t, state) => ({
      x1: state.v1,
      v1: -omega2 * state.x1 - model.kappa * (state.x1 - state.x2) - model.gamma * state.v1,
      x2: state.v2,
      v2: -omega2 * state.x2 - model.kappa * (state.x2 - state.x1) - model.gamma * state.v2
    }));
    result.points = result.points.map(point => ({
      ...point,
      y: point.x1,
      v: point.v1
    }));
    result.method = systemMethodInfo(methodKey, "coupled 4D system");
    return result;
  }

  function simulateVectorSystem(model, methodKey, initialState, derivative) {
    const t0 = finiteOr(model.t0, 0);
    const t1 = finiteOr(model.t1, 20);
    const requestedH = Math.abs(finiteOr(model.h, 0.03));
    const direction = Math.sign(t1 - t0 || 1);
    const span = Math.max(Math.abs(t1 - t0), requestedH);
    const maxSteps = 6000;
    const h = Math.max(requestedH, span / maxSteps) * direction;
    const keys = Object.keys(initialState);
    const points = [];
    let t = t0;
    let state = { ...initialState };
    let previous = subtractScaledState(state, derivative(t, state), h, keys);
    points.push({ t, ...state });

    let guard = 0;
    while ((h > 0 && t < t1) || (h < 0 && t > t1)) {
      const step = h > 0 ? Math.min(h, t1 - t) : Math.max(h, t1 - t);
      const before = state;
      const tStart = t;
      const next = stepVectorMethod(methodKey, derivative, t, state, step, previous, keys);
      previous = before;
      t += step;
      const stepped = model.postStep ? model.postStep(before, next, tStart, t, step, methodKey, derivative, keys) : next;
      const inserts = stepped?.inserts || [];
      state = stepped?.state || stepped;
      if (model.groundBounce && next.y < 0) {
        previous = subtractScaledState(state, derivative(t, state), step, keys);
      }
      inserts.forEach(insert => {
        points.push({ t: insert.t, ...insert });
      });
      points.push({ t, ...state });
      guard++;
      if (guard > maxSteps + 2) break;
    }

    return {
      method: systemMethodInfo(methodKey, "system"),
      points,
      h,
      limited: Math.abs(h) > requestedH
    };
  }

  function stepVectorMethod(methodKey, derivative, t, state, h, previous, keys) {
    if (methodKey === "euler2") return addScaledState(state, derivative(t, state), h, keys);
    if (methodKey === "midpoint2") {
      const k1 = derivative(t, state);
      const mid = addScaledState(state, k1, h / 2, keys);
      return addScaledState(state, derivative(t + h / 2, mid), h, keys);
    }
    if (methodKey === "verlet" && previous) {
      return addScaledState(previous, derivative(t, state), 2 * h, keys);
    }
    if (methodKey === "velocityVerlet" || methodKey === "eulerCromer") {
      const k1 = derivative(t, state);
      const predicted = addScaledState(state, k1, h, keys);
      const k2 = derivative(t + h, predicted);
      return addScaledState(state, averageDerivatives(k1, k2, keys), h, keys);
    }
    const k1 = derivative(t, state);
    const k2 = derivative(t + h / 2, addScaledState(state, k1, h / 2, keys));
    const k3 = derivative(t + h / 2, addScaledState(state, k2, h / 2, keys));
    const k4 = derivative(t + h, addScaledState(state, k3, h, keys));
    const weighted = {};
    keys.forEach(key => {
      weighted[key] = (k1[key] + 2 * k2[key] + 2 * k3[key] + k4[key]) / 6;
    });
    return addScaledState(state, weighted, h, keys);
  }

  function addScaledState(state, delta, scale, keys) {
    const next = {};
    keys.forEach(key => {
      next[key] = state[key] + scale * delta[key];
    });
    return next;
  }

  function subtractScaledState(state, delta, scale, keys) {
    const next = {};
    keys.forEach(key => {
      next[key] = state[key] - scale * delta[key];
    });
    return next;
  }

  function averageDerivatives(a, b, keys) {
    const avg = {};
    keys.forEach(key => {
      avg[key] = (a[key] + b[key]) / 2;
    });
    return avg;
  }

  function systemMethodInfo(methodKey, subject) {
    const base = window.SecondOrderMethods?.METHOD_DEFS?.find(item => item.key === methodKey);
    return {
      key: methodKey,
      label: base ? base.label : methodKey,
      note: `${base ? base.label : methodKey} applied to a ${subject}`
    };
  }

  function simulateCircuitFirstOrder(model, methodKey) {
    if (model.hasC && model.hasR) return simulateRcCircuit(model, methodKey);
    if (model.hasC && !model.hasR) return simulateIdealCapacitor(model);
    if (!model.hasC && model.hasR) return simulatePureResistor(model);
    return simulateStaticCircuit(model, "no dynamic element in the circuit");
  }

  function simulateRcCircuit(model, methodKey) {
    const t0 = finiteOr(model.t0, 0);
    const t1 = finiteOr(model.t1, 20);
    const requestedH = Math.abs(finiteOr(model.h, 0.03));
    const direction = Math.sign(t1 - t0 || 1);
    const span = Math.max(Math.abs(t1 - t0), requestedH);
    const maxSteps = 6000;
    const h = Math.max(requestedH, span / maxSteps) * direction;
    const points = [];
    let t = t0;
    let q = finiteOr(model.y0, 0);
    let prevQ = q - h * rcChargeRate(model, t, q);
    points.push({ t, y: q, v: rcChargeRate(model, t, q) });

    let guard = 0;
    while ((h > 0 && t < t1) || (h < 0 && t > t1)) {
      const step = h > 0 ? Math.min(h, t1 - t) : Math.max(h, t1 - t);
      const nextQ = stepRcCharge(model, methodKey, t, q, step, prevQ);
      prevQ = q;
      t += step;
      q = nextQ;
      points.push({ t, y: q, v: rcChargeRate(model, t, q) });
      guard++;
      if (guard > maxSteps + 2) break;
    }

    return {
      method: planarMethodInfo(methodKey),
      points,
      h,
      limited: Math.abs(h) > requestedH,
      note: "RC circuit: L=0, so q is solved as a first-order equation"
    };
  }

  function stepRcCharge(model, methodKey, t, q, h, prevQ) {
    if (methodKey === "euler2") return q + h * rcChargeRate(model, t, q);
    if (methodKey === "midpoint2") {
      const k1 = rcChargeRate(model, t, q);
      return q + h * rcChargeRate(model, t + h / 2, q + h * k1 / 2);
    }
    if (methodKey === "verlet" && isFinite(prevQ)) {
      return prevQ + 2 * h * rcChargeRate(model, t, q);
    }
    if (methodKey === "velocityVerlet" || methodKey === "eulerCromer") {
      const k1 = rcChargeRate(model, t, q);
      const predicted = q + h * k1;
      const k2 = rcChargeRate(model, t + h, predicted);
      return q + h * (k1 + k2) / 2;
    }
    const k1 = rcChargeRate(model, t, q);
    const k2 = rcChargeRate(model, t + h / 2, q + h * k1 / 2);
    const k3 = rcChargeRate(model, t + h / 2, q + h * k2 / 2);
    const k4 = rcChargeRate(model, t + h, q + h * k3);
    return q + h * (k1 + 2 * k2 + 2 * k3 + k4) / 6;
  }

  function rcChargeRate(model, t, q) {
    return (circuitVoltage(model, t) - q / model.circuitC) / model.circuitR;
  }

  function simulateIdealCapacitor(model) {
    const points = sampleCircuitAlgebraic(model, t => {
      if (Math.abs(model.circuitV) < 1e-9) return { y: model.y0, v: 0 };
      return {
        y: model.circuitC * circuitVoltage(model, t),
        v: model.circuitC * circuitVoltageDerivative(model, t)
      };
    });
    return {
      method: { label: "ideal capacitor", note: "ideal C with no R or L is evaluated algebraically from q=C*V" },
      points,
      h: model.h,
      limited: points.limited,
      note: "ideal capacitor: q=C*Vext(t)"
    };
  }

  function simulatePureResistor(model) {
    let q = finiteOr(model.y0, 0);
    const points = sampleCircuitAlgebraic(model, (t, step) => {
      const current = circuitVoltage(model, t) / model.circuitR;
      q += step * current;
      return { y: q, v: current };
    });
    return {
      method: { label: "Ohm law", note: "pure R is algebraic: i=V/R" },
      points,
      h: model.h,
      limited: points.limited,
      note: "pure resistor: current comes from Ohm's law"
    };
  }

  function simulateStaticCircuit(model, note) {
    const points = sampleCircuitAlgebraic(model, () => ({ y: model.y0, v: 0 }));
    return {
      method: { label: "static", note },
      points,
      h: model.h,
      limited: points.limited,
      note
    };
  }

  function sampleCircuitAlgebraic(model, stateAt) {
    const t0 = finiteOr(model.t0, 0);
    const t1 = finiteOr(model.t1, 20);
    const requestedH = Math.abs(finiteOr(model.h, 0.03));
    const direction = Math.sign(t1 - t0 || 1);
    const span = Math.max(Math.abs(t1 - t0), requestedH);
    const maxSteps = 6000;
    const h = Math.max(requestedH, span / maxSteps) * direction;
    const points = [];
    let t = t0;
    let guard = 0;
    let previousT = t0;
    while ((h > 0 && t <= t1) || (h < 0 && t >= t1)) {
      const state = stateAt(t, t - previousT);
      points.push({ t, y: finiteOr(state.y, 0), v: finiteOr(state.v, 0) });
      previousT = t;
      t += h;
      if ((h > 0 && t > t1 && previousT < t1) || (h < 0 && t < t1 && previousT > t1)) t = t1;
      guard++;
      if (guard > maxSteps + 2 || previousT === t1) break;
    }
    points.limited = Math.abs(h) > requestedH;
    return points;
  }

  function circuitVoltage(model, t) {
    return model.circuitV * Math.cos(model.circuitOmega * t);
  }

  function circuitVoltageDerivative(model, t) {
    return -model.circuitV * model.circuitOmega * Math.sin(model.circuitOmega * t);
  }

  function physicsStatusText(model, result) {
    const parts = [];
    if (model.analysisMode === "resonance") {
      if (currentResonanceScan?.peak) {
        parts.push(`peak near Omega=${formatNumber(currentResonanceScan.peak.omega)}`);
      }
      if (currentResonanceScan?.predictedOmega != null) {
        parts.push(`damped peak approx Omega=${formatNumber(currentResonanceScan.predictedOmega)}`);
      } else {
        parts.push("gamma=0: omega0 is sampled, but the true resonant amplitude is unbounded");
      }
      parts.push(model.resonance.compare
        ? "A and B are selected drive frequencies from the resonance scan"
        : "A is selected by clicking a scan marker");
      if (result.limited) parts.push(`h limited to ${formatNumber(Math.abs(result.h))}`);
      return parts.join(" | ");
    }
    if (result.limited) parts.push(`h limited to ${formatNumber(Math.abs(result.h))}`);
    if (model.mode === "planar") parts.push(result.method.note || `2D system solved with ${result.method.label}`);
    if (model.mode === "particle2d") parts.push(result.method.note || `2D motion solved with ${result.method.label}`);
    if (model.mode === "coupled") parts.push(result.method.note || `coupled system solved with ${result.method.label}`);
    if (model.mode === "circuitFirstOrder" && result.note) parts.push(result.note);
    if (model.compare?.enabled && model.type === "pendulum" && model.compare.pendulumMode === "linear") {
      parts.push("B is the linear model: theta'' = -(g/L) theta");
    } else if (model.compare?.enabled) {
      parts.push("A and B use the same numerical method");
    }
    return parts.join(" | ");
  }

  function applySystemDefaults(type) {
    const defaults = {
      oscillator: {
        physicsT1: 20,
        physicsH: 0.03,
        physicsY0: 1,
        physicsV0: 0,
        physicsOmega: 1,
        physicsGamma: 0,
        physicsDriveA: 0,
        physicsDriveOmega: 0,
        physicsOscillatorMode: "simulation",
        physicsResOmegaMin: 0.1,
        physicsResOmegaMax: 2.5,
        physicsResSamples: 48,
        physicsResOmegaA: 0.6,
        physicsResOmegaB: 1,
        physicsResSettleCycles: 20,
        physicsResMeasureCycles: 8,
        physicsOscillatorAnimation: "spring",
        physicsCompareY0: 1.4,
        physicsCompareV0: 0,
        physicsCompareOmega: 1.2
      },
      pendulum: {
        physicsT1: 20,
        physicsH: 0.03,
        physicsY0: 0.7,
        physicsV0: 0,
        physicsGamma: 0,
        physicsDriveA: 0,
        physicsDriveOmega: 0,
        physicsLength: 1,
        physicsG: 9.81,
        physicsCompareY0: 1.5,
        physicsCompareV0: 0,
        physicsCompareLength: 1
      },
      projectile: {
        physicsT1: 3,
        physicsH: 0.01,
        physicsParticleX0: 0,
        physicsParticleY0: 0,
        physicsParticleVx0: 5,
        physicsParticleVy0: 8,
        physicsParticleDrag: 0,
        physicsProjectileG: 9.81,
        physicsPhaseProjection: "particleCompare"
      },
      verticalBounce: {
        physicsT1: 10,
        physicsH: 0.01,
        physicsBounceY0: 3,
        physicsBounceVy0: 8,
        physicsParticleDrag: 0,
        physicsProjectileG: 9.81,
        physicsBounceRestitution: 0.8,
        physicsPhaseProjection: "y-vy"
      },
      chargedParticle: {
        physicsT1: 8,
        physicsH: 0.02,
        physicsParticleX0: 0,
        physicsParticleY0: 0,
        physicsParticleVx0: 1,
        physicsParticleVy0: 2,
        physicsParticleDrag: 0,
        physicsParticleCharge: 1,
        physicsParticleMass: 1,
        physicsElectricEx: 1,
        physicsElectricEy: 0,
        physicsMagneticB: 0.6,
        physicsPhaseProjection: "particleCompare"
      },
      coupledOscillators: {
        physicsT1: 35,
        physicsH: 0.03,
        physicsCoupledOmega: 1,
        physicsCoupledKappa: 0.35,
        physicsCoupledGamma: 0,
        physicsCoupledX1: 1,
        physicsCoupledV1: 0,
        physicsCoupledX2: 0,
        physicsCoupledV2: 0,
        physicsPhaseProjection: "coupledBoth"
      },
      rlc: {
        physicsT1: 30,
        physicsH: 0.03,
        physicsY0: 1,
        physicsV0: 0,
        physicsCircuitL: 1,
        physicsCircuitC: 1,
        physicsCircuitR: 0.2,
        physicsCircuitV: 0,
        physicsCircuitOmega: 0,
        physicsCompareY0: 1,
        physicsCompareV0: 0,
        physicsCompareCircuitL: 1,
        physicsCompareCircuitC: 1,
        physicsCompareCircuitR: 0.4,
        physicsCompareCircuitV: 0,
        physicsCompareCircuitOmega: 0
      },
      predatorPrey: {
        physicsT1: 40,
        physicsH: 0.03,
        physicsY0: 45,
        physicsV0: 15,
        physicsPredAlpha: 0.55,
        physicsPredBeta: 0.02,
        physicsPredDelta: 0.01,
        physicsPredGamma: 0.4,
        physicsCompareY0: 45,
        physicsCompareV0: 15,
        physicsComparePredAlpha: 0.55,
        physicsComparePredBeta: 0.024,
        physicsComparePredDelta: 0.01,
        physicsComparePredGamma: 0.4
      },
      neuron: {
        physicsT1: 80,
        physicsH: 0.04,
        physicsY0: -1,
        physicsV0: 1,
        physicsNeuronA: 0.7,
        physicsNeuronB: 0.8,
        physicsNeuronTau: 12.5,
        physicsNeuronI: 0.7
      }
    }[type];
    if (!defaults) return;
    Object.entries(defaults).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    });
  }

  function startAnimation() {
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    const tick = now => {
      if (!currentResult || !isPlaying) return;
      const t0 = currentResult.points[0].t;
      const t1 = currentResult.points[currentResult.points.length - 1].t;
      const span = Math.max(t1 - t0, 1e-9);
      animationT = t0 + ((now - animationStart) / 1000 * getSpeed()) % span;
      drawFrame(animationT);
      animationFrame = window.requestAnimationFrame(tick);
    };
    animationFrame = window.requestAnimationFrame(tick);
  }

  function drawFrame(t, options = {}) {
    if (!currentResult || !currentModel) return;
    const canvas = document.getElementById("physicsCanvas");
    const ctx = canvas.getContext("2d");
    const state = interpolateState(currentResult.points, t);
    const compareState = currentCompareResult ? interpolateState(currentCompareResult.points, t) : null;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    if (currentModel.type === "pendulum") {
      if (compareState && currentCompareModel) {
        drawPendulum(ctx, width, height, state, currentModel, { pivotX: width * 0.38, color: "#7c3aed", label: "A" });
        drawPendulum(ctx, width, height, compareState, currentCompareModel, { pivotX: width * 0.62, color: "#0ea5e9", label: currentCompareModel.isLinearCompare ? "B lin" : "B" });
      } else {
        drawPendulum(ctx, width, height, state, currentModel);
      }
    } else if (currentModel.type === "rlc") {
      if (compareState && currentCompareModel) {
        drawRlcCircuit(ctx, width, height, state, currentModel, { regionTop: height * 0.08, regionHeight: height * 0.42, label: "A" });
        drawRlcCircuit(ctx, width, height, compareState, currentCompareModel, { regionTop: height * 0.52, regionHeight: height * 0.42, label: "B" });
      } else {
        drawRlcCircuit(ctx, width, height, state, currentModel);
      }
    } else if (currentModel.mode === "particle2d") {
      drawParticle2D(ctx, width, height, state, currentModel);
    } else if (currentModel.mode === "coupled") {
      drawCoupledOscillators(ctx, width, height, state, currentModel);
    } else if (currentModel.type === "predatorPrey") {
      if (compareState && currentCompareModel) {
        const predatorUnit = predatorCompareIconUnit(ctx, width, height);
        drawPredatorPrey(ctx, width, height, state, currentModel, {
          regionTop: height * 0.06,
          regionHeight: height * 0.42,
          label: "A",
          unit: predatorUnit
        });
        drawPredatorPrey(ctx, width, height, compareState, currentCompareModel, {
          regionTop: height * 0.52,
          regionHeight: height * 0.42,
          label: "B",
          unit: predatorUnit
        });
      } else {
        drawPredatorPrey(ctx, width, height, state, currentModel);
      }
    } else if (currentModel.type === "neuron") {
      drawNeuron(ctx, width, height, state, currentModel);
    } else {
      const xLimit = oscillatorVisualLimit();
      if (compareState && currentCompareModel) {
        const draw = currentModel.oscillatorAnimation === "potential" ? drawOscillatorPotentialWell : drawOscillator;
        draw(ctx, width, height, state, currentModel, { centerY: height * 0.38, color: "#2563eb", label: "A", xLimit });
        draw(ctx, width, height, compareState, currentCompareModel, { centerY: height * 0.68, color: "#0ea5e9", label: "B", xLimit });
      } else {
        if (currentModel.oscillatorAnimation === "potential") {
          drawOscillatorPotentialWell(ctx, width, height, state, currentModel, { xLimit });
        } else {
          drawOscillator(ctx, width, height, state, currentModel, { xLimit });
        }
      }
    }

    if (currentModel.type !== "predatorPrey") {
      drawCanvasHud(ctx, state, currentModel, compareState);
    }
    updateTimeControls(t);
    updatePlotCursors(t, state, options.forcePlotUpdate);
  }

  function drawOscillator(ctx, width, height, state, model, options = {}) {
    const centerY = options.centerY ?? height * 0.55;
    const wallX = width * 0.12;
    const originX = width * 0.52;
    const xLimit = Math.max(options.xLimit || 2, 1e-6);
    const scale = width * 0.16 / xLimit;
    const massX = originX + clamp(state.y, -xLimit, xLimit) * scale;
    const massW = 58;
    const massH = 46;
    const massLeft = massX - massW / 2;
    const massRight = massX + massW / 2;
    const hasDamping = Math.abs(model.gamma) > 1e-9;
    const hasDriver = Math.abs(model.driveA) > 1e-9;
    const dampingForce = hasDamping ? -model.gamma * state.v : 0;
    const driveForce = hasDriver ? model.driveA * Math.cos(model.driveOmega * state.t) : 0;

    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(wallX, centerY - 70);
    ctx.lineTo(wallX, centerY + 70);
    ctx.stroke();

    if (hasDamping) {
      drawViscousMedium(ctx, width, centerY, massLeft, massRight, dampingForce, state.t);
    }

    drawSpring(ctx, wallX, centerY, massLeft, centerY, 13, 16);

    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width * 0.18, centerY + 48);
    ctx.lineTo(width * 0.86, centerY + 48);
    ctx.stroke();

    ctx.fillStyle = "#64748b";
    ctx.font = "12px Arial";
    [-xLimit, -xLimit / 2, 0, xLimit / 2, xLimit].forEach(tick => {
      const tickX = originX + tick * scale;
      ctx.strokeStyle = tick === 0 ? "#64748b" : "#cbd5e1";
      ctx.lineWidth = tick === 0 ? 1.6 : 1;
      ctx.beginPath();
      ctx.moveTo(tickX, centerY + 36);
      ctx.lineTo(tickX, centerY + 58);
      ctx.stroke();
      ctx.fillText(`x=${formatHudNumber(tick)}`, tickX - 18, centerY + 74);
    });

    ctx.fillStyle = hasDriver ? "#f97316" : (options.color || "#2563eb");
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.fillRect(massLeft, centerY - massH / 2, massW, massH);
    ctx.strokeRect(massLeft, centerY - massH / 2, massW, massH);

    drawMassCenterMarker(ctx, massX, centerY, massH);
    drawCanvasObjectLabel(ctx, options.label, massX, centerY - massH / 2 - 12, options.color || "#2563eb");

    if (hasDamping) {
      drawForceArrow(ctx, massX, centerY + 104, dampingForce, "#0891b2", "Fdrag");
      drawHeatWisps(ctx, massLeft - 18, centerY + 9, Math.abs(dampingForce));
    }

    if (hasDriver) {
      drawOscillatorDriveCue(ctx, width, originX, centerY, scale, state, model, driveForce);
      drawLinearThruster(ctx, massX, centerY, massW, massH, driveForce, state.t);
      drawForceArrow(ctx, massX, centerY - 58, driveForce, "#f97316", "Fext");
    }
  }

  function drawOscillatorPotentialWell(ctx, width, height, state, model, options = {}) {
    const centerY = options.centerY ?? height * 0.56;
    const xLimit = Math.max(options.xLimit || 2, 1e-6);
    const left = width * 0.18;
    const right = width * 0.88;
    const bottom = centerY + 88;
    const wellHeight = options.label ? 86 : 150;
    const scaleX = (right - left) / (2 * xLimit);
    const omega2 = model.omega * model.omega;
    const energy = 0.5 * state.v * state.v + 0.5 * omega2 * state.y * state.y;
    const referencePotential = Math.max(0.5 * xLimit * xLimit, energy, 1);
    const energyY = bottom - clamp(energy / referencePotential, 0, 1.18) * wellHeight;
    const mapX = x => (left + right) / 2 + x * scaleX;
    const mapY = x => bottom - clamp(0.5 * omega2 * x * x / referencePotential, 0, 1.18) * wellHeight;
    const clampedX = clamp(state.y, -xLimit, xLimit);
    const ballX = mapX(clampedX);
    const ballY = mapY(clampedX);

    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(left, bottom);
    ctx.lineTo(right, bottom);
    ctx.stroke();

    drawPotentialScaleAxis(ctx, width * 0.08, bottom, wellHeight, referencePotential);

    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 90; i++) {
      const x = -xLimit + 2 * xLimit * i / 90;
      const px = mapX(x);
      const py = mapY(x);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.strokeStyle = "rgba(22, 163, 74, 0.72)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(left, energyY);
    ctx.lineTo(right, energyY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#166534";
    ctx.font = "12px Arial";
    ctx.fillText("E", right - 18, energyY - 6);
    drawPotentialWellCaption(ctx, width * 0.08, bottom + 50, omega2);

    ctx.fillStyle = options.color || "#2563eb";
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ballX, ballY - 14, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawCanvasObjectLabel(ctx, options.label, ballX, ballY - 42, options.color || "#2563eb");

    ctx.fillStyle = "#475569";
    ctx.font = "12px Arial";
    [-xLimit, 0, xLimit].forEach(tick => {
      const tickX = mapX(tick);
      ctx.strokeStyle = tick === 0 ? "#64748b" : "#cbd5e1";
      ctx.lineWidth = tick === 0 ? 1.6 : 1;
      ctx.beginPath();
      ctx.moveTo(tickX, bottom - 6);
      ctx.lineTo(tickX, bottom + 12);
      ctx.stroke();
      ctx.fillText(formatHudNumber(tick), tickX - 12, bottom + 28);
    });
  }

  function drawPotentialScaleAxis(ctx, axisX, bottom, height, referencePotential) {
    ctx.strokeStyle = "#64748b";
    ctx.fillStyle = "#475569";
    ctx.lineWidth = 1.4;
    ctx.font = "11px Arial";
    ctx.beginPath();
    ctx.moveTo(axisX, bottom);
    ctx.lineTo(axisX, bottom - height);
    ctx.stroke();
    ctx.fillText("V", axisX - 4, bottom - height - 8);
    [0, 0.5, 1].forEach(fraction => {
      const y = bottom - height * fraction;
      const value = referencePotential * fraction;
      ctx.beginPath();
      ctx.moveTo(axisX - 5, y);
      ctx.lineTo(axisX + 5, y);
      ctx.stroke();
      ctx.fillText(formatHudNumber(value), axisX + 8, y + 4);
    });
  }

  function drawPotentialWellCaption(ctx, x, y, omega2) {
    ctx.fillStyle = "rgba(255,255,255,0.86)";
    ctx.strokeStyle = "rgba(148, 163, 184, 0.75)";
    ctx.lineWidth = 1;
    ctx.fillRect(x - 8, y - 18, 118, 42);
    ctx.strokeRect(x - 8, y - 18, 118, 42);
    ctx.fillStyle = "#475569";
    ctx.font = "11px Arial";
    ctx.fillText("curvature", x, y - 2);
    ctx.fillText(`~ \u03c9\u00b2=${formatHudNumber(omega2)}`, x, y + 15);
  }

  function drawParticle2D(ctx, width, height, state, model) {
    const bounds = particleCanvasBounds();
    const margin = 46;
    const plotLeft = margin;
    const plotRight = width - margin;
    const plotTop = 46;
    const plotBottom = height - 42;
    const scaleX = (plotRight - plotLeft) / Math.max(bounds.maxX - bounds.minX, 1e-6);
    const scaleY = (plotBottom - plotTop) / Math.max(bounds.maxY - bounds.minY, 1e-6);
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (plotLeft + plotRight) / 2 - (bounds.minX + bounds.maxX) * scale / 2;
    const offsetY = (plotTop + plotBottom) / 2 + (bounds.minY + bounds.maxY) * scale / 2;
    const map = point => ({
      x: offsetX + point.x * scale,
      y: offsetY - point.yPos * scale
    });
    const points = currentResult.points;
    const currentIndex = points.findIndex(point => point.t >= state.t);
    const visibleEnd = currentIndex < 0 ? points.length : currentIndex + 1;

    drawParticleField(ctx, width, height, model, state);
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(plotLeft, plotTop, plotRight - plotLeft, plotBottom - plotTop);
    drawParticleAxes(ctx, bounds, map, plotLeft, plotRight, plotTop, plotBottom);

    if (model.type === "projectile" || model.type === "verticalBounce") {
      const ground = map({ x: 0, yPos: 0 });
      ctx.strokeStyle = "#16a34a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(plotLeft, ground.y);
      ctx.lineTo(plotRight, ground.y);
      ctx.stroke();
      ctx.fillStyle = "#166534";
      ctx.font = "12px Arial";
      ctx.fillText("ground y=0", plotRight - 90, ground.y - 8);
    }

    ctx.strokeStyle = "rgba(37, 99, 235, 0.28)";
    ctx.lineWidth = 2;
    drawMappedPath(ctx, points, map);
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 3;
    drawMappedPath(ctx, points.slice(0, Math.max(visibleEnd, 1)), map);

    const p = map(state);
    ctx.fillStyle = model.type === "chargedParticle" && !hasElectricField(model) && Math.abs(model.params.bz || 0) > 1e-9 ? "#7c3aed" : "#f97316";
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawVectorArrow(ctx, p.x, p.y, state.vx, -state.vy, "#334155", "v", 24);

    drawParticleCanvasHud(ctx, width, height, state, model, bounds);
  }

  function drawParticleAxes(ctx, bounds, map, left, right, top, bottom) {
    const xTicks = niceTicks(bounds.minX, bounds.maxX, 5);
    const yTicks = niceTicks(bounds.minY, bounds.maxY, 4);
    ctx.save();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.38)";
    ctx.fillStyle = "#64748b";
    ctx.lineWidth = 1;
    ctx.font = "11px Arial";
    xTicks.forEach(value => {
      const x = map({ x: value, yPos: 0 }).x;
      if (x < left || x > right) return;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
      ctx.fillText(formatAxisTick(value), x - 10, bottom + 16);
    });
    yTicks.forEach(value => {
      const y = map({ x: 0, yPos: value }).y;
      if (y < top || y > bottom) return;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
      ctx.fillText(formatAxisTick(value), left - 38, y + 4);
    });
    if (bounds.minX <= 0 && bounds.maxX >= 0) {
      const axisX = map({ x: 0, yPos: 0 }).x;
      ctx.strokeStyle = "rgba(71, 85, 105, 0.72)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(axisX, top);
      ctx.lineTo(axisX, bottom);
      ctx.stroke();
      ctx.fillText("x=0", axisX + 5, top + 14);
    }
    if (bounds.minY <= 0 && bounds.maxY >= 0) {
      const axisY = map({ x: 0, yPos: 0 }).y;
      ctx.strokeStyle = "rgba(71, 85, 105, 0.72)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(left, axisY);
      ctx.lineTo(right, axisY);
      ctx.stroke();
      ctx.fillText("y=0", right - 34, axisY - 6);
    }
    ctx.fillStyle = "#334155";
    ctx.font = "12px Arial";
    ctx.fillText("x", right - 10, bottom + 17);
    ctx.fillText("y", left - 34, top + 12);
    ctx.restore();
  }

  function drawParticleCanvasHud(ctx, width, height, state, model, bounds) {
    const viewWidth = bounds.maxX - bounds.minX;
    const viewHeight = bounds.maxY - bounds.minY;
    const lines = model.type === "verticalBounce"
      ? [
          `y=${formatHudNumber(state.yPos)}`,
          `vy=${formatHudNumber(state.vy)}`,
          `e=${formatHudNumber(model.restitution)}`,
          `view y=${formatHudNumber(viewHeight)}`
        ]
      : [
          `x=${formatHudNumber(state.x)}  y=${formatHudNumber(state.yPos)}`,
          `vx=${formatHudNumber(state.vx)}  vy=${formatHudNumber(state.vy)}`,
          `view ${formatHudNumber(viewWidth)} x ${formatHudNumber(viewHeight)}`
        ];
    const boxX = width - 154;
    const boxY = 14;
    const boxH = 22 + lines.length * 17;
    ctx.fillStyle = "rgba(255,255,255,0.86)";
    ctx.strokeStyle = "rgba(148, 163, 184, 0.8)";
    ctx.lineWidth = 1;
    ctx.fillRect(boxX, boxY, 138, boxH);
    ctx.strokeRect(boxX, boxY, 138, boxH);
    ctx.fillStyle = "#334155";
    ctx.font = "12px Arial";
    lines.forEach((line, index) => {
      ctx.fillText(line, boxX + 10, boxY + 20 + index * 17);
    });
  }

  function drawParticleField(ctx, width, height, model, state) {
    if (model.type === "projectile" || model.type === "verticalBounce") {
      drawVectorArrow(ctx, width - 76, 72, 0, 1, "#64748b", "g", 34);
      ctx.fillStyle = "rgba(34, 197, 94, 0.08)";
      ctx.fillRect(0, height - 34, width, 34);
      return;
    }
    if (model.type === "chargedParticle") {
      const ex = model.params.ex || 0;
      const ey = model.params.ey || 0;
      const bz = model.params.bz || 0;
      if (Math.hypot(ex, ey) > 1e-9) {
        for (let y = 78; y < height - 42; y += 54) {
          for (let x = 86; x < width - 40; x += 76) {
            drawVectorArrow(ctx, x, y, ex, -ey, "rgba(249, 115, 22, 0.5)", "E", 24);
          }
        }
      }
      if (Math.abs(bz) > 1e-9) drawMagneticFieldSymbols(ctx, width, height, bz);
      return;
    }
  }

  function drawMagneticFieldSymbols(ctx, width, height, bz) {
    const outward = bz >= 0;
    ctx.strokeStyle = "rgba(124, 58, 237, 0.45)";
    ctx.fillStyle = "rgba(124, 58, 237, 0.45)";
    ctx.lineWidth = 1.7;
    for (let y = 76; y < height - 42; y += 48) {
      for (let x = 80; x < width - 40; x += 62) {
        if (outward) {
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(x - 6, y - 6);
          ctx.lineTo(x + 6, y + 6);
          ctx.moveTo(x + 6, y - 6);
          ctx.lineTo(x - 6, y + 6);
          ctx.stroke();
        }
      }
    }
    ctx.fillStyle = "#6d28d9";
    ctx.font = "12px Arial";
    ctx.fillText(outward ? "B out of screen" : "B into screen", width - 142, 28);
  }

  function drawCoupledOscillators(ctx, width, height, state, model) {
    const centerY = height * 0.57;
    const wallLeft = width * 0.1;
    const wallRight = width * 0.9;
    const rest1 = width * 0.38;
    const rest2 = width * 0.62;
    const maxAbs = Math.max(
      1,
      ...(currentResult?.points || []).flatMap(point => [Math.abs(point.x1 || 0), Math.abs(point.x2 || 0)])
    );
    const scale = width * 0.11 / maxAbs;
    const x1 = rest1 + clamp(state.x1, -maxAbs, maxAbs) * scale;
    const x2 = rest2 + clamp(state.x2, -maxAbs, maxAbs) * scale;
    const massW = 48;
    const massH = 42;

    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(wallLeft, centerY - 70);
    ctx.lineTo(wallLeft, centerY + 70);
    ctx.moveTo(wallRight, centerY - 70);
    ctx.lineTo(wallRight, centerY + 70);
    ctx.stroke();

    drawSpring(ctx, wallLeft, centerY, x1 - massW / 2, centerY, 9, 13);
    drawSpring(ctx, x1 + massW / 2, centerY, x2 - massW / 2, centerY, 9, 13);
    drawSpring(ctx, x2 + massW / 2, centerY, wallRight, centerY, 9, 13);

    drawCoupledMass(ctx, x1, centerY, massW, massH, "#2563eb", "1");
    drawCoupledMass(ctx, x2, centerY, massW, massH, "#0ea5e9", "2");

    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width * 0.16, centerY + 50);
    ctx.lineTo(width * 0.84, centerY + 50);
    ctx.stroke();
    [rest1, rest2].forEach((rest, index) => {
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(rest, centerY + 38);
      ctx.lineTo(rest, centerY + 62);
      ctx.stroke();
      ctx.fillStyle = "#475569";
      ctx.font = "12px Arial";
      ctx.fillText(`x${index + 1}=0`, rest - 18, centerY + 78);
    });

    ctx.fillStyle = "#334155";
    ctx.font = "13px Arial";
    ctx.fillText(`x1=${formatHudNumber(state.x1)}  v1=${formatHudNumber(state.v1)}`, 18, 52);
    ctx.fillText(`x2=${formatHudNumber(state.x2)}  v2=${formatHudNumber(state.v2)}`, 18, 72);
  }

  function drawCoupledMass(ctx, x, y, w, h, color, label) {
    ctx.fillStyle = color;
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.fillRect(x - w / 2, y - h / 2, w, h);
    ctx.strokeRect(x - w / 2, y - h / 2, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px Arial";
    ctx.textAlign = "center";
    ctx.fillText(label, x, y + 5);
    ctx.textAlign = "start";
  }

  function particleCanvasBounds() {
    const points = currentResult?.points || [];
    const x = points.map(point => point.x);
    const y = points.map(point => point.yPos);
    const minX = Math.min(...x);
    const maxX = Math.max(...x);
    const minY = Math.min(...y);
    const maxY = Math.max(...y);
    const xPad = Math.max((maxX - minX) * 0.08, 0.5);
    const yPad = Math.max((maxY - minY) * 0.08, 0.5);
    return {
      minX: minX - xPad,
      maxX: maxX + xPad,
      minY: minY - yPad,
      maxY: maxY + yPad
    };
  }

  function drawMappedPath(ctx, points, map) {
    if (!points.length) return;
    ctx.beginPath();
    points.forEach((point, index) => {
      const mapped = map(point);
      if (index === 0) ctx.moveTo(mapped.x, mapped.y);
      else ctx.lineTo(mapped.x, mapped.y);
    });
    ctx.stroke();
  }

  function drawVectorArrow(ctx, x, y, vx, vy, color, label, baseLength = 32) {
    const mag = Math.hypot(vx, vy);
    if (mag < 1e-9) return;
    const len = baseLength * clamp(mag, 0.35, 2.4);
    const ux = vx / mag;
    const uy = vy / mag;
    const endX = x + ux * len;
    const endY = y + uy * len;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - ux * 9 - uy * 5, endY - uy * 9 + ux * 5);
    ctx.lineTo(endX - ux * 9 + uy * 5, endY - uy * 9 - ux * 5);
    ctx.closePath();
    ctx.fill();
    if (label) {
      ctx.font = "12px Arial";
      ctx.fillText(label, endX + 5, endY - 5);
    }
  }

  function oscillatorVisualLimit() {
    const points = [
      ...(currentResult?.points || []),
      ...(currentCompareResult?.points || [])
    ];
    const maxAbs = points.reduce((max, point) => Math.max(max, Math.abs(point.y || 0)), 0);
    const rawLimit = Math.max(2, maxAbs * 1.15);
    if (rawLimit <= 5) return Math.ceil(rawLimit);
    const power = Math.pow(10, Math.floor(Math.log10(rawLimit)));
    return Math.ceil(rawLimit / power) * power;
  }

  function drawPendulum(ctx, width, height, state, model, options = {}) {
    const pivotX = options.pivotX ?? width / 2;
    const pivotY = height * 0.18;
    const visualLength = pendulumVisualLength(width, height, model.length);
    const bobX = pivotX + visualLength * Math.sin(state.y);
    const bobY = pivotY + visualLength * Math.cos(state.y);
    const hasDamping = Math.abs(model.gamma) > 1e-9;
    const hasDriver = Math.abs(model.driveA) > 1e-9;
    const dampingForce = hasDamping ? -model.gamma * state.v : 0;
    const driveForce = hasDriver ? model.driveA * Math.cos(model.driveOmega * state.t) : 0;

    if (hasDamping) {
      drawPendulumFluid(ctx, width, height, bobX, bobY, state.t, dampingForce);
    }

    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(bobX, bobY);
    ctx.stroke();
    drawPendulumLengthLabel(ctx, pivotX, pivotY, bobX, bobY, model.length);

    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = options.color || "#7c3aed";
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bobX, bobY, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawCanvasObjectLabel(ctx, options.label, bobX, bobY - 32, options.color || "#7c3aed");

    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(pivotX, pivotY + visualLength + 34);
    ctx.stroke();

    if (hasDamping) {
      drawTangentialArrow(ctx, bobX, bobY, state.y, dampingForce, "#0891b2", "Fdrag");
      drawHeatWisps(ctx, bobX - 22, bobY + 8, Math.abs(dampingForce));
    }

    if (hasDriver) {
      drawPendulumThruster(ctx, bobX, bobY, state.y, driveForce, state.t);
      drawTangentialArrow(ctx, bobX, bobY, state.y, driveForce, "#f97316", "Fext");
    }
  }

  function drawRlcCircuit(ctx, width, height, state, model, options = {}) {
    const regionTop = options.regionTop ?? 0;
    const regionHeight = options.regionHeight ?? height;
    const left = width * 0.16;
    const right = width * 0.84;
    const top = regionTop + regionHeight * 0.22;
    const bottom = regionTop + regionHeight * 0.74;
    const midY = (top + bottom) / 2;
    const current = state.v;
    const voltage = circuitVoltage(model, state.t);
    const chargeLevel = clamp(state.y / 2, -1, 1);
    const resistorStart = width * 0.34;
    const resistorEnd = width * 0.52;
    const inductorStart = width * 0.46;
    const inductorEnd = width * 0.66;
    const capHeight = Math.min(88, regionHeight * 0.34);
    const capGap = 18;
    const hasSource = Math.abs(model.circuitV) > 1e-9;

    drawCanvasObjectLabel(ctx, options.label, width * 0.08, top + 5, options.label === "B" ? "#0ea5e9" : "#2563eb");

    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(model.hasR ? resistorStart : right, top);
    if (model.hasR) {
      ctx.moveTo(resistorEnd, top);
      ctx.lineTo(right, top);
    }
    ctx.moveTo(right, top);
    ctx.lineTo(right, model.hasC ? midY - capHeight / 2 - capGap : bottom);
    if (model.hasC) {
      ctx.moveTo(right, midY + capHeight / 2 + capGap);
      ctx.lineTo(right, bottom);
    }
    ctx.moveTo(right, bottom);
    ctx.lineTo(model.hasL ? inductorEnd : left, bottom);
    if (model.hasL) {
      ctx.moveTo(inductorStart, bottom);
      ctx.lineTo(left, bottom);
    }
    ctx.moveTo(left, bottom);
    ctx.lineTo(left, hasSource ? midY + 50 : top);
    if (hasSource) {
      ctx.moveTo(left, midY - 50);
      ctx.lineTo(left, top);
    }
    ctx.stroke();

    if (hasSource) drawCircuitBattery(ctx, left, midY, voltage);
    else drawMissingElementLabel(ctx, left - 18, midY, "V0=0");
    if (model.hasR) drawCircuitResistor(ctx, resistorStart, top, resistorEnd, top, current, state.t, model.circuitR);
    else drawMissingElementLabel(ctx, (resistorStart + resistorEnd) / 2, top - 18, "R=0");
    if (model.hasL) drawCircuitInductor(ctx, inductorStart, bottom, inductorEnd, bottom, current, state.t);
    else drawMissingElementLabel(ctx, (inductorStart + inductorEnd) / 2, bottom + 28, "L=0");
    if (model.hasC) drawCircuitCapacitor(ctx, right, midY, chargeLevel, state.y);
    else drawMissingElementLabel(ctx, right + 18, midY, "C=0");
    drawCircuitCurrentArrows(ctx, left, right, top, bottom, current, state.t, model.hasC);

    ctx.fillStyle = "#334155";
    ctx.font = "13px Arial";
    ctx.fillText(`q=${formatHudNumber(state.y)}`, right - 86, midY + 92);
    ctx.fillText(`i=${formatHudNumber(current)}`, width * 0.48, top - 32);
    if (hasSource) ctx.fillText(`Vext=${formatHudNumber(voltage)}`, left - 56, midY + 78);
  }

  function drawPredatorPrey(ctx, width, height, state, model, options = {}) {
    const regionTop = options.regionTop ?? 0;
    const regionHeight = options.regionHeight ?? height;
    const comparePanel = !!options.label;
    const headerTop = regionTop + regionHeight * 0.03;
    const meadowTop = regionTop + regionHeight * (comparePanel ? 0.31 : 0.2);
    const meadowBottom = regionTop + regionHeight * 0.76;
    const prey = Math.max(state.y, 0);
    const wolves = Math.max(state.v, 0);
    const rates = model.derivative(state.t, prey, wolves);
    const meadowLeft = width * 0.08;
    const meadowWidth = width * 0.84;
    const meadowHeight = meadowBottom - meadowTop;
    const dividerX = meadowLeft + meadowWidth * 0.62;
    const iconTop = meadowTop + 12;
    const iconBottom = meadowBottom - 14;
    const sheepArea = {
      x: meadowLeft + 16,
      y: iconTop,
      width: dividerX - meadowLeft - 32,
      height: iconBottom - iconTop
    };
    const wolfArea = {
      x: dividerX + 16,
      y: iconTop,
      width: meadowLeft + meadowWidth - dividerX - 32,
      height: iconBottom - iconTop
    };
    const unit = options.unit || predatorIconUnit(ctx, sheepArea, wolfArea, [currentResult]);

    ctx.fillStyle = "#ecfdf5";
    ctx.fillRect(meadowLeft, meadowTop, meadowWidth, meadowHeight);
    ctx.fillStyle = "rgba(254, 242, 242, 0.6)";
    ctx.fillRect(dividerX, meadowTop, meadowLeft + meadowWidth - dividerX, meadowHeight);
    ctx.strokeStyle = "#86efac";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(meadowLeft, meadowTop, meadowWidth, meadowHeight);
    ctx.strokeStyle = "rgba(100, 116, 139, 0.35)";
    ctx.beginPath();
    ctx.moveTo(dividerX, meadowTop + 12);
    ctx.lineTo(dividerX, meadowBottom - 12);
    ctx.stroke();

    drawPredatorLabels(ctx, meadowLeft, headerTop, meadowWidth, prey, wolves, rates, unit, options.label);
    drawPopulationIcons(ctx, sheepArea.x, sheepArea.y, sheepArea.width, sheepArea.height, prey, unit, "sheep");
    drawPopulationIcons(ctx, wolfArea.x, wolfArea.y, wolfArea.width, wolfArea.height, wolves, unit, "wolf");

    drawPopulationBar(ctx, width * 0.16, regionTop + regionHeight * 0.84, width * 0.3, prey, "#2563eb", "sheep");
    drawPopulationBar(ctx, width * 0.54, regionTop + regionHeight * 0.84, width * 0.3, wolves, "#dc2626", "wolves");
  }

  function drawPredatorLabels(ctx, x, y, width, prey, wolves, rates, unit, label = "", options = {}) {
    ctx.fillStyle = "#166534";
    ctx.font = "bold 12px Arial";
    const titleY = y + 12;
    const detailY = y + 28;
    ctx.fillText(`${label ? `${label}: ` : ""}Lotka-Volterra`, x + 12, titleY);
    ctx.fillStyle = "#475569";
    ctx.font = "11px Arial";
    ctx.fillText(`1 icon = ${formatHudNumber(unit)}`, x + width - 92, titleY);
    ctx.fillText(`sheep ${formatHudNumber(prey)} | rate ${formatHudNumber(rates.y)}`, x + 12, detailY);
    ctx.fillText(`wolves ${formatHudNumber(wolves)} | rate ${formatHudNumber(rates.v)}`, x + width * 0.62 + 12, detailY);
  }

  function drawNeuron(ctx, width, height, state, model) {
    const voltage = state.y;
    const recovery = state.v;
    const rates = model.derivative(state.t, voltage, recovery);
    const spike = latestNeuronSpike(state.t);
    const spikeActive = spike && spike.age <= 1.2;
    const bounds = neuronSpriteBounds(width, height);
    const soma = {
      x: bounds.x + bounds.w * 0.23,
      y: bounds.y + bounds.h * 0.5
    };
    const inputTarget = {
      x: bounds.x + bounds.w * 0.02,
      y: bounds.y + bounds.h * 0.52
    };

    drawNeuronChargeArcs(ctx, bounds, voltage, spikeActive ? spike.age : null, state.t);
    drawNeuronSprite(ctx, bounds);
    drawNeuronInput(ctx, bounds.x - width * 0.06, inputTarget.y, model.neuronI, rates.y, inputTarget);
    drawAxonPulse(ctx, bounds, spike, voltage, state.t);

    drawNeuronMeter(ctx, width * 0.66, height * 0.22, voltage, "u membrane voltage", "#7c3aed", -2.5, 2.5, null);
    drawNeuronMeter(ctx, width * 0.66, height * 0.46, recovery, "w recovery", "#0891b2", -1, 2, null);

    ctx.fillStyle = spikeActive ? "#dc2626" : "#475569";
    ctx.font = "13px Arial";
    ctx.fillText("FitzHugh-Nagumo excitable neuron", width * 0.54, height * 0.15);
    ctx.fillText(spikeActive ? "spike: u peaked, pulse on axon" : "spike event: local maximum of u", width * 0.58, height * 0.76);
    ctx.fillText(`u'=${formatHudNumber(rates.y)}   w'=${formatHudNumber(rates.v)}`, width * 0.58, height * 0.82);
  }

  function neuronSpriteBounds(width, height) {
    const maxW = width * 0.48;
    const maxH = height * 0.58;
    const ratio = 2;
    let w = maxW;
    let h = w / ratio;
    if (h > maxH) {
      h = maxH;
      w = h * ratio;
    }
    return {
      x: width * 0.16,
      y: height * 0.24,
      w,
      h
    };
  }

  function drawNeuronSprite(ctx, bounds) {
    if (neuronSprite.complete && neuronSprite.naturalWidth > 0) {
      const previousSmoothing = ctx.imageSmoothingEnabled;
      const previousQuality = ctx.imageSmoothingQuality;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(neuronSprite, bounds.x, bounds.y, bounds.w, bounds.h);
      ctx.imageSmoothingEnabled = previousSmoothing;
      ctx.imageSmoothingQuality = previousQuality;
      return;
    }

    ctx.fillStyle = "#c084fc";
    ctx.strokeStyle = "#4c1d95";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bounds.x + bounds.w * 0.23, bounds.y + bounds.h * 0.5, bounds.h * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  function drawNeuronChargeArcs(ctx, bounds, voltage, spikeAge, time) {
    const normalized = clamp((voltage + 1.4) / 3, 0, 1);
    const spikeBoost = spikeAge == null ? 0 : Math.max(0, 1 - spikeAge / 1.2);
    const intensity = clamp(normalized * 0.65 + spikeBoost * 0.65, 0, 1);
    if (intensity <= 0.04) return;

    const somaX = bounds.x + bounds.w * 0.23;
    const somaY = bounds.y + bounds.h * 0.5;
    ctx.save();
    ctx.lineCap = "round";
    for (let i = 0; i < 7; i++) {
      const angle = time * 2.6 + i * Math.PI * 2 / 7;
      const r0 = bounds.h * (0.12 + 0.015 * Math.sin(time * 5 + i));
      const r1 = bounds.h * (0.2 + 0.035 * intensity);
      const p0 = {
        x: somaX + Math.cos(angle) * r0,
        y: somaY + Math.sin(angle) * r0
      };
      const p1 = {
        x: somaX + Math.cos(angle + 0.22) * r1,
        y: somaY + Math.sin(angle + 0.22) * r1
      };
      ctx.strokeStyle = `rgba(250, 204, 21, ${0.2 + intensity * 0.45})`;
      ctx.lineWidth = 1.2 + intensity * 1.8;
      drawLightningSegment(ctx, p0, p1, 4, i + time);
    }
    ctx.restore();
  }

  function drawAxonPulse(ctx, bounds, spike, voltage, time) {
    if (!spike || spike.age > 1.2) return;
    const progress = clamp(spike.age / 1.2, 0, 1);
    const intensity = 1 - Math.abs(progress - 0.5) * 0.7;
    const path = axonPathPoints(bounds);
    const head = pointOnPolyline(path, progress);
    const tail = pointOnPolyline(path, Math.max(progress - 0.12, 0));

    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = `rgba(250, 204, 21, ${0.38 + intensity * 0.5})`;
    ctx.lineWidth = 2 + intensity * 3;
    drawLightningSegment(ctx, tail, head, 7, time * 3);
    ctx.strokeStyle = `rgba(59, 130, 246, ${0.2 + intensity * 0.32})`;
    ctx.lineWidth = 5 + intensity * 4;
    drawLightningSegment(ctx, tail, head, 5, time * 5 + 2);
    ctx.restore();
  }

  function axonPathPoints(bounds) {
    const y = bounds.y + bounds.h * 0.5;
    return [
      { x: bounds.x + bounds.w * 0.39, y: y - bounds.h * 0.01 },
      { x: bounds.x + bounds.w * 0.48, y: y - bounds.h * 0.02 },
      { x: bounds.x + bounds.w * 0.58, y: y + bounds.h * 0.04 },
      { x: bounds.x + bounds.w * 0.68, y: y + bounds.h * 0.1 },
      { x: bounds.x + bounds.w * 0.77, y: y + bounds.h * 0.07 },
      { x: bounds.x + bounds.w * 0.86, y: y - bounds.h * 0.04 },
      { x: bounds.x + bounds.w * 0.93, y: y - bounds.h * 0.08 }
    ];
  }

  function pointOnPolyline(points, t) {
    if (!points.length) return { x: 0, y: 0 };
    const lengths = [];
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const length = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
      lengths.push(length);
      total += length;
    }
    let target = clamp(t, 0, 1) * total;
    for (let i = 0; i < lengths.length; i++) {
      if (target <= lengths[i] || i === lengths.length - 1) {
        const fraction = lengths[i] ? target / lengths[i] : 0;
        return {
          x: points[i].x + (points[i + 1].x - points[i].x) * fraction,
          y: points[i].y + (points[i + 1].y - points[i].y) * fraction
        };
      }
      target -= lengths[i];
    }
    return points[points.length - 1];
  }

  function drawLightningSegment(ctx, from, to, segments, phase) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.max(Math.hypot(dx, dy), 1);
    const nx = -dy / len;
    const ny = dx / len;
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const jitter = i === 0 || i === segments ? 0 : Math.sin(phase * 7 + i * 12.989) * 6;
      const x = from.x + dx * t + nx * jitter;
      const y = from.y + dy * t + ny * jitter;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function latestNeuronSpike(t) {
    const points = currentResult?.points || [];
    let peakT = null;
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const current = points[i];
      const next = points[i + 1];
      if (next.t > t) break;
      const risingBefore = current.y - prev.y;
      const fallingAfter = next.y - current.y;
      if (risingBefore > 0 && fallingAfter <= 0) {
        peakT = current.t;
      }
    }
    if (peakT == null) return null;
    return { t: peakT, age: Math.max(t - peakT, 0) };
  }

  function drawMissingElementLabel(ctx, x, y, label) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px Arial";
    ctx.fillText(label, x - 12, y);
  }

  function drawCircuitBattery(ctx, x, y, voltage) {
    const level = clamp(Math.abs(voltage) / 2, 0.12, 1);
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "rgba(249, 115, 22, 0.65)";
    ctx.lineWidth = 1.5;
    ctx.fillRect(x - 40, y - 54, 80, 108);
    ctx.strokeRect(x - 40, y - 54, 80, 108);

    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x - 22, y - 28);
    ctx.lineTo(x + 22, y - 28);
    ctx.moveTo(x - 12, y + 8);
    ctx.lineTo(x + 12, y + 8);
    ctx.moveTo(x, y - 50);
    ctx.lineTo(x, y - 28);
    ctx.moveTo(x, y + 8);
    ctx.lineTo(x, y + 50);
    ctx.stroke();

    ctx.fillStyle = `rgba(249, 115, 22, ${0.18 + level * 0.36})`;
    ctx.beginPath();
    ctx.arc(x, y - 10, 20 + level * 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#9a3412";
    ctx.font = "12px Arial";
    ctx.fillText("Vext", x - 15, y + 34);
    ctx.fillStyle = "#334155";
    ctx.fillText("+", x + 26, y - 26);
    ctx.fillText("-", x + 26, y + 12);
  }

  function drawCircuitResistor(ctx, x0, y0, x1, y1, current, time, resistance) {
    const segments = 8;
    const amplitude = 12;
    const power = resistance * current * current;
    const heat = clamp(power / 2, 0.04, 1);
    ctx.strokeStyle = "#92400e";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    for (let i = 1; i < segments; i++) {
      const x = x0 + (x1 - x0) * i / segments;
      const y = y0 + (i % 2 ? -amplitude : amplitude);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(x1, y1);
    ctx.stroke();
    drawAnimatedHeatWisps(ctx, (x0 + x1) / 2 - 20, y0 - 40, heat, time);
    ctx.fillStyle = "#92400e";
    ctx.font = "12px Arial";
    ctx.fillText(`R  P=${formatHudNumber(power)}`, (x0 + x1) / 2 - 24, y0 + 38);
  }

  function drawCircuitInductor(ctx, x0, y0, x1, y1, current, time) {
    const coils = 5;
    const radius = (x1 - x0) / (coils * 2);
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    for (let i = 0; i < coils; i++) {
      const cx = x0 + radius * (1 + i * 2);
      ctx.arc(cx, y0, radius, Math.PI, 0);
    }
    ctx.lineTo(x1, y1);
    ctx.stroke();
    drawInductorField(ctx, (x0 + x1) / 2, y0, x1 - x0, current, time);
    ctx.fillStyle = "#1d4ed8";
    ctx.font = "12px Arial";
    ctx.fillText("L stores magnetic field", (x0 + x1) / 2 - 56, y0 + 48);
    ctx.fillText("E_L = 1/2 L i^2", (x0 + x1) / 2 - 44, y0 + 64);
  }

  function drawCircuitCapacitor(ctx, x, y, chargeLevel, charge) {
    const plateLength = 86;
    const gap = 20;
    const leftPlateX = x - gap / 2;
    const rightPlateX = x + gap / 2;

    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(leftPlateX, y - plateLength / 2);
    ctx.lineTo(leftPlateX, y + plateLength / 2);
    ctx.moveTo(rightPlateX, y - plateLength / 2);
    ctx.lineTo(rightPlateX, y + plateLength / 2);
    ctx.stroke();

    const fill = Math.abs(chargeLevel);
    const color = chargeLevel >= 0 ? "37, 99, 235" : "220, 38, 38";
    ctx.fillStyle = `rgba(${color}, ${0.1 + fill * 0.45})`;
    ctx.fillRect(leftPlateX - 12, y + plateLength / 2 - fill * plateLength, 8, fill * plateLength);
    ctx.fillRect(rightPlateX + 4, y - plateLength / 2, 8, fill * plateLength);
    drawCapacitorField(ctx, x, y, fill, chargeLevel);

    ctx.fillStyle = "#334155";
    ctx.font = "12px Arial";
    ctx.fillText("C stores electric field", x + 28, y - 10);
    ctx.fillText("E_C = q^2/(2C)", x + 28, y + 8);
    ctx.fillText(`q=${formatHudNumber(charge)}`, x + 28, y + 26);
    ctx.fillText(chargeLevel >= 0 ? "+" : "-", leftPlateX - 28, y - 50);
    ctx.fillText(chargeLevel >= 0 ? "-" : "+", rightPlateX + 18, y - 50);
  }

  function drawCapacitorField(ctx, x, y, strength, chargeLevel) {
    const direction = chargeLevel >= 0 ? 1 : -1;
    ctx.strokeStyle = `rgba(37, 99, 235, ${0.18 + strength * 0.36})`;
    ctx.lineWidth = 1.7;
    for (let i = 0; i < 4; i++) {
      const yy = y - 28 + i * 18;
      drawSmallArrow(ctx, x, yy, direction > 0 ? 0 : Math.PI, 22, ctx.strokeStyle);
    }
  }

  function drawInductorField(ctx, centerX, centerY, width, current, time) {
    const strength = clamp(Math.abs(current), 0, 1.6);
    const alpha = 0.12 + strength * 0.26;
    ctx.strokeStyle = `rgba(37, 99, 235, ${alpha})`;
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) {
      const phase = time * 4 + i * 0.9;
      const wobble = Math.sin(phase) * 4;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY - 2 + wobble, width * (0.22 + i * 0.07), 18 + i * 7, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawAnimatedHeatWisps(ctx, x, y, strength, time) {
    const count = Math.ceil(3 + strength * 6);
    const alpha = clamp(0.36 + strength * 0.58, 0.36, 0.95);
    ctx.strokeStyle = `rgba(234, 88, 12, ${alpha})`;
    ctx.lineWidth = 2.2 + strength * 1.4;
    for (let i = 0; i < count; i++) {
      const offset = i * 8;
      const lift = (Math.sin(time * 5 + i) + 1) * (4 + strength * 5);
      ctx.beginPath();
      ctx.moveTo(x + offset, y + 16);
      ctx.bezierCurveTo(x - 5 + offset, y + 7 - lift, x + 8 + offset, y - 2 - lift, x + 2 + offset, y - 14 - lift);
      ctx.stroke();
    }
  }

  function drawCircuitCurrentArrows(ctx, left, right, top, bottom, current, time, hasCapacitor) {
    const strength = clamp(Math.abs(current), 0, 1.4);
    if (strength < 1e-6) return;
    const alpha = 0.18 + strength * 0.46;
    const direction = Math.sign(current || 1);
    const positions = [
      { x: (left + right) / 2, y: top, angle: direction > 0 ? 0 : Math.PI },
      { x: right, y: (top + bottom) / 2 + (hasCapacitor ? 74 : 0), angle: direction > 0 ? Math.PI / 2 : -Math.PI / 2 },
      { x: (left + right) / 2, y: bottom, angle: direction > 0 ? Math.PI : 0 },
      { x: left, y: (top + bottom) / 2 - 74, angle: direction > 0 ? -Math.PI / 2 : Math.PI / 2 }
    ];
    positions.forEach((item, index) => {
      const pulse = 0.75 + 0.25 * Math.sin(time * 5 + index);
      drawSmallArrow(ctx, item.x, item.y, item.angle, 20 + strength * 10 * pulse, `rgba(37, 99, 235, ${alpha})`);
    });
  }

  function drawSmallArrow(ctx, x, y, angle, length, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-length / 2, 0);
    ctx.lineTo(length / 2, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(length / 2, 0);
    ctx.lineTo(length / 2 - 8, -5);
    ctx.lineTo(length / 2 - 8, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function predatorCompareIconUnit(ctx, width, height) {
    const regionHeight = height * 0.42;
    const meadowLeft = width * 0.08;
    const meadowWidth = width * 0.84;
    const meadowHeight = regionHeight * 0.68;
    const dividerX = meadowLeft + meadowWidth * 0.62;
    const iconTop = 34;
    const iconBottom = meadowHeight - 14;
    const sheepArea = {
      width: dividerX - meadowLeft - 32,
      height: Math.max(iconBottom - iconTop, 24)
    };
    const wolfArea = {
      width: meadowLeft + meadowWidth - dividerX - 32,
      height: Math.max(iconBottom - iconTop, 24)
    };
    return predatorIconUnit(ctx, sheepArea, wolfArea, [currentResult, currentCompareResult]);
  }

  function predatorIconUnit(ctx, sheepArea, wolfArea, results = [currentResult]) {
    const points = results
      .filter(Boolean)
      .flatMap(result => result.points || []);
    const maxPopulation = Math.max(...(points.length ? points : [{ y: 1, v: 1 }]).map(point => Math.max(point.y, point.v, 0)), 1);
    const sheepCapacity = populationIconCapacity(ctx, sheepArea.width, sheepArea.height, "sheep");
    const wolfCapacity = populationIconCapacity(ctx, wolfArea.width, wolfArea.height, "wolf");
    const sharedCapacity = Math.max(Math.min(sheepCapacity, wolfCapacity), 1);
    return Math.max(1, Math.ceil(maxPopulation / sharedCapacity));
  }

  function populationIconCapacity(ctx, width, height, type) {
    const layout = populationIconLayout(ctx, type);
    const cols = Math.max(Math.floor(width / (layout.size + layout.gap)), 1);
    const rows = Math.max(Math.floor(height / (layout.size + layout.gap * 0.7)), 1);
    return cols * rows;
  }

  function populationIconLayout(ctx, type) {
    const pixelScale = canvasPixelScale(ctx);
    return {
      size: (type === "wolf" ? 38 : 36) * pixelScale,
      gap: 6 * pixelScale,
      wobble: 1.5 * pixelScale
    };
  }

  function drawPopulationIcons(ctx, x, y, width, height, value, unit, type) {
    const icon = animalIcons[type];
    const layout = populationIconLayout(ctx, type);
    const iconSize = layout.size;
    const gap = layout.gap;
    const fullCount = Math.floor(value / unit);
    const fraction = clamp((value - fullCount * unit) / unit, 0, 1);
    const count = fullCount + (fraction > 0.02 ? 1 : 0);
    const cols = Math.max(Math.floor(width / (iconSize + gap)), 1);
    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const px = x + col * (iconSize + gap) + iconSize / 2 + Math.sin(i * 1.7) * layout.wobble;
      const py = y + row * (iconSize + gap * 0.7) + iconSize / 2 + Math.cos(i * 2.1) * layout.wobble;
      if (py > y + height) break;
      const part = i < fullCount ? 1 : fraction;
      if (icon?.complete && icon.naturalWidth > 0) {
        drawPopulationBitmapIcon(ctx, icon, px, py, iconSize, part);
      } else if (type === "wolf") {
        drawWolfIcon(ctx, px, py);
      } else {
        drawSheepIcon(ctx, px, py);
      }
    }
  }

  function drawPopulationBitmapIcon(ctx, icon, centerX, centerY, size, fraction) {
    const x = centerX - size / 2;
    const y = centerY - size / 2;
    const previousSmoothing = ctx.imageSmoothingEnabled;
    const previousQuality = ctx.imageSmoothingQuality;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    if (fraction >= 0.995) {
      ctx.drawImage(icon, x, y, size, size);
    } else {
      ctx.save();
      ctx.globalAlpha = 0.32;
      ctx.drawImage(icon, x, y, size, size);
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.rect(x, y, size * fraction, size);
      ctx.clip();
      ctx.drawImage(icon, x, y, size, size);
      ctx.restore();
    }
    ctx.imageSmoothingEnabled = previousSmoothing;
    ctx.imageSmoothingQuality = previousQuality;
  }

  function canvasPixelScale(ctx) {
    const canvas = ctx.canvas;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return 1;
    return canvas.width / rect.width;
  }

  function drawSheepIcon(ctx, x, y) {
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(x, y, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f8fafc";
    [-7, 0, 7].forEach(offset => {
      ctx.beginPath();
      ctx.arc(x + offset, y - 6, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    ctx.fillStyle = "#cbd5e1";
    ctx.beginPath();
    ctx.arc(x + 12, y - 1, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#334155";
    ctx.beginPath();
    ctx.arc(x + 14, y - 2, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1.2;
    [-6, 6].forEach(offset => {
      ctx.beginPath();
      ctx.moveTo(x + offset, y + 7);
      ctx.lineTo(x + offset - 2, y + 13);
      ctx.stroke();
    });
  }

  function drawWolfIcon(ctx, x, y) {
    ctx.fillStyle = "#7f1d1d";
    ctx.strokeStyle = "#450a0a";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - 13, y + 7);
    ctx.lineTo(x - 3, y - 9);
    ctx.lineTo(x + 12, y + 3);
    ctx.lineTo(x + 2, y + 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 7, y - 4);
    ctx.lineTo(x - 9, y - 13);
    ctx.lineTo(x - 1, y - 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fecaca";
    ctx.beginPath();
    ctx.arc(x + 4, y - 1, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#450a0a";
    ctx.beginPath();
    ctx.moveTo(x + 9, y + 3);
    ctx.lineTo(x + 15, y + 2);
    ctx.stroke();
  }

  function drawPopulationBar(ctx, x, y, width, value, color, label) {
    const barWidth = width * clamp(value / 4, 0, 1);
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(x, y, width, 12);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, barWidth, 12);
    ctx.fillStyle = "#334155";
    ctx.font = "12px Arial";
    ctx.fillText(`${label}: ${formatHudNumber(value)}`, x, y + 30);
  }

  function drawNeuronMeter(ctx, x, y, value, label, color, min, max, threshold = null) {
    const width = 160;
    const height = 14;
    const fraction = clamp((value - min) / (max - min), 0, 1);
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width * fraction, height);
    ctx.strokeStyle = "#94a3b8";
    ctx.strokeRect(x, y, width, height);
    if (threshold != null) {
      const thresholdX = x + width * clamp((threshold - min) / (max - min), 0, 1);
      ctx.strokeStyle = "#dc2626";
      ctx.beginPath();
      ctx.moveTo(thresholdX, y - 6);
      ctx.lineTo(thresholdX, y + height + 6);
      ctx.stroke();
    }
    ctx.fillStyle = "#334155";
    ctx.font = "12px Arial";
    ctx.fillText(`${label}: ${formatHudNumber(value)}`, x, y + 34);
  }

  function drawNeuronInput(ctx, x, y, input, voltageRate, target) {
    const strength = clamp(Math.abs(input), 0, 2);
    ctx.strokeStyle = "#f59e0b";
    ctx.fillStyle = "#fff7ed";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#92400e";
    ctx.beginPath();
    ctx.moveTo(x - 10, y);
    ctx.lineTo(x + 10, y);
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x, y + 10);
    ctx.stroke();

    if (target) {
      const startX = x + 24;
      const endX = target.x - 8;
      const endY = target.y;
      ctx.strokeStyle = `rgba(249, 115, 22, ${0.42 + strength * 0.24})`;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = 2.2 + strength * 1.2;
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      const angle = Math.atan2(endY - y, endX - startX);
      drawSmallArrow(ctx, endX - 2, endY, angle, 22 + strength * 12, ctx.strokeStyle);
    }

    ctx.fillStyle = "#92400e";
    ctx.font = "12px Arial";
    ctx.fillText("input current into dendrites", x - 52, y + 42);
    ctx.fillText(`I=${formatHudNumber(input)}   adds to u'=${formatHudNumber(voltageRate)}`, x - 58, y + 58);
  }

  function drawSpring(ctx, x0, y0, x1, y1, coils, amplitude) {
    const length = x1 - x0;
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    for (let i = 1; i < coils * 2; i++) {
      const x = x0 + length * i / (coils * 2);
      const y = y0 + (i % 2 === 0 ? -amplitude : amplitude);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  function pendulumVisualLength(width, height, lengthValue) {
    const base = Math.min(width, height) * 0.31;
    const scale = clamp(Math.sqrt(Math.max(lengthValue, 0.05)), 0.55, 1.65);
    return Math.min(base * scale, height * 0.68);
  }

  function drawPendulumLengthLabel(ctx, pivotX, pivotY, bobX, bobY, lengthValue) {
    const x = (pivotX + bobX) / 2 + 10;
    const y = (pivotY + bobY) / 2;
    ctx.fillStyle = "#475569";
    ctx.font = "12px Arial";
    ctx.fillText(`L=${formatHudNumber(lengthValue)}`, x, y);
  }

  function drawViscousMedium(ctx, width, centerY, massLeft, massRight, force, time) {
    const left = width * 0.18;
    const top = centerY - 42;
    const right = width * 0.86;
    const height = 102;
    const intensity = clamp(Math.abs(force) / 1.5, 0.12, 0.72);

    ctx.fillStyle = "rgba(14, 165, 233, 0.08)";
    ctx.strokeStyle = "rgba(8, 145, 178, 0.22)";
    ctx.lineWidth = 1.5;
    ctx.fillRect(left, top, right - left, height);
    ctx.strokeRect(left, top, right - left, height);

    ctx.strokeStyle = `rgba(8, 145, 178, ${0.18 + intensity * 0.32})`;
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) {
      const y = top + 20 + i * 18;
      drawFluidWave(ctx, left + 18, y, right - left - 36, time * (1.3 + i * 0.18) + i * 0.9);
    }

    const side = force >= 0 ? massRight + 7 : massLeft - 7;
    drawDragWake(ctx, side, centerY, force, intensity, time);
  }

  function drawFluidWave(ctx, x, y, width, phase) {
    ctx.beginPath();
    for (let i = 0; i <= width; i += 8) {
      const px = x + i;
      const py = y + Math.sin(i / 26 + phase) * 2.5;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  function drawPendulumFluid(ctx, width, height, bobX, bobY, time, force) {
    const top = height * 0.34;
    const fluidHeight = height * 0.5;
    const intensity = clamp(Math.abs(force) / 1.2, 0.1, 0.68);

    ctx.fillStyle = "rgba(14, 165, 233, 0.08)";
    ctx.strokeStyle = "rgba(8, 145, 178, 0.22)";
    ctx.lineWidth = 1.4;
    ctx.fillRect(width * 0.18, top, width * 0.64, fluidHeight);
    ctx.strokeRect(width * 0.18, top, width * 0.64, fluidHeight);

    ctx.strokeStyle = `rgba(8, 145, 178, ${0.18 + intensity * 0.3})`;
    for (let i = 0; i < 5; i++) {
      drawFluidWave(ctx, width * 0.21, top + 18 + i * 21, width * 0.58, time * (1.1 + i * 0.16) + i);
    }

    drawPendulumWake(ctx, bobX, bobY, force, time, intensity);
  }

  function drawPendulumWake(ctx, bobX, bobY, force, time, intensity) {
    const direction = -Math.sign(force || 1);
    ctx.strokeStyle = `rgba(8, 145, 178, ${0.25 + intensity * 0.42})`;
    ctx.lineWidth = 1.7;
    for (let i = 0; i < 4; i++) {
      const offset = -18 + i * 12;
      const wobble = Math.sin(time * 5 + i) * 4;
      ctx.beginPath();
      ctx.moveTo(bobX + direction * 18, bobY + offset);
      ctx.bezierCurveTo(bobX + direction * 30, bobY + offset - 5 + wobble, bobX + direction * 42, bobY + offset + 5 - wobble, bobX + direction * 55, bobY + offset);
      ctx.stroke();
    }
  }

  function drawDragWake(ctx, x, centerY, force, intensity, time) {
    const direction = -Math.sign(force || 1);
    ctx.strokeStyle = `rgba(8, 145, 178, ${0.25 + intensity * 0.45})`;
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 4; i++) {
      const y = centerY - 21 + i * 14;
      const wobble = Math.sin(time * 5 + i) * 4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + direction * 13, y - 5 + wobble, x + direction * 24, y + 5 - wobble, x + direction * 37, y);
      ctx.stroke();
    }
  }

  function drawMassCenterMarker(ctx, massX, centerY, massH) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(massX, centerY - massH / 2 + 5);
    ctx.lineTo(massX, centerY + massH / 2 - 5);
    ctx.stroke();

    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(massX, centerY - massH / 2 + 5);
    ctx.lineTo(massX, centerY + massH / 2 - 5);
    ctx.stroke();

    ctx.fillStyle = "#0f172a";
    ctx.font = "12px Arial";
    ctx.fillText("x", massX - 3, centerY - massH / 2 - 8);
  }

  function drawOscillatorDriveCue(ctx, width, originX, centerY, scale, state, model, force) {
    const omega2 = Math.max(model.omega * model.omega, 1e-9);
    const eqX = originX + clamp(force / omega2, -2, 2) * scale;

    ctx.strokeStyle = "rgba(249, 115, 22, 0.75)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(eqX, centerY + 30);
    ctx.lineTo(eqX, centerY + 66);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#9a3412";
    ctx.font = "12px Arial";
    ctx.fillText("x_eq", eqX - 12, centerY + 86);

    drawDriveSignal(ctx, width - 76, 74, state, model, force);
  }

  function drawDriveSignal(ctx, centerX, centerY, state, model, force) {
    ctx.fillStyle = "rgba(255, 247, 237, 0.92)";
    ctx.strokeStyle = "rgba(249, 115, 22, 0.45)";
    ctx.lineWidth = 1.2;
    ctx.fillRect(centerX - 45, centerY - 24, 90, 48);
    ctx.strokeRect(centerX - 45, centerY - 24, 90, 48);

    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    if (Math.abs(model.driveOmega) < 1e-9) {
      const y = centerY - clamp(force / Math.max(Math.abs(model.driveA), 1e-9), -1, 1) * 12;
      ctx.moveTo(centerX - 34, y);
      ctx.lineTo(centerX + 34, y);
    } else {
      for (let i = 0; i <= 68; i++) {
        const x = centerX - 34 + i;
        const phase = (i / 68) * Math.PI * 2 + model.driveOmega * state.t;
        const y = centerY - Math.cos(phase) * 12;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    ctx.fillStyle = "#9a3412";
    ctx.font = "12px Arial";
    ctx.fillText("Fext", centerX - 12, centerY + 38);
  }

  function drawLinearThruster(ctx, massX, centerY, massW, massH, force, time) {
    const direction = Math.sign(force || 1);
    const x = massX - direction * (massW / 2 + 8);
    const y = centerY;
    drawThrusterBody(ctx, x, y, direction, 0, Math.abs(force), time);
  }

  function drawPendulumThruster(ctx, bobX, bobY, theta, force, time) {
    const tangentX = Math.cos(theta);
    const tangentY = -Math.sin(theta);
    const direction = Math.sign(force || 1);
    const x = bobX - tangentX * direction * 28;
    const y = bobY - tangentY * direction * 28;
    drawThrusterBody(ctx, x, y, direction, -theta, Math.abs(force), time);
  }

  function drawThrusterBody(ctx, x, y, direction, angle, strength, time) {
    const size = clamp(strength / 1.4, 0, 1);
    const bodyLength = 16;
    const bodyHeight = 10;
    const flicker = 0.75 + 0.25 * Math.sin(time * 18 + strength * 3);
    const flameLength = (18 + size * 22) * flicker;
    const flameSpread = (7 + size * 4) * (0.85 + 0.15 * Math.cos(time * 23));

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = "#334155";
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 1.5;
    ctx.fillRect(-bodyLength / 2, -bodyHeight / 2, bodyLength, bodyHeight);
    ctx.strokeRect(-bodyLength / 2, -bodyHeight / 2, bodyLength, bodyHeight);

    const nozzleX = -direction * bodyLength / 2;
    ctx.fillStyle = "#64748b";
    ctx.fillRect(nozzleX - direction * 5, -4, 5, 8);
    if (size < 0.02) {
      ctx.restore();
      return;
    }

    ctx.fillStyle = `rgba(249, 115, 22, ${0.35 + size * 0.45})`;
    ctx.beginPath();
    ctx.moveTo(nozzleX - direction * 4, 0);
    ctx.lineTo(nozzleX - direction * flameLength, -flameSpread);
    ctx.lineTo(nozzleX - direction * (flameLength * 0.72), 0);
    ctx.lineTo(nozzleX - direction * (flameLength * 0.92), flameSpread);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = `rgba(254, 215, 170, ${0.35 + size * 0.4})`;
    ctx.beginPath();
    ctx.moveTo(nozzleX - direction * 4, 0);
    ctx.lineTo(nozzleX - direction * flameLength * 0.55, -flameSpread * 0.45);
    ctx.lineTo(nozzleX - direction * flameLength * 0.42, 0);
    ctx.lineTo(nozzleX - direction * flameLength * 0.55, flameSpread * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawTangentialArrow(ctx, x, y, theta, force, color, label) {
    const tangentX = Math.cos(theta);
    const tangentY = -Math.sin(theta);
    const length = clamp(force * 44, -78, 78);
    const startX = x + tangentX * 27;
    const startY = y + tangentY * 27;
    const endX = startX + tangentX * length;
    const endY = startY + tangentY * length;
    const direction = Math.sign(length || 1);

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.3;
    if (Math.abs(length) < 2) {
      ctx.beginPath();
      ctx.arc(startX, startY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "12px Arial";
      ctx.fillText(label, startX + 5, startY - 5);
      return;
    }

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - tangentX * direction * 9 - tangentY * 5, endY - tangentY * direction * 9 + tangentX * 5);
    ctx.lineTo(endX - tangentX * direction * 9 + tangentY * 5, endY - tangentY * direction * 9 - tangentX * 5);
    ctx.closePath();
    ctx.fill();

    ctx.font = "12px Arial";
    ctx.fillText(label, endX + 5, endY - 5);
  }

  function drawForceArrow(ctx, x, y, force, color, label) {
    const length = clamp(force * 54, -88, 88);
    const direction = Math.sign(length || 1);
    const endX = x + length;

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.4;
    if (Math.abs(length) < 2) {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "12px Arial";
      ctx.fillText(label, x - 32, y - 8);
      return;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(endX, y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(endX, y);
    ctx.lineTo(endX - direction * 9, y - 6);
    ctx.lineTo(endX - direction * 9, y + 6);
    ctx.closePath();
    ctx.fill();

    ctx.font = "12px Arial";
    ctx.fillText(label, x - 32, y - 8);
  }

  function drawHeatWisps(ctx, x, y, strength) {
    const alpha = clamp(strength / 1.6, 0.08, 0.7);
    ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      const offset = i * 9;
      ctx.beginPath();
      ctx.moveTo(x + offset, y + 10);
      ctx.bezierCurveTo(x - 5 + offset, y + 2, x + 8 + offset, y - 4, x + 2 + offset, y - 13);
      ctx.stroke();
    }
  }

  function drawCanvasObjectLabel(ctx, label, x, y, color) {
    if (!label) return;
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4;
    ctx.font = "bold 15px Arial";
    ctx.textAlign = "center";
    ctx.strokeText(label, x, y);
    ctx.fillText(label, x, y);
    ctx.restore();
  }

  function drawCanvasHud(ctx, state, model, compareState = null) {
    ctx.fillStyle = "#334155";
    ctx.font = "15px Arial";
    const labels = variableLabels(model);
    const main = `t=${formatTimeValue(state.t)}   A: ${labels.y}=${formatHudNumber(state.y)}   ${labels.v}=${formatHudNumber(state.v)}`;
    ctx.fillText(main, 18, 28);
    if (compareState) {
      ctx.fillStyle = "#0369a1";
      ctx.fillText(`B: ${labels.y}=${formatHudNumber(compareState.y)}   ${labels.v}=${formatHudNumber(compareState.v)}`, 18, 50);
    }
  }

  function interpolateState(points, t) {
    if (!points.length) return { t: 0, y: 0, v: 0 };
    if (t <= points[0].t) return points[0];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (t >= a.t && t <= b.t) {
        const fraction = (t - a.t) / (b.t - a.t || 1);
        const state = { t };
        Object.keys(a).forEach(key => {
          if (key === "t") return;
          if (typeof a[key] === "number" && typeof b[key] === "number") {
            state[key] = a[key] + (b[key] - a[key]) * fraction;
          }
        });
        return state;
      }
    }
    return points[points.length - 1];
  }

  function metricParts(model, point) {
    if (model.type === "rlc") {
      const inductor = model.hasL ? 0.5 * model.circuitL * point.v * point.v : 0;
      const capacitor = model.hasC ? point.y * point.y / (2 * model.circuitC) : 0;
      return { kinetic: inductor, potential: capacitor, total: inductor + capacitor };
    }

    if (model.mode === "particle2d" || model.mode === "coupled") {
      const specs = energyComponentSpecs(model);
      const kinetic = specs
        .filter(spec => spec.key.startsWith("kinetic"))
        .reduce((sum, spec) => sum + spec.value(model, point), 0);
      const totalSpec = specs.find(spec => spec.key === "total");
      const total = totalSpec ? totalSpec.value(model, point) : kinetic;
      return { kinetic, potential: total - kinetic, total };
    }

    if (model.mode === "planar" && model.derivative) {
      const rates = model.derivative(point.t, point.y, point.v);
      return { kinetic: rates.y, potential: rates.v, total: rates.y + rates.v };
    }

    let kinetic = 0.5 * point.v * point.v;
    let potential;
    if (model.type === "pendulum") {
      kinetic = 0.5 * model.length * model.length * point.v * point.v;
      potential = model.g * model.length * (1 - Math.cos(point.y));
    } else {
      potential = 0.5 * model.omega * model.omega * point.y * point.y;
    }
    return { kinetic, potential, total: kinetic + potential };
  }

  function updateTimeControls(t) {
    const slider = document.getElementById("physicsTimeSlider");
    const label = document.getElementById("physicsTimeLabel");
    if (!currentResult) return;
    const t0 = currentResult.points[0].t;
    const t1 = currentResult.points[currentResult.points.length - 1].t;
    const sliderValue = clamp((t - t0) / (t1 - t0 || 1), 0, 1);
    if (document.activeElement !== slider || isPlaying) {
      slider.value = String(sliderValue);
    }
    label.textContent = `t=${formatTimeValue(t)}`;
  }

  function updatePlotCursors(t, state, force = false) {
    if (!currentResult || !currentModel) return;
    const now = performance.now();
    if (!force && now - lastPlotCursorUpdate < 80) return;
    lastPlotCursorUpdate = now;
    if (currentModel.analysisMode === "resonance") {
      updateResonanceCursors(t, state);
      return;
    }
    if (currentModel.mode === "particle2d") {
      updateParticleCursors(t, state);
      return;
    }
    if (currentModel.mode === "coupled") {
      updateCoupledCursors(t, state);
      return;
    }
    const history = getHistoryUntil(t);
    const compareHistory = currentCompareResult && currentCompareModel
      ? getHistoryUntil(t, currentCompareResult, currentCompareModel)
      : null;
    const timeShape = timeCursorShape(t);
    const timeAnnotation = timeCursorAnnotation(t);
    relayoutIfReady("physicsTimePlot", { shapes: [timeShape], annotations: [timeAnnotation] });
    relayoutIfReady("physicsEnergyPlot", { shapes: [timeShape], annotations: [timeAnnotation] });
    restyleIfReady("physicsTimePlot", {
      x: [history.t, history.t],
      y: [history.y, history.v]
    }, [2, 3]);
    restyleIfReady("physicsPhasePlot", {
      x: [history.y],
      y: [history.v]
    }, [1]);
    restyleIfReady("physicsPhasePlot", {
      x: [[state.y]],
      y: [[state.v]]
    }, [2]);
    if (compareHistory && currentCompareResult) {
      const compareState = interpolateState(currentCompareResult.points, t);
      restyleIfReady("physicsTimePlot", {
        x: [compareHistory.t, compareHistory.t],
        y: [compareHistory.y, compareHistory.v]
      }, [6, 7]);
      restyleIfReady("physicsPhasePlot", {
        x: [compareHistory.y],
        y: [compareHistory.v]
      }, [4]);
      restyleIfReady("physicsPhasePlot", {
        x: [[compareState.y]],
        y: [[compareState.v]]
      }, [5]);
      restyleIfReady("physicsEnergyPlot", {
        x: [compareHistory.t],
        y: [compareHistory.total]
      }, [7]);
    }
    restyleIfReady("physicsEnergyPlot", {
      x: [history.t, history.t, history.t],
      y: [history.kinetic, history.potential, history.total]
    }, [3, 4, 5]);
  }

  function updateResonanceCursors(t, state) {
    const compareState = currentCompareResult ? interpolateState(currentCompareResult.points, t) : null;
    const history = getHistoryUntil(t, currentResult, currentModel);
    const compareHistory = currentCompareResult && currentCompareModel
      ? getHistoryUntil(t, currentCompareResult, currentCompareModel)
      : null;
    const timeShape = timeCursorShape(t);
    const timeAnnotation = timeCursorAnnotation(t);
    relayoutIfReady("physicsPhasePlot", { shapes: [timeShape], annotations: [timeAnnotation] });
    restyleIfReady("physicsPhasePlot", {
      x: [history.t],
      y: [history.y]
    }, [1]);
    if (compareHistory) {
      restyleIfReady("physicsPhasePlot", {
        x: [compareHistory.t],
        y: [compareHistory.y]
      }, [3]);
    }
    restyleIfReady("physicsEnergyPlot", {
      x: [history.y],
      y: [history.v]
    }, [1]);
    restyleIfReady("physicsEnergyPlot", {
      x: [[state.y]],
      y: [[state.v]]
    }, [2]);
    if (compareHistory && compareState) {
      restyleIfReady("physicsEnergyPlot", {
        x: [compareHistory.y],
        y: [compareHistory.v]
      }, [4]);
      restyleIfReady("physicsEnergyPlot", {
        x: [[compareState.y]],
        y: [[compareState.v]]
      }, [5]);
    }
  }

  function updateParticleCursors(t, state) {
    const history = getHistoryUntil(t);
    const timeShape = timeCursorShape(t);
    const timeAnnotation = timeCursorAnnotation(t);
    relayoutIfReady("physicsTimePlot", { shapes: [timeShape], annotations: [timeAnnotation] });
    relayoutIfReady("physicsPhasePlot", { shapes: [timeShape], annotations: [timeAnnotation] });
    restyleIfReady("physicsTimePlot", {
      x: [history.t, history.t],
      y: [history.vx, history.vy]
    }, [2, 3]);
    restyleIfReady("physicsPhasePlot", {
      x: [history.t, history.t],
      y: [history.x, history.yPos]
    }, [2, 3]);
    if ((currentModel.phaseProjection || defaultPhaseProjection(currentModel.type)) === "particleCompare") {
      restyleIfReady("physicsEnergyPlot", {
        x: [history.x, history.yPos],
        y: [history.vx, history.vy]
      }, [2, 3]);
      restyleIfReady("physicsEnergyPlot", {
        x: [[state.x], [state.yPos]],
        y: [[state.vx], [state.vy]]
      }, [4, 5]);
    } else {
      const projection = projectionTrace(currentModel, history.points, currentModel.phaseProjection || defaultPhaseProjection(currentModel.type));
      const currentProjection = projectionPoint(currentModel, state, currentModel.phaseProjection || defaultPhaseProjection(currentModel.type));
      restyleIfReady("physicsEnergyPlot", {
        x: [projection.x],
        y: [projection.y]
      }, [1]);
      restyleIfReady("physicsEnergyPlot", {
        x: [[currentProjection.x]],
        y: [[currentProjection.y]]
      }, [2]);
    }
    updateExtraEnergyCursor(t, history, currentModel);
  }

  function updateCoupledCursors(t, state) {
    const history = getHistoryUntil(t);
    const timeShape = timeCursorShape(t);
    const timeAnnotation = timeCursorAnnotation(t);
    relayoutIfReady("physicsTimePlot", { shapes: [timeShape], annotations: [timeAnnotation] });
    restyleIfReady("physicsTimePlot", {
      x: [history.t, history.t],
      y: [history.x1, history.x2]
    }, [2, 3]);
    relayoutIfReady("physicsPhasePlot", { shapes: [timeShape], annotations: [timeAnnotation] });
    restyleIfReady("physicsPhasePlot", {
      x: [history.t, history.t],
      y: [history.v1, history.v2]
    }, [2, 3]);
    if ((currentModel.phaseProjection || "coupledBoth") === "coupledBoth") {
      restyleIfReady("physicsEnergyPlot", {
        x: [history.x1, history.x2],
        y: [history.v1, history.v2]
      }, [2, 3]);
      restyleIfReady("physicsEnergyPlot", {
        x: [[state.x1], [state.x2]],
        y: [[state.v1], [state.v2]]
      }, [4, 5]);
    } else {
      const projection = projectionTrace(currentModel, history.points, currentModel.phaseProjection);
      const currentProjection = projectionPoint(currentModel, state, currentModel.phaseProjection);
      restyleIfReady("physicsEnergyPlot", {
        x: [projection.x],
        y: [projection.y]
      }, [1]);
      restyleIfReady("physicsEnergyPlot", {
        x: [[currentProjection.x]],
        y: [[currentProjection.y]]
      }, [2]);
    }
    updateExtraEnergyCursor(t, history, currentModel);
  }

  function updateExtraEnergyCursor(t, history, model) {
    const specs = energyComponentSpecs(model);
    if (!specs.length) return;
    const timeShape = timeCursorShape(t);
    const timeAnnotation = timeCursorAnnotation(t);
    relayoutIfReady("physicsExtraPlot", { shapes: [timeShape], annotations: [timeAnnotation] });
    restyleIfReady("physicsExtraPlot", {
      x: specs.map(() => history.t),
      y: specs.map(spec => history.points.map(point => spec.value(model, point)))
    }, specs.map((spec, index) => specs.length + index));
  }

  function getHistoryUntil(t, result = currentResult, model = currentModel) {
    const points = result?.points || [];
    const state = interpolateState(points, t);
    const visiblePoints = points.filter(point => point.t <= t);
    if (!visiblePoints.length || visiblePoints[visiblePoints.length - 1].t < t) {
      visiblePoints.push(state);
    }
    const metrics = visiblePoints.map(point => metricParts(model, point));
    return {
      points: visiblePoints,
      t: visiblePoints.map(point => point.t),
      y: visiblePoints.map(point => point.y),
      v: visiblePoints.map(point => point.v),
      x: visiblePoints.map(point => point.x),
      yPos: visiblePoints.map(point => point.yPos),
      vx: visiblePoints.map(point => point.vx),
      vy: visiblePoints.map(point => point.vy),
      x1: visiblePoints.map(point => point.x1),
      v1: visiblePoints.map(point => point.v1),
      x2: visiblePoints.map(point => point.x2),
      v2: visiblePoints.map(point => point.v2),
      kinetic: metrics.map(item => item.kinetic),
      potential: metrics.map(item => item.potential),
      total: metrics.map(item => item.total)
    };
  }

  function timeCursorShape(t) {
    return {
      type: "line",
      x0: t,
      x1: t,
      y0: 0,
      y1: 1,
      yref: "paper",
      line: { color: "rgba(220, 38, 38, 0.78)", width: 2 }
    };
  }

  function timeCursorAnnotation(t) {
    return {
      x: t,
      y: 1,
      xref: "x",
      yref: "paper",
      text: `t=${formatTimeValue(t)}`,
      showarrow: false,
      yanchor: "bottom",
      bgcolor: "rgba(255,255,255,0.88)",
      bordercolor: "rgba(220,38,38,0.55)",
      borderwidth: 1,
      font: { color: "#991b1b", size: 11 }
    };
  }

  function relayoutIfReady(id, update) {
    const el = document.getElementById(id);
    if (el && el.data) window.Plotly.relayout(el, update);
  }

  function restyleIfReady(id, update, traces) {
    const el = document.getElementById(id);
    if (el && el.data) window.Plotly.restyle(el, update, traces);
  }

  function paddedRange(values) {
    const finiteValues = values.filter(isFinite);
    if (!finiteValues.length) return undefined;
    let min = finiteValues[0];
    let max = finiteValues[0];
    finiteValues.forEach(value => {
      min = Math.min(min, value);
      max = Math.max(max, value);
    });
    const span = Math.max(max - min, 1);
    const pad = span * 0.08;
    return [min - pad, max + pad];
  }

  function niceTicks(min, max, count) {
    if (!isFinite(min) || !isFinite(max) || min === max) return [min || 0];
    const span = Math.abs(max - min);
    const rawStep = span / Math.max(count - 1, 1);
    const power = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalized = rawStep / power;
    const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    const step = niceNormalized * power;
    const start = Math.ceil(min / step) * step;
    const ticks = [];
    for (let value = start; value <= max + step * 0.5; value += step) {
      ticks.push(Math.abs(value) < step * 1e-9 ? 0 : value);
      if (ticks.length > 12) break;
    }
    return ticks;
  }

  function formatAxisTick(value) {
    if (!isFinite(value)) return "0";
    const abs = Math.abs(value);
    if (abs >= 1000 || (abs > 0 && abs < 0.01)) return value.toExponential(1);
    if (abs >= 10) return String(Math.round(value * 10) / 10);
    return String(Math.round(value * 100) / 100);
  }

  function resizeCanvasToDisplay() {
    const canvas = document.getElementById("physicsCanvas");
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(Math.floor(rect.width * dpr), 1);
    const height = Math.max(Math.floor(rect.height * dpr), 1);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function getSpeed() {
    return Math.max(finiteOr(parseFloat(document.getElementById("physicsSpeed").value), 1), 0.05);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function finiteOr(value, fallback) {
    return isFinite(value) ? value : fallback;
  }

  function formatNumber(value) {
    if (!isFinite(value)) return "0";
    return String(Math.round(value * 1000000) / 1000000);
  }

  function formatHudNumber(value) {
    if (!isFinite(value)) return "0";
    return String(Math.round(value * 100) / 100);
  }

  function formatTimeValue(value) {
    if (!isFinite(value)) return "0.00";
    return value.toFixed(2);
  }

  window.setupPhysicsLab = setupPhysicsLab;
})();
