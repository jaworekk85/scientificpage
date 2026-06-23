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
  const PHYSICS_CATEGORIES = [
    {
      key: "mechanical",
      label: "Mechanical",
      systems: [
        ["oscillator", "oscillator"],
        ["pendulum", "pendulum"],
        ["projectile", "projectile motion"],
        ["verticalBounce", "vertical bounce"],
        ["coupledOscillators", "coupled oscillators"]
      ]
    },
    {
      key: "rotation",
      label: "Rotation / rigid body",
      systems: [
        ["rotatingDisk", "rotating disk / variable inertia"],
        ["rollingBodies", "rolling sphere / cylinder / hoop"],
        ["spool", "pulled spool"],
        ["wilberforce", "Wilberforce oscillator"],
        ["gyroscope", "gyroscope / precession"]
      ]
    },
    {
      key: "fields",
      label: "Fields & circuits",
      systems: [
        ["chargedParticle", "charged particle: E + B fields"],
        ["rigidDipole", "rigid charged dipole"],
        ["rlc", "RLC circuit"]
      ]
    },
    {
      key: "bio",
      label: "Biological / population",
      systems: [
        ["predatorPrey", "predator-prey"],
        ["neuron", "neuron"]
      ]
    },
    {
      key: "chaos",
      label: "Chaos",
      systems: [
        ["lorenz", "Lorenz attractor"],
        ["logisticMap", "logistic map"],
        ["doublePendulum", "double pendulum"],
        ["duffing", "Duffing oscillator"],
        ["liouvilleFlow", "phase flow / Liouville"]
      ]
    }
  ];

  function setupPhysicsLab() {
    populatePhysicsCategorySelect();
    populatePhysicsSystemSelect();
    populateMethodSelect();
    bindEvents();
    updatePhysicsControls();
    setDynamicsMode();
    if (isChaosDynamicsSelected()) window.runChaosSimulation?.();
    else runPhysicsSimulation();
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

  function populatePhysicsCategorySelect() {
    const select = document.getElementById("physicsCategory");
    if (!select) return;
    const previous = select.value || PHYSICS_CATEGORIES[0]?.key;
    select.innerHTML = "";
    PHYSICS_CATEGORIES.forEach(category => {
      const option = document.createElement("option");
      option.value = category.key;
      option.textContent = category.label;
      select.appendChild(option);
    });
    select.value = PHYSICS_CATEGORIES.some(category => category.key === previous)
      ? previous
      : PHYSICS_CATEGORIES[0]?.key;
  }

  function populatePhysicsSystemSelect(categoryKey = document.getElementById("physicsCategory")?.value) {
    const select = document.getElementById("physicsSystem");
    if (!select) return;
    const category = PHYSICS_CATEGORIES.find(item => item.key === categoryKey) || PHYSICS_CATEGORIES[0];
    const previous = select.value;
    select.innerHTML = "";
    category.systems.forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    });
    select.value = category.systems.some(([value]) => value === previous)
      ? previous
      : category.systems[0]?.[0];
  }

  function isChaosDynamicsSelected() {
    return document.getElementById("physicsCategory")?.value === "chaos"
      || document.getElementById("physicsSystem")?.value === "lorenz";
  }

  function setDynamicsMode() {
    const chaosMode = isChaosDynamicsSelected();
    if (chaosMode && isPlaying) {
      isPlaying = false;
      const playButton = document.getElementById("physicsPlayBtn");
      if (playButton) playButton.textContent = "Play";
    }
    if (!chaosMode) window.stopChaosAnimation?.();
    document.getElementById("physicsControlsBody")?.classList.toggle("hidden", chaosMode);
    document.getElementById("physicsOutputBody")?.classList.toggle("hidden", chaosMode);
    document.getElementById("chaosControlsBody")?.classList.toggle("hidden", !chaosMode);
    document.getElementById("chaosOutputBody")?.classList.toggle("hidden", !chaosMode);
  }

  function bindEvents() {
    const plotButton = document.getElementById("physicsPlotBtn");
    if (plotButton) plotButton.addEventListener("click", runPhysicsSimulation);
    const categorySelect = document.getElementById("physicsCategory");
    const systemSelect = document.getElementById("physicsSystem");
    if (categorySelect && systemSelect) {
      categorySelect.addEventListener("change", () => {
        populatePhysicsSystemSelect(categorySelect.value);
        setDynamicsMode();
        if (!isChaosDynamicsSelected()) applySystemDefaults(systemSelect.value);
        updatePhysicsControls();
        if (isChaosDynamicsSelected()) window.runChaosSimulation?.();
        else runPhysicsSimulation();
      });
    }
    if (systemSelect) {
      systemSelect.addEventListener("change", () => {
        setDynamicsMode();
        if (!isChaosDynamicsSelected()) applySystemDefaults(systemSelect.value);
        updatePhysicsControls();
        if (isChaosDynamicsSelected()) window.runChaosSimulation?.();
        else runPhysicsSimulation();
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
    document.querySelectorAll("#physicsControlsBody input:not(#physicsSpeed), #physicsControlsBody select:not(#physicsSystem):not(#physicsCategory)").forEach(el => {
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
        if (isChaosDynamicsSelected()) {
          window.refreshChaosFrame?.();
          ["chaosPhasePlot", "chaosTimePlot", "chaosSeparationPlot"].forEach(id => {
            const el = document.getElementById(id);
            if (el) window.Plotly.Plots.resize(el);
          });
          return;
        }
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
    if (isChaosDynamicsSelected()) {
      setDynamicsMode();
      window.runChaosSimulation?.();
      return;
    }
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
    if (model.mode === "rigidDipole") return simulateRigidDipole(model, methodKey);
    if (model.mode === "coupled") return simulateCoupledOscillators(model, methodKey);
    if (model.mode === "wilberforce") return simulateWilberforce(model, methodKey);
    if (model.mode === "rollingBodies") return simulateRollingBodies(model, methodKey);
    if (model.mode === "spool") return simulateSpool(model, methodKey);
    if (model.mode === "heavyTop") return simulateHeavyTop(model, methodKey);
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
    const dipoleDistance = Math.max(finiteOr(parseFloat(document.getElementById("physicsDipoleDistance")?.value), 1), 0.05);
    const dipoleInertia = Math.max(finiteOr(parseFloat(document.getElementById("physicsDipoleInertia")?.value), 0.12), 0.005);
    const dipoleDamping = Math.max(finiteOr(parseFloat(document.getElementById("physicsDipoleDamping")?.value), 0.04), 0);
    const dipoleTheta0 = finiteOr(parseFloat(document.getElementById("physicsDipoleTheta0")?.value), 80) * Math.PI / 180;
    const dipoleOmega0 = finiteOr(parseFloat(document.getElementById("physicsDipoleOmega0")?.value), 0);
    const phaseProjection = document.getElementById("physicsPhaseProjection")?.value || defaultPhaseProjection(type);
    const coupledOmega = finiteOr(parseFloat(document.getElementById("physicsCoupledOmega")?.value), 1);
    const coupledKappa = finiteOr(parseFloat(document.getElementById("physicsCoupledKappa")?.value), 0.35);
    const coupledGamma = Math.max(finiteOr(parseFloat(document.getElementById("physicsCoupledGamma")?.value), 0), 0);
    const coupledX1 = finiteOr(parseFloat(document.getElementById("physicsCoupledX1")?.value), 1);
    const coupledV1 = finiteOr(parseFloat(document.getElementById("physicsCoupledV1")?.value), 0);
    const coupledX2 = finiteOr(parseFloat(document.getElementById("physicsCoupledX2")?.value), 0);
    const coupledV2 = finiteOr(parseFloat(document.getElementById("physicsCoupledV2")?.value), 0);
    const rotationI0 = Math.max(finiteOr(parseFloat(document.getElementById("physicsRotationI0")?.value), 3), 0.05);
    const rotationI1 = Math.max(finiteOr(parseFloat(document.getElementById("physicsRotationI1")?.value), 1), 0.05);
    const rotationTau = finiteOr(parseFloat(document.getElementById("physicsRotationTau")?.value), 0);
    const rotationTheta0 = finiteOr(parseFloat(document.getElementById("physicsRotationTheta0")?.value), 0);
    const rotationOmega0 = finiteOr(parseFloat(document.getElementById("physicsRotationOmega0")?.value), 2);
    const rollingAngle = clamp(finiteOr(parseFloat(document.getElementById("physicsRollingAngle")?.value), 18), 1, 60) * Math.PI / 180;
    const rollingLength = Math.max(finiteOr(parseFloat(document.getElementById("physicsRollingLength")?.value), 8), 1);
    const rollingRadius = Math.max(finiteOr(parseFloat(document.getElementById("physicsRollingRadius")?.value), 0.35), 0.05);
    const rollingG = finiteOr(parseFloat(document.getElementById("physicsRollingG")?.value), 9.81);
    const rollingDrag = Math.max(finiteOr(parseFloat(document.getElementById("physicsRollingDrag")?.value), 0), 0);
    const spoolMass = Math.max(finiteOr(parseFloat(document.getElementById("physicsSpoolMass")?.value), 1), 0.05);
    const spoolRadius = Math.max(finiteOr(parseFloat(document.getElementById("physicsSpoolRadius")?.value), 0.55), 0.08);
    const spoolAxleRadius = clamp(finiteOr(parseFloat(document.getElementById("physicsSpoolAxleRadius")?.value), 0.22), 0.02, spoolRadius * 0.95);
    const spoolInertiaK = Math.max(finiteOr(parseFloat(document.getElementById("physicsSpoolInertiaK")?.value), 0.55), 0.05);
    const spoolForce = finiteOr(parseFloat(document.getElementById("physicsSpoolForce")?.value), 1.2);
    const spoolPullAngle = clamp(finiteOr(parseFloat(document.getElementById("physicsSpoolPullAngle")?.value), 75), -170, 170) * Math.PI / 180;
    const spoolDrag = Math.max(finiteOr(parseFloat(document.getElementById("physicsSpoolDrag")?.value), 0.02), 0);
    const wilberforceMass = Math.max(finiteOr(parseFloat(document.getElementById("physicsWilberforceMass")?.value), 1), 0.05);
    const wilberforceI = Math.max(finiteOr(parseFloat(document.getElementById("physicsWilberforceI")?.value), 0.2), 0.01);
    const wilberforceKz = Math.max(finiteOr(parseFloat(document.getElementById("physicsWilberforceKz")?.value), 4), 0.01);
    const wilberforceKt = Math.max(finiteOr(parseFloat(document.getElementById("physicsWilberforceKt")?.value), 0.8), 0.01);
    const wilberforceCouplingLimit = Math.sqrt(wilberforceKz * wilberforceKt) * 0.96;
    const wilberforceCoupling = clamp(
      finiteOr(parseFloat(document.getElementById("physicsWilberforceCoupling")?.value), 0.18),
      -wilberforceCouplingLimit,
      wilberforceCouplingLimit
    );
    const wilberforceDamping = Math.max(finiteOr(parseFloat(document.getElementById("physicsWilberforceDamping")?.value), 0), 0);
    const wilberforceZ0 = finiteOr(parseFloat(document.getElementById("physicsWilberforceZ0")?.value), 1);
    const wilberforceVz0 = finiteOr(parseFloat(document.getElementById("physicsWilberforceVz0")?.value), 0);
    const wilberforceTheta0 = finiteOr(parseFloat(document.getElementById("physicsWilberforceTheta0")?.value), 0);
    const wilberforceOmega0 = finiteOr(parseFloat(document.getElementById("physicsWilberforceOmega0")?.value), 0);
    const gyroMass = Math.max(finiteOr(parseFloat(document.getElementById("physicsGyroMass")?.value), 1), 0.05);
    const gyroD = Math.max(finiteOr(parseFloat(document.getElementById("physicsGyroD")?.value), 0.9), 0.05);
    const gyroI1 = Math.max(finiteOr(parseFloat(document.getElementById("physicsGyroI1")?.value), 0.45), 0.01);
    const gyroI = Math.max(finiteOr(parseFloat(document.getElementById("physicsGyroI")?.value), 0.2), 0.01);
    const gyroSpin = finiteOr(parseFloat(document.getElementById("physicsGyroSpin")?.value), 35);
    const gyroTiltDeg = clamp(finiteOr(parseFloat(document.getElementById("physicsGyroTilt")?.value), 35), 1, 85);
    const gyroTilt = gyroTiltDeg * Math.PI / 180;
    const gyroG = finiteOr(parseFloat(document.getElementById("physicsGyroG")?.value), 9.81);
    const gyroPhi0 = finiteOr(parseFloat(document.getElementById("physicsGyroPhi0")?.value), 0);
    const gyroThetaDot0 = finiteOr(parseFloat(document.getElementById("physicsGyroThetaDot0")?.value), 0);
    const gyroPhiDot0 = finiteOr(parseFloat(document.getElementById("physicsGyroPhiDot0")?.value), 1.1);

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

    if (type === "rigidDipole") {
      return {
        type,
        mode: "rigidDipole",
        t0,
        t1,
        h,
        x0: particleX0,
        yParticle0: particleY0,
        vx0: particleVx0,
        vy0: particleVy0,
        theta0: dipoleTheta0,
        omega0: dipoleOmega0,
        y0: dipoleTheta0,
        v0: dipoleOmega0,
        charge: particleCharge,
        mass: particleMass,
        drag: particleDrag,
        dipoleDistance,
        dipoleInertia,
        dipoleDamping,
        electricEx,
        electricEy,
        magneticB,
        params: { q: particleCharge, m: particleMass, ex: electricEx, ey: electricEy, bz: magneticB },
        phaseProjection: phaseProjectionOptions(type).some(option => option.value === phaseProjection)
          ? phaseProjection
          : defaultPhaseProjection(type),
        latex: buildRigidDipoleLatex(particleCharge, particleMass, dipoleDistance, dipoleInertia, electricEx, electricEy, magneticB, particleDrag, dipoleDamping),
        description: modelDescription(type)
      };
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

    if (type === "rotatingDisk") {
      const span = t1 - t0 || 1;
      const inertiaAt = t => {
        const fraction = clamp((t - t0) / span, 0, 1);
        return rotationI0 + (rotationI1 - rotationI0) * fraction;
      };
      const inertiaPrime = (rotationI1 - rotationI0) / span;
      return {
        type,
        mode: "planar",
        t0,
        t1,
        h,
        y0: rotationTheta0,
        v0: rotationOmega0,
        rotationI0,
        rotationI1,
        rotationTau,
        inertiaAt,
        inertiaPrime,
        derivative: (t, theta, omega) => ({
          y: omega,
          v: (rotationTau - inertiaPrime * omega) / inertiaAt(t)
        }),
        latex: buildRotatingDiskLatex(rotationI0, rotationI1, rotationTau),
        description: modelDescription(type)
      };
    }

    if (type === "rollingBodies") {
      return {
        type,
        mode: "rollingBodies",
        t0,
        t1,
        h,
        rollingAngle,
        rollingLength,
        rollingRadius,
        rollingDrag,
        rollingG,
        bodies: rollingBodySpecs(),
        phaseProjection: phaseProjectionOptions(type).some(option => option.value === phaseProjection)
          ? phaseProjection
          : defaultPhaseProjection(type),
        postStep: (before, next) => ({ state: clampRollingBodiesState(next, rollingLength) }),
        latex: buildRollingBodiesLatex(rollingG, rollingAngle, rollingDrag),
        description: modelDescription(type)
      };
    }

    if (type === "spool") {
      const spoolAcceleration = spoolForce * (Math.cos(spoolPullAngle) + spoolAxleRadius / spoolRadius) / (spoolMass * (1 + spoolInertiaK));
      return {
        type,
        mode: "spool",
        t0,
        t1,
        h,
        y0: 0,
        v0: 0,
        spoolRadius,
        spoolAxleRadius,
        spoolInertiaK,
        spoolForce,
        spoolPullAngle,
        spoolDrag,
        mass: spoolMass,
        spoolAcceleration,
        derivative: (time, state) => ({
          s: state.v,
          v: spoolAcceleration - spoolDrag * state.v,
          phi: state.omega,
          omega: (spoolAcceleration - spoolDrag * state.v) / spoolRadius
        }),
        latex: buildSpoolLatex(spoolMass, spoolRadius, spoolAxleRadius, spoolInertiaK, spoolForce, spoolPullAngle, spoolDrag),
        description: modelDescription(type)
      };
    }

    if (type === "wilberforce") {
      const verticalFrequency = Math.sqrt(wilberforceKz / wilberforceMass);
      const torsionFrequency = Math.sqrt(wilberforceKt / wilberforceI);
      return {
        type,
        mode: "wilberforce",
        t0,
        t1,
        h,
        y0: wilberforceZ0,
        v0: wilberforceVz0,
        x1: wilberforceZ0,
        v1: wilberforceVz0,
        x2: wilberforceTheta0,
        v2: wilberforceOmega0,
        wilberforceMass,
        wilberforceI,
        wilberforceKz,
        wilberforceKt,
        wilberforceCoupling,
        wilberforceDamping,
        verticalFrequency,
        torsionFrequency,
        derivative: (t, state) => ({
          x1: state.v1,
          v1: (-wilberforceKz * state.x1 - wilberforceCoupling * state.x2 - wilberforceDamping * state.v1) / wilberforceMass,
          x2: state.v2,
          v2: (-wilberforceKt * state.x2 - wilberforceCoupling * state.x1 - wilberforceDamping * state.v2) / wilberforceI
        }),
        latex: buildWilberforceLatex(wilberforceMass, wilberforceI, wilberforceKz, wilberforceKt, wilberforceCoupling, wilberforceDamping),
        description: modelDescription(type)
      };
    }

    if (type === "gyroscope") {
      const spinAngularMomentum = gyroI * gyroSpin;
      const pPhi = gyroI1 * gyroPhiDot0 * Math.sin(gyroTilt) * Math.sin(gyroTilt)
        + spinAngularMomentum * Math.cos(gyroTilt);
      const torque = gyroMass * gyroG * gyroD * Math.sin(gyroTilt);
      return {
        type,
        mode: "heavyTop",
        t0,
        t1,
        h,
        y0: gyroTilt,
        v0: gyroThetaDot0,
        theta0: gyroTilt,
        thetaDot0: gyroThetaDot0,
        phi0: gyroPhi0,
        phiDot0: gyroPhiDot0,
        psi0: 0,
        gyroMass,
        gyroD,
        gyroI1,
        gyroI3: gyroI,
        gyroSpin,
        gyroTilt,
        gyroTiltDeg,
        gyroG,
        gyroPphi: pPhi,
        gyroPpsi: spinAngularMomentum,
        spinAngularMomentum,
        torque,
        phaseProjection: phaseProjectionOptions(type).some(option => option.value === phaseProjection)
          ? phaseProjection
          : defaultPhaseProjection(type),
        latex: buildGyroscopeLatex(gyroMass, gyroD, gyroI1, gyroI, gyroSpin, gyroTiltDeg, gyroThetaDot0, gyroPhiDot0, gyroG),
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
    if (type === "rigidDipole") return "rigid charged dipole: two charges on a rod in uniform E and B fields";
    if (type === "coupledOscillators") return "two linear oscillators connected by a coupling spring";
    if (type === "rotatingDisk") return "rotating disk: angular momentum, torque, and changing moment of inertia";
    if (type === "rollingBodies") return "rolling bodies: sphere, cylinder, and hoop race down the same incline";
    if (type === "spool") return "pulled spool: rolling without slipping with a tangent string force";
    if (type === "wilberforce") return "Wilberforce oscillator: periodic energy exchange between z and θ";
    if (type === "gyroscope") return "gyroscope: symmetric heavy top with φ precession and θ nutation";
    if (type === "rlc") return "RLC circuit: charge and current behave like a damped oscillator";
    if (type === "predatorPrey") return "predator-prey: two populations coupled by feedback";
    if (type === "neuron") return "FitzHugh-Nagumo neuron: voltage and recovery variable";
    return "";
  }

  function updatePhysicsControls(model = null) {
    if (isChaosDynamicsSelected()) {
      setDynamicsMode();
      return;
    }
    if (!model) model = readModel();
    const type = document.getElementById("physicsSystem").value;
    const oscillator = type === "oscillator";
    const resonance = oscillator && (document.getElementById("physicsOscillatorMode")?.value || "simulation") === "resonance";
    const pendulum = type === "pendulum";
    const particle = type === "projectile" || type === "verticalBounce" || type === "chargedParticle" || type === "rigidDipole";
    const bounce = type === "verticalBounce";
    const chargedParticle = type === "chargedParticle";
    const rigidDipole = type === "rigidDipole";
    const coupled = type === "coupledOscillators";
    const rotation = type === "rotatingDisk";
    const rolling = type === "rollingBodies";
    const spool = type === "spool";
    const wilberforce = type === "wilberforce";
    const gyro = type === "gyroscope";
    const rlc = type === "rlc";
    const predator = type === "predatorPrey";
    const compare = oscillator || pendulum || rlc || predator;
    const compareEnabled = !!document.getElementById("physicsCompareEnabled")?.checked;
    const pendulumCompareMode = document.getElementById("physicsPendulumCompareMode")?.value || "custom";
    const linearPendulumCompare = pendulum && pendulumCompareMode === "linear";
    const visibility = {
      secondMethod: true,
      initial: !resonance && !particle && !coupled && !rotation && !rolling && !spool && !wilberforce && !gyro && !rigidDipole,
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
      phaseProjection: particle || coupled || gyro || rigidDipole || rolling,
      particleInitial: particle && !bounce,
      bounceInitial: bounce,
      particleDrag: particle,
      projectile: type === "projectile" || bounce,
      bounce,
      chargedParticle: chargedParticle || rigidDipole,
      electricField: chargedParticle || rigidDipole,
      magneticField: chargedParticle || rigidDipole,
      rigidDipole,
      rigidDipoleInitial: rigidDipole,
      coupled,
      coupledInitial: coupled,
      rotation,
      rotationInitial: rotation,
      rolling,
      spool,
      wilberforce,
      wilberforceInitial: wilberforce,
      gyro,
      gyroInitial: gyro,
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
    if (type === "gyroscope") {
      return [
        { value: "theta-thetaDot", label: "\u03b8 vs \u03b8'" },
        { value: "phi-phiDot", label: "\u03c6 vs \u03c6'" },
        { value: "theta-phi", label: "\u03b8 vs \u03c6" },
        { value: "theta-phiDot", label: "\u03b8 vs \u03c6'" },
        { value: "thetaDot-phi", label: "\u03b8' vs \u03c6" },
        { value: "thetaDot-phiDot", label: "\u03b8' vs \u03c6'" }
      ];
    }
    if (type === "rigidDipole") {
      return [
        { value: "theta-omega", label: "\u03b8 vs \u03c9" },
        { value: "x-y", label: "x vs y" },
        { value: "x-vx", label: "x vs vx" },
        { value: "y-vy", label: "y vs vy" },
        { value: "vx-vy", label: "vx vs vy" },
        { value: "x-theta", label: "x vs \u03b8" },
        { value: "y-theta", label: "y vs \u03b8" },
        { value: "vx-omega", label: "vx vs \u03c9" },
        { value: "vy-omega", label: "vy vs \u03c9" }
      ];
    }
    if (type === "rollingBodies") {
      return [
        { value: "s-v", label: "s vs v" },
        { value: "phi-omega", label: "\u03c6 vs \u03c9" },
        { value: "s-phi", label: "s vs \u03c6" },
        { value: "v-omega", label: "v vs \u03c9" }
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
    if (type === "gyroscope") return "theta-thetaDot";
    if (type === "rigidDipole") return "theta-omega";
    if (type === "rollingBodies") return "s-v";
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

  function buildRotatingDiskLatex(i0, i1, tau) {
    const equation = "\\dot{\\theta}=\\omega,\\quad \\dot{\\omega}=\\frac{\\tau-\\dot{I}\\omega}{I(t)},\\quad L=I\\omega";
    return equationMarkup(equation, [
      ["I_0", i0],
      ["I_1", i1],
      ["\\tau", tau]
    ], [
      "I(t): moment of inertia changes linearly from I0 to I1",
      "tau: external torque",
      "if tau=0, angular momentum L should stay constant"
    ]);
  }

  function buildRollingBodiesLatex(g, angle, drag) {
    const equation = "\\begin{aligned}k&=I/(mR^2),\\quad \\dot{s}=v,\\quad \\dot{\\phi}=v/R,\\\\ \\dot{v}&=\\frac{g\\sin\\alpha}{1+k}-\\gamma v,\\quad \\dot{\\omega}=\\dot{v}/R\\end{aligned}";
    return equationMarkup(equation, [
      ["g", g],
      ["\\alpha", angle],
      ["\\gamma", drag]
    ], [
      "solid sphere: k=2/5; solid cylinder: k=1/2; hoop: k=1",
      "larger k sends more energy into rotation and less into translation"
    ]);
  }

  function buildSpoolLatex(mass, radius, axleRadius, inertiaK, force, pullAngle, drag) {
    const equation = "\\begin{aligned}I&=kMR^2,\\quad F_x=F\\cos\\alpha,\\quad \\tau_F=Fr,\\\\ \\dot{s}&=v,\\quad \\dot{\\phi}=v/R,\\\\ \\dot{v}&=\\frac{F(\\cos\\alpha+r/R)}{M(1+k)}-\\gamma v,\\quad \\dot{\\omega}=\\dot{v}/R\\end{aligned}";
    return equationMarkup(equation, [
      ["M", mass],
      ["R", radius],
      ["r", axleRadius],
      ["k", inertiaK],
      ["F", force],
      ["\\alpha", pullAngle],
      ["\\gamma", drag]
    ], [
      "this upper tangent geometry gives the plus sign",
      "F_x moves the center of mass; tau_F is the string torque about the spool center",
      "static friction enforces rolling without slipping"
    ]);
  }

  function buildWilberforceLatex(mass, inertia, kz, kt, coupling, damping) {
    const equation = "m\\ddot{z}=-k_z z-\\epsilon\\theta-\\gamma\\dot{z},\\quad I\\ddot{\\theta}=-k_\\theta\\theta-\\epsilon z-\\gamma\\dot{\\theta}";
    return equationMarkup(equation, [
      ["m", mass],
      ["I", inertia],
      ["k_z", kz],
      ["k_\\theta", kt],
      ["\\epsilon", coupling],
      ["\\gamma", damping]
    ], [
      "z: vertical displacement of the suspended mass",
      "\u03b8: torsional angle of the spring and mass",
      "\u03b5: coupling that periodically exchanges energy between z and \u03b8"
    ]);
  }

  function buildRigidDipoleLatex(charge, mass, distance, inertia, ex, ey, magneticB, drag, damping) {
    const equation = "\\begin{aligned}\\mathbf u&=(\\cos\\theta,\\sin\\theta),\\quad \\mathbf u_\\perp=(-\\sin\\theta,\\cos\\theta),\\\\ \\mathbf r_\\pm&=(x,y)\\pm\\frac d2\\mathbf u,\\quad \\mathbf v_\\pm=(v_x,v_y)\\pm\\frac d2\\omega\\mathbf u_\\perp,\\\\ \\mathbf F_\\pm&=\\pm q\\left(\\mathbf E+\\mathbf v_\\pm\\times B_z\\hat{\\mathbf z}\\right),\\\\[2pt] \\Longrightarrow\\quad \\dot{x}&=v_x,\\quad \\dot{y}=v_y,\\quad \\dot{\\theta}=\\omega,\\\\ \\dot{v}_x&=\\frac{q d B_z}{M}\\omega\\cos\\theta-\\gamma_t v_x,\\\\ \\dot{v}_y&=\\frac{q d B_z}{M}\\omega\\sin\\theta-\\gamma_t v_y,\\\\ \\dot{\\omega}&=\\frac{q d}{I}\\left(E_y\\cos\\theta-E_x\\sin\\theta-B_z(v_x\\cos\\theta+v_y\\sin\\theta)\\right)-\\frac{\\gamma_{rot}}{I}\\omega\\end{aligned}";
    return equationMarkup(equation, [
      ["q", charge],
      ["M", mass],
      ["d", distance],
      ["I", inertia],
      ["E_x", ex],
      ["E_y", ey],
      ["B_z", magneticB],
      ["\\gamma_t", drag],
      ["\\gamma_{rot}", damping]
    ], [
      "top lines show where the endpoint forces come from",
      "bottom lines are the first-order ODE actually integrated",
      "the rod is rigid: the charges stay separated by d",
      "B_z=0 gives the clean electric dipole torque case",
      "drag damps center-of-mass motion; gamma_rot damps rotation"
    ]);
  }

  function buildGyroscopeLatex(mass, distance, transverseInertia, spinInertia, spin, tiltDeg, thetaDot0, phiDot0, g) {
    const equation = "\\dot{\\phi}=\\frac{p_\\phi-p_\\psi\\cos\\theta}{I_1\\sin^2\\theta},\\quad I_1\\ddot{\\theta}=I_1\\dot{\\phi}^2\\sin\\theta\\cos\\theta-p_\\psi\\dot{\\phi}\\sin\\theta+Mgd\\sin\\theta";
    return equationMarkup(equation, [
      ["M", mass],
      ["d", distance],
      ["I_1", transverseInertia],
      ["I_3", spinInertia],
      ["\\omega_3", spin],
      ["\\theta_0", tiltDeg],
      ["\\dot{\\theta}_0", thetaDot0],
      ["\\dot{\\phi}_0", phiDot0],
      ["g", g],
    ], [
      "symmetric heavy top with a fixed pivot",
      "\u03b8: tilt of the body axis from vertical; changing \u03b8 is nutation",
      "\u03c6: azimuth around the vertical axis; changing \u03c6 is precession",
      "\u03c8: spin about the body axis; p_\u03c6 and p_\u03c8 are conserved"
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
    if (model.type === "rotatingDisk") return { y: "\u03b8", v: "\u03c9" };
    if (model.type === "spool") return { y: "s", v: "v" };
    if (model.type === "wilberforce") return { y: "z", v: "vz" };
    if (model.type === "gyroscope") return { y: "\u03b8", v: "\u03b8'" };
    if (model.type === "rigidDipole") return { y: "\u03b8", v: "\u03c9" };
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
    if (model.type === "rotatingDisk") return {
      a: "rotational energy",
      b: "angular momentum",
      total: "moment of inertia",
      title: "rotation diagnostics",
      axis: "value"
    };
    if (model.type === "spool") return {
      a: "translational kinetic",
      b: "rotational kinetic",
      total: "total kinetic",
      title: "spool energy",
      axis: "E"
    };
    if (model.type === "wilberforce") return {
      a: "vertical mode energy",
      b: "torsional mode energy",
      total: "total energy",
      title: "Wilberforce energy exchange",
      axis: "E"
    };
    if (model.type === "gyroscope") return {
      a: "rotational kinetic",
      b: "gravitational potential",
      total: "total energy",
      title: "gyroscope energy",
      axis: "E"
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

    if (model.mode === "coupled" || model.mode === "wilberforce") {
      return [
        {
          key: "kinetic1",
          name: model.mode === "wilberforce" ? "vertical kinetic" : "mass 1 kinetic",
          color: "#2563eb",
          value: (m, point) => 0.5 * (m.wilberforceMass || 1) * point.v1 * point.v1
        },
        {
          key: "kinetic2",
          name: model.mode === "wilberforce" ? "rotational kinetic" : "mass 2 kinetic",
          color: "#0ea5e9",
          value: (m, point) => 0.5 * (m.wilberforceI || 1) * point.v2 * point.v2
        },
        {
          key: "wallSpring",
          name: model.mode === "wilberforce" ? "vertical spring" : "outer springs",
          color: "#f97316",
          value: (m, point) => model.mode === "wilberforce"
            ? 0.5 * m.wilberforceKz * point.x1 * point.x1
            : 0.5 * m.omega * m.omega * (point.x1 * point.x1 + point.x2 * point.x2)
        },
        {
          key: "coupling",
          name: model.mode === "wilberforce" ? "torsion + coupling" : "coupling spring",
          color: "#a855f7",
          value: (m, point) => model.mode === "wilberforce"
            ? 0.5 * m.wilberforceKt * point.x2 * point.x2 + m.wilberforceCoupling * point.x1 * point.x2
            : 0.5 * m.kappa * (point.x1 - point.x2) * (point.x1 - point.x2)
        },
        {
          key: "total",
          name: "total energy",
          color: "#16a34a",
          width: 2.8,
          value: (m, point) => energyComponentSpecs(m)
            .filter(spec => spec.key !== "total")
            .reduce((sum, spec) => sum + spec.value(m, point), 0)
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
    if (model.mode === "rigidDipole") {
      drawRigidDipolePlots(model, result);
      return;
    }
    if (model.mode === "rollingBodies") {
      drawRollingBodiesPlots(model, result);
      return;
    }
    if (model.mode === "coupled" || model.mode === "wilberforce") {
      drawCoupledPlots(model, result);
      return;
    }
    if (model.mode === "heavyTop") {
      drawHeavyTopPlots(model, result);
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
        name: `${metricNames.a} elapsed`,
        mode: "lines",
        showlegend: false,
        line: { color: "#2563eb", width: 2.2 }
      },
      {
        x: [],
        y: [],
        name: `${metricNames.b} elapsed`,
        mode: "lines",
        showlegend: false,
        line: { color: "#f97316", width: 2.2 }
      },
      {
        x: [],
        y: [],
        name: `${metricNames.total} elapsed`,
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

  function drawHeavyTopPlots(model, result) {
    const points = result.points;
    const t = points.map(point => point.t);
    const theta = points.map(point => point.theta);
    const thetaDot = points.map(point => point.thetaDot);
    const phi = points.map(point => point.phi);
    const phiDot = points.map(point => point.phiDot);
    const angular = points.map(point => heavyTopAngularMomentum(model, point));
    const energy = points.map(point => metricParts(model, point));
    const projectionKey = model.phaseProjection || defaultPhaseProjection(model.type);
    const projection = projectionTrace(model, points, projectionKey);
    const currentProjection = projectionPoint(model, points[0], projectionKey);

    window.Plotly.newPlot("physicsTimePlot", [
      timeTrace(t, theta, "\u03b8(t)", "#2563eb"),
      timeTrace(t, thetaDot, "\u03b8'(t)", "#dc2626"),
      timeTrace(t, phi, "\u03c6(t)", "#7c3aed"),
      timeTrace(t, phiDot, "\u03c6'(t)", "#f97316"),
      elapsedTrace("\u03b8 elapsed", "#2563eb"),
      elapsedTrace("\u03b8' elapsed", "#dc2626"),
      elapsedTrace("\u03c6 elapsed", "#7c3aed"),
      elapsedTrace("\u03c6' elapsed", "#f97316")
    ], {
      title: "Euler angles over time",
      margin: { t: 42, r: 16, b: 42, l: 52 },
      xaxis: { title: "t", range: [model.t0, model.t1], autorange: false, fixedrange: true },
      yaxis: { title: "\u03b8, \u03b8', \u03c6, \u03c6'", range: paddedRange([...theta, ...thetaDot, ...phi, ...phiDot]), autorange: false, fixedrange: true },
      shapes: [timeCursorShape(model.t0)],
      annotations: [timeCursorAnnotation(model.t0)],
      uirevision: `${model.type}-euler-time`
    }, { responsive: true });

    window.Plotly.newPlot("physicsPhasePlot", [
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
      uirevision: `${model.type}-phase-${projectionKey}`
    }, { responsive: true });

    window.Plotly.newPlot("physicsEnergyPlot", [
      timeTrace(t, angular.map(item => item.lz), "L_z conserved", "#16a34a"),
      timeTrace(t, angular.map(item => item.l3), "L_3 body axis", "#2563eb"),
      timeTrace(t, angular.map(item => item.lPerp), "L_\u22a5", "#f97316"),
      timeTrace(t, angular.map(item => item.lTotal), "|L|", "#7c3aed"),
      elapsedTrace("L_z elapsed", "#16a34a"),
      elapsedTrace("L_3 elapsed", "#2563eb"),
      elapsedTrace("L_\u22a5 elapsed", "#f97316"),
      elapsedTrace("|L| elapsed", "#7c3aed")
    ], {
      title: "angular momentum components",
      margin: { t: 42, r: 16, b: 42, l: 52 },
      xaxis: { title: "t", range: [model.t0, model.t1], autorange: false, fixedrange: true },
      yaxis: { title: "L", range: paddedRange(angular.flatMap(item => [item.lz, item.l3, item.lPerp, item.lTotal])), autorange: false, fixedrange: true },
      shapes: [timeCursorShape(model.t0)],
      annotations: [timeCursorAnnotation(model.t0)],
      uirevision: `${model.type}-angular-momentum`
    }, { responsive: true });

    setExtraPhysicsPlotVisible(true);
    window.Plotly.newPlot("physicsExtraPlot", [
      timeTrace(t, energy.map(item => item.kinetic), "rotational kinetic", "#2563eb"),
      timeTrace(t, energy.map(item => item.potential), "gravitational potential", "#f97316"),
      timeTrace(t, energy.map(item => item.total), "total energy", "#16a34a"),
      elapsedTrace("kinetic elapsed", "#2563eb"),
      elapsedTrace("potential elapsed", "#f97316"),
      elapsedTrace("total elapsed", "#16a34a", 2.8)
    ], {
      title: "gyroscope energy",
      margin: { t: 42, r: 16, b: 42, l: 52 },
      xaxis: { title: "t", range: [model.t0, model.t1], autorange: false, fixedrange: true },
      yaxis: { title: "E", range: paddedRange(energy.flatMap(item => [item.kinetic, item.potential, item.total])), autorange: false, fixedrange: true },
      shapes: [timeCursorShape(model.t0)],
      annotations: [timeCursorAnnotation(model.t0)],
      uirevision: `${model.type}-energy`
    }, { responsive: true });
  }

  function timeTrace(x, y, name, color) {
    return {
      x,
      y,
      name,
      mode: "lines",
      line: { color, width: 1.5 },
      opacity: 0.25
    };
  }

  function elapsedTrace(name, color, width = 2.6) {
    return {
      x: [],
      y: [],
      name,
      mode: "lines",
      showlegend: false,
      line: { color, width }
    };
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
    if (key === "theta") return "\u03b8";
    if (key === "thetaDot") return "\u03b8'";
    if (key === "omega") return "\u03c9";
    if (key === "torque") return "\u03c4";
    if (key === "phi") return "\u03c6";
    if (key === "phiDot") return "\u03c6'";
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

  function drawRigidDipolePlots(model, result) {
    const points = result.points;
    const t = points.map(point => point.t);
    const x = points.map(point => point.x);
    const y = points.map(point => point.yPos);
    const theta = points.map(point => point.theta);
    const omega = points.map(point => point.omega);
    const torque = points.map(point => point.torque);
    const energy = points.map(point => metricParts(model, point));
    const projectionKey = model.phaseProjection || defaultPhaseProjection(model.type);
    const projection = projectionTrace(model, points, projectionKey);
    const currentProjection = projectionPoint(model, points[0], projectionKey);

    window.Plotly.newPlot("physicsTimePlot", [
      timeTrace(t, theta, "\u03b8(t)", "#7c3aed"),
      timeTrace(t, omega, "\u03c9(t)", "#dc2626"),
      timeTrace(t, torque, "\u03c4(t)", "#f97316"),
      elapsedTrace("\u03b8 elapsed", "#7c3aed"),
      elapsedTrace("\u03c9 elapsed", "#dc2626"),
      elapsedTrace("\u03c4 elapsed", "#f97316")
    ], {
      title: "dipole rotation over time",
      margin: { t: 42, r: 16, b: 42, l: 52 },
      xaxis: { title: "t", range: [model.t0, model.t1], autorange: false, fixedrange: true },
      yaxis: { title: "\u03b8, \u03c9, \u03c4", range: paddedRange([...theta, ...omega, ...torque]), autorange: false, fixedrange: true },
      shapes: [timeCursorShape(model.t0)],
      annotations: [timeCursorAnnotation(model.t0)],
      uirevision: `${model.type}-time`
    }, { responsive: true });

    window.Plotly.newPlot("physicsPhasePlot", [
      {
        x: projection.x,
        y: projection.y,
        name: "phase projection",
        mode: "lines",
        line: { color: "#111827", width: 1.5 },
        opacity: 0.25
      },
      elapsedTrace("phase elapsed", "#111827", 2.8),
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
      uirevision: `${model.type}-phase-${projectionKey}`
    }, { responsive: true });

    window.Plotly.newPlot("physicsEnergyPlot", [
      timeTrace(t, energy.map(item => item.kinetic), "translational kinetic", "#2563eb"),
      timeTrace(t, energy.map(item => item.rotational), "rotational kinetic", "#7c3aed"),
      timeTrace(t, energy.map(item => item.potential), "electric potential", "#f97316"),
      timeTrace(t, energy.map(item => item.total), "total energy", "#16a34a"),
      elapsedTrace("translation elapsed", "#2563eb"),
      elapsedTrace("rotation elapsed", "#7c3aed"),
      elapsedTrace("potential elapsed", "#f97316"),
      elapsedTrace("total elapsed", "#16a34a", 2.8)
    ], {
      title: "dipole energy",
      margin: { t: 42, r: 16, b: 42, l: 52 },
      xaxis: { title: "t", range: [model.t0, model.t1], autorange: false, fixedrange: true },
      yaxis: { title: "E", range: paddedRange(energy.flatMap(item => [item.kinetic, item.rotational, item.potential, item.total])), autorange: false, fixedrange: true },
      shapes: [timeCursorShape(model.t0)],
      annotations: [timeCursorAnnotation(model.t0)],
      uirevision: `${model.type}-energy`
    }, { responsive: true });

    setExtraPhysicsPlotVisible(true);
    window.Plotly.newPlot("physicsExtraPlot", [
      {
        x,
        y,
        name: "center of mass",
        mode: "lines",
        line: { color: "#2563eb", width: 1.5 },
        opacity: 0.28
      },
      elapsedTrace("trajectory elapsed", "#2563eb", 2.8),
      {
        x: [x[0]],
        y: [y[0]],
        name: "current center",
        mode: "markers",
        showlegend: false,
        marker: { color: "#dc2626", size: 11, line: { color: "#fff", width: 2 } }
      }
    ], {
      title: "center-of-mass trajectory",
      margin: { t: 42, r: 16, b: 42, l: 52 },
      xaxis: { title: "x", range: paddedRange(x), autorange: false, fixedrange: true },
      yaxis: { title: "y", range: paddedRange(y), autorange: false, fixedrange: true, scaleanchor: "x", scaleratio: 1 },
      uirevision: `${model.type}-trajectory`
    }, { responsive: true });
  }

  function drawRollingBodiesPlots(model, result) {
    const points = result.points;
    const t = points.map(point => point.t);
    const positionValues = [];
    const velocityValues = [];
    const energyValues = [];
    const positionTraces = [];
    const velocityTraces = [];
    const phaseTraces = [];
    const energyTraces = [];
    const projectionKey = model.phaseProjection || defaultPhaseProjection(model.type);
    const projectionSpec = rollingProjectionSpec(projectionKey);

    model.bodies.forEach(body => {
      const cap = capitalizeKey(body.key);
      const s = points.map(point => Math.min(point[`s${cap}`], model.rollingLength));
      const v = points.map(point => point[`v${cap}`]);
      const phaseX = points.map(point => rollingProjectionValue(point, body, projectionSpec.xKey));
      const phaseY = points.map(point => rollingProjectionValue(point, body, projectionSpec.yKey));
      const energies = points.map(point => point[`energy${cap}`] ?? rollingBodyEnergy(model, body, point));
      positionValues.push(...s);
      velocityValues.push(...v);
      energyValues.push(...energies.flatMap(item => [item.translational, item.rotational, item.potential, item.total]));
      positionTraces.push(timeTrace(t, s, `${body.label} s(t)`, body.color));
      velocityTraces.push(timeTrace(t, v, `${body.label} v(t)`, body.color));
      phaseTraces.push({
        x: phaseX,
        y: phaseY,
        name: body.label,
        mode: "lines",
        line: { color: body.color, width: 2 },
        opacity: 0.75
      });
      energyTraces.push(
        { ...timeTrace(t, energies.map(item => item.potential), `${body.label} potential`, body.color), line: { color: body.color, width: 1.8, dash: "dot" } },
        { ...timeTrace(t, energies.map(item => item.translational), `${body.label} translational`, body.color), line: { color: body.color, width: 1.8 } },
        { ...timeTrace(t, energies.map(item => item.rotational), `${body.label} rotational`, body.color), line: { color: body.color, width: 1.8, dash: "dash" } }
      );
    });

    positionTraces.push(...model.bodies.map(body => elapsedTrace(`${body.label} elapsed`, body.color, 2.8)));
    velocityTraces.push(...model.bodies.map(body => elapsedTrace(`${body.label} elapsed`, body.color, 2.8)));

    window.Plotly.newPlot("physicsTimePlot", positionTraces, {
      title: "rolling distance along the incline",
      margin: { t: 42, r: 16, b: 42, l: 52 },
      xaxis: { title: "t", range: [model.t0, model.t1], autorange: false, fixedrange: true },
      yaxis: { title: "s", range: paddedRange(positionValues), autorange: false, fixedrange: true },
      shapes: [timeCursorShape(model.t0)],
      annotations: [timeCursorAnnotation(model.t0)],
      uirevision: `${model.type}-position`
    }, { responsive: true });

    window.Plotly.newPlot("physicsPhasePlot", velocityTraces, {
      title: "rolling speed",
      margin: { t: 42, r: 16, b: 42, l: 52 },
      xaxis: { title: "t", range: [model.t0, model.t1], autorange: false, fixedrange: true },
      yaxis: { title: "v", range: paddedRange(velocityValues), autorange: false, fixedrange: true },
      shapes: [timeCursorShape(model.t0)],
      annotations: [timeCursorAnnotation(model.t0)],
      uirevision: `${model.type}-velocity`
    }, { responsive: true });

    window.Plotly.newPlot("physicsEnergyPlot", [
      ...phaseTraces,
      ...model.bodies.map(body => elapsedTrace(`${body.label} phase elapsed`, body.color, 2.8))
    ], {
      title: `phase projection: ${projectionSpec.xLabel} vs ${projectionSpec.yLabel}`,
      margin: { t: 42, r: 16, b: 42, l: 52 },
      xaxis: { title: projectionSpec.xLabel, range: paddedRange(phaseTraces.flatMap(trace => trace.x)), autorange: false, fixedrange: true },
      yaxis: { title: projectionSpec.yLabel, range: paddedRange(phaseTraces.flatMap(trace => trace.y)), autorange: false, fixedrange: true },
      uirevision: `${model.type}-phase-${projectionKey}`
    }, { responsive: true });

    setExtraPhysicsPlotVisible(true);
    window.Plotly.newPlot("physicsExtraPlot", energyTraces, {
      title: "energy components per unit mass",
      margin: { t: 42, r: 16, b: 42, l: 52 },
      xaxis: { title: "t", range: [model.t0, model.t1], autorange: false, fixedrange: true },
      yaxis: { title: "E/m", range: paddedRange(energyValues), autorange: false, fixedrange: true },
      shapes: [timeCursorShape(model.t0)],
      annotations: [timeCursorAnnotation(model.t0)],
      uirevision: `${model.type}-energy`
    }, { responsive: true });
  }

  function rollingProjectionSpec(key) {
    const specs = {
      "s-v": { xKey: "s", yKey: "v", xLabel: "s", yLabel: "v" },
      "phi-omega": { xKey: "phi", yKey: "omega", xLabel: "\u03c6", yLabel: "\u03c9" },
      "s-phi": { xKey: "s", yKey: "phi", xLabel: "s", yLabel: "\u03c6" },
      "v-omega": { xKey: "v", yKey: "omega", xLabel: "v", yLabel: "\u03c9" }
    };
    return specs[key] || specs["s-v"];
  }

  function rollingProjectionValue(point, body, key) {
    const cap = capitalizeKey(body.key);
    return point[`${key}${cap}`];
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
    const firstName = model.mode === "wilberforce" ? "z mode" : "mass 1";
    const secondName = model.mode === "wilberforce" ? "\u03b8 mode" : "mass 2";
    const x1Label = model.mode === "wilberforce" ? "z" : "x1";
    const x2Label = model.mode === "wilberforce" ? "θ" : "x2";
    const v1Label = model.mode === "wilberforce" ? "v_z" : "v1";
    const v2Label = model.mode === "wilberforce" ? "ω" : "v2";
    window.Plotly.newPlot("physicsTimePlot", [
      {
        x: t,
        y: x1,
        name: `${x1Label}(t)`,
        mode: "lines",
        line: { color: "#2563eb", width: 1.5 },
        opacity: 0.25
      },
      {
        x: t,
        y: x2,
        name: `${x2Label}(t)`,
        mode: "lines",
        line: { color: "#0ea5e9", width: 1.5 },
        opacity: 0.25
      },
      {
        x: [],
        y: [],
        name: `${x1Label} elapsed`,
        mode: "lines",
        showlegend: false,
        line: { color: "#2563eb", width: 2.6 }
      },
      {
        x: [],
        y: [],
        name: `${x2Label} elapsed`,
        mode: "lines",
        showlegend: false,
        line: { color: "#0ea5e9", width: 2.6 }
      }
    ], {
      title: model.mode === "wilberforce" ? "z and \u03b8 coordinates" : "two displacements over time",
      margin: { t: 42, r: 16, b: 42, l: 52 },
      xaxis: { title: "t", range: [model.t0, model.t1], autorange: false, fixedrange: true },
      yaxis: { title: `${x1Label}, ${x2Label}`, range: paddedRange([...x1, ...x2]), autorange: false, fixedrange: true },
      shapes: [timeCursorShape(model.t0)],
      annotations: [timeCursorAnnotation(model.t0)],
      uirevision: `${model.type}-time`
    }, { responsive: true });

    window.Plotly.newPlot("physicsPhasePlot", [
      {
        x: t,
        y: v1,
        name: `${v1Label}(t)`,
        mode: "lines",
        line: { color: "#dc2626", width: 1.5 },
        opacity: 0.25
      },
      {
        x: t,
        y: v2,
        name: `${v2Label}(t)`,
        mode: "lines",
        line: { color: "#f97316", width: 1.5 },
        opacity: 0.25
      },
      {
        x: [],
        y: [],
        name: `${v1Label} elapsed`,
        mode: "lines",
        showlegend: false,
        line: { color: "#dc2626", width: 2.6 }
      },
      {
        x: [],
        y: [],
        name: `${v2Label} elapsed`,
        mode: "lines",
        showlegend: false,
        line: { color: "#f97316", width: 2.6 }
      }
    ], {
      title: model.mode === "wilberforce" ? "z' and \u03b8' velocities" : "two velocities over time",
      margin: { t: 42, r: 16, b: 42, l: 52 },
      xaxis: { title: "t", range: [model.t0, model.t1], autorange: false, fixedrange: true },
      yaxis: { title: `${v1Label}, ${v2Label}`, range: paddedRange([...v1, ...v2]), autorange: false, fixedrange: true },
      shapes: [timeCursorShape(model.t0)],
      annotations: [timeCursorAnnotation(model.t0)],
      uirevision: `${model.type}-velocities`
    }, { responsive: true });

    if ((model.phaseProjection || "coupledBoth") === "coupledBoth") {
      window.Plotly.newPlot("physicsEnergyPlot", [
        {
          x: x1,
          y: v1,
          name: `${firstName} phase`,
          mode: "lines",
          line: { color: "#2563eb", width: 1.5 },
          opacity: 0.25
        },
        {
          x: x2,
          y: v2,
          name: `${secondName} phase`,
          mode: "lines",
          line: { color: "#0ea5e9", width: 1.5 },
          opacity: 0.25
        },
        {
          x: [],
          y: [],
          name: `${firstName} elapsed`,
          mode: "lines",
          showlegend: false,
          line: { color: "#2563eb", width: 2.7 }
        },
        {
          x: [],
          y: [],
          name: `${secondName} elapsed`,
          mode: "lines",
          showlegend: false,
          line: { color: "#0ea5e9", width: 2.7 }
        },
        {
          x: [model.x1],
          y: [model.v1],
          name: `${firstName} current`,
          mode: "markers",
          showlegend: false,
          marker: { color: "#2563eb", size: 11, line: { color: "#fff", width: 2 } }
        },
        {
          x: [model.x2],
          y: [model.v2],
          name: `${secondName} current`,
          mode: "markers",
          showlegend: false,
          marker: { color: "#0ea5e9", size: 11, line: { color: "#fff", width: 2 } }
        }
      ], {
        title: model.mode === "wilberforce" ? "phase spaces of both modes" : "phase spaces of both masses",
        margin: { t: 42, r: 16, b: 42, l: 52 },
        xaxis: { title: model.mode === "wilberforce" ? "coordinate" : "x", range: paddedRange([...x1, ...x2]), autorange: false, fixedrange: true },
        yaxis: { title: model.mode === "wilberforce" ? "rate" : "v", range: paddedRange([...v1, ...v2]), autorange: false, fixedrange: true },
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

  function simulateRigidDipole(model, methodKey) {
    const result = simulateVectorSystem(model, methodKey, {
      x: model.x0,
      y: model.yParticle0,
      vx: model.vx0,
      vy: model.vy0,
      theta: model.theta0,
      omega: model.omega0
    }, (t, state) => rigidDipoleDerivative(model, state));
    result.points = result.points.map(point => {
      const diagnostics = rigidDipoleDiagnostics(model, point);
      return {
        ...point,
        yPos: point.y,
        y: point.theta,
        v: point.omega,
        torque: diagnostics.torque,
        forceX: diagnostics.fx,
        forceY: diagnostics.fy
      };
    });
    result.method = systemMethodInfo(methodKey, "rigid charged dipole 6D system");
    return result;
  }

  function rigidDipoleDerivative(model, state) {
    const diagnostics = rigidDipoleDiagnostics(model, state);
    return {
      x: state.vx,
      y: state.vy,
      vx: diagnostics.fx / model.mass - model.drag * state.vx,
      vy: diagnostics.fy / model.mass - model.drag * state.vy,
      theta: state.omega,
      omega: (diagnostics.torque - model.dipoleDamping * state.omega) / model.dipoleInertia
    };
  }

  function rigidDipoleDiagnostics(model, state) {
    const half = model.dipoleDistance * 0.5;
    const ux = Math.cos(state.theta);
    const uy = Math.sin(state.theta);
    const rx = half * ux;
    const ry = half * uy;
    const vpx = state.vx - state.omega * ry;
    const vpy = state.vy + state.omega * rx;
    const vmx = state.vx + state.omega * ry;
    const vmy = state.vy - state.omega * rx;
    const fpx = model.charge * (model.electricEx + vpy * model.magneticB);
    const fpy = model.charge * (model.electricEy - vpx * model.magneticB);
    const fmx = -model.charge * (model.electricEx + vmy * model.magneticB);
    const fmy = -model.charge * (model.electricEy - vmx * model.magneticB);
    const fx = fpx + fmx;
    const fy = fpy + fmy;
    const torque = rx * fpy - ry * fpx + (-rx) * fmy - (-ry) * fmx;
    return { fx, fy, torque, fpx, fpy, fmx, fmy, rx, ry };
  }

  function rollingBodySpecs() {
    return [
      { key: "sphere", label: "sphere", k: 2 / 5, color: "#2563eb" },
      { key: "cylinder", label: "cylinder", k: 1 / 2, color: "#16a34a" },
      { key: "hoop", label: "hoop", k: 1, color: "#dc2626" }
    ];
  }

  function simulateRollingBodies(model, methodKey) {
    const initialState = {};
    model.bodies.forEach(body => {
      const cap = capitalizeKey(body.key);
      initialState[`s${cap}`] = 0;
      initialState[`v${cap}`] = 0;
      initialState[`phi${cap}`] = 0;
      initialState[`omega${cap}`] = 0;
    });
    const result = simulateVectorSystem(model, methodKey, initialState, (t, state) => rollingBodiesDerivative(model, state));
    result.points = result.points.map(point => {
      const mapped = { ...point };
      model.bodies.forEach(body => {
        const cap = capitalizeKey(body.key);
        mapped[`energy${cap}`] = rollingBodyEnergy(model, body, point);
      });
      mapped.y = point.sSphere;
      mapped.v = point.vSphere;
      return mapped;
    });
    result.method = systemMethodInfo(methodKey, "rolling bodies comparison");
    return result;
  }

  function rollingBodiesDerivative(model, state) {
    const derivative = {};
    model.bodies.forEach(body => {
      const cap = capitalizeKey(body.key);
      const sKey = `s${cap}`;
      const vKey = `v${cap}`;
      const phiKey = `phi${cap}`;
      const omegaKey = `omega${cap}`;
      const atEnd = state[sKey] >= model.rollingLength && state[vKey] >= 0;
      const acceleration = atEnd
        ? 0
        : model.rollingG * Math.sin(model.rollingAngle) / (1 + body.k) - model.rollingDrag * state[vKey];
      derivative[sKey] = atEnd ? 0 : state[vKey];
      derivative[vKey] = acceleration;
      derivative[phiKey] = atEnd ? 0 : state[vKey] / model.rollingRadius;
      derivative[omegaKey] = acceleration / model.rollingRadius;
    });
    return derivative;
  }

  function clampRollingBodiesState(state, trackLength) {
    const next = { ...state };
    rollingBodySpecs().forEach(body => {
      const cap = capitalizeKey(body.key);
      const sKey = `s${cap}`;
      if (next[sKey] >= trackLength) {
        next[sKey] = trackLength;
        next[`v${cap}`] = 0;
        next[`omega${cap}`] = 0;
      }
    });
    return next;
  }

  function rollingBodyEnergy(model, body, point) {
    const cap = capitalizeKey(body.key);
    const s = clamp(point[`s${cap}`], 0, model.rollingLength);
    const v = point[`v${cap}`] || 0;
    const translational = 0.5 * v * v;
    const rotational = 0.5 * body.k * v * v;
    const potential = model.rollingG * Math.sin(model.rollingAngle) * Math.max(model.rollingLength - s, 0);
    return { translational, rotational, potential, total: translational + rotational + potential };
  }

  function simulateSpool(model, methodKey) {
    const result = simulateVectorSystem(model, methodKey, {
      s: 0,
      v: 0,
      phi: 0,
      omega: 0
    }, (t, state) => model.derivative(t, state));
    result.points = result.points.map(point => ({
      ...point,
      y: point.s,
      v: point.v
    }));
    result.method = systemMethodInfo(methodKey, "pulled spool 4D rolling system");
    return result;
  }

  function capitalizeKey(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
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

  function simulateWilberforce(model, methodKey) {
    const result = simulateVectorSystem(model, methodKey, {
      x1: model.x1,
      v1: model.v1,
      x2: model.x2,
      v2: model.v2
    }, (t, state) => model.derivative(t, state));
    result.points = result.points.map(point => ({
      ...point,
      z: point.x1,
      vz: point.v1,
      theta: point.x2,
      omega: point.v2,
      y: point.x1,
      v: point.v1
    }));
    result.method = systemMethodInfo(methodKey, "Wilberforce 4D coupled oscillator");
    return result;
  }

  function simulateHeavyTop(model, methodKey) {
    const result = simulateVectorSystem(model, methodKey, {
      theta: model.theta0,
      thetaDot: model.thetaDot0,
      phi: model.phi0,
      psi: model.psi0
    }, (t, state) => heavyTopRates(model, state));
    result.points = result.points.map(point => {
      const rates = heavyTopRates(model, point);
      return {
        ...point,
        y: point.theta,
        v: point.thetaDot,
        phiDot: rates.phi,
        psiDot: rates.psi,
        spinRate: rates.spinRate
      };
    });
    result.method = systemMethodInfo(methodKey, "symmetric heavy top");
    return result;
  }

  function heavyTopRates(model, state) {
    const theta = clamp(state.theta, 0.035, Math.PI - 0.035);
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    const sin2 = Math.max(sinTheta * sinTheta, 1e-5);
    const phiDot = (model.gyroPphi - model.gyroPpsi * cosTheta) / (model.gyroI1 * sin2);
    const spinRate = model.gyroPpsi / model.gyroI3;
    const psiDot = spinRate - phiDot * cosTheta;
    const thetaAccel = phiDot * phiDot * sinTheta * cosTheta
      - (model.gyroPpsi / model.gyroI1) * phiDot * sinTheta
      + (model.gyroMass * model.gyroG * model.gyroD / model.gyroI1) * sinTheta;
    return {
      theta: state.thetaDot,
      thetaDot: thetaAccel,
      phi: phiDot,
      psi: psiDot,
      spinRate
    };
  }

  function heavyTopAngularMomentum(model, point) {
    const theta = clamp(point.theta ?? point.y, 0.035, Math.PI - 0.035);
    const thetaDot = point.thetaDot ?? point.v ?? 0;
    const rates = heavyTopRates(model, {
      theta,
      thetaDot,
      phi: point.phi ?? 0,
      psi: point.psi ?? 0
    });
    const lTheta = model.gyroI1 * thetaDot;
    const lPhi = model.gyroI1 * rates.phi * Math.sin(theta);
    const lPerp = Math.hypot(lTheta, lPhi);
    const l3 = model.gyroPpsi;
    const lz = model.gyroPphi;
    return {
      lTheta,
      lPhi,
      lPerp,
      l3,
      lz,
      lTotal: Math.hypot(lPerp, l3)
    };
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
    if (model.mode === "rollingBodies") parts.push(result.method.note || `rolling bodies comparison solved with ${result.method.label}`);
    if (model.mode === "spool") parts.push(result.method.note || `spool rolling system solved with ${result.method.label}`);
    if (model.mode === "coupled") parts.push(result.method.note || `coupled system solved with ${result.method.label}`);
    if (model.mode === "circuitFirstOrder" && result.note) parts.push(result.note);
    if (model.type === "rotatingDisk") {
      parts.push(Math.abs(model.rotationTau) < 1e-9
        ? "tau=0: angular momentum L=I omega should stay nearly constant"
        : "external torque changes angular momentum");
    }
    if (model.type === "rollingBodies") {
      parts.push("larger I/(mR^2) rolls more slowly: sphere beats cylinder, hoop is slowest");
    }
    if (model.type === "spool") {
      parts.push("current tangent geometry gives a = F(cos(alpha)+r/R)/(M(1+k)) before damping");
    }
    if (model.type === "wilberforce") {
      parts.push("coupled z and \u03b8 modes exchange energy through \u03b5");
    }
    if (model.type === "gyroscope") {
      parts.push("symmetric heavy top: \u03b8 nutates and \u03c6 precesses from conserved p_\u03c6 and p_\u03c8");
    }
    if (model.type === "rigidDipole") {
      parts.push(Math.abs(model.magneticB) < 1e-9
        ? "Bz=0: clean electric dipole torque p x E"
        : "Bz enabled: Lorentz forces are applied at both endpoint charges");
    }
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
      rigidDipole: {
        physicsT1: 18,
        physicsH: 0.015,
        physicsParticleX0: 0,
        physicsParticleY0: 0,
        physicsParticleVx0: 0,
        physicsParticleVy0: 0,
        physicsParticleDrag: 0,
        physicsParticleCharge: 1,
        physicsParticleMass: 1,
        physicsElectricEx: 1,
        physicsElectricEy: 0,
        physicsMagneticB: 0,
        physicsDipoleDistance: 1,
        physicsDipoleInertia: 0.12,
        physicsDipoleDamping: 0.04,
        physicsDipoleTheta0: 80,
        physicsDipoleOmega0: 0,
        physicsPhaseProjection: "theta-omega"
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
      rotatingDisk: {
        physicsT1: 12,
        physicsH: 0.02,
        physicsRotationI0: 3,
        physicsRotationI1: 1,
        physicsRotationTau: 0,
        physicsRotationTheta0: 0,
        physicsRotationOmega0: 2
      },
      rollingBodies: {
        physicsT1: 7,
        physicsH: 0.01,
        physicsRollingAngle: 18,
        physicsRollingLength: 8,
        physicsRollingRadius: 0.35,
        physicsRollingG: 9.81,
        physicsRollingDrag: 0,
        physicsPhaseProjection: "s-v"
      },
      spool: {
        physicsT1: 8,
        physicsH: 0.01,
        physicsSpoolMass: 1,
        physicsSpoolRadius: 0.55,
        physicsSpoolAxleRadius: 0.22,
        physicsSpoolInertiaK: 0.55,
        physicsSpoolForce: 2,
        physicsSpoolPullAngle: 75,
        physicsSpoolDrag: 0.02
      },
      wilberforce: {
        physicsT1: 40,
        physicsH: 0.02,
        physicsWilberforceMass: 1,
        physicsWilberforceI: 0.2,
        physicsWilberforceKz: 4,
        physicsWilberforceKt: 0.8,
        physicsWilberforceCoupling: 0.18,
        physicsWilberforceDamping: 0,
        physicsWilberforceZ0: 1,
        physicsWilberforceVz0: 0,
        physicsWilberforceTheta0: 0,
        physicsWilberforceOmega0: 0
      },
      gyroscope: {
        physicsT1: 14,
        physicsH: 0.01,
        physicsGyroMass: 1,
        physicsGyroD: 0.9,
        physicsGyroI1: 0.45,
        physicsGyroI: 0.2,
        physicsGyroSpin: 35,
        physicsGyroTilt: 35,
        physicsGyroG: 9.81,
        physicsGyroPhi0: 0,
        physicsGyroThetaDot0: 0,
        physicsGyroPhiDot0: 1.1
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
    } else if (currentModel.mode === "rigidDipole") {
      drawRigidDipole(ctx, width, height, state, currentModel);
    } else if (currentModel.mode === "coupled") {
      drawCoupledOscillators(ctx, width, height, state, currentModel);
    } else if (currentModel.type === "rotatingDisk") {
      drawRotatingDisk(ctx, width, height, state, currentModel);
    } else if (currentModel.type === "rollingBodies") {
      drawRollingBodies(ctx, width, height, state, currentModel);
    } else if (currentModel.type === "spool") {
      drawSpool(ctx, width, height, state, currentModel);
    } else if (currentModel.type === "wilberforce") {
      drawWilberforce(ctx, width, height, state, currentModel);
    } else if (currentModel.type === "gyroscope") {
      drawGyroscope(ctx, width, height, state, currentModel);
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

    if (!["predatorPrey", "rotatingDisk", "rollingBodies", "spool", "wilberforce", "gyroscope"].includes(currentModel.type)) {
      drawCanvasHud(ctx, state, currentModel, compareState);
    }
    updateTimeControls(t);
    updatePlotCursors(t, state, options.forcePlotUpdate);
  }

  function drawRotatingDisk(ctx, width, height, state, model) {
    const centerX = width * 0.48;
    const centerY = height * 0.5;
    const inertia = model.inertiaAt(state.t);
    const maxI = Math.max(model.rotationI0, model.rotationI1, 1e-6);
    const radiusScale = 0.48 + 0.52 * Math.sqrt(clamp(inertia / maxI, 0.08, 1.4));
    const initialRadiusScale = 0.48 + 0.52 * Math.sqrt(clamp(model.rotationI0 / maxI, 0.08, 1.4));
    const radius = Math.min(width, height) * 0.2 * radiusScale;
    const initialRadius = Math.min(width, height) * 0.2 * initialRadiusScale;
    const radiusRatio = Math.sqrt(inertia / Math.max(model.rotationI0, 1e-9));
    const theta = state.y;
    const omega = state.v;
    const angularMomentum = inertia * omega;
    const energy = 0.5 * inertia * omega * omega;
    const omegaRef = Math.max(Math.abs(model.rotationOmega0), Math.abs(omega), 1e-6);
    const lRef = Math.max(Math.abs(model.rotationI0 * model.rotationOmega0), Math.abs(angularMomentum), 1e-6);

    ctx.fillStyle = "#f8fafc";
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + radius * 0.82, radius * 1.15, radius * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(100, 116, 139, 0.5)";
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.arc(centerX, centerY, initialRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#e0f2fe";
    ctx.strokeStyle = "#0369a1";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(14, 165, 233, 0.18)";
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.68, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const angle = theta + i * Math.PI / 3;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + Math.cos(angle) * radius * 0.92, centerY + Math.sin(angle) * radius * 0.92);
      ctx.stroke();
    }

    for (let i = 0; i < 2; i++) {
      const angle = theta + i * Math.PI;
      const handX = centerX + Math.cos(angle) * radius * 0.9;
      const handY = centerY + Math.sin(angle) * radius * 0.9;
      ctx.fillStyle = "#7c3aed";
      ctx.beginPath();
      ctx.arc(handX, handY, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
    ctx.fill();

    drawCircularArrow(
      ctx,
      centerX,
      centerY,
      radius + 22,
      theta - Math.PI * 0.55,
      theta - Math.PI * 0.55 + Math.sign(omega || 1) * Math.PI * 0.8,
      "#2563eb",
      "\u03c9"
    );

    if (Math.abs(model.rotationTau) > 1e-9) {
      drawCircularArrow(
        ctx,
        centerX,
        centerY,
        radius + 42,
        -Math.PI * 0.15,
        -Math.PI * 0.15 + Math.sign(model.rotationTau) * Math.PI * 0.55,
        "#f97316",
        "\u03c4"
      );
    }

    const vectorX = width * 0.78;
    const vectorY = height * 0.56;
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(vectorX, vectorY + 70);
    ctx.lineTo(vectorX, vectorY - 70);
    ctx.stroke();
    drawVectorArrow(ctx, vectorX, vectorY + 28, 0, -angularMomentum / lRef, "#16a34a", "L", 54);
    drawVectorArrow(ctx, vectorX + 54, vectorY + 28, 0, -omega / omegaRef, "#2563eb", "\u03c9", 44);

    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.strokeStyle = "rgba(148, 163, 184, 0.7)";
    ctx.lineWidth = 1;
    ctx.fillRect(12, 16, 166, 116);
    ctx.strokeRect(12, 16, 166, 116);

    ctx.fillStyle = "#0f172a";
    ctx.font = "13px Arial";
    ctx.fillText(`t = ${formatHudNumber(state.t)}`, 20, 34);
    ctx.fillText(`I(t) = ${formatHudNumber(inertia)}`, 20, 54);
    ctx.fillText(`R_eff/R0 = ${formatHudNumber(radiusRatio)}`, 20, 74);
    ctx.fillText(`\u03c9 = ${formatHudNumber(omega)}`, 20, 94);
    ctx.fillText(`L = I\u03c9 = ${formatHudNumber(angularMomentum)}`, 20, 114);
    ctx.fillText(`E_rot = ${formatHudNumber(energy)}`, 20, 128);

    ctx.fillStyle = "#475569";
    ctx.font = "12px Arial";
    ctx.fillText("dashed outline: initial effective radius", centerX - 105, centerY + initialRadius + 22);
    ctx.fillText("smaller I -> faster rotation when tau = 0", centerX - 100, height - 22);
  }

  function drawRollingBodies(ctx, width, height, state, model) {
    const columnWidth = width / model.bodies.length;
    const angle = model.rollingAngle;
    const normalX = -Math.sin(angle);
    const normalY = Math.cos(angle);
    const radiusPx = Math.max(12, Math.min(22, model.rollingRadius * 52));
    const panelTop = height * 0.18;
    const panelHeight = height * 0.62;
    const startY = panelTop + panelHeight * 0.48;
    const trackLengthPx = columnWidth * 0.66;

    model.bodies.forEach((body, index) => {
      const cap = capitalizeKey(body.key);
      const panelX = index * columnWidth + 8;
      const panelW = columnWidth - 16;
      const startX = panelX + panelW * 0.16;
      const endX = startX + trackLengthPx * Math.cos(angle);
      const endY = startY + trackLengthPx * Math.sin(angle);
      const s = clamp(state[`s${cap}`] || 0, 0, model.rollingLength);
      const fraction = clamp(s / model.rollingLength, 0, 1);
      const centerX = startX + trackLengthPx * fraction * Math.cos(angle) + normalX * (radiusPx + 8);
      const centerY = startY + trackLengthPx * fraction * Math.sin(angle) - normalY * (radiusPx + 8);

      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1;
      ctx.strokeRect(panelX, panelTop, panelW, panelHeight);
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      drawRollingBody(ctx, centerX, centerY, radiusPx, state[`phi${cap}`] || 0, body);
      ctx.fillStyle = body.color;
      ctx.font = "12px Arial";
      ctx.fillText(body.label, panelX + 10, panelTop + 20);
      ctx.fillStyle = "#334155";
      ctx.fillText(`k=${formatHudNumber(body.k)}  s=${formatHudNumber(s)}`, panelX + 10, panelTop + 38);
      ctx.fillText(`v=${formatHudNumber(state[`v${cap}`] || 0)}`, panelX + 10, panelTop + 56);
    });

    ctx.fillStyle = "#0f172a";
    ctx.font = "13px Arial";
    ctx.fillText(`\u03b1=${formatHudNumber(model.rollingAngle * 180 / Math.PI)} deg  L=${formatHudNumber(model.rollingLength)}  drag=${formatHudNumber(model.rollingDrag)}`, 18, 24);
  }

  function drawRollingBody(ctx, x, y, radius, phi, body) {
    ctx.save();
    ctx.fillStyle = body.key === "hoop" ? "#ffffff" : body.color;
    ctx.strokeStyle = body.color;
    ctx.lineWidth = body.key === "hoop" ? 6 : 2.5;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = body.key === "hoop" ? body.color : "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(phi) * radius * 0.82, y + Math.sin(phi) * radius * 0.82);
    ctx.stroke();
    drawCanvasObjectLabel(ctx, body.key === "sphere" ? "sphere" : body.key === "cylinder" ? "cyl" : "hoop", x, y - radius - 10, body.color);
    ctx.restore();
  }

  function drawSpool(ctx, width, height, state, model) {
    const sValues = (currentResult?.points || []).map(point => point.s).filter(value => Number.isFinite(value));
    const minS = Math.min(...sValues, state.s, -0.5);
    const maxS = Math.max(...sValues, state.s, 0.5);
    const sPad = Math.max((maxS - minS) * 0.12, 0.4);
    const viewMin = minS - sPad;
    const viewMax = maxS + sPad;
    const plotLeft = 58;
    const plotRight = width - 46;
    const mapS = value => plotLeft + (value - viewMin) / Math.max(viewMax - viewMin, 1e-6) * (plotRight - plotLeft);
    const centerX = mapS(state.s);
    const originX = mapS(0);
    const groundY = height * 0.72;
    const radius = Math.min(width, height) * 0.15;
    const axleRadius = radius * model.spoolAxleRadius / model.spoolRadius;
    const centerY = groundY - radius;
    const angle = model.spoolPullAngle;
    const visualSpin = (centerX - originX) / Math.max(radius, 1e-6);
    const constraintOmega = state.v / Math.max(model.spoolRadius, 1e-6);
    const forceX = model.spoolForce * Math.cos(angle);
    const forceY = -model.spoolForce * Math.sin(angle);
    const stringTorque = model.spoolForce * model.spoolAxleRadius;
    const torqueSign = Math.sign(stringTorque || 1);
    const torqueSpan = clamp(Math.abs(stringTorque) / Math.max(model.spoolRadius, 1e-6), 0.22, 0.72);
    const tangentX = centerX - Math.sin(angle) * axleRadius;
    const tangentY = centerY - Math.cos(angle) * axleRadius;
    const stringEndX = tangentX + Math.cos(angle) * radius * 2.1;
    const stringEndY = tangentY - Math.sin(angle) * radius * 2.1;

    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(plotLeft - 18, groundY);
    ctx.lineTo(plotRight + 18, groundY);
    ctx.stroke();

    ctx.fillStyle = "#dbeafe";
    ctx.strokeStyle = "#1d4ed8";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#1e3a8a";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + Math.cos(visualSpin) * radius * 0.86, centerY + Math.sin(visualSpin) * radius * 0.86);
    ctx.stroke();
    ctx.fillStyle = "#1e3a8a";
    ctx.beginPath();
    ctx.arc(centerX + Math.cos(visualSpin) * radius * 0.86, centerY + Math.sin(visualSpin) * radius * 0.86, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY, axleRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(15, 23, 42, 0.45)";
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(tangentX, tangentY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(tangentX, tangentY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "12px Arial";
    ctx.fillText("r", (centerX + tangentX) * 0.5 + 5, (centerY + tangentY) * 0.5 - 5);

    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tangentX, tangentY);
    ctx.lineTo(stringEndX, stringEndY);
    ctx.stroke();
    drawVectorArrow(ctx, stringEndX - Math.cos(angle) * 12, stringEndY + Math.sin(angle) * 12, forceX, forceY, "#dc2626", "F", 38);
    drawVectorArrow(ctx, tangentX, tangentY + 22, forceX, 0, "#f97316", "F_x", 34);
    drawCircularArrow(ctx, centerX, centerY, axleRadius + 18, visualSpin - torqueSign * torqueSpan, visualSpin + torqueSign * torqueSpan, "#f97316", "\u03c4_F");
    drawVectorArrow(ctx, centerX, groundY + 34, Math.sign(model.spoolAcceleration || 1), 0, "#16a34a", "a_cm", 42);
    const omegaSign = Math.sign(state.v || state.omega || model.spoolAcceleration || 1);
    const omegaSpan = clamp(Math.abs(state.omega) / 4, 0.22, 0.75);
    drawCircularArrow(ctx, centerX, centerY, radius * 0.72, visualSpin - omegaSign * omegaSpan, visualSpin + omegaSign * omegaSpan, "#7c3aed", "\u03c9");

    const wrapTerm = Math.cos(angle) + model.spoolAxleRadius / model.spoolRadius;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.strokeStyle = "rgba(148, 163, 184, 0.8)";
    ctx.lineWidth = 1;
    ctx.fillRect(16, 16, 342, 144);
    ctx.strokeRect(16, 16, 342, 144);
    ctx.fillStyle = "#0f172a";
    ctx.font = "12px Arial";
    ctx.fillText(`s=${formatHudNumber(state.s)}  v=${formatHudNumber(state.v)}  \u03c9=${formatHudNumber(state.omega)}`, 28, 38);
    ctx.fillText(`v/R=${formatHudNumber(constraintOmega)}  \u03c9-v/R=${formatHudNumber(state.omega - constraintOmega)}`, 28, 58);
    ctx.fillText(`a0=${formatHudNumber(model.spoolAcceleration)}  upper tangent`, 28, 78);
    ctx.fillText(`cos\u03b1+r/R=${formatHudNumber(wrapTerm)}`, 28, 98);
    ctx.fillText(`F_x=${formatHudNumber(forceX)}  \u03c4_F=${formatHudNumber(stringTorque)}`, 28, 118);
    ctx.fillText(`sign(a_cm)=${model.spoolAcceleration < 0 ? "-" : "+"}`, 28, 138);
    ctx.fillStyle = "#475569";
    ctx.fillText(`view: s ${formatHudNumber(viewMin)} to ${formatHudNumber(viewMax)}`, width - 172, groundY + 28);
  }

  function drawCircularArrow(ctx, centerX, centerY, radius, startAngle, endAngle, color, label) {
    const clockwise = endAngle < startAngle;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle, clockwise);
    ctx.stroke();

    const direction = clockwise ? -1 : 1;
    const endX = centerX + Math.cos(endAngle) * radius;
    const endY = centerY + Math.sin(endAngle) * radius;
    const tangent = endAngle + direction * Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - Math.cos(tangent) * 10 + Math.cos(endAngle) * 5, endY - Math.sin(tangent) * 10 + Math.sin(endAngle) * 5);
    ctx.lineTo(endX - Math.cos(tangent) * 10 - Math.cos(endAngle) * 5, endY - Math.sin(tangent) * 10 - Math.sin(endAngle) * 5);
    ctx.closePath();
    ctx.fill();

    if (label) {
      const midAngle = (startAngle + endAngle) / 2;
      ctx.font = "13px Arial";
      ctx.fillText(label, centerX + Math.cos(midAngle) * (radius + 10), centerY + Math.sin(midAngle) * (radius + 10));
    }
  }

  function drawWilberforce(ctx, width, height, state, model) {
    const centerX = width * 0.42;
    const anchorY = height * 0.12;
    const restY = height * 0.52;
    const zScale = Math.min(height * 0.16, 82);
    const bobY = restY + clamp(state.x1, -1.8, 1.8) * zScale;
    const springTop = anchorY + 18;
    const springBottom = bobY - 44;
    const bobW = Math.min(width, height) * 0.2;
    const bobH = Math.min(width, height) * 0.12;
    const depth = Math.min(width, height) * 0.035;
    const theta = state.x2;
    const omega = state.v2;
    const verticalEnergy = 0.5 * model.wilberforceMass * state.v1 * state.v1
      + 0.5 * model.wilberforceKz * state.x1 * state.x1;
    const torsionalEnergy = 0.5 * model.wilberforceI * omega * omega
      + 0.5 * model.wilberforceKt * theta * theta;
    const couplingEnergy = model.wilberforceCoupling * state.x1 * theta;
    const totalEnergy = verticalEnergy + torsionalEnergy + couplingEnergy;
    const energyMax = Math.max(verticalEnergy, torsionalEnergy, Math.abs(totalEnergy), 1e-6);

    const shadowGradient = ctx.createRadialGradient(centerX, bobY + 58, 5, centerX, bobY + 58, bobW * 0.7);
    shadowGradient.addColorStop(0, "rgba(15, 23, 42, 0.18)");
    shadowGradient.addColorStop(1, "rgba(15, 23, 42, 0)");
    ctx.fillStyle = shadowGradient;
    ctx.beginPath();
    ctx.ellipse(centerX, bobY + 58, bobW * 0.62, bobH * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(centerX - 118, anchorY - 9);
    ctx.lineTo(centerX + 96, anchorY - 9);
    ctx.lineTo(centerX + 122, anchorY + 12);
    ctx.lineTo(centerX - 92, anchorY + 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX - 62, anchorY + 12);
    ctx.lineTo(centerX + 62, anchorY + 12);
    ctx.stroke();

    drawHelicalSpring3D(ctx, centerX, springTop, springBottom, 15, 22, depth, theta * 0.45);

    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1.3;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(centerX - 125, restY);
    ctx.lineTo(centerX + 125, restY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#64748b";
    ctx.font = "12px Arial";
    ctx.fillText("z=0", centerX + 132, restY + 4);

    drawWilberforceBob3D(ctx, centerX, bobY, bobW, bobH, depth, theta);

    const rateRanges = wilberforceRateRanges(state.v1, omega);
    drawVectorArrow(ctx, centerX + bobW * 0.65, bobY, 0, normalizedRateValue(state.v1, rateRanges.z), "#2563eb", "z'", 34);
    drawRateCircularArrow(ctx, centerX, bobY, bobW * 0.42 + 18, theta, omega, rateRanges.omega, "#7c3aed", "\u03c9");

    const panelX = width * 0.66;
    const panelY = height * 0.22;
    drawEnergyBar(ctx, panelX, panelY, 160, "E_z", verticalEnergy / energyMax, "#2563eb");
    drawEnergyBar(ctx, panelX, panelY + 34, 160, "E_\u03b8", torsionalEnergy / energyMax, "#7c3aed");
    drawEnergyBar(ctx, panelX, panelY + 68, 160, "E", totalEnergy / energyMax, "#16a34a");
    drawWilberforceRatePanel(ctx, panelX, panelY + 104, 160, state.v1, omega);

    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.strokeStyle = "rgba(148, 163, 184, 0.7)";
    ctx.lineWidth = 1;
    ctx.fillRect(14, 18, 220, 118);
    ctx.strokeRect(14, 18, 220, 118);
    ctx.fillStyle = "#0f172a";
    ctx.font = "13px Arial";
    ctx.fillText(`z = ${formatHudNumber(state.x1)}`, 24, 38);
    ctx.fillText(`z' = ${formatHudNumber(state.v1)}`, 24, 58);
    ctx.fillText(`\u03b8 = ${formatHudNumber(theta)}`, 24, 78);
    ctx.fillText(`\u03b8' = \u03c9 = ${formatHudNumber(omega)}`, 24, 98);
    ctx.fillText(`\u03b5 = ${formatHudNumber(model.wilberforceCoupling)}`, 24, 118);

    ctx.fillStyle = "#475569";
    ctx.font = "12px Arial";
    ctx.fillText("energy periodically shifts between z and \u03b8", centerX - 112, height - 24);
  }

  function drawWilberforceRatePanel(ctx, x, y, width, verticalRate, angularRate) {
    const ranges = wilberforceRateRanges(verticalRate, angularRate);
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.strokeStyle = "rgba(148, 163, 184, 0.72)";
    ctx.lineWidth = 1;
    ctx.fillRect(x - 10, y - 14, width + 20, 68);
    ctx.strokeRect(x - 10, y - 14, width + 20, 68);
    ctx.fillStyle = "#334155";
    ctx.font = "12px Arial";
    ctx.fillText("rate ranges", x, y + 2);
    drawRateRangeGauge(ctx, x, y + 22, width, "z'", verticalRate, ranges.z.min, ranges.z.max, "#2563eb");
    drawRateRangeGauge(ctx, x, y + 46, width, "\u03b8'=\u03c9", angularRate, ranges.omega.min, ranges.omega.max, "#7c3aed");
  }

  function drawHelicalSpring3D(ctx, x, y0, y1, coils, radiusX, radiusY, phase = 0) {
    const length = y1 - y0;
    const steps = Math.max(coils * 22, 2);
    let previous = null;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = phase + t * coils * Math.PI * 2;
      const depth = Math.sin(angle);
      const point = {
        x: x + Math.cos(angle) * radiusX,
        y: y0 + t * length + depth * radiusY * 0.36
      };
      if (previous) {
        ctx.strokeStyle = depth > 0 ? "#0f172a" : "#94a3b8";
        ctx.lineWidth = depth > 0 ? 2.4 : 1.5;
        ctx.beginPath();
        ctx.moveTo(previous.x, previous.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      }
      previous = point;
    }
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y0 - 14);
    ctx.lineTo(x, y0);
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y1 + 18);
    ctx.stroke();
  }

  function drawWilberforceBob3D(ctx, x, y, width, height, depth, theta) {
    const topY = y - height * 0.26;
    const bottomY = y + height * 0.26;
    const bodyGradient = ctx.createLinearGradient(x - width / 2, topY, x + width / 2, bottomY);
    bodyGradient.addColorStop(0, "#f8fafc");
    bodyGradient.addColorStop(0.18, "#bae6fd");
    bodyGradient.addColorStop(0.55, "#38bdf8");
    bodyGradient.addColorStop(1, "#0369a1");

    ctx.fillStyle = bodyGradient;
    ctx.strokeStyle = "#075985";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - width / 2, topY);
    ctx.bezierCurveTo(x - width / 2, y, x - width / 2, bottomY, x, bottomY + depth * 0.38);
    ctx.bezierCurveTo(x + width / 2, bottomY, x + width / 2, y, x + width / 2, topY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#e0f2fe";
    ctx.strokeStyle = "#0369a1";
    ctx.beginPath();
    ctx.ellipse(x, topY, width / 2, depth, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(3, 105, 161, 0.22)";
    ctx.beginPath();
    ctx.ellipse(x, bottomY, width / 2, depth, 0, 0, Math.PI);
    ctx.fill();

    const markerX = x + Math.cos(theta) * width * 0.36;
    const markerY = topY + Math.sin(theta) * depth * 0.72;
    const markerFront = Math.sin(theta) >= 0;
    ctx.strokeStyle = markerFront ? "#0f172a" : "rgba(15, 23, 42, 0.35)";
    ctx.lineWidth = markerFront ? 2.8 : 1.7;
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.lineTo(markerX, markerY);
    ctx.stroke();
    ctx.fillStyle = markerFront ? "#f97316" : "#fdba74";
    ctx.beginPath();
    ctx.arc(markerX, markerY, markerFront ? 7 : 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawEnergyBar(ctx, x, y, width, label, fraction, color) {
    const clamped = clamp(fraction, 0, 1);
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(x, y, width, 12);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width * clamped, 12);
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, 12);
    ctx.fillStyle = "#334155";
    ctx.font = "12px Arial";
    ctx.fillText(label, x, y - 5);
  }

  function drawGyroscope(ctx, width, height, state, model) {
    const pivotX = width * 0.38;
    const pivotY = height * 0.63;
    const theta = clamp(state.theta ?? state.y, 0.035, Math.PI - 0.035);
    const phi = state.phi ?? 0;
    const psi = state.psi ?? 0;
    const rates = heavyTopRates(model, state);
    const gravityTorque = model.gyroMass * model.gyroG * model.gyroD * Math.sin(theta);
    const slowPrecession = model.spinAngularMomentum
      ? model.gyroMass * model.gyroG * model.gyroD / model.spinAngularMomentum
      : 0;
    const visualScale = Math.min(width, height);
    const orbitRx = visualScale * 0.35 * Math.sin(theta);
    const orbitRy = orbitRx * 0.34;
    const axisLength = visualScale * 0.43;
    const tiltDepth = Math.cos(theta);
    const rotorX = pivotX + Math.cos(phi) * orbitRx;
    const rotorY = pivotY - axisLength * 0.52 * tiltDepth + Math.sin(phi) * orbitRy;
    const rotorDepth = Math.sin(phi);
    const armAngle = Math.atan2(rotorY - pivotY, rotorX - pivotX);
    const diskAngle = armAngle + Math.PI / 2;
    const diskRx = visualScale * 0.13;
    const diskRy = visualScale * (0.038 + 0.02 * Math.abs(rotorDepth));

    const baseGradient = ctx.createRadialGradient(pivotX, pivotY + 92, 4, pivotX, pivotY + 92, 140);
    baseGradient.addColorStop(0, "rgba(15, 23, 42, 0.18)");
    baseGradient.addColorStop(1, "rgba(15, 23, 42, 0)");
    ctx.fillStyle = baseGradient;
    ctx.beginPath();
    ctx.ellipse(pivotX, pivotY + 92, 142, 28, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.4;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.ellipse(pivotX, pivotY - axisLength * 0.52 * tiltDepth, orbitRx, orbitRy, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#e2e8f0";
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(pivotX, pivotY + 78, 84, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    drawGyroVerticalPost(ctx, pivotX, pivotY, axisLength, 1);

    drawGyroArm3D(ctx, pivotX, pivotY, rotorX, rotorY, rotorDepth);

    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 9, 0, Math.PI * 2);
    ctx.fill();

    drawGyroRotor3D(ctx, rotorX, rotorY, diskRx, diskRy, diskAngle, gyroVisualSpin(psi, model, state, rates) - diskAngle, rotorDepth);
    const postOcclusion = gyroPostOcclusion(rotorX, pivotX, diskRx, rotorDepth);
    if (postOcclusion > 0.02) {
      drawGyroVerticalPost(ctx, pivotX, pivotY, axisLength, 1, postOcclusion);
    }

    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1.4;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.ellipse(pivotX, pivotY - axisLength * 0.52 * tiltDepth, orbitRx, orbitRy, 0, 0, Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);

    drawVectorArrow(ctx, pivotX + 70, pivotY - 34, 0, 1, "#f97316", "\u03c4=Mg d", 34);
    drawGyroAngleLabels(ctx, pivotX, pivotY, rotorX, rotorY, theta, phi, axisLength, tiltDepth, orbitRx, orbitRy);
    drawGyroRatePanel(ctx, width, height, model, state, rates);

    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.strokeStyle = "rgba(148, 163, 184, 0.7)";
    ctx.lineWidth = 1;
    ctx.fillRect(14, 18, 300, 162);
    ctx.strokeRect(14, 18, 300, 162);
    ctx.fillStyle = "#0f172a";
    ctx.font = "12px Arial";
    ctx.fillText(`\u03b8 tilt = ${formatHudNumber(theta)}`, 24, 38);
    ctx.fillText(`\u03c6 azimuth = ${formatHudNumber(phi)}`, 24, 58);
    ctx.fillText(`\u03c8 spin angle = ${formatHudNumber(psi)}`, 24, 78);
    ctx.fillText(`\u03b8' nutation rate = ${formatHudNumber(state.thetaDot ?? state.v)}`, 24, 100);
    ctx.fillText(`\u03c6' precession rate = ${formatHudNumber(rates.phi)}`, 24, 120);
    ctx.fillText(`\u03c8' spin rate = ${formatHudNumber(rates.psi)}`, 24, 140);
    ctx.fillText(`\u03c4_g = ${formatHudNumber(gravityTorque)}  \u03a9_slow \u2248 ${formatHudNumber(slowPrecession)}`, 24, 160);
    ctx.fillText(`E = ${formatHudNumber(metricParts(model, state).total)}`, 222, 140);
  }

  function drawGyroArm3D(ctx, pivotX, pivotY, rotorX, rotorY, depth) {
    const armGradient = ctx.createLinearGradient(pivotX, pivotY, rotorX, rotorY);
    armGradient.addColorStop(0, "#0f172a");
    armGradient.addColorStop(0.5, "#334155");
    armGradient.addColorStop(1, "#020617");
    ctx.strokeStyle = armGradient;
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(rotorX, rotorY);
    ctx.stroke();
    ctx.lineCap = "butt";
  }

  function gyroVisualSpin(psi, model, state, rates) {
    const maxReadableSpinRate = 10;
    const spinRange = gyroRateRanges(model, state, rates).psi;
    const spinReference = Math.max(Math.abs(spinRange.min), Math.abs(spinRange.max), 1e-9);
    const visualScale = Math.min(1, maxReadableSpinRate / spinReference);
    return positiveAngle(psi * visualScale);
  }

  function gyroPostOcclusion(rotorX, pivotX, diskRx, rotorDepth) {
    const behind = clamp(-rotorDepth * 2.8, 0, 1);
    const alignment = clamp(1 - Math.abs(rotorX - pivotX) / Math.max(diskRx * 1.15, 1), 0, 1);
    return behind * alignment;
  }

  function drawGyroVerticalPost(ctx, pivotX, pivotY, axisLength, emphasis = 1, opacity = 1) {
    ctx.save();
    ctx.globalAlpha = opacity;
    const postGradient = ctx.createLinearGradient(pivotX - 10, pivotY + 66, pivotX + 14, pivotY - axisLength);
    postGradient.addColorStop(0, emphasis > 1 ? "#334155" : "#64748b");
    postGradient.addColorStop(0.45, emphasis > 1 ? "#f8fafc" : "#cbd5e1");
    postGradient.addColorStop(1, emphasis > 1 ? "#1f2937" : "#475569");
    ctx.strokeStyle = postGradient;
    ctx.lineWidth = 8 * emphasis;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY + 74);
    ctx.lineTo(pivotX, pivotY - axisLength * 0.92);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.48)";
    ctx.lineWidth = 2.2 * emphasis;
    ctx.beginPath();
    ctx.moveTo(pivotX - 2, pivotY + 56);
    ctx.lineTo(pivotX - 2, pivotY - axisLength * 0.82);
    ctx.stroke();
    ctx.lineCap = "butt";
    ctx.restore();
  }

  function drawGyroAngleLabels(ctx, pivotX, pivotY, rotorX, rotorY, theta, phi, axisLength, tiltDepth, orbitRx, orbitRy) {
    const verticalTop = pivotY - axisLength * 0.54;
    const orbitY = pivotY - axisLength * 0.52 * tiltDepth;
    const phiAngle = positiveAngle(phi);
    const projectionX = pivotX + Math.cos(phiAngle) * orbitRx;
    const projectionY = orbitY + Math.sin(phiAngle) * orbitRy;
    ctx.strokeStyle = "rgba(37, 99, 235, 0.45)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 48, -Math.PI / 2, -Math.PI / 2 + clamp(theta, 0, Math.PI) * 0.55, false);
    ctx.stroke();
    ctx.fillStyle = "#2563eb";
    ctx.font = "13px Arial";
    ctx.fillText("\u03b8", pivotX + 34, pivotY - 38);

    ctx.strokeStyle = "rgba(124, 58, 237, 0.34)";
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(pivotX, orbitY);
    ctx.lineTo(pivotX + Math.max(orbitRx, 28), orbitY);
    ctx.moveTo(pivotX, orbitY);
    ctx.lineTo(projectionX, projectionY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#7c3aed";
    ctx.beginPath();
    ctx.arc(projectionX, projectionY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#7c3aed";
    ctx.lineWidth = 1.8;
    drawEllipseAngleArc(ctx, pivotX, orbitY, Math.max(orbitRx * 0.36, 24), Math.max(orbitRy * 0.36, 9), 0, phiAngle);
    ctx.fillStyle = "#7c3aed";
    const phiLabelX = pivotX + Math.cos(phiAngle * 0.5) * Math.max(orbitRx * 0.44, 34);
    const phiLabelY = orbitY + Math.sin(phiAngle * 0.5) * Math.max(orbitRy * 0.44, 12);
    ctx.fillText("\u03c6", phiLabelX + 6, phiLabelY - 4);

    ctx.strokeStyle = "rgba(22, 163, 74, 0.4)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(rotorX, rotorY);
    ctx.stroke();
    ctx.fillStyle = "#16a34a";
    ctx.fillText("body axis", (pivotX + rotorX) / 2 + 8, (pivotY + rotorY) / 2 - 8);
    ctx.fillStyle = "#64748b";
    ctx.fillText("vertical", pivotX + 8, verticalTop + 18);
  }

  function drawEllipseAngleArc(ctx, centerX, centerY, rx, ry, startAngle, endAngle) {
    const steps = Math.max(8, Math.ceil(Math.abs(endAngle - startAngle) / 0.08));
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const fraction = i / steps;
      const angle = startAngle + (endAngle - startAngle) * fraction;
      const x = centerX + Math.cos(angle) * rx;
      const y = centerY + Math.sin(angle) * ry;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawRateCircularArrow(ctx, centerX, centerY, radius, centerAngle, value, range, color, label, maxSpan = 1.25) {
    const scale = Math.abs(normalizedRateValue(value, range));
    const span = maxSpan * scale;
    if (span < 0.02) {
      ctx.fillStyle = color;
      ctx.font = "12px Arial";
      ctx.fillText(label, centerX + radius + 6, centerY);
      return;
    }
    const signedSpan = Math.sign(value || 1) * span;
    drawCircularArrow(ctx, centerX, centerY, radius, centerAngle - signedSpan * 0.5, centerAngle + signedSpan * 0.5, color, label);
  }

  function drawGyroRatePanel(ctx, width, height, model, state, rates) {
    const panelX = width * 0.68;
    const panelY = height * 0.58;
    const panelW = 206;
    const panelH = 120;
    const ranges = gyroRateRanges(model, state, rates);
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.strokeStyle = "rgba(148, 163, 184, 0.72)";
    ctx.lineWidth = 1;
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeRect(panelX, panelY, panelW, panelH);
    ctx.fillStyle = "#334155";
    ctx.font = "12px Arial";
    ctx.fillText("angular rate ranges", panelX + 10, panelY + 18);
    const thetaDot = state.thetaDot ?? state.v ?? 0;
    drawRateRangeGauge(ctx, panelX + 10, panelY + 38, panelW - 20, "\u03b8'", thetaDot, ranges.thetaDot.min, ranges.thetaDot.max, "#dc2626");
    drawRateRangeGauge(ctx, panelX + 10, panelY + 68, panelW - 20, "\u03c6'", rates.phi, ranges.phi.min, ranges.phi.max, "#2563eb");
    drawRateRangeGauge(ctx, panelX + 10, panelY + 98, panelW - 20, "\u03c8'", rates.psi, ranges.psi.min, ranges.psi.max, "#7c3aed");
  }

  function wilberforceRateRanges(verticalRate, angularRate) {
    if (currentResult?._wilberforceRateRanges) return currentResult._wilberforceRateRanges;
    const points = currentResult?.points || [];
    const zValues = points.map(point => point.v1).filter(Number.isFinite);
    const omegaValues = points.map(point => point.v2).filter(Number.isFinite);
    zValues.push(verticalRate);
    omegaValues.push(angularRate);
    const ranges = {
      z: paddedValueRange(zValues, 1),
      omega: paddedValueRange(omegaValues, 1)
    };
    if (currentResult) currentResult._wilberforceRateRanges = ranges;
    return ranges;
  }

  function gyroRateRanges(model, state, rates) {
    if (currentResult?._gyroRateRanges) return currentResult._gyroRateRanges;
    const points = currentResult?.points || [];
    const thetaDotValues = [];
    const phiDotValues = [];
    const psiDotValues = [];
    points.forEach(point => {
      const pointRates = heavyTopRates(model, point);
      thetaDotValues.push(point.thetaDot ?? point.v ?? 0);
      phiDotValues.push(pointRates.phi);
      psiDotValues.push(pointRates.psi);
    });
    thetaDotValues.push(state.thetaDot ?? state.v ?? 0);
    phiDotValues.push(rates.phi);
    psiDotValues.push(rates.psi);
    const ranges = {
      thetaDot: paddedValueRange(thetaDotValues, 1),
      phi: paddedValueRange(phiDotValues, 1),
      psi: paddedValueRange(psiDotValues, 1)
    };
    if (currentResult) currentResult._gyroRateRanges = ranges;
    return ranges;
  }

  function paddedValueRange(values, fallbackSpan = 1) {
    const finiteValues = values.filter(Number.isFinite);
    const minValue = finiteValues.length ? Math.min(...finiteValues) : -fallbackSpan;
    const maxValue = finiteValues.length ? Math.max(...finiteValues) : fallbackSpan;
    const span = maxValue - minValue;
    const padding = span > 1e-9 ? span * 0.08 : Math.max(Math.abs(maxValue), fallbackSpan) * 0.08;
    return {
      min: minValue - padding,
      max: maxValue + padding
    };
  }

  function normalizedRateValue(value, range) {
    const reference = Math.max(Math.abs(range?.min ?? 0), Math.abs(range?.max ?? 0), 1e-9);
    return clamp(value / reference, -1, 1);
  }

  function drawRateRangeGauge(ctx, x, y, width, label, value, minValue, maxValue, color) {
    const labelW = 38;
    const barX = x + labelW;
    const barW = width - labelW - 44;
    const span = Math.max(maxValue - minValue, 1e-9);
    const fraction = clamp((value - minValue) / span, 0, 1);
    const markerX = barX + fraction * barW;
    ctx.fillStyle = "#0f172a";
    ctx.font = "11px Arial";
    ctx.fillText(label, x, y + 4);
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(barX, y);
    ctx.lineTo(barX + barW, y);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(markerX, y - 6);
    ctx.lineTo(markerX, y + 6);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(markerX, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#64748b";
    ctx.font = "10px Arial";
    ctx.fillText(formatHudNumber(minValue), barX - 2, y + 14);
    ctx.fillText(formatHudNumber(maxValue), barX + barW - 18, y + 14);
    ctx.fillStyle = "#0f172a";
    ctx.font = "11px Arial";
    ctx.fillText(formatHudNumber(value), barX + barW + 8, y + 4);
  }

  function drawSignedRateGauge(ctx, x, y, width, label, value, reference, color) {
    const mid = x + width * 0.5;
    const half = width * 0.34;
    const scaled = clamp(value / Math.max(reference, 1e-6), -1, 1);
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mid - half, y);
    ctx.lineTo(mid + half, y);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(mid, y);
    ctx.lineTo(mid + scaled * half, y);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(mid + scaled * half, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0f172a";
    ctx.font = "12px Arial";
    ctx.fillText(label, x, y + 4);
    ctx.fillText(formatHudNumber(value), mid + half + 8, y + 4);
  }

  function drawGyroRotor3D(ctx, x, y, rx, ry, angle, spin, depth) {
    const shadowAlpha = 0.12 + 0.08 * Math.max(depth, 0);
    ctx.fillStyle = `rgba(15, 23, 42, ${shadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(x + 10, y + 34, rx * 0.9, ry * 0.75, angle, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    const rimGradient = ctx.createLinearGradient(-rx, -ry, rx, ry);
    rimGradient.addColorStop(0, "#f8fafc");
    rimGradient.addColorStop(0.25, "#bae6fd");
    rimGradient.addColorStop(0.62, "#38bdf8");
    rimGradient.addColorStop(1, "#075985");

    ctx.fillStyle = rimGradient;
    ctx.strokeStyle = "#075985";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
    ctx.beginPath();
    ctx.ellipse(-rx * 0.22, -ry * 0.36, rx * 0.42, ry * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(15, 23, 42, 0.18)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * rx * 0.88, Math.sin(a) * ry * 0.88);
      ctx.stroke();
    }

    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.4;
    const markerAngle = spin;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(markerAngle) * rx * 0.9, Math.sin(markerAngle) * ry * 0.9);
    ctx.stroke();
    ctx.fillStyle = "#0f172a";
    ctx.font = "12px Arial";
    ctx.fillText("\u03c8", Math.cos(markerAngle) * rx * 0.72 + 4, Math.sin(markerAngle) * ry * 0.72 - 4);

    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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

  function drawRigidDipole(ctx, width, height, state, model) {
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
    const center = map(state);
    const half = model.dipoleDistance * 0.5 * scale;
    const ux = Math.cos(state.theta);
    const uy = Math.sin(state.theta);
    const plus = { x: center.x + ux * half, y: center.y - uy * half };
    const minus = { x: center.x - ux * half, y: center.y + uy * half };
    const diagnostics = rigidDipoleDiagnostics(model, state);
    const torqueScale = Math.max(Math.abs(model.charge * model.dipoleDistance * Math.hypot(model.electricEx, model.electricEy)), 1e-6);

    drawParticleField(ctx, width, height, model, state);
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(plotLeft, plotTop, plotRight - plotLeft, plotBottom - plotTop);
    drawParticleAxes(ctx, bounds, map, plotLeft, plotRight, plotTop, plotBottom);

    ctx.strokeStyle = "rgba(37, 99, 235, 0.26)";
    ctx.lineWidth = 2;
    drawMappedPath(ctx, points, map);
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 3;
    drawMappedPath(ctx, points.slice(0, Math.max(visibleEnd, 1)), map);

    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(minus.x, minus.y);
    ctx.lineTo(plus.x, plus.y);
    ctx.stroke();
    ctx.lineCap = "butt";

    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(center.x, center.y, 4, 0, Math.PI * 2);
    ctx.fill();
    drawDipoleCharge(ctx, plus.x, plus.y, "+", "#dc2626");
    drawDipoleCharge(ctx, minus.x, minus.y, "-", "#2563eb");
    drawVectorArrow(ctx, center.x, center.y, state.vx, -state.vy, "#334155", "v", 24);
    if (Math.abs(state.omega) > 0.03) {
      const omegaSign = Math.sign(state.omega);
      const omegaSpan = clamp(Math.abs(state.omega) / 2, 0.18, 0.95);
      drawCircularArrow(ctx, center.x, center.y, Math.max(half * 0.42, 18), state.theta - omegaSign * omegaSpan * 0.5, state.theta + omegaSign * omegaSpan * 0.5, "#7c3aed", "\u03c9");
    } else {
      ctx.fillStyle = "#7c3aed";
      ctx.font = "12px Arial";
      ctx.fillText("\u03c9\u22480", center.x + Math.max(half * 0.32, 18), center.y - 12);
    }
    drawTorqueGauge(ctx, width - 114, height - 82, diagnostics.torque / torqueScale);

    const hudX = 14;
    const hudY = 14;
    const hudW = 274;
    const hudH = 122;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.strokeStyle = "rgba(148, 163, 184, 0.8)";
    ctx.lineWidth = 1;
    ctx.fillRect(hudX, hudY, hudW, hudH);
    ctx.strokeRect(hudX, hudY, hudW, hudH);
    ctx.fillStyle = "#0f172a";
    ctx.font = "12px Arial";
    ctx.textAlign = "left";
    const left = hudX + 10;
    const right = hudX + 146;
    const rows = [
      [`x=${formatHudNumber(state.x)}`, `y=${formatHudNumber(state.yPos)}`],
      [`vx=${formatHudNumber(state.vx)}`, `vy=${formatHudNumber(state.vy)}`],
      [`\u03b8=${formatHudNumber(state.theta)}`, `\u03c9=${formatHudNumber(state.omega)}`],
      [`\u03c4=${formatHudNumber(diagnostics.torque)}`, `Bz=${formatHudNumber(model.magneticB)}`],
      [`Ex=${formatHudNumber(model.electricEx)}`, `Ey=${formatHudNumber(model.electricEy)}`]
    ];
    rows.forEach((row, index) => {
      const y = hudY + 24 + index * 20;
      ctx.fillText(row[0], left, y);
      ctx.fillText(row[1], right, y);
    });
  }

  function drawDipoleCharge(ctx, x, y, label, color) {
    ctx.fillStyle = color;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.fillText(label, x, y + 5);
    ctx.textAlign = "start";
  }

  function drawTorqueGauge(ctx, x, y, normalizedTorque) {
    const value = clamp(normalizedTorque, -1, 1);
    ctx.fillStyle = "rgba(255,255,255,0.86)";
    ctx.strokeStyle = "rgba(148, 163, 184, 0.8)";
    ctx.lineWidth = 1;
    ctx.fillRect(x - 42, y - 42, 84, 84);
    ctx.strokeRect(x - 42, y - 42, 84, 84);
    drawCircularArrow(ctx, x, y, 25, -Math.PI / 2, -Math.PI / 2 + value * Math.PI * 1.35, "#f97316", "\u03c4");
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
    if (model.type === "chargedParticle" || model.type === "rigidDipole") {
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
    const objectPad = currentModel?.type === "rigidDipole"
      ? Math.max(currentModel.dipoleDistance * 0.65, 0.5)
      : 0.5;
    const xPad = Math.max((maxX - minX) * 0.08, objectPad);
    const yPad = Math.max((maxY - minY) * 0.08, objectPad);
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

    if (model.type === "rotatingDisk") {
      const inertia = model.inertiaAt(point.t);
      const angularMomentum = inertia * point.v;
      const energy = 0.5 * inertia * point.v * point.v;
      return { kinetic: energy, potential: angularMomentum, total: inertia };
    }

    if (model.type === "spool") {
      const translational = 0.5 * model.mass * point.v * point.v;
      const inertia = model.spoolInertiaK * model.mass * model.spoolRadius * model.spoolRadius;
      const rotational = 0.5 * inertia * (point.omega || point.v / model.spoolRadius) ** 2;
      return { kinetic: translational, potential: rotational, total: translational + rotational };
    }

    if (model.type === "wilberforce") {
      const vertical = 0.5 * model.wilberforceMass * point.v1 * point.v1
        + 0.5 * model.wilberforceKz * point.x1 * point.x1;
      const torsional = 0.5 * model.wilberforceI * point.v2 * point.v2
        + 0.5 * model.wilberforceKt * point.x2 * point.x2;
      const coupling = model.wilberforceCoupling * point.x1 * point.x2;
      return {
        kinetic: vertical,
        potential: torsional,
        total: vertical + torsional + coupling
      };
    }

    if (model.type === "gyroscope") {
      const theta = clamp(point.theta ?? point.y, 0.035, Math.PI - 0.035);
      const thetaDot = point.thetaDot ?? point.v ?? 0;
      const rates = heavyTopRates(model, {
        theta,
        thetaDot,
        phi: point.phi ?? 0,
        psi: point.psi ?? 0
      });
      const sinTheta = Math.sin(theta);
      const kinetic = 0.5 * model.gyroI1 * (thetaDot * thetaDot + rates.phi * rates.phi * sinTheta * sinTheta)
        + 0.5 * model.gyroI3 * rates.spinRate * rates.spinRate;
      const potential = model.gyroMass * model.gyroG * model.gyroD * Math.cos(theta);
      return {
        kinetic,
        potential,
        total: kinetic + potential
      };
    }

    if (model.type === "rigidDipole") {
      const theta = point.theta ?? point.y ?? 0;
      const omega = point.omega ?? point.v ?? 0;
      const translational = 0.5 * model.mass * ((point.vx || 0) * (point.vx || 0) + (point.vy || 0) * (point.vy || 0));
      const rotational = 0.5 * model.dipoleInertia * omega * omega;
      const potential = -model.charge * model.dipoleDistance
        * (Math.cos(theta) * model.electricEx + Math.sin(theta) * model.electricEy);
      return {
        kinetic: translational,
        rotational,
        potential,
        total: translational + rotational + potential
      };
    }

    if (model.mode === "particle2d" || model.mode === "coupled" || model.mode === "wilberforce") {
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
    if (currentModel.mode === "rigidDipole") {
      updateRigidDipoleCursors(t, state);
      return;
    }
    if (currentModel.mode === "rollingBodies") {
      updateRollingBodiesCursors(t, state);
      return;
    }
    if (currentModel.mode === "coupled" || currentModel.mode === "wilberforce") {
      updateCoupledCursors(t, state);
      return;
    }
    if (currentModel.mode === "heavyTop") {
      updateHeavyTopCursors(t, state);
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

  function updateRigidDipoleCursors(t, state) {
    const history = getHistoryUntil(t);
    const timeShape = timeCursorShape(t);
    const timeAnnotation = timeCursorAnnotation(t);
    relayoutIfReady("physicsTimePlot", { shapes: [timeShape], annotations: [timeAnnotation] });
    relayoutIfReady("physicsEnergyPlot", { shapes: [timeShape], annotations: [timeAnnotation] });
    relayoutIfReady("physicsExtraPlot", { shapes: [timeShape], annotations: [timeAnnotation] });
    restyleIfReady("physicsTimePlot", {
      x: [history.t, history.t, history.t],
      y: [history.theta, history.omega, history.torque]
    }, [3, 4, 5]);

    const projectionKey = currentModel.phaseProjection || defaultPhaseProjection(currentModel.type);
    const projection = projectionTrace(currentModel, history.points, projectionKey);
    const currentProjection = projectionPoint(currentModel, state, projectionKey);
    restyleIfReady("physicsPhasePlot", {
      x: [projection.x],
      y: [projection.y]
    }, [1]);
    restyleIfReady("physicsPhasePlot", {
      x: [[currentProjection.x]],
      y: [[currentProjection.y]]
    }, [2]);

    restyleIfReady("physicsEnergyPlot", {
      x: [history.t, history.t, history.t, history.t],
      y: [history.kinetic, history.rotational, history.potential, history.total]
    }, [4, 5, 6, 7]);
    restyleIfReady("physicsExtraPlot", {
      x: [history.x],
      y: [history.yPos]
    }, [1]);
    restyleIfReady("physicsExtraPlot", {
      x: [[state.x]],
      y: [[state.yPos]]
    }, [2]);
  }

  function updateRollingBodiesCursors(t, state) {
    const history = getHistoryUntil(t);
    const timeShape = timeCursorShape(t);
    const timeAnnotation = timeCursorAnnotation(t);
    relayoutIfReady("physicsTimePlot", { shapes: [timeShape], annotations: [timeAnnotation] });
    relayoutIfReady("physicsPhasePlot", { shapes: [timeShape], annotations: [timeAnnotation] });
    relayoutIfReady("physicsExtraPlot", { shapes: [timeShape], annotations: [timeAnnotation] });

    const positions = [];
    const velocities = [];
    const projectionX = [];
    const projectionY = [];
    const projectionSpec = rollingProjectionSpec(currentModel.phaseProjection || defaultPhaseProjection(currentModel.type));
    currentModel.bodies.forEach(body => {
      const cap = capitalizeKey(body.key);
      positions.push(history.points.map(point => Math.min(point[`s${cap}`], currentModel.rollingLength)));
      velocities.push(history.points.map(point => point[`v${cap}`]));
      projectionX.push(history.points.map(point => rollingProjectionValue(point, body, projectionSpec.xKey)));
      projectionY.push(history.points.map(point => rollingProjectionValue(point, body, projectionSpec.yKey)));
    });

    restyleIfReady("physicsTimePlot", {
      x: currentModel.bodies.map(() => history.t),
      y: positions
    }, [3, 4, 5]);
    restyleIfReady("physicsPhasePlot", {
      x: currentModel.bodies.map(() => history.t),
      y: velocities
    }, [3, 4, 5]);
    restyleIfReady("physicsEnergyPlot", {
      x: projectionX,
      y: projectionY
    }, [3, 4, 5]);
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

  function updateHeavyTopCursors(t, state) {
    const history = getHistoryUntil(t);
    const timeShape = timeCursorShape(t);
    const timeAnnotation = timeCursorAnnotation(t);
    relayoutIfReady("physicsTimePlot", { shapes: [timeShape], annotations: [timeAnnotation] });
    relayoutIfReady("physicsEnergyPlot", { shapes: [timeShape], annotations: [timeAnnotation] });
    relayoutIfReady("physicsExtraPlot", { shapes: [timeShape], annotations: [timeAnnotation] });
    restyleIfReady("physicsTimePlot", {
      x: [history.t, history.t, history.t, history.t],
      y: [history.theta, history.thetaDot, history.phi, history.phiDot]
    }, [4, 5, 6, 7]);

    const projectionKey = currentModel.phaseProjection || defaultPhaseProjection(currentModel.type);
    const projection = projectionTrace(currentModel, history.points, projectionKey);
    const currentProjection = projectionPoint(currentModel, state, projectionKey);
    restyleIfReady("physicsPhasePlot", {
      x: [projection.x],
      y: [projection.y]
    }, [1]);
    restyleIfReady("physicsPhasePlot", {
      x: [[currentProjection.x]],
      y: [[currentProjection.y]]
    }, [2]);

    restyleIfReady("physicsEnergyPlot", {
      x: [history.t, history.t, history.t, history.t],
      y: [history.lz, history.l3, history.lPerp, history.lTotal]
    }, [4, 5, 6, 7]);
    restyleIfReady("physicsExtraPlot", {
      x: [history.t, history.t, history.t],
      y: [history.kinetic, history.potential, history.total]
    }, [3, 4, 5]);
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
    const angular = model?.mode === "heavyTop"
      ? visiblePoints.map(point => heavyTopAngularMomentum(model, point))
      : [];
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
      theta: visiblePoints.map(point => point.theta),
      omega: visiblePoints.map(point => point.omega),
      torque: visiblePoints.map(point => point.torque),
      thetaDot: visiblePoints.map(point => point.thetaDot),
      phi: visiblePoints.map(point => point.phi),
      phiDot: visiblePoints.map(point => point.phiDot),
      lz: angular.map(item => item.lz),
      l3: angular.map(item => item.l3),
      lPerp: angular.map(item => item.lPerp),
      lTotal: angular.map(item => item.lTotal),
      kinetic: metrics.map(item => item.kinetic),
      rotational: metrics.map(item => item.rotational),
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

  function positiveAngle(value) {
    if (!isFinite(value)) return 0;
    const fullTurn = Math.PI * 2;
    return ((value % fullTurn) + fullTurn) % fullTurn;
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
