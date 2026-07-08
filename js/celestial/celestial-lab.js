function setupCelestialLab() {
  const canvas = document.getElementById("celestialCanvas");
  if (!canvas) return;

  const controls = {
    scenario: document.getElementById("celestialScenario"),
    method: document.getElementById("celestialMethod"),
    g: document.getElementById("celestialG"),
    h: document.getElementById("celestialH"),
    massA: document.getElementById("celestialMassA"),
    massB: document.getElementById("celestialMassB"),
    semiMajor: document.getElementById("celestialSemiMajor"),
    eccentricity: document.getElementById("celestialEccentricity"),
    timeSpan: document.getElementById("celestialTimeSpan"),
    speed: document.getElementById("celestialSpeed"),
    collisionMode: document.getElementById("celestialCollisionMode"),
    bodySelect: document.getElementById("celestialBodySelect"),
    viewFrame: document.getElementById("celestialViewFrame"),
    energyK: document.getElementById("celestialEnergyK"),
    energyU: document.getElementById("celestialEnergyU"),
    energyTotal: document.getElementById("celestialEnergyTotal"),
    energyExchange: document.getElementById("celestialEnergyExchange"),
    energyKBody: document.getElementById("celestialEnergyKBody"),
    energyUPair: document.getElementById("celestialEnergyUPair"),
    energyEShare: document.getElementById("celestialEnergyEShare"),
    angularLx: document.getElementById("celestialAngularLx"),
    angularLy: document.getElementById("celestialAngularLy"),
    angularLz: document.getElementById("celestialAngularLz"),
    angularMag: document.getElementById("celestialAngularMag"),
    inputMode: document.getElementById("celestialInputMode"),
    showRungeLenz: document.getElementById("celestialShowRungeLenz"),
    showKeplerFirst: document.getElementById("celestialShowKeplerFirst"),
    showKeplerSecond: document.getElementById("celestialShowKeplerSecond"),
    keplerSecondPercent: document.getElementById("celestialKeplerSecondPercent"),
    showKeplerThird: document.getElementById("celestialShowKeplerThird"),
    showLagrange: document.getElementById("celestialShowLagrange"),
    showTidalForces: document.getElementById("celestialShowTidalForces"),
    tidalOverlayMode: document.getElementById("celestialTidalOverlayMode"),
    showTidalLocking: document.getElementById("celestialShowTidalLocking"),
    tidalK2: document.getElementById("celestialTidalK2"),
    tidalLag: document.getElementById("celestialTidalLag"),
    tidalInertia: document.getElementById("celestialTidalInertia"),
    showRocheLimit: document.getElementById("celestialShowRocheLimit"),
    rocheMode: document.getElementById("celestialRocheMode"),
    rocheBreakup: document.getElementById("celestialRocheBreakup"),
    rocheMaterial: document.getElementById("celestialRocheMaterial"),
    debrisGravityMode: document.getElementById("celestialDebrisGravityMode"),
    debrisSelfGravityLimit: document.getElementById("celestialDebrisSelfGravityLimit"),
    showTrails: document.getElementById("celestialShowTrails"),
    addPlanetBtn: document.getElementById("celestialAddPlanetBtn"),
    addStarBtn: document.getElementById("celestialAddStarBtn"),
    removeBodyBtn: document.getElementById("celestialRemoveBodyBtn"),
    resetPresetBtn: document.getElementById("celestialResetPresetBtn"),
    bodySummary: document.getElementById("celestialBodySummary"),
    bodyMass: document.getElementById("celestialBodyMass"),
    bodyRadius: document.getElementById("celestialBodyRadius"),
    bodyOrbit: document.getElementById("celestialBodyOrbit"),
    bodyEccentricity: document.getElementById("celestialBodyEccentricity"),
    bodyPhase: document.getElementById("celestialBodyPhase"),
    bodyInclination: document.getElementById("celestialBodyInclination"),
    bodyX: document.getElementById("celestialBodyX"),
    bodyY: document.getElementById("celestialBodyY"),
    bodyZ: document.getElementById("celestialBodyZ"),
    bodyVx: document.getElementById("celestialBodyVx"),
    bodyVy: document.getElementById("celestialBodyVy"),
    bodyVz: document.getElementById("celestialBodyVz"),
    bodySpin: document.getElementById("celestialBodySpin"),
    bodySpinTilt: document.getElementById("celestialBodySpinTilt"),
    slider: document.getElementById("celestialTimeSlider"),
    playBtn: document.getElementById("celestialPlayBtn"),
    timeLabel: document.getElementById("celestialTimeLabel"),
    bufferStatus: document.getElementById("celestialBufferStatus"),
    collisionStatus: document.getElementById("celestialCollisionStatus"),
    equation: document.getElementById("celestialEquation"),
    energy: document.getElementById("celestialMetricEnergy"),
    angularMomentum: document.getElementById("celestialMetricAngularMomentum"),
    metricEccentricity: document.getElementById("celestialMetricEccentricity"),
    rungeLenz: document.getElementById("celestialMetricRungeLenz"),
    keplerStatus: document.getElementById("celestialKeplerStatus"),
    lagrangeStatus: document.getElementById("celestialLagrangeStatus"),
    tidalStatus: document.getElementById("celestialTidalStatus")
  };
  const lagrangePlaceButtons = Array.from(document.querySelectorAll("[data-lagrange-place]"));

  let playing = false;
  let lastFrame = 0;
  let rafId = null;
  let three = null;
  let fallback2d = false;
  let bodies = [];
  let selectedBodyId = null;
  let nextBodyId = 1;
  let syncingBodyEditor = false;
  let activePreset = controls.scenario?.value || "twoBody";
  let playProgress = Number(controls.slider?.value || 0);
  let trajectory = emptyTrajectory();
  let trajectoryBuildToken = 0;
  let plotCursorReady = false;
  let plotCursorState = null;
  let lastStatusPanelUpdate = 0;
  let lastPlotCursorUpdate = 0;
  let tidalOverlayScaleCache = { key: "", maxDelta: 0, maxAcross: 0 };

  function emptyTrajectory() {
    return {
      signature: "",
      samples: [],
      totalSteps: 0,
      requestedSteps: 0,
      computedSteps: 0,
      sampleEvery: 1,
      collisionEvents: [],
      rocheEvents: [],
      complete: false
    };
  }

  function numberValue(input, fallback) {
    if (!input || input.value === "" || input.value == null) return fallback;
    const value = Number(input.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function readModel() {
    const g = Math.max(0.001, numberValue(controls.g, 1));
    const h = Math.max(0.0005, numberValue(controls.h, 0.01));
    const massA = Math.max(0.001, numberValue(controls.massA, 10));
    const massB = Math.max(0.001, numberValue(controls.massB, 0.1));
    const semiMajor = Math.max(0.2, numberValue(controls.semiMajor, 3));
    const eccentricity = Math.min(1.2, Math.max(0, numberValue(controls.eccentricity, 0.45)));
    const timeSpan = Math.max(1, numberValue(controls.timeSpan, 30));
    const speed = Math.max(0, numberValue(controls.speed, 1));
    return { g, h, massA, massB, semiMajor, eccentricity, timeSpan, speed };
  }

  function readTidalSpinModel() {
    return {
      k2: Math.max(0, Math.min(1.5, numberValue(controls.tidalK2, 0.3))),
      timeLag: Math.max(0, Math.min(5, numberValue(controls.tidalLag, 0.55))),
      inertiaAlpha: Math.max(0.05, Math.min(1, numberValue(controls.tidalInertia, 0.4)))
    };
  }

  function readRocheBreakupModel() {
    const material = controls.rocheMaterial?.value || "rubble";
    const breakup = Boolean(controls.rocheBreakup?.checked);
    const debrisGravityMode = controls.debrisGravityMode?.value || "collective";
    const selfGravityLimit = Math.max(2, Math.min(80, Math.round(numberValue(controls.debrisSelfGravityLimit, 32))));
    const fragmentCount = material === "rigid" ? 14 : (material === "fluid" ? 26 : 20);
    return {
      enabled: Boolean(controls.showRocheLimit?.checked || breakup),
      breakup,
      material,
      debrisGravityMode,
      selfGravityLimit,
      resilience: material === "rigid" ? 2.4 : (material === "fluid" ? 0.72 : 1.15),
      fragmentCount
    };
  }

  function createBody(type, name, options = {}) {
    const id = `body-${nextBodyId}`;
    nextBodyId += 1;
    return {
      id,
      type,
      name,
      mass: options.mass ?? (type === "star" ? 10 : 0.1),
      radius: options.radius ?? (type === "star" ? 0.42 : 0.18),
      orbit: options.orbit ?? (type === "star" ? 0 : 3),
      phase: options.phase ?? 0,
      inclination: options.inclination ?? 0,
      eccentricity: options.eccentricity,
      x: options.x ?? 0,
      y: options.y ?? 0,
      z: options.z ?? 0,
      vx: options.vx ?? 0,
      vy: options.vy ?? 0,
      vz: options.vz ?? 0,
      spin: options.spin ?? (type === "star" ? 0.35 : 1),
      spinTilt: options.spinTilt ?? 0,
      texture: options.texture ?? (type === "star" ? "star" : "jupiter"),
      role: options.role ?? "body",
      lagrangePoint: options.lagrangePoint ?? null
    };
  }

  function coOrbitalPresetBodies(model, variant) {
    const g = Math.max(0.001, model.g);
    const starMass = Math.max(6, model.massA);
    const defaultPlanetMass = Math.min(Math.max(0.04, model.massB), starMass * 0.012);
    const planetMass = variant === "horseshoe" ? starMass * 0.001 : defaultPlanetMass;
    const totalMass = starMass + planetMass;
    const distance = Math.max(2.4, model.semiMajor);
    const mu = planetMass / totalMass;
    const omega = Math.sqrt((g * totalMass) / Math.pow(distance, 3));
    const orbitVelocity = (position) => ({
      vx: -omega * position.z,
      vy: 0,
      vz: omega * position.x
    });
    const stateFromRotatingLocal = (localX, localY, velocityScale = 1, localVx = 0, localVy = 0) => {
      const position = {
        x: localX * distance,
        y: 0,
        z: localY * distance
      };
      const velocity = orbitVelocity(position);
      return {
        ...position,
        vx: velocity.vx * velocityScale + omega * distance * localVx,
        vy: 0,
        vz: velocity.vz * velocityScale + omega * distance * localVy
      };
    };

    const starPosition = { x: -mu * distance, y: 0, z: 0 };
    const planetPosition = { x: (1 - mu) * distance, y: 0, z: 0 };
    const starVelocity = orbitVelocity(starPosition);
    const planetVelocity = orbitVelocity(planetPosition);
    const stateFromStarCircularLocal = (localRadius, angleDegrees, velocityScale = 1) => {
      const angle = (angleDegrees * Math.PI) / 180;
      const position = {
        x: localRadius * Math.cos(angle) * distance,
        y: 0,
        z: localRadius * Math.sin(angle) * distance
      };
      const fromStar = subVec(position, starPosition);
      const fromStarDistance = Math.max(1e-9, normVec(fromStar));
      const speed = Math.sqrt((g * starMass) / fromStarDistance) * velocityScale;
      return {
        ...position,
        vx: starVelocity.vx - (fromStar.z / fromStarDistance) * speed,
        vy: 0,
        vz: starVelocity.vz + (fromStar.x / fromStarDistance) * speed
      };
    };
    const l4 = { x: 0.5 - mu, y: Math.sqrt(3) / 2 };
    const l5 = { x: 0.5 - mu, y: -Math.sqrt(3) / 2 };

    let testState;
    let name;
    let point;
    if (variant === "horseshoe") {
      name = "Horseshoe test body";
      point = "L3";
      testState = stateFromStarCircularLocal(0.98, -25, 1.002);
    } else if (variant === "wideCoOrbital") {
      name = "Wide co-orbital loop test body";
      point = "L3";
      testState = stateFromRotatingLocal(-0.9033, -0.0178, 1, 0.026, -0.037);
    } else {
      const base = variant === "tadpoleL5" ? l5 : l4;
      const sign = variant === "tadpoleL5" ? -1 : 1;
      name = variant === "tadpoleL5" ? "L5 tadpole test body" : "L4 tadpole test body";
      point = variant === "tadpoleL5" ? "L5" : "L4";
      testState = stateFromRotatingLocal(base.x - 0.06, base.y + sign * 0.04, 1);
    }

    return [
      createBody("star", "Central star", {
        mass: starMass,
        radius: 0.42,
        orbit: 0,
        x: starPosition.x,
        y: starPosition.y,
        z: starPosition.z,
        vx: starVelocity.vx,
        vy: starVelocity.vy,
        vz: starVelocity.vz
      }),
      createBody("planet", "Co-orbital planet", {
        mass: planetMass,
        radius: 0.14,
        orbit: distance,
        phase: 0,
        eccentricity: 0,
        texture: "jupiter",
        x: planetPosition.x,
        y: planetPosition.y,
        z: planetPosition.z,
        vx: planetVelocity.vx,
        vy: planetVelocity.vy,
        vz: planetVelocity.vz
      }),
      createBody("planet", name, {
        mass: Math.max(0.00001, planetMass * 0.0001),
        radius: 0.055,
        orbit: distance,
        phase: point === "L5" ? 5 / 6 : 1 / 2,
        eccentricity: 0,
        texture: "mars",
        role: "lagrange-test",
        lagrangePoint: point,
        ...testState
      })
    ];
  }

  function scenarioUsesDirectState(scenario) {
    return scenario === "tadpoleL4"
      || scenario === "tadpoleL5"
      || scenario === "horseshoe"
      || scenario === "wideCoOrbital";
  }

  function currentPresetScenario() {
    return controls.scenario?.value === "custom" ? activePreset : (controls.scenario?.value || activePreset);
  }

  function isTidalScenario(scenario) {
    return scenario === "tidalStress" || scenario === "tidalEccentric" || scenario === "tidalLocking";
  }

  function markCustomSystem() {
    if (!controls.scenario || controls.scenario.value === "custom") return;
    activePreset = currentPresetScenario();
    controls.scenario.value = "custom";
  }

  function stopPlayback() {
    playing = false;
    lastFrame = 0;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (controls.playBtn) controls.playBtn.textContent = "Play";
  }

  function applyScenarioSuggestions(scenario) {
    if (controls.showTidalForces) controls.showTidalForces.checked = false;
    if (controls.showTidalLocking) controls.showTidalLocking.checked = false;
    if (controls.showRocheLimit) controls.showRocheLimit.checked = false;
    if (controls.rocheBreakup) controls.rocheBreakup.checked = false;
    if (scenarioUsesDirectState(scenario)) {
      if (controls.inputMode) controls.inputMode.value = "state";
      if (controls.viewFrame) controls.viewFrame.value = "rotatingPair";
      if (controls.showLagrange) controls.showLagrange.checked = true;
      if (controls.showTrails) controls.showTrails.checked = true;
      if (controls.speed) controls.speed.value = "1.5";
      if (controls.timeSpan) controls.timeSpan.value = scenario === "horseshoe" ? "420" : "180";
      if (controls.h) controls.h.value = "0.01";
      if (controls.energyK) controls.energyK.checked = true;
      if (controls.energyU) controls.energyU.checked = true;
      if (controls.energyTotal) controls.energyTotal.checked = true;
      return;
    }

    if (controls.showLagrange) controls.showLagrange.checked = false;
    if (isTidalScenario(scenario)) {
      if (controls.inputMode) controls.inputMode.value = "orbit";
      if (controls.viewFrame) controls.viewFrame.value = "rotatingPair";
      if (controls.showTidalForces) controls.showTidalForces.checked = true;
      if (controls.tidalOverlayMode) controls.tidalOverlayMode.value = "both";
      if (controls.showTidalLocking) controls.showTidalLocking.checked = scenario === "tidalLocking";
      if (controls.showTrails) controls.showTrails.checked = true;
      if (controls.speed) controls.speed.value = "0.8";
      if (controls.timeSpan) controls.timeSpan.value = scenario === "tidalEccentric" ? "42" : "24";
      if (controls.h) controls.h.value = "0.004";
      if (controls.energyK) controls.energyK.checked = true;
      if (controls.energyU) controls.energyU.checked = true;
      if (controls.energyTotal) controls.energyTotal.checked = true;
      return;
    }
    if (scenario === "twoBody") {
      if (controls.inputMode) controls.inputMode.value = "orbit";
      if (controls.viewFrame) controls.viewFrame.value = "inertial";
      if (controls.speed) controls.speed.value = "1";
      if (controls.timeSpan) controls.timeSpan.value = "30";
      if (controls.h) controls.h.value = "0.01";
    } else {
      if (controls.inputMode) controls.inputMode.value = "state";
      if (controls.viewFrame) controls.viewFrame.value = scenario === "binary" ? "barycenter" : "inertial";
      if (controls.speed) controls.speed.value = "1";
      if (controls.timeSpan) controls.timeSpan.value = scenario === "binary" ? "45" : "60";
      if (controls.h) controls.h.value = "0.01";
    }
  }

  function tidalPresetBodies(model, variant) {
    const planetMass = Math.max(4, model.massA * 0.4);
    const moonMass = Math.max(0.035, Math.min(0.12, model.massB * 0.4));
    const eccentric = variant === "tidalEccentric" ? 0.46 : 0;
    const semiMajor = variant === "tidalEccentric"
      ? Math.max(2.05, Math.min(2.8, model.semiMajor * 0.72))
      : Math.max(1.55, Math.min(2.2, model.semiMajor * 0.55));
    const distance = semiMajor * (1 - eccentric);
    const totalMass = planetMass + moonMass;
    const mu = Math.max(0.0001, model.g * totalMass);
    const relativeSpeed = Math.sqrt(mu * (2 / Math.max(distance, 1e-9) - 1 / Math.max(semiMajor, 1e-9)));
    const planetX = -distance * moonMass / totalMass;
    const moonX = distance * planetMass / totalMass;
    const planetVz = -relativeSpeed * moonMass / totalMass;
    const moonVz = relativeSpeed * planetMass / totalMass;
    const moonSpin = variant === "tidalLocking" ? 3.2 : (variant === "tidalEccentric" ? 1.35 : 1.8);
    const planetName = variant === "tidalLocking" ? "Angular-momentum planet" : "Tide-raising planet";
    const moonName = variant === "tidalEccentric" ? "Eccentric moon" : (variant === "tidalLocking" ? "Fast-spinning moon" : "Stretched moon");
    return [
      createBody("planet", planetName, {
        mass: planetMass,
        radius: 0.42,
        orbit: 0,
        texture: "jupiter",
        x: planetX,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: planetVz,
        spin: 0.45,
        spinTilt: 4
      }),
      createBody("planet", moonName, {
        mass: moonMass,
        radius: 0.18,
        orbit: semiMajor,
        phase: 0,
        eccentricity: eccentric,
        texture: "mars",
        x: moonX,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: moonVz,
        spin: moonSpin,
        spinTilt: -8
      })
    ];
  }

  function presetBodiesForScenario(scenario, model) {
    if (scenario === "tadpoleL4" || scenario === "tadpoleL5" || scenario === "horseshoe" || scenario === "wideCoOrbital") {
      return coOrbitalPresetBodies(model, scenario);
    }

    if (scenario === "tidalStress" || scenario === "tidalEccentric" || scenario === "tidalLocking") {
      return tidalPresetBodies(model, scenario);
    }

    if (scenario === "binary") {
      return [
        createBody("star", "Star A", { mass: 8, radius: 0.36, orbit: 0.72, phase: 0, eccentricity: 0 }),
        createBody("star", "Star B", { mass: 6, radius: 0.31, orbit: 1.36, phase: 0.5, eccentricity: 0 })
      ];
    }

    if (scenario === "threeBody") {
      return [
        createBody("star", "Primary", { mass: model.massA, radius: 0.38, orbit: 0 }),
        createBody("planet", "Inner planet", {
          mass: model.massB,
          radius: 0.17,
          orbit: Math.max(1.5, model.semiMajor * 0.72),
          phase: 0.04,
          inclination: 0,
          eccentricity: Math.min(model.eccentricity, 0.55),
          texture: "mars"
        }),
        createBody("planet", "Outer planet", {
          mass: model.massB * 1.8,
          radius: 0.21,
          orbit: Math.max(2.4, model.semiMajor * 1.2),
          phase: 0.42,
          inclination: 7,
          eccentricity: model.eccentricity,
          texture: "jupiter"
        })
      ];
    }

    return [
      createBody("star", "Central star", { mass: model.massA, radius: 0.42, orbit: 0 }),
      createBody("planet", "Kepler planet", {
        mass: model.massB,
        radius: 0.18,
        orbit: model.semiMajor,
        phase: 0,
        inclination: 0,
        eccentricity: model.eccentricity,
        texture: "jupiter"
      })
    ];
  }

  function resetBodiesFromScenario() {
    stopPlayback();
    const scenario = currentPresetScenario();
    activePreset = scenario;
    if (controls.scenario) controls.scenario.value = scenario;
    if (controls.slider) controls.slider.value = "0";
    playProgress = 0;
    if (controls.collisionMode) controls.collisionMode.value = "detect";
    applyScenarioSuggestions(scenario);
    bodies = presetBodiesForScenario(scenario, readModel());
    if (!scenarioUsesDirectState(scenario)) syncStatesFromOrbitalElements();
    selectedBodyId = bodies.find((body) => body.role === "lagrange-test")?.id || bodies[1]?.id || bodies[0]?.id || null;
    syncBodySelect();
    syncBodyEditor();
    if (three) {
      three.bodyMeshSignature = "";
      rebuildBodyMeshes();
    }
  }

  function ensureBodies() {
    if (!bodies.length) resetBodiesFromScenario();
  }

  function selectedBody() {
    return bodies.find((body) => body.id === selectedBodyId) || bodies[0] || null;
  }

  function syncBodySelect() {
    if (!controls.bodySelect) return;
    const current = selectedBodyId || controls.bodySelect.value;
    controls.bodySelect.innerHTML = "";
    bodies.forEach((body) => {
      const option = document.createElement("option");
      option.value = body.id;
      option.textContent = body.name;
      controls.bodySelect.appendChild(option);
    });
    selectedBodyId = bodies.some((body) => body.id === current) ? current : (bodies[0]?.id || null);
    controls.bodySelect.value = selectedBodyId || "";
  }

  function syncBodyEditor() {
    const body = selectedBody();
    if (!body) return;
    syncingBodyEditor = true;
    controls.bodyMass.value = body.mass;
    controls.bodyRadius.value = body.radius;
    controls.bodyOrbit.value = body.orbit;
    controls.bodyEccentricity.value = body.eccentricity ?? 0;
    controls.bodyPhase.value = body.phase;
    controls.bodyInclination.value = body.inclination;
    controls.bodyX.value = body.x;
    controls.bodyY.value = body.y;
    controls.bodyZ.value = body.z;
    controls.bodyVx.value = body.vx;
    controls.bodyVy.value = body.vy;
    controls.bodyVz.value = body.vz;
    controls.bodySpin.value = body.spin;
    controls.bodySpinTilt.value = body.spinTilt;
    syncingBodyEditor = false;
    updateBodySummary();
    syncInputModeUi();
  }

  function updateBodySummary() {
    const body = selectedBody();
    if (!controls.bodySummary || !body) return;
    controls.bodySummary.textContent = [
      `selected: ${body.name}`,
      `type: ${body.type}`,
      `m=${Number(body.mass).toFixed(3)}`,
      `R=${Number(body.radius).toFixed(3)}`,
      `r=(${Number(body.x).toFixed(2)}, ${Number(body.y).toFixed(2)}, ${Number(body.z).toFixed(2)})`,
      `v=(${Number(body.vx).toFixed(2)}, ${Number(body.vy).toFixed(2)}, ${Number(body.vz).toFixed(2)})`,
      `spin=${Number(body.spin).toFixed(2)}`
    ].join(" · ");
  }

  function syncInputModeUi() {
    const editor = document.querySelector(".celestial-body-editor");
    if (!editor || !controls.inputMode) return;
    const orbitOption = Array.from(controls.inputMode.options).find((option) => option.value === "orbit");
    const twoBodyMode = bodies.length === 2;
    if (orbitOption) orbitOption.disabled = !twoBodyMode;
    controls.inputMode.disabled = !twoBodyMode;
    if (!twoBodyMode) controls.inputMode.value = "state";
    editor.dataset.mode = controls.inputMode.value || "state";
    if (controls.showRungeLenz) {
      controls.showRungeLenz.disabled = !twoBodyMode;
      if (!twoBodyMode) controls.showRungeLenz.checked = false;
    }
    [controls.showKeplerFirst, controls.showKeplerSecond].forEach((control) => {
      if (!control) return;
      control.disabled = !twoBodyMode;
      if (!twoBodyMode) control.checked = false;
    });
    if (controls.keplerSecondPercent) {
      controls.keplerSecondPercent.disabled = !twoBodyMode;
    }
    if (controls.showKeplerThird) {
      const applicable = keplerThirdApplicability().ok;
      controls.showKeplerThird.disabled = !applicable;
      if (!applicable) controls.showKeplerThird.checked = false;
    }
    if (controls.showLagrange) {
      controls.showLagrange.disabled = bodies.length < 2;
      if (bodies.length < 2) controls.showLagrange.checked = false;
    }
    if (controls.showTidalForces) {
      controls.showTidalForces.disabled = bodies.length < 2;
      if (bodies.length < 2) controls.showTidalForces.checked = false;
    }
    if (controls.tidalOverlayMode) {
      controls.tidalOverlayMode.disabled = bodies.length < 2;
    }
    if (controls.showTidalLocking) {
      controls.showTidalLocking.disabled = bodies.length < 2;
      if (bodies.length < 2) controls.showTidalLocking.checked = false;
    }
    if (controls.showRocheLimit) {
      controls.showRocheLimit.disabled = bodies.length < 2;
      if (bodies.length < 2) controls.showRocheLimit.checked = false;
    }
    if (controls.rocheMode) {
      controls.rocheMode.disabled = bodies.length < 2;
    }
    if (controls.rocheBreakup) {
      controls.rocheBreakup.disabled = bodies.length < 2;
      if (bodies.length < 2) controls.rocheBreakup.checked = false;
    }
    if (controls.rocheMaterial) {
      controls.rocheMaterial.disabled = bodies.length < 2;
    }
    if (controls.debrisGravityMode) {
      controls.debrisGravityMode.disabled = bodies.length < 2;
    }
    if (controls.debrisSelfGravityLimit) {
      controls.debrisSelfGravityLimit.disabled = bodies.length < 2 || controls.debrisGravityMode?.value !== "self";
    }
    const spinOrbitEnabled = bodies.length >= 2 && Boolean(controls.showTidalLocking?.checked);
    [controls.tidalK2, controls.tidalLag, controls.tidalInertia].forEach((control) => {
      if (control) control.disabled = !spinOrbitEnabled;
    });
    lagrangePlaceButtons.forEach((button) => {
      button.disabled = bodies.length < 2;
    });
    updateLagrangePlaceButtons();
  }

  function updateCapabilityControls() {
    syncInputModeUi();
    updateCelestialEquation();
  }

  function celestialEquationMarkup(lines, params = [], notes = []) {
    const lineMarkup = lines.map((line) => `<div class="equation-line">\\(${line}\\)</div>`).join("");
    const paramMarkup = params.length
      ? `<div class="equation-params">${params.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
      : "";
    const notesMarkup = notes.length
      ? `<div class="equation-notes">${notes.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
      : "";
    return `${lineMarkup}${paramMarkup}${notesMarkup}`;
  }

  function updateCelestialEquation() {
    if (!controls.equation) return;
    const rocheModel = readRocheBreakupModel();
    const lines = [
      "\\dot{\\mathbf r}_i=\\mathbf v_i,\\quad \\dot{\\mathbf v}_i=\\sum_{j\\ne i}Gm_j{\\mathbf r_j-\\mathbf r_i\\over (|\\mathbf r_j-\\mathbf r_i|^2+\\epsilon^2)^{3/2}}"
    ];
    const params = ["compact bodies: mutual Newtonian gravity"];
    const notes = [];
    if (controls.showTidalForces?.checked || controls.showRocheLimit?.checked || controls.rocheBreakup?.checked) {
      lines.push("\\Delta\\mathbf a(\\mathbf x)=\\mathbf a(\\mathbf r_i+\\mathbf x)-\\mathbf a(\\mathbf r_i),\\quad \\Delta a_{NF}=|\\Delta\\mathbf a(+R\\hat{\\mathbf s})-\\Delta\\mathbf a(-R\\hat{\\mathbf s})|");
      params.push("tidal field: differential acceleration across selected body");
    }
    if (controls.showTidalLocking?.checked) {
      lines.push("I=\\alpha mR^2,\\quad \\dot\\omega={\\tau\\over I},\\quad \\dot L_{orb}=-\\tau,\\quad \\dot E_{heat}=-(\\dot E_{spin}+\\dot E_{orb})");
      params.push(`spin-orbit: k2=${readTidalSpinModel().k2.toFixed(2)}, lag=${readTidalSpinModel().timeLag.toFixed(2)}`);
    }
    if (controls.showRocheLimit?.checked || controls.rocheBreakup?.checked) {
      lines.push("R_{fluid}=2.44R_s\\left({\\rho_s\\over\\rho_t}\\right)^{1/3},\\quad R_{rigid}=1.26R_s\\left({\\rho_s\\over\\rho_t}\\right)^{1/3}");
      lines.push("\\dot D={S(R_{fluid}/d-1,\\,R_{rigid}/d-1,\\,material)\\over t_{dyn}},\\quad t_{dyn}=\\sqrt{R_t^3/(Gm_t)}");
      params.push(`Roche material: ${rocheModel.material}`);
    }
    if (controls.rocheBreakup?.checked) {
      lines.push("\\dot{\\mathbf r}_p=\\mathbf v_p,\\quad \\dot{\\mathbf v}_p=\\sum_jGm_j{\\mathbf r_j-\\mathbf r_p\\over (|\\mathbf r_j-\\mathbf r_p|^2+\\epsilon_d^2)^{3/2}}+\\mathbf a_{debris}");
      if (rocheModel.debrisGravityMode === "self") {
        lines.push("\\mathbf a_{debris,p}=\\sum_{q\\ne p}Gm_q{\\mathbf r_q-\\mathbf r_p\\over (|\\mathbf r_q-\\mathbf r_p|^2+\\epsilon_d^2)^{3/2}}\\quad(N_{frag}\\le n_0)");
        params.push(`debris: fragment N-body if N <= ${rocheModel.selfGravityLimit}`);
      } else if (rocheModel.debrisGravityMode === "collective") {
        lines.push("\\dot{\\mathbf v}_i\\leftarrow\\dot{\\mathbf v}_i+GM_D{\\mathbf R_D-\\mathbf r_i\\over (|\\mathbf R_D-\\mathbf r_i|^2+\\epsilon_d^2)^{3/2}}");
        params.push("debris: collective center-of-mass back-reaction");
      } else {
        params.push("debris: tracer cloud, no back-reaction");
      }
      notes.push("Fragment cloud remains one selectable debris object; individual particles are internal degrees of freedom.");
    }
    controls.equation.innerHTML = celestialEquationMarkup(lines, params, notes);
    if (window.MathJax?.typesetPromise) window.MathJax.typesetPromise([controls.equation]).catch(() => {});
  }

  function updateSelectedBodyFromEditor() {
    if (syncingBodyEditor) return;
    const body = selectedBody();
    if (!body) return;
    markCustomSystem();
    body.mass = Math.max(0.001, numberValue(controls.bodyMass, body.mass));
    body.radius = Math.max(0.03, numberValue(controls.bodyRadius, body.radius));
    if (!controls.inputMode || controls.inputMode.value === "orbit") {
      body.orbit = Math.max(0, numberValue(controls.bodyOrbit, body.orbit));
      body.eccentricity = Math.min(0.95, Math.max(0, numberValue(controls.bodyEccentricity, body.eccentricity ?? 0)));
      body.phase = numberValue(controls.bodyPhase, body.phase);
      body.inclination = numberValue(controls.bodyInclination, body.inclination);
      syncStatesFromOrbitalElements();
    } else {
      body.x = numberValue(controls.bodyX, body.x);
      body.y = numberValue(controls.bodyY, body.y);
      body.z = numberValue(controls.bodyZ, body.z);
      body.vx = numberValue(controls.bodyVx, body.vx);
      body.vy = numberValue(controls.bodyVy, body.vy);
      body.vz = numberValue(controls.bodyVz, body.vz);
      if (bodies.length === 2) syncOrbitFromSelectedState();
    }
    body.spin = numberValue(controls.bodySpin, body.spin);
    body.spinTilt = numberValue(controls.bodySpinTilt, body.spinTilt);
    if (three) three.bodyMeshSignature = "";
    updateBodySummary();
  }

  function addBody(type) {
    markCustomSystem();
    const index = bodies.filter((body) => body.type === type).length + 1;
    const model = readModel();
    const body = createBody(type, type === "star" ? `Star ${index}` : `Planet ${index}`, {
      mass: type === "star" ? model.massA * 0.5 : model.massB,
      radius: type === "star" ? 0.3 : 0.16,
      orbit: type === "star" ? 0.7 + index * 0.22 : model.semiMajor + index * 0.55,
      phase: (index * 0.23) % 1,
      inclination: type === "star" ? 0 : (index % 2 === 0 ? -6 : 6),
      eccentricity: type === "planet" ? model.eccentricity : 0,
      texture: type === "star" ? "star" : (index % 2 === 0 ? "mars" : "jupiter")
    });
    bodies.push(body);
    assignBodyState(body, relativeStateFromOrbit(
      body,
      model,
      Math.max(0.001, bodies.reduce((sum, item) => sum + item.mass, 0) - body.mass)
    ));
    selectedBodyId = body.id;
    syncBodySelect();
    syncBodyEditor();
    if (three) {
      three.bodyMeshSignature = "";
      rebuildBodyMeshes();
    }
    refresh();
  }

  function lagrangeTestBodyIndex(label) {
    return bodies.findIndex((body) => body.role === "lagrange-test" && body.lagrangePoint === label);
  }

  function updateLagrangePlaceButtons() {
    lagrangePlaceButtons.forEach((button) => {
      const label = button.dataset.lagrangePlace;
      button.classList.toggle("is-active", lagrangeTestBodyIndex(label) >= 0);
    });
  }

  function placeTestBodyAtLagrangePoint(label) {
    markCustomSystem();
    const existingIndex = lagrangeTestBodyIndex(label);
    if (existingIndex >= 0) {
      const removedSelected = bodies[existingIndex]?.id === selectedBodyId;
      bodies.splice(existingIndex, 1);
      if (removedSelected) selectedBodyId = bodies[Math.min(existingIndex, bodies.length - 1)]?.id || bodies[0]?.id || null;
      syncBodySelect();
      syncBodyEditor();
      if (three) {
        three.bodyMeshSignature = "";
        rebuildBodyMeshes();
      }
      updateLagrangePlaceButtons();
      refresh();
      return;
    }

    const progress = Number(controls.slider?.value || 0);
    const sample = sampleForProgress(progress);
    const data = lagrangePointsForSample(sample);
    const point = data?.points?.[label];
    if (!point) return;

    sample.bodies.forEach((state, index) => {
      if (bodies[index]) assignBodyState(bodies[index], state);
    });

    const totalMass = bodies.reduce((sum, body) => sum + body.mass, 0);
    const testBody = createBody("planet", `Test body ${label}`, {
      mass: Math.max(0.001, totalMass * 0.00001),
      radius: 0.075,
      orbit: 0,
      phase: 0,
      inclination: 0,
      eccentricity: 0,
      texture: "mars",
      x: point.position.x,
      y: point.position.y,
      z: point.position.z,
      vx: point.velocity.x,
      vy: point.velocity.y,
      vz: point.velocity.z,
      spin: 0.3,
      spinTilt: 0,
      role: "lagrange-test",
      lagrangePoint: label
    });
    bodies.push(testBody);
    selectedBodyId = testBody.id;
    if (controls.inputMode) controls.inputMode.value = "state";
    if (controls.slider) controls.slider.value = "0";
    playProgress = 0;
    syncBodySelect();
    syncBodyEditor();
    updateLagrangePlaceButtons();
    if (three) {
      three.bodyMeshSignature = "";
      rebuildBodyMeshes();
    }
    refresh();
  }

  function removeSelectedBody() {
    if (bodies.length <= 1) return;
    markCustomSystem();
    const index = bodies.findIndex((body) => body.id === selectedBodyId);
    if (index < 0) return;
    bodies.splice(index, 1);
    selectedBodyId = bodies[Math.min(index, bodies.length - 1)]?.id || bodies[0]?.id || null;
    syncBodySelect();
    syncBodyEditor();
    if (three) {
      three.bodyMeshSignature = "";
      rebuildBodyMeshes();
    }
    refresh();
  }

  function vec(x = 0, y = 0, z = 0) {
    return { x, y, z };
  }

  function addVec(a, b) {
    return vec(a.x + b.x, a.y + b.y, a.z + b.z);
  }

  function subVec(a, b) {
    return vec(a.x - b.x, a.y - b.y, a.z - b.z);
  }

  function scaleVec(a, scalar) {
    return vec(a.x * scalar, a.y * scalar, a.z * scalar);
  }

  function dotVec(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  function crossVec(a, b) {
    return vec(
      a.y * b.z - a.z * b.y,
      a.z * b.x - a.x * b.z,
      a.x * b.y - a.y * b.x
    );
  }

  function normVec(a) {
    return Math.hypot(a.x, a.y, a.z);
  }

  function normalizeVec(a, fallback = vec(1, 0, 0)) {
    const length = normVec(a);
    return length > 1e-12 ? scaleVec(a, 1 / length) : fallback;
  }

  function rotateVecAroundAxis(vector, axis, angle) {
    const unit = normalizeVec(axis, vec(0, 1, 0));
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return addVec(
      addVec(scaleVec(vector, cos), scaleVec(crossVec(unit, vector), sin)),
      scaleVec(unit, dotVec(unit, vector) * (1 - cos))
    );
  }

  function bodyState(body) {
    return {
      x: Number(body.x) || 0,
      y: Number(body.y) || 0,
      z: Number(body.z) || 0,
      vx: Number(body.vx) || 0,
      vy: Number(body.vy) || 0,
      vz: Number(body.vz) || 0,
      mass: Math.max(0, Number(body.mass) || 0),
      radius: Math.max(0, Number(body.radius) || 0),
      spinOmega: Number(body.spin) || 0,
      spinPhase: 0,
      tidalHeat: 0,
      rocheDamage: 0,
      active: body.active !== false
    };
  }

  function assignBodyState(body, state) {
    body.x = state.x;
    body.y = state.y;
    body.z = state.z;
    body.vx = state.vx;
    body.vy = state.vy;
    body.vz = state.vz;
  }

  function cloneStates(states) {
    return states.map((state) => ({ ...state }));
  }

  function cloneDebrisFields(fields) {
    return (fields || []).map((field) => ({
      ...field,
      particles: (field.particles || []).map((particle) => ({ ...particle }))
    }));
  }

  function stateMass(state, index) {
    if (!state || state.active === false) return 0;
    return Math.max(0, Number(state.mass ?? bodies[index]?.mass) || 0);
  }

  function stateRadius(state, index) {
    if (!state || state.active === false) return 0;
    return Math.max(0, Number(state.radius ?? bodies[index]?.radius) || 0);
  }

  function stateActive(state, index) {
    return Boolean(state && state.active !== false && stateMass(state, index) > 0 && stateRadius(state, index) >= 0);
  }

  function primaryBody(exceptBody = null) {
    return bodies
      .filter((body) => body !== exceptBody)
      .sort((a, b) => b.mass - a.mass)[0] || bodies[0] || null;
  }

  function relativeStateFromOrbit(body, model, centralMass) {
    const a = Math.max(0.001, Number(body.orbit) || 0);
    if (a <= 0.001) return bodyState(body);
    const e = Math.min(Math.max(Number(body.eccentricity ?? model.eccentricity) || 0, 0), 0.95);
    const eccentricAnomaly = (Number(body.phase) || 0) * Math.PI * 2;
    const b = a * Math.sqrt(Math.max(0, 1 - e * e));
    const denom = Math.max(0.06, 1 - e * Math.cos(eccentricAnomaly));
    const mu = Math.max(0.0001, model.g * Math.max(0.001, centralMass + body.mass));
    const meanMotion = Math.sqrt(mu / Math.pow(a, 3));
    const x = a * (Math.cos(eccentricAnomaly) - e);
    const zFlat = b * Math.sin(eccentricAnomaly);
    const vx = (-a * Math.sin(eccentricAnomaly) * meanMotion) / denom;
    const vzFlat = (b * Math.cos(eccentricAnomaly) * meanMotion) / denom;
    const inc = ((Number(body.inclination) || 0) * Math.PI) / 180;
    return {
      x,
      y: zFlat * Math.sin(inc),
      z: zFlat * Math.cos(inc),
      vx,
      vy: vzFlat * Math.sin(inc),
      vz: vzFlat * Math.cos(inc)
    };
  }

  function syncStatesFromOrbitalElements() {
    if (!bodies.length) return;
    const model = readModel();
    if (bodies.length === 2) {
      const primary = primaryBody();
      const secondary = bodies.find((body) => body !== primary) || bodies[1];
      const rel = relativeStateFromOrbit(secondary, model, primary.mass);
      const totalMass = primary.mass + secondary.mass;
      assignBodyState(primary, {
        x: -rel.x * secondary.mass / totalMass,
        y: -rel.y * secondary.mass / totalMass,
        z: -rel.z * secondary.mass / totalMass,
        vx: -rel.vx * secondary.mass / totalMass,
        vy: -rel.vy * secondary.mass / totalMass,
        vz: -rel.vz * secondary.mass / totalMass
      });
      assignBodyState(secondary, {
        x: rel.x * primary.mass / totalMass,
        y: rel.y * primary.mass / totalMass,
        z: rel.z * primary.mass / totalMass,
        vx: rel.vx * primary.mass / totalMass,
        vy: rel.vy * primary.mass / totalMass,
        vz: rel.vz * primary.mass / totalMass
      });
      return;
    }

    const totalMass = bodies.reduce((sum, body) => sum + body.mass, 0);
    bodies.forEach((body) => {
      if (body.orbit <= 0) {
        assignBodyState(body, { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 });
        return;
      }
      assignBodyState(body, relativeStateFromOrbit(body, model, Math.max(0.001, totalMass - body.mass)));
    });
  }

  function syncOrbitFromSelectedState() {
    const body = selectedBody();
    const primary = primaryBody(body);
    if (!body || !primary || body === primary) return;
    const model = readModel();
    const r = subVec(vec(body.x, body.y, body.z), vec(primary.x, primary.y, primary.z));
    const v = subVec(vec(body.vx, body.vy, body.vz), vec(primary.vx, primary.vy, primary.vz));
    const rNorm = normVec(r);
    if (rNorm < 1e-6) return;
    const mu = model.g * (body.mass + primary.mass);
    const speed2 = dotVec(v, v);
    const specificEnergy = 0.5 * speed2 - mu / rNorm;
    const h = crossVec(r, v);
    const hNorm = normVec(h);
    const eVec = subVec(scaleVec(crossVec(v, h), 1 / Math.max(mu, 1e-9)), scaleVec(r, 1 / rNorm));
    const e = normVec(eVec);
    const a = specificEnergy < -1e-9 ? -mu / (2 * specificEnergy) : rNorm;
    body.orbit = Math.max(0, a);
    body.eccentricity = Math.min(0.95, e);
    body.phase = ((Math.atan2(r.z, r.x) / (Math.PI * 2)) + 1) % 1;
    body.inclination = hNorm > 1e-9
      ? Math.acos(Math.min(1, Math.max(-1, h.y / hNorm))) * 180 / Math.PI - 90
      : 0;
  }

  function closestPairInfo(states) {
    let best = null;
    for (let i = 0; i < states.length; i += 1) {
      if (!stateActive(states[i], i)) continue;
      for (let j = i + 1; j < states.length; j += 1) {
        if (!stateActive(states[j], j)) continue;
        const distance = normVec(subVec(states[j], states[i]));
        const contact = Math.max(1e-6, stateRadius(states[i], i) + stateRadius(states[j], j));
        const ratio = distance / contact;
        if (!best || ratio < best.ratio) {
          best = {
            i,
            j,
            distance,
            contact,
            ratio,
            label: `${bodies[i]?.name || "body"}-${bodies[j]?.name || "body"}`
          };
        }
      }
    }
    return best || { i: -1, j: -1, distance: 0, contact: 1, ratio: Number.NaN, label: "n/a" };
  }

  function collisionPairKey(i, j) {
    return `${Math.min(i, j)}:${Math.max(i, j)}`;
  }

  function collisionEventForPair(states, i, j, t) {
    const bodyA = bodies[i];
    const bodyB = bodies[j];
    if (!bodyA || !bodyB) return null;
    if (!stateActive(states[i], i) || !stateActive(states[j], j)) return null;
    const contact = stateRadius(states[i], i) + stateRadius(states[j], j);
    if (contact <= 0) return null;
    const delta = subVec(states[j], states[i]);
    const distance = normVec(delta);
    if (distance > contact) return null;
    const velocityA = vec(states[i].vx, states[i].vy, states[i].vz);
    const velocityB = vec(states[j].vx, states[j].vy, states[j].vz);
    return {
      t,
      i,
      j,
      key: collisionPairKey(i, j),
      label: `${bodyA.name}-${bodyB.name}`,
      distance,
      contact,
      ratio: distance / Math.max(contact, 1e-9),
      relativeSpeed: normVec(subVec(velocityB, velocityA)),
      position: scaleVec(addVec(states[i], states[j]), 0.5),
      radius: Math.max(stateRadius(states[i], i), stateRadius(states[j], j))
    };
  }

  function recordCollisionEvents(t, states, activePairs) {
    for (let i = 0; i < states.length; i += 1) {
      for (let j = i + 1; j < states.length; j += 1) {
        const key = collisionPairKey(i, j);
        const event = collisionEventForPair(states, i, j, t);
        if (event) {
          if (!activePairs.has(key)) {
            activePairs.add(key);
            trajectory.collisionEvents.push(event);
          }
          continue;
        }
        const bodyA = bodies[i];
        const bodyB = bodies[j];
        if (!bodyA || !bodyB) {
          activePairs.delete(key);
          continue;
        }
        const contact = stateRadius(states[i], i) + stateRadius(states[j], j);
        const distance = normVec(subVec(states[j], states[i]));
        if (contact <= 0 || distance > contact * 1.03) activePairs.delete(key);
      }
    }
  }

  function energyFrameLabel() {
    const frame = controls.viewFrame?.value || "inertial";
    if (frame === "barycenter") return "barycenter frame";
    if (frame === "selected") return "selected body frame";
    if (frame === "rotatingPair") return "rotating pair frame";
    return "inertial frame";
  }

  function baryVelocityForStates(states) {
    let totalMass = 0;
    let momentum = vec(0, 0, 0);
    states.forEach((state, index) => {
      const body = bodies[index];
      if (!body) return;
      const mass = stateMass(state, index);
      if (mass <= 0) return;
      totalMass += mass;
      momentum = addVec(momentum, scaleVec(vec(state.vx, state.vy, state.vz), mass));
    });
    return totalMass > 0 ? scaleVec(momentum, 1 / totalMass) : vec(0, 0, 0);
  }

  function energyVelocityForState(states, index) {
    const state = states[index];
    if (!state) return vec(0, 0, 0);
    const velocity = vec(state.vx, state.vy, state.vz);
    const frame = controls.viewFrame?.value || "inertial";
    if (frame === "selected") {
      const selectedIndex = bodies.findIndex((body) => body.id === selectedBodyId);
      const selectedState = states[selectedIndex];
      return selectedState ? subVec(velocity, vec(selectedState.vx, selectedState.vy, selectedState.vz)) : velocity;
    }
    if (frame === "barycenter") {
      return subVec(velocity, baryVelocityForStates(states));
    }
    if (frame === "rotatingPair") {
      const pair = pairKinematics(makeSample(0, states));
      if (!pair) return velocity;
      const position = vec(state.x, state.y, state.z);
      const relativeVelocity = subVec(velocity, pair.baryVelocity);
      const frameVelocity = crossVec(pair.omegaVector, subVec(position, pair.bary));
      return subVec(relativeVelocity, frameVelocity);
    }
    return velocity;
  }

  function bodyContributionParts(model, states) {
    const parts = states.map((state, index) => {
      const body = bodies[index];
      const mass = stateMass(state, index);
      const velocity = vec(state.vx, state.vy, state.vz);
      const energyVelocity = energyVelocityForState(states, index);
      const angularVector = body && mass > 0
        ? scaleVec(crossVec(vec(state.x, state.y, state.z), velocity), mass)
        : vec(0, 0, 0);
      return {
        kinetic: body && mass > 0 ? 0.5 * mass * dotVec(energyVelocity, energyVelocity) : 0,
        potentialShare: 0,
        angularVector,
        angularMagnitude: normVec(angularVector)
      };
    });

    for (let i = 0; i < states.length; i += 1) {
      if (!stateActive(states[i], i)) continue;
      for (let j = i + 1; j < states.length; j += 1) {
        if (!stateActive(states[j], j)) continue;
        const r = normVec(subVec(states[j], states[i]));
        if (r <= 1e-8) continue;
        const pairPotential = -model.g * stateMass(states[i], i) * stateMass(states[j], j) / r;
        parts[i].potentialShare += pairPotential * 0.5;
        parts[j].potentialShare += pairPotential * 0.5;
      }
    }

    parts.forEach((part) => {
      part.energy = part.kinetic + part.potentialShare;
    });
    return parts;
  }

  function energyVelocityForDebrisParticle(states, particle) {
    const velocity = vec(particle.vx, particle.vy, particle.vz);
    const frame = controls.viewFrame?.value || "inertial";
    if (frame === "selected") {
      const selectedIndex = bodies.findIndex((body) => body.id === selectedBodyId);
      const selectedState = states[selectedIndex];
      return selectedState ? subVec(velocity, vec(selectedState.vx, selectedState.vy, selectedState.vz)) : velocity;
    }
    if (frame === "barycenter") return subVec(velocity, baryVelocityForStates(states));
    if (frame === "rotatingPair") {
      const pair = pairKinematics(makeSample(0, states));
      if (!pair) return velocity;
      const position = vec(particle.x, particle.y, particle.z);
      const relativeVelocity = subVec(velocity, pair.baryVelocity);
      const frameVelocity = crossVec(pair.omegaVector, subVec(position, pair.bary));
      return subVec(relativeVelocity, frameVelocity);
    }
    return velocity;
  }

  function debrisContributionParts(model, sample, states) {
    const parts = states.map(() => ({
      kinetic: 0,
      potentialShare: 0,
      angularVector: vec(0, 0, 0),
      angularMagnitude: 0,
      energy: 0
    }));
    let kinetic = 0;
    let potential = 0;
    let angular = vec(0, 0, 0);
    (sample?.debris || []).forEach((field) => {
      const targetIndex = Math.max(0, Math.min(parts.length - 1, Number(field.targetIndex) || 0));
      const particles = field.particles || [];
      particles.forEach((particle) => {
        const mass = Math.max(0, Number(particle.mass) || 0);
        if (mass <= 0) return;
        const velocity = vec(particle.vx, particle.vy, particle.vz);
        const energyVelocity = energyVelocityForDebrisParticle(states, particle);
        const particleKinetic = 0.5 * mass * dotVec(energyVelocity, energyVelocity);
        const particleAngular = scaleVec(crossVec(vec(particle.x, particle.y, particle.z), velocity), mass);
        kinetic += particleKinetic;
        angular = addVec(angular, particleAngular);
        parts[targetIndex].kinetic += particleKinetic;
        parts[targetIndex].angularVector = addVec(parts[targetIndex].angularVector, particleAngular);

        states.forEach((state, stateIndex) => {
          if (!stateActive(state, stateIndex)) return;
          const r = normVec(subVec(state, particle));
          if (r <= 1e-8) return;
          const pairPotential = -model.g * stateMass(state, stateIndex) * mass / r;
          potential += pairPotential;
          parts[stateIndex].potentialShare += pairPotential * 0.5;
          parts[targetIndex].potentialShare += pairPotential * 0.5;
        });
      });

      if ((field.gravityMode || "tracer") === "self") {
        for (let i = 0; i < particles.length; i += 1) {
          for (let j = i + 1; j < particles.length; j += 1) {
            const massA = Math.max(0, Number(particles[i].mass) || 0);
            const massB = Math.max(0, Number(particles[j].mass) || 0);
            if (massA <= 0 || massB <= 0) continue;
            const r = normVec(subVec(particles[j], particles[i]));
            if (r <= 1e-8) continue;
            const pairPotential = -model.g * massA * massB / r;
            potential += pairPotential;
            parts[targetIndex].potentialShare += pairPotential;
          }
        }
      }
    });
    parts.forEach((part) => {
      part.angularMagnitude = normVec(part.angularVector);
      part.energy = part.kinetic + part.potentialShare;
    });
    return { kinetic, potential, angularVector: angular, parts };
  }

  function computeMetrics(model, sample = null) {
    const states = sample ? sample.bodies : bodies.map(bodyState);
    let kinetic = 0;
    let potential = 0;
    let angular = vec(0, 0, 0);

    states.forEach((state, index) => {
      const body = bodies[index];
      if (!body) return;
      const mass = stateMass(state, index);
      if (mass <= 0) return;
      const velocity = vec(state.vx, state.vy, state.vz);
      const energyVelocity = energyVelocityForState(states, index);
      kinetic += 0.5 * mass * dotVec(energyVelocity, energyVelocity);
      angular = addVec(
        angular,
        scaleVec(crossVec(vec(state.x, state.y, state.z), velocity), mass)
      );
    });

    for (let i = 0; i < states.length; i += 1) {
      if (!stateActive(states[i], i)) continue;
      for (let j = i + 1; j < states.length; j += 1) {
        if (!stateActive(states[j], j)) continue;
        const r = normVec(subVec(states[j], states[i]));
      if (r > 1e-8) potential -= model.g * stateMass(states[i], i) * stateMass(states[j], j) / r;
      }
    }
    const bodyContributions = bodyContributionParts(model, states);
    const debrisContributions = sample ? debrisContributionParts(model, sample, states) : null;
    if (debrisContributions) {
      kinetic += debrisContributions.kinetic;
      potential += debrisContributions.potential;
      angular = addVec(angular, debrisContributions.angularVector);
      bodyContributions.forEach((part, index) => {
        const debrisPart = debrisContributions.parts[index];
        if (!debrisPart) return;
        part.kinetic += debrisPart.kinetic;
        part.potentialShare += debrisPart.potentialShare;
        part.angularVector = addVec(part.angularVector, debrisPart.angularVector);
        part.angularMagnitude = normVec(part.angularVector);
        part.energy = part.kinetic + part.potentialShare;
      });
    }

    const metrics = {
      energy: kinetic + potential,
      kinetic,
      potential,
      angularMomentum: normVec(angular),
      angularVector: angular,
      eccentricity: null,
      semiMajor: null,
      rungeLenz: null,
      rungeLenzVector: vec(0, 0, 0),
      closestPair: closestPairInfo(states),
      bodyContributions
    };

    if (states.length === 2 && bodies.length === 2 && stateActive(states[0], 0) && stateActive(states[1], 1)) {
      const r = subVec(states[1], states[0]);
      const v = subVec(
        vec(states[1].vx, states[1].vy, states[1].vz),
        vec(states[0].vx, states[0].vy, states[0].vz)
      );
      const rNorm = normVec(r);
      const mu = model.g * (bodies[0].mass + bodies[1].mass);
      if (rNorm > 1e-8 && mu > 1e-9) {
        const h = crossVec(r, v);
        const eVec = subVec(scaleVec(crossVec(v, h), 1 / mu), scaleVec(r, 1 / rNorm));
        const specificEnergy = 0.5 * dotVec(v, v) - mu / rNorm;
        metrics.eccentricity = normVec(eVec);
        metrics.semiMajor = specificEnergy < -1e-9 ? -mu / (2 * specificEnergy) : null;
        metrics.rungeLenz = metrics.eccentricity;
        metrics.rungeLenzVector = eVec;
      }
    }

    return metrics;
  }

  function makeTrajectorySignature(model) {
    const tidalSpin = readTidalSpinModel();
    return JSON.stringify({
      g: model.g,
      h: model.h,
      timeSpan: model.timeSpan,
      method: controls.method.value,
      collisionMode: controls.collisionMode?.value || "detect",
      tidalLocking: Boolean(controls.showTidalLocking?.checked),
      tidalK2: tidalSpin.k2,
      tidalLag: tidalSpin.timeLag,
      tidalInertia: tidalSpin.inertiaAlpha,
      rocheVisible: Boolean(controls.showRocheLimit?.checked),
      rocheBreakup: Boolean(controls.rocheBreakup?.checked),
      rocheMaterial: controls.rocheMaterial?.value || "rubble",
      debrisGravityMode: controls.debrisGravityMode?.value || "collective",
      debrisSelfGravityLimit: numberValue(controls.debrisSelfGravityLimit, 32),
      selectedBodyId,
      bodies: bodies.map((body) => ({
        id: body.id,
        mass: body.mass,
        x: body.x,
        y: body.y,
        z: body.z,
        vx: body.vx,
        vy: body.vy,
        vz: body.vz,
        spin: body.spin,
        radius: body.radius
      }))
    });
  }

  function makeSample(t, states, debrisFields = []) {
    return {
      t,
      bodies: cloneStates(states),
      debris: cloneDebrisFields(debrisFields)
    };
  }

  function accelerationsFor(states, model) {
    const accelerations = states.map(() => vec(0, 0, 0));
    for (let i = 0; i < states.length; i += 1) {
      if (!stateActive(states[i], i)) continue;
      for (let j = i + 1; j < states.length; j += 1) {
        if (!stateActive(states[j], j)) continue;
        const massI = stateMass(states[i], i);
        const massJ = stateMass(states[j], j);
        const dx = states[j].x - states[i].x;
        const dy = states[j].y - states[i].y;
        const dz = states[j].z - states[i].z;
        const r2 = dx * dx + dy * dy + dz * dz + 1e-6;
        const invR3 = 1 / Math.pow(r2, 1.5);
        const scale = model.g * invR3;
        accelerations[i].x += scale * massJ * dx;
        accelerations[i].y += scale * massJ * dy;
        accelerations[i].z += scale * massJ * dz;
        accelerations[j].x -= scale * massI * dx;
        accelerations[j].y -= scale * massI * dy;
        accelerations[j].z -= scale * massI * dz;
      }
    }
    return accelerations;
  }

  function externalAccelerationAt(position, states, model, excludeIndex = -1) {
    let acceleration = vec(0, 0, 0);
    states.forEach((state, index) => {
      if (index === excludeIndex || !stateActive(state, index)) return;
      const mass = stateMass(state, index);
      if (mass <= 0) return;
      const delta = subVec(state, position);
      const r2 = dotVec(delta, delta) + 1e-6;
      acceleration = addVec(acceleration, scaleVec(delta, model.g * mass / Math.pow(r2, 1.5)));
    });
    return acceleration;
  }

  function strongestTidalSource(sample, targetIndex, model) {
    const target = sample.bodies[targetIndex];
    if (!target || !stateActive(target, targetIndex)) return null;
    let best = null;
    sample.bodies.forEach((state, index) => {
      if (index === targetIndex || !stateActive(state, index)) return;
      const mass = stateMass(state, index);
      const distance = normVec(subVec(state, target));
      if (distance <= 1e-8 || mass <= 0) return;
      const strength = model.g * mass / Math.pow(distance, 3);
      if (!best || strength > best.strength) {
        best = { index, state, mass, distance, strength };
      }
    });
    return best;
  }

  function tidalDiagnosticsForSample(sample, model, requestedTargetIndex = null) {
    const targetIndex = requestedTargetIndex == null
      ? bodies.findIndex((body) => body.id === selectedBodyId)
      : requestedTargetIndex;
    const targetBody = bodies[targetIndex];
    const target = sample?.bodies?.[targetIndex];
    if (!targetBody || !target || !stateActive(target, targetIndex)) return null;
    const source = strongestTidalSource(sample, targetIndex, model);
    if (!source) return null;
    const radius = Math.max(stateRadius(target, targetIndex), targetBody.radius || 0.05, 1e-4);
    const center = vec(target.x, target.y, target.z);
    const sourceDirection = normalizeVec(subVec(source.state, target), vec(1, 0, 0));
    const fallback = Math.abs(sourceDirection.y) < 0.9 ? vec(0, 1, 0) : vec(0, 0, 1);
    const transverseA = normalizeVec(crossVec(sourceDirection, fallback), vec(0, 0, 1));
    const transverseB = normalizeVec(crossVec(sourceDirection, transverseA), vec(0, 1, 0));
    const centerAcceleration = externalAccelerationAt(center, sample.bodies, model, targetIndex);
    const probe = (axis, sign) => {
      const offset = scaleVec(axis, radius * sign);
      const position = addVec(center, offset);
      const acceleration = externalAccelerationAt(position, sample.bodies, model, targetIndex);
      return {
        position,
        offset,
        delta: subVec(acceleration, centerAcceleration)
      };
    };
    const probes = [
      probe(sourceDirection, 1),
      probe(sourceDirection, -1),
      probe(transverseA, 1),
      probe(transverseA, -1),
      probe(transverseB, 1),
      probe(transverseB, -1)
    ];
    const near = probes[0].delta;
    const far = probes[1].delta;
    const across = normVec(subVec(near, far));
    const surfaceGravity = model.g * stateMass(target, targetIndex) / Math.max(radius * radius, 1e-9);
    const sourcePull = source.strength * source.distance;
    return {
      targetIndex,
      targetBody,
      targetState: target,
      source,
      sourceBody: bodies[source.index],
      radius,
      probes,
      across,
      surfaceGravity,
      sourcePull,
      ratio: surfaceGravity > 0 ? across / surfaceGravity : Number.NaN,
      sourceRatio: sourcePull > 0 ? across / sourcePull : Number.NaN
    };
  }

  function rocheDiagnosticsFromTidal(diagnostics) {
    if (!diagnostics?.source?.state) return null;
    const targetState = diagnostics.targetState;
    const sourceState = diagnostics.source.state;
    const targetIndex = diagnostics.targetIndex;
    const sourceIndex = diagnostics.source.index;
    if (!targetState || !sourceState) return null;
    const targetMass = stateMass(targetState, targetIndex);
    const sourceMass = stateMass(sourceState, sourceIndex);
    if (targetMass <= 0 || sourceMass <= 0) return null;
    const targetRadius = Math.max(diagnostics.radius, 1e-6);
    const sourceRadius = Math.max(stateRadius(sourceState, sourceIndex), 1e-6);
    const sourceDensity = sourceMass / Math.max(sourceRadius ** 3, 1e-12);
    const targetDensity = Math.max(targetMass, 1e-9) / Math.max(targetRadius ** 3, 1e-12);
    const densityRatio = sourceDensity / Math.max(targetDensity, 1e-12);
    const fluid = 2.44 * sourceRadius * Math.cbrt(densityRatio);
    const rigid = 1.26 * sourceRadius * Math.cbrt(densityRatio);
    return {
      sourceIndex,
      targetIndex,
      sourceState,
      distance: diagnostics.source.distance,
      sourceRadius,
      targetRadius,
      sourceDensity,
      targetDensity,
      fluid,
      rigid,
      fluidRatio: diagnostics.source.distance / Math.max(fluid, 1e-9),
      rigidRatio: diagnostics.source.distance / Math.max(rigid, 1e-9)
    };
  }

  function tidalOverlayScaleFor(model, fallbackDiagnostics = null) {
    const key = `${trajectory.signature}:${trajectory.samples.length}:${selectedBodyId}`;
    if (tidalOverlayScaleCache.key === key) return tidalOverlayScaleCache;
    const samples = trajectory.samples.length ? trajectory.samples : [];
    const stride = Math.max(1, Math.floor(samples.length / 260));
    let maxDelta = 0;
    let maxAcross = 0;
    const inspect = (sample) => {
      const diagnostics = tidalDiagnosticsForSample(sample, model);
      if (!diagnostics) return;
      diagnostics.probes.forEach((probe) => {
        maxDelta = Math.max(maxDelta, normVec(probe.delta));
      });
      maxAcross = Math.max(maxAcross, diagnostics.across);
    };
    for (let index = 0; index < samples.length; index += stride) inspect(samples[index]);
    if (samples.length) inspect(samples[samples.length - 1]);
    if (fallbackDiagnostics) {
      fallbackDiagnostics.probes.forEach((probe) => {
        maxDelta = Math.max(maxDelta, normVec(probe.delta));
      });
      maxAcross = Math.max(maxAcross, fallbackDiagnostics.across);
    }
    tidalOverlayScaleCache = { key, maxDelta, maxAcross };
    return tidalOverlayScaleCache;
  }

  function spinOrbitMomentOfInertia(state, index, tidalSpin = readTidalSpinModel()) {
    const alpha = tidalSpin.inertiaAlpha;
    const mass = stateMass(state, index);
    const radius = Math.max(stateRadius(state, index), 1e-6);
    return alpha * mass * radius * radius;
  }

  function spinOrbitPairForStates(states, model) {
    if (!controls.showTidalLocking?.checked) return null;
    const targetIndex = bodies.findIndex((body) => body.id === selectedBodyId);
    const target = states[targetIndex];
    if (!target || !stateActive(target, targetIndex)) return null;
    const source = strongestTidalSource({ bodies: states }, targetIndex, model);
    if (!source || source.index === targetIndex) return null;
    const sourceState = states[source.index];
    if (!sourceState || !stateActive(sourceState, source.index)) return null;
    return { targetIndex, sourceIndex: source.index, target, source: sourceState };
  }

  function relativeOrbitScalars(target, source, targetMass, sourceMass, model) {
    const r = subVec(target, source);
    const v = subVec(vec(target.vx, target.vy, target.vz), vec(source.vx, source.vy, source.vz));
    const distance = normVec(r);
    if (distance <= 1e-9) return null;
    const hVec = crossVec(r, v);
    const hMag = normVec(hVec);
    const orbitRate = hMag / Math.max(distance * distance, 1e-9);
    const totalMass = targetMass + sourceMass;
    const reducedMass = totalMass > 0 ? (targetMass * sourceMass) / totalMass : 0;
    const orbitalEnergy = 0.5 * reducedMass * dotVec(v, v) - (model.g * targetMass * sourceMass) / distance;
    return { r, v, distance, hVec, hMag, orbitRate, totalMass, reducedMass, orbitalEnergy };
  }

  function applyTidalSpinOrbitStep(states, h, model) {
    const pair = spinOrbitPairForStates(states, model);
    if (!pair || h <= 0) {
      return states.map((state, index) => ({
        ...state,
        spinPhase: (Number(state.spinPhase) || 0) + (Number(state.spinOmega ?? bodies[index]?.spin) || 0) * h
      }));
    }

    const next = cloneStates(states);
    const target = next[pair.targetIndex];
    const source = next[pair.sourceIndex];
    const targetMass = stateMass(target, pair.targetIndex);
    const sourceMass = stateMass(source, pair.sourceIndex);
    const orbit = relativeOrbitScalars(target, source, targetMass, sourceMass, model);
    if (!orbit || orbit.reducedMass <= 0 || orbit.hMag <= 1e-12) return next;

    const tidalSpin = readTidalSpinModel();
    const inertia = spinOrbitMomentOfInertia(target, pair.targetIndex, tidalSpin);
    if (inertia <= 0) return next;
    const omega = Number(target.spinOmega ?? bodies[pair.targetIndex]?.spin) || 0;
    const spinEnergyBefore = 0.5 * inertia * omega * omega;
    const totalMechanicalBefore = spinEnergyBefore + orbit.orbitalEnergy;
    const torqueCoefficient = 3 * tidalSpin.k2 * model.g * sourceMass * sourceMass * Math.pow(stateRadius(target, pair.targetIndex), 5) * tidalSpin.timeLag
      / Math.max(Math.pow(orbit.distance, 6), 1e-9);
    const spinTorque = -torqueCoefficient * (omega - orbit.orbitRate);
    const rawDeltaOmega = (spinTorque * h) / inertia;
    const maxDeltaOmega = Math.max(0.05, Math.abs(omega - orbit.orbitRate) * 0.35);
    const deltaOmega = Math.max(-maxDeltaOmega, Math.min(maxDeltaOmega, rawDeltaOmega));
    const nextOmega = omega + deltaOmega;
    const deltaSpinL = inertia * deltaOmega;
    const deltaOrbitL = -deltaSpinL;

    const hUnit = normalizeVec(orbit.hVec, vec(0, 1, 0));
    const rUnit = normalizeVec(orbit.r, vec(1, 0, 0));
    const tangent = normalizeVec(crossVec(hUnit, rUnit), vec(0, 0, 1));
    const deltaRelativeSpeed = deltaOrbitL / Math.max(orbit.reducedMass * orbit.distance, 1e-9);
    const targetShare = sourceMass / Math.max(orbit.totalMass, 1e-9);
    const sourceShare = targetMass / Math.max(orbit.totalMass, 1e-9);

    target.vx += tangent.x * deltaRelativeSpeed * targetShare;
    target.vy += tangent.y * deltaRelativeSpeed * targetShare;
    target.vz += tangent.z * deltaRelativeSpeed * targetShare;
    source.vx -= tangent.x * deltaRelativeSpeed * sourceShare;
    source.vy -= tangent.y * deltaRelativeSpeed * sourceShare;
    source.vz -= tangent.z * deltaRelativeSpeed * sourceShare;

    target.spinOmega = nextOmega;
    target.spinPhase = (Number(target.spinPhase) || 0) + nextOmega * h;
    const orbitAfter = relativeOrbitScalars(target, source, targetMass, sourceMass, model);
    const spinEnergyAfter = 0.5 * inertia * nextOmega * nextOmega;
    const totalMechanicalAfter = spinEnergyAfter + (orbitAfter?.orbitalEnergy ?? orbit.orbitalEnergy);
    const heatGain = Math.max(0, totalMechanicalBefore - totalMechanicalAfter);
    target.tidalHeat = (Number(target.tidalHeat) || 0) + heatGain;
    target.tidalTorque = spinTorque;
    target.tidalOrbitRate = orbit.orbitRate;
    target.tidalSpinRatio = orbit.orbitRate > 1e-9 ? nextOmega / orbit.orbitRate : Number.NaN;
    target.tidalBulkSpinL = inertia * nextOmega;
    target.tidalOrbitL = orbitAfter ? orbit.reducedMass * orbitAfter.hMag : orbit.reducedMass * orbit.hMag;
    target.tidalTotalL = target.tidalBulkSpinL + target.tidalOrbitL;
    target.tidalK2 = tidalSpin.k2;
    target.tidalLag = tidalSpin.timeLag;
    target.tidalInertiaAlpha = tidalSpin.inertiaAlpha;

    next.forEach((state, index) => {
      if (index === pair.targetIndex) return;
      state.spinPhase = (Number(state.spinPhase) || 0) + (Number(state.spinOmega ?? bodies[index]?.spin) || 0) * h;
    });
    return next;
  }

  function spinOrbitDiagnosticsForSample(sample, model) {
    const diagnostics = tidalDiagnosticsForSample(sample, model);
    if (!diagnostics) return null;
    const targetIndex = diagnostics.targetIndex;
    const sourceIndex = diagnostics.source.index;
    const target = sample.bodies[targetIndex];
    const source = sample.bodies[sourceIndex];
    const targetBody = bodies[targetIndex];
    if (!target || !source || !targetBody) return null;
    const r = subVec(target, source);
    const v = subVec(
      vec(target.vx, target.vy, target.vz),
      vec(source.vx, source.vy, source.vz)
    );
    const distance = normVec(r);
    if (distance <= 1e-9) return null;
    const orbitalAngularVector = crossVec(r, v);
    const orbitalRate = normVec(orbitalAngularVector) / Math.max(distance * distance, 1e-9);
    const spinOmega = Number(target.spinOmega ?? targetBody.spin) || 0;
    const spinRatio = orbitalRate > 1e-9 ? spinOmega / orbitalRate : Number.NaN;
    const spinState = Math.abs(spinRatio - 1) < 0.04
      ? "near synchronous"
      : spinRatio > 1
        ? "fast prograde spin: torque pushes orbit outward"
        : spinRatio >= 0
          ? "slow prograde spin: torque drains orbit"
          : "retrograde spin: strong tidal braking";
    return {
      ...diagnostics,
      spinOmega,
      spinRatio,
      orbitalRate,
      torque: Number(target.tidalTorque) || 0,
      heat: Number(target.tidalHeat) || 0,
      bulkSpinL: Number(target.tidalBulkSpinL) || 0,
      orbitL: Number(target.tidalOrbitL) || 0,
      totalL: Number(target.tidalTotalL) || 0,
      k2: Number(target.tidalK2 ?? readTidalSpinModel().k2) || 0,
      timeLag: Number(target.tidalLag ?? readTidalSpinModel().timeLag) || 0,
      inertiaAlpha: Number(target.tidalInertiaAlpha ?? readTidalSpinModel().inertiaAlpha) || 0,
      spinState
    };
  }

  function spinOrbitSeries(samples, model) {
    const lockProgress = [];
    const spinRatio = [];
    const orbitScale = [];
    const heat = [];
    const totalL = [];
    const initialOrbitL = (() => {
      const diagnostics = spinOrbitDiagnosticsForSample(samples[0], model);
      return diagnostics && Number.isFinite(diagnostics.orbitL) && Math.abs(diagnostics.orbitL) > 1e-9
        ? diagnostics.orbitL
        : 1;
    })();
    samples.forEach((sample) => {
      const diagnostics = spinOrbitDiagnosticsForSample(sample, model);
      const ratio = diagnostics && Number.isFinite(diagnostics.spinRatio) ? diagnostics.spinRatio : Number.NaN;
      spinRatio.push(ratio);
      lockProgress.push(Number.isFinite(ratio) ? 1 / (1 + Math.abs(ratio - 1)) : Number.NaN);
      orbitScale.push(diagnostics && Number.isFinite(diagnostics.orbitL) ? diagnostics.orbitL / initialOrbitL : Number.NaN);
      heat.push(diagnostics && Number.isFinite(diagnostics.heat) ? diagnostics.heat : Number.NaN);
      totalL.push(diagnostics && Number.isFinite(diagnostics.totalL) ? diagnostics.totalL : Number.NaN);
    });
    return { lockProgress, spinRatio, orbitScale, heat, totalL };
  }

  function rocheSeriesFromDiagnostics(tidalDiagnostics) {
    const fluidRatio = [];
    const rigidRatio = [];
    tidalDiagnostics.forEach((diagnostics) => {
      const roche = rocheDiagnosticsFromTidal(diagnostics);
      fluidRatio.push(roche ? roche.fluidRatio : Number.NaN);
      rigidRatio.push(roche ? roche.rigidRatio : Number.NaN);
    });
    return { fluidRatio, rigidRatio };
  }

  function rocheDamageSeries(samples, model) {
    const breakupModel = readRocheBreakupModel();
    const damageByBody = bodies.map(() => 0);
    const selectedDamage = [];
    const maxDamage = [];
    const selectedIndex = Math.max(0, bodies.findIndex((body) => body.id === selectedBodyId));
    samples.forEach((sample, sampleIndex) => {
      const previous = samples[Math.max(0, sampleIndex - 1)];
      const dt = sampleIndex === 0 ? 0 : Math.max(0, sample.t - previous.t);
      bodies.forEach((body, bodyIndex) => {
        if (body.type === "star") {
          damageByBody[bodyIndex] = 0;
          return;
        }
        const state = sample.bodies[bodyIndex];
        if (!stateActive(state, bodyIndex)) {
          damageByBody[bodyIndex] = Math.max(damageByBody[bodyIndex], Number(state?.rocheDamage) || 0);
          return;
        }
        const diagnostics = tidalDiagnosticsForSample(sample, model, bodyIndex);
        const roche = rocheDiagnosticsFromTidal(diagnostics);
        const severity = rocheDamageSeverity(roche, breakupModel);
        if (severity > 0 && dt > 0) {
          const tDyn = Math.sqrt(Math.max(Math.pow(stateRadius(state, bodyIndex), 3), 1e-12) / Math.max(model.g * stateMass(state, bodyIndex), 1e-12));
          damageByBody[bodyIndex] += severity * dt / Math.max(tDyn * breakupModel.resilience, 1e-6);
        } else if (dt > 0) {
          damageByBody[bodyIndex] = Math.max(0, damageByBody[bodyIndex] - dt * 0.025);
        }
        damageByBody[bodyIndex] = Math.max(damageByBody[bodyIndex], Number(state?.rocheDamage) || 0);
        damageByBody[bodyIndex] = Math.min(1, damageByBody[bodyIndex]);
      });
      selectedDamage.push(damageByBody[selectedIndex] || 0);
      maxDamage.push(Math.max(0, ...damageByBody));
    });
    return { selectedDamage, maxDamage };
  }

  function seededUnit(seed) {
    return Math.sin(seed * 12.9898 + 78.233) * 43758.5453 % 1;
  }

  function positiveSeededUnit(seed) {
    const value = seededUnit(seed);
    return value < 0 ? value + 1 : value;
  }

  function debrisPaletteForBody(body, material) {
    if (material === "rigid") {
      return body?.texture === "mars"
        ? ["#9ca3af", "#d1d5db", "#b45309", "#7c2d12"]
        : ["#9ca3af", "#e5e7eb", "#d8b383", "#8f573b"];
    }
    if (body?.type === "star") return ["#fbbf24", "#fde68a", "#f97316", "#fff7ad"];
    if (body?.texture === "mars") return ["#8f3d24", "#c46b3e", "#f97316", "#6f2d1b", "#fed7aa"];
    return ["#d8b383", "#f1d5a5", "#b46b42", "#8f573b", "#f9e8c7"];
  }

  function debrisColorForParticle(body, material, seed) {
    const palette = debrisPaletteForBody(body, material);
    const index = Math.min(palette.length - 1, Math.floor(positiveSeededUnit(seed + 7) * palette.length));
    return palette[index];
  }

  function rocheDamageSeverity(roche, breakupModel) {
    if (!roche) return 0;
    const fluidDepth = Math.max(0, 1 / Math.max(roche.fluidRatio, 1e-9) - 1);
    const rigidDepth = Math.max(0, 1 / Math.max(roche.rigidRatio, 1e-9) - 1);
    if (breakupModel.material === "rigid") {
      return fluidDepth * 0.55 + Math.pow(rigidDepth, 1.08) * 5.8;
    }
    const fluidTerm = fluidDepth * (breakupModel.material === "fluid" ? 2.8 : 1.35);
    const rigidTerm = Math.pow(rigidDepth, 1.08) * (breakupModel.material === "fluid" ? 6.5 : 5.8);
    return fluidTerm + rigidTerm;
  }

  function debrisFieldCenterOfMass(field) {
    const particles = field?.particles || [];
    let totalMass = 0;
    let position = vec(0, 0, 0);
    let velocity = vec(0, 0, 0);
    particles.forEach((particle) => {
      const mass = Math.max(0, Number(particle.mass) || 0);
      totalMass += mass;
      position = addVec(position, scaleVec(particle, mass));
      velocity = addVec(velocity, scaleVec(vec(particle.vx, particle.vy, particle.vz), mass));
    });
    if (totalMass <= 0) return null;
    return {
      mass: totalMass,
      x: position.x / totalMass,
      y: position.y / totalMass,
      z: position.z / totalMass,
      vx: velocity.x / totalMass,
      vy: velocity.y / totalMass,
      vz: velocity.z / totalMass
    };
  }

  function applyDebrisBackreactionStep(states, debrisFields, h, model) {
    if (!debrisFields?.length) return states;
    const next = cloneStates(states);
    next.forEach((state, stateIndex) => {
      if (!stateActive(state, stateIndex)) return;
      let acceleration = vec(0, 0, 0);
      debrisFields.forEach((field) => {
        const gravityMode = field.gravityMode || "tracer";
        if (gravityMode === "tracer") return;
        const sources = gravityMode === "self"
          ? (field.particles || [])
          : [debrisFieldCenterOfMass(field)].filter(Boolean);
        sources.forEach((source) => {
          const mass = Math.max(0, Number(source.mass) || 0);
          if (mass <= 0) return;
          const offset = subVec(source, state);
          const softening = Math.max(Number(field.softening) || 0.02, 0.02);
          const r2 = dotVec(offset, offset) + softening * softening;
          acceleration = addVec(acceleration, scaleVec(offset, model.g * mass / Math.pow(r2, 1.5)));
        });
      });
      state.vx += acceleration.x * h;
      state.vy += acceleration.y * h;
      state.vz += acceleration.z * h;
    });
    return next;
  }

  function updateDebrisFields(debrisFields, states, h, model) {
    return cloneDebrisFields(debrisFields).map((field) => {
      const nextAge = (field.age || 0) + h;
      const birthDuration = Math.max(0.25, Number(field.birthDuration) || 0.8);
      return {
        ...field,
        age: nextAge,
        particles: field.particles.map((particle, particleIndex) => {
          let acceleration = vec(0, 0, 0);
          states.forEach((state, index) => {
            if (!stateActive(state, index)) return;
            const offset = subVec(state, particle);
            const r2 = dotVec(offset, offset) + 1e-6;
            const invR3 = 1 / Math.pow(r2, 1.5);
            acceleration = addVec(acceleration, scaleVec(offset, model.g * stateMass(state, index) * invR3));
          });
          if (field.gravityMode === "self") {
            field.particles.forEach((other, otherIndex) => {
              if (otherIndex === particleIndex) return;
              const mass = Math.max(0, Number(other.mass) || 0);
              if (mass <= 0) return;
              const offset = subVec(other, particle);
              const softening = Math.max(Number(field.softening) || 0.02, 0.02);
              const r2 = dotVec(offset, offset) + softening * softening;
              acceleration = addVec(acceleration, scaleVec(offset, model.g * mass / Math.pow(r2, 1.5)));
            });
          }
          const vx = particle.vx + acceleration.x * h;
          const vy = particle.vy + acceleration.y * h;
          const vz = particle.vz + acceleration.z * h;
          const localAge = Math.max(0, nextAge - (Number(particle.birthDelay) || 0));
          const fadeIn = Math.max(0, Math.min(1, localAge / birthDuration));
          const baseOpacity = Math.max(0.2, Math.min(0.92, Number(particle.baseOpacity) || 0.82));
          return {
            ...particle,
            x: particle.x + vx * h,
            y: particle.y + vy * h,
            z: particle.z + vz * h,
            vx,
            vy,
            vz,
            opacity: Math.max(0.04, baseOpacity * fadeIn)
          };
        })
      };
    });
  }

  function createRocheDebrisField(states, targetIndex, sourceIndex, roche, breakupModel, t, model) {
    const target = states[targetIndex];
    const source = states[sourceIndex];
    if (!target || !source) return null;
    const targetBody = bodies[targetIndex];
    const targetRadius = Math.max(stateRadius(target, targetIndex), 1e-5);
    const targetMass = Math.max(stateMass(target, targetIndex), 1e-9);
    const radial = normalizeVec(subVec(target, source), vec(1, 0, 0));
    const relativeVelocity = subVec(vec(target.vx, target.vy, target.vz), vec(source.vx, source.vy, source.vz));
    const normal = normalizeVec(crossVec(radial, relativeVelocity), vec(0, 1, 0));
    const tangent = normalizeVec(crossVec(normal, radial), vec(0, 0, 1));
    const orbitShear = normVec(relativeVelocity) * targetRadius / Math.max(roche.distance, targetRadius);
    const impulse = Math.max(orbitShear * 0.42, targetRadius * 0.012);
    const count = breakupModel.fragmentCount;
    const particleMass = targetMass / Math.max(count, 1);
    const gravityMode = breakupModel.debrisGravityMode === "self" && count <= breakupModel.selfGravityLimit
      ? "self"
      : breakupModel.debrisGravityMode === "tracer"
        ? "tracer"
        : "collective";
    const sourcePull = normalizeVec(subVec(source, target), vec(-1, 0, 0));
    const particles = Array.from({ length: count }, (_, index) => {
      const slot = count === 1 ? 0 : index / (count - 1);
      const centered = slot * 2 - 1;
      const seed = (targetIndex + 1) * 1000 + index * 37 + Math.round(t * 100);
      const jitterA = positiveSeededUnit(seed) - 0.5;
      const jitterB = positiveSeededUnit(seed + 13) - 0.5;
      const side = index % 2 === 0 ? 1 : -1;
      const radialOffset = centered * targetRadius * 0.92;
      const tangentOffset = jitterA * targetRadius * 0.34;
      const normalOffset = jitterB * targetRadius * 0.22;
      const position = addVec(
        target,
        addVec(
          scaleVec(radial, radialOffset),
          addVec(scaleVec(tangent, tangentOffset), scaleVec(normal, normalOffset))
        )
      );
      const velocity = addVec(
        vec(target.vx, target.vy, target.vz),
        addVec(
          scaleVec(radial, centered * impulse * 0.2),
          addVec(
            scaleVec(tangent, (-centered * 0.55 + jitterA * 0.18) * impulse),
            scaleVec(normal, side * (0.06 + Math.abs(jitterB) * 0.08) * impulse)
          )
        )
      );
      return {
        x: position.x,
        y: position.y,
        z: position.z,
        vx: velocity.x,
        vy: velocity.y,
        vz: velocity.z,
        mass: particleMass,
        radius: targetRadius * (0.09 + positiveSeededUnit(seed + 29) * 0.1),
        color: debrisColorForParticle(targetBody, breakupModel.material, seed),
        baseOpacity: 0.72 + positiveSeededUnit(seed + 41) * 0.18,
        birthDelay: positiveSeededUnit(seed + 53) * 0.45,
        opacity: 0
      };
    });
    const palette = debrisPaletteForBody(targetBody, breakupModel.material);
    return {
      id: `roche-${targetIndex}-${Math.round(t * 1000)}`,
      t0: t,
      age: 0,
      targetIndex,
      sourceIndex,
      material: breakupModel.material,
      gravityMode,
      totalMass: targetMass,
      softening: Math.max(targetRadius * 0.22, 0.015),
      parentRadius: targetRadius,
      parentName: targetBody?.name || "body",
      parentTexture: targetBody?.texture || "jupiter",
      birthDuration: 0.9,
      color: palette[0],
      coreColor: palette[1] || palette[0],
      axis: sourcePull,
      particles
    };
  }

  function applyRocheBreakupStep(states, debrisFields, h, model, t) {
    const breakupModel = readRocheBreakupModel();
    const statesWithDebrisGravity = applyDebrisBackreactionStep(states, debrisFields, h, model);
    const movedDebris = updateDebrisFields(debrisFields, statesWithDebrisGravity, h, model);
    if (!breakupModel.enabled || bodies.length < 2) return { states: statesWithDebrisGravity, debrisFields: movedDebris };
    const next = cloneStates(statesWithDebrisGravity);
    let nextDebris = movedDebris;
    next.forEach((target, targetIndex) => {
      if (bodies[targetIndex]?.type === "star") return;
      if (!stateActive(target, targetIndex) || target.fragmented) return;
      const diagnostics = tidalDiagnosticsForSample(makeSample(t, next), model, targetIndex);
      const roche = rocheDiagnosticsFromTidal(diagnostics);
      const severity = rocheDamageSeverity(roche, breakupModel);
      if (!roche || severity <= 0) {
        const currentDamage = Number(target.rocheDamage) || 0;
        target.rocheDamage = Math.max(0, currentDamage - h * 0.025);
        target.rocheSeverity = 0;
        return;
      }
      const tDyn = Math.sqrt(Math.max(Math.pow(stateRadius(target, targetIndex), 3), 1e-12) / Math.max(model.g * stateMass(target, targetIndex), 1e-12));
      const damageGain = severity * h / Math.max(tDyn * breakupModel.resilience, 1e-6);
      target.rocheDamage = Math.max(0, (Number(target.rocheDamage) || 0) + damageGain);
      target.rocheSeverity = severity;
      if (target.rocheDamage < 1) return;
      target.rocheDamage = 1;
      if (!breakupModel.breakup) return;
      const sourceIndex = roche.sourceIndex;
      const debris = createRocheDebrisField(next, targetIndex, sourceIndex, roche, breakupModel, t, model);
      target.active = false;
      target.mass = 0;
      target.radius = 0;
      target.fragmented = true;
      target.fragmentedAt = t;
      target.rocheSeverity = severity;
      trajectory.rocheEvents.push({
        t,
        targetIndex,
        sourceIndex,
        label: `${bodies[targetIndex]?.name || "body"} disrupted by ${bodies[sourceIndex]?.name || "source"}`,
        material: breakupModel.material,
        damage: target.rocheDamage,
        fluidRatio: roche.fluidRatio,
        rigidRatio: roche.rigidRatio,
        position: vec(states[targetIndex].x, states[targetIndex].y, states[targetIndex].z),
        radius: Math.max(roche.targetRadius, 0.08)
      });
      if (debris) nextDebris = [...nextDebris, debris];
    });
    return { states: next, debrisFields: nextDebris };
  }

  function resolveCollisions(states) {
    if ((controls.collisionMode?.value || "detect") !== "merge") return states;
    const next = cloneStates(states);
    let merged = true;
    while (merged) {
      merged = false;
      for (let i = 0; i < next.length; i += 1) {
        if (!stateActive(next[i], i)) continue;
        for (let j = i + 1; j < next.length; j += 1) {
          if (!stateActive(next[j], j)) continue;
          const contact = stateRadius(next[i], i) + stateRadius(next[j], j);
          const distance = normVec(subVec(next[j], next[i]));
          if (contact <= 0 || distance > contact) continue;
          const massI = stateMass(next[i], i);
          const massJ = stateMass(next[j], j);
          const keep = massI >= massJ ? i : j;
          const drop = keep === i ? j : i;
          const keepMass = stateMass(next[keep], keep);
          const dropMass = stateMass(next[drop], drop);
          const totalMass = keepMass + dropMass;
          if (totalMass <= 0) continue;
          const mergedPosition = scaleVec(addVec(scaleVec(next[keep], keepMass), scaleVec(next[drop], dropMass)), 1 / totalMass);
          const keepVelocity = vec(next[keep].vx, next[keep].vy, next[keep].vz);
          const dropVelocity = vec(next[drop].vx, next[drop].vy, next[drop].vz);
          const mergedVelocity = scaleVec(addVec(scaleVec(keepVelocity, keepMass), scaleVec(dropVelocity, dropMass)), 1 / totalMass);
          const mergedRadius = Math.cbrt(Math.pow(stateRadius(next[keep], keep), 3) + Math.pow(stateRadius(next[drop], drop), 3));
          next[keep] = {
            ...next[keep],
            x: mergedPosition.x,
            y: mergedPosition.y,
            z: mergedPosition.z,
            vx: mergedVelocity.x,
            vy: mergedVelocity.y,
            vz: mergedVelocity.z,
            mass: totalMass,
            radius: mergedRadius,
            active: true
          };
          next[drop] = {
            ...next[drop],
            x: mergedPosition.x,
            y: mergedPosition.y,
            z: mergedPosition.z,
            vx: mergedVelocity.x,
            vy: mergedVelocity.y,
            vz: mergedVelocity.z,
            mass: 0,
            radius: 0,
            active: false,
            mergedInto: keep
          };
          merged = true;
          break;
        }
        if (merged) break;
      }
    }
    return next;
  }

  function verletStep(states, h, model) {
    const a0 = accelerationsFor(states, model);
    const next = states.map((state, index) => ({
      ...state,
      x: stateActive(state, index) ? state.x + state.vx * h + 0.5 * a0[index].x * h * h : state.x,
      y: stateActive(state, index) ? state.y + state.vy * h + 0.5 * a0[index].y * h * h : state.y,
      z: stateActive(state, index) ? state.z + state.vz * h + 0.5 * a0[index].z * h * h : state.z,
      vx: state.vx,
      vy: state.vy,
      vz: state.vz
    }));
    const a1 = accelerationsFor(next, model);
    next.forEach((state, index) => {
      if (!stateActive(state, index)) return;
      state.vx = states[index].vx + 0.5 * (a0[index].x + a1[index].x) * h;
      state.vy = states[index].vy + 0.5 * (a0[index].y + a1[index].y) * h;
      state.vz = states[index].vz + 0.5 * (a0[index].z + a1[index].z) * h;
    });
    return next;
  }

  function derivativeFor(states, model) {
    const acc = accelerationsFor(states, model);
    return states.map((state, index) => ({
      x: stateActive(state, index) ? state.vx : 0,
      y: stateActive(state, index) ? state.vy : 0,
      z: stateActive(state, index) ? state.vz : 0,
      vx: acc[index].x,
      vy: acc[index].y,
      vz: acc[index].z
    }));
  }

  function addScaledStates(states, deriv, scale) {
    return states.map((state, index) => ({
      ...state,
      x: state.x + deriv[index].x * scale,
      y: state.y + deriv[index].y * scale,
      z: state.z + deriv[index].z * scale,
      vx: state.vx + deriv[index].vx * scale,
      vy: state.vy + deriv[index].vy * scale,
      vz: state.vz + deriv[index].vz * scale
    }));
  }

  function eulerStep(states, h, model) {
    return addScaledStates(states, derivativeFor(states, model), h);
  }

  function midpointStep(states, h, model) {
    const k1 = derivativeFor(states, model);
    const mid = addScaledStates(states, k1, h / 2);
    const k2 = derivativeFor(mid, model);
    return addScaledStates(states, k2, h);
  }

  function symplecticEulerStep(states, h, model) {
    const acc = accelerationsFor(states, model);
    return states.map((state, index) => {
      if (!stateActive(state, index)) return { ...state };
      const vx = state.vx + acc[index].x * h;
      const vy = state.vy + acc[index].y * h;
      const vz = state.vz + acc[index].z * h;
      return {
        ...state,
        x: state.x + vx * h,
        y: state.y + vy * h,
        z: state.z + vz * h,
        vx,
        vy,
        vz
      };
    });
  }

  function rk4Step(states, h, model) {
    const k1 = derivativeFor(states, model);
    const k2 = derivativeFor(addScaledStates(states, k1, h / 2), model);
    const k3 = derivativeFor(addScaledStates(states, k2, h / 2), model);
    const k4 = derivativeFor(addScaledStates(states, k3, h), model);
    return states.map((state, index) => ({
      ...state,
      x: state.x + (h / 6) * (k1[index].x + 2 * k2[index].x + 2 * k3[index].x + k4[index].x),
      y: state.y + (h / 6) * (k1[index].y + 2 * k2[index].y + 2 * k3[index].y + k4[index].y),
      z: state.z + (h / 6) * (k1[index].z + 2 * k2[index].z + 2 * k3[index].z + k4[index].z),
      vx: state.vx + (h / 6) * (k1[index].vx + 2 * k2[index].vx + 2 * k3[index].vx + k4[index].vx),
      vy: state.vy + (h / 6) * (k1[index].vy + 2 * k2[index].vy + 2 * k3[index].vy + k4[index].vy),
      vz: state.vz + (h / 6) * (k1[index].vz + 2 * k2[index].vz + 2 * k3[index].vz + k4[index].vz)
    }));
  }

  function stepperForMethod(method) {
    if (method === "rk4") return rk4Step;
    if (method === "midpoint") return midpointStep;
    if (method === "symplecticEuler") return symplecticEulerStep;
    if (method === "euler") return eulerStep;
    return verletStep;
  }

  function updateBufferStatus() {
    if (!controls.bufferStatus) return;
    if (!trajectory.totalSteps) {
      controls.bufferStatus.textContent = "buffer ready";
      return;
    }
    if (trajectory.complete) {
      controls.bufferStatus.textContent = trajectory.requestedSteps > trajectory.totalSteps
        ? `trajectory ready: ${trajectory.samples.length} samples, adaptive h`
        : `trajectory ready: ${trajectory.samples.length} samples`;
      return;
    }
    controls.bufferStatus.textContent = "computing trajectory";
  }

  function targetSampleCount(model, totalSteps) {
    const byTimeSpan = Math.ceil(model.timeSpan * 32);
    return Math.min(totalSteps, Math.max(1800, Math.min(4200, byTimeSpan)));
  }

  function rebuildTrajectoryBuffer() {
    const model = readModel();
    const signature = makeTrajectorySignature(model);
    trajectoryBuildToken += 1;
    const token = trajectoryBuildToken;
    const requestedSteps = Math.max(1, Math.ceil(model.timeSpan / model.h));
    const totalSteps = Math.min(requestedSteps, 120000);
    const effectiveH = model.timeSpan / totalSteps;
    const sampleEvery = totalSteps <= 30000
      ? 1
      : Math.max(1, Math.ceil(totalSteps / targetSampleCount(model, totalSteps)));
    let states = bodies.map(bodyState);
    let debrisFields = [];
    let computedSteps = 0;
    let t = 0;
    const activeCollisionPairs = new Set();

    trajectory = {
      signature,
      samples: [makeSample(0, states, debrisFields)],
      totalSteps,
      requestedSteps,
      computedSteps,
      sampleEvery,
      collisionEvents: [],
      rocheEvents: [],
      complete: false
    };
    plotCursorReady = false;
    plotCursorState = null;
    updateBufferStatus();
    recordCollisionEvents(0, states, activeCollisionPairs);
    const stepper = stepperForMethod(controls.method.value);

    const integrateUntil = (limit) => {
      while (computedSteps < limit) {
        const remaining = model.timeSpan - t;
        const h = Math.min(effectiveH, remaining);
        states = stepper(states, h, model);
        states = applyTidalSpinOrbitStep(states, h, model);
        const rocheStep = applyRocheBreakupStep(states, debrisFields, h, model, t + h);
        states = rocheStep.states;
        debrisFields = rocheStep.debrisFields;
        computedSteps += 1;
        t += h;
        recordCollisionEvents(t, states, activeCollisionPairs);
        states = resolveCollisions(states);
        if (computedSteps % sampleEvery === 0 || computedSteps === totalSteps) {
          trajectory.samples.push(makeSample(t, states, debrisFields));
        }
      }

      trajectory.computedSteps = computedSteps;
      trajectory.complete = computedSteps >= totalSteps;
      updateBufferStatus();
    };

    if (token !== trajectoryBuildToken) return;
    integrateUntil(totalSteps);
    drawScene();
    updatePlots();
  }

  function interpolateNumber(a, b, fraction, fallback = 0) {
    const left = Number.isFinite(Number(a)) ? Number(a) : fallback;
    const right = Number.isFinite(Number(b)) ? Number(b) : left;
    return left + (right - left) * fraction;
  }

  function interpolateState(state, next, fraction) {
    const b = next || state;
    return {
      x: interpolateNumber(state.x, b.x, fraction),
      y: interpolateNumber(state.y, b.y, fraction),
      z: interpolateNumber(state.z, b.z, fraction),
      vx: interpolateNumber(state.vx, b.vx, fraction),
      vy: interpolateNumber(state.vy, b.vy, fraction),
      vz: interpolateNumber(state.vz, b.vz, fraction),
      mass: interpolateNumber(state.mass, b.mass, fraction, state.mass ?? 0),
      radius: interpolateNumber(state.radius, b.radius, fraction, state.radius ?? 0),
      spinOmega: interpolateNumber(state.spinOmega, b.spinOmega, fraction, state.spinOmega ?? 0),
      spinPhase: interpolateNumber(state.spinPhase, b.spinPhase, fraction, state.spinPhase ?? 0),
      tidalHeat: interpolateNumber(state.tidalHeat, b.tidalHeat, fraction, state.tidalHeat ?? 0),
      rocheDamage: interpolateNumber(state.rocheDamage, b.rocheDamage, fraction, state.rocheDamage ?? 0),
      tidalTorque: interpolateNumber(state.tidalTorque, b.tidalTorque, fraction, state.tidalTorque ?? 0),
      tidalOrbitRate: interpolateNumber(state.tidalOrbitRate, b.tidalOrbitRate, fraction, state.tidalOrbitRate ?? 0),
      tidalSpinRatio: interpolateNumber(state.tidalSpinRatio, b.tidalSpinRatio, fraction, state.tidalSpinRatio ?? Number.NaN),
      tidalBulkSpinL: interpolateNumber(state.tidalBulkSpinL, b.tidalBulkSpinL, fraction, state.tidalBulkSpinL ?? 0),
      tidalOrbitL: interpolateNumber(state.tidalOrbitL, b.tidalOrbitL, fraction, state.tidalOrbitL ?? 0),
      tidalTotalL: interpolateNumber(state.tidalTotalL, b.tidalTotalL, fraction, state.tidalTotalL ?? 0),
      tidalK2: interpolateNumber(state.tidalK2, b.tidalK2, fraction, state.tidalK2 ?? 0),
      tidalLag: interpolateNumber(state.tidalLag, b.tidalLag, fraction, state.tidalLag ?? 0),
      tidalInertiaAlpha: interpolateNumber(state.tidalInertiaAlpha, b.tidalInertiaAlpha, fraction, state.tidalInertiaAlpha ?? 0),
      active: fraction < 0.5 ? state.active !== false : b.active !== false,
      mergedInto: fraction < 0.5 ? state.mergedInto : b.mergedInto
    };
  }

  function interpolateParticle(left, right, fraction) {
    const a = left || right;
    const b = right || left;
    const fade = left && right ? 1 : (left ? 1 - fraction : fraction);
    return {
      ...a,
      x: interpolateNumber(a.x, b.x, fraction),
      y: interpolateNumber(a.y, b.y, fraction),
      z: interpolateNumber(a.z, b.z, fraction),
      vx: interpolateNumber(a.vx, b.vx, fraction),
      vy: interpolateNumber(a.vy, b.vy, fraction),
      vz: interpolateNumber(a.vz, b.vz, fraction),
      radius: interpolateNumber(a.radius, b.radius, fraction, a.radius ?? 0.02),
      opacity: Math.max(0, Math.min(1, interpolateNumber(a.opacity, b.opacity, fraction, 1) * fade))
    };
  }

  function interpolateDebrisFields(leftFields = [], rightFields = [], fraction) {
    const ids = new Set([
      ...leftFields.map((field) => field.id),
      ...rightFields.map((field) => field.id)
    ]);
    return Array.from(ids).map((id) => {
      const left = leftFields.find((field) => field.id === id);
      const right = rightFields.find((field) => field.id === id);
      const base = right || left;
      const particleCount = Math.max(left?.particles?.length || 0, right?.particles?.length || 0);
      return {
        ...base,
        particles: Array.from({ length: particleCount }, (_, index) => interpolateParticle(
          left?.particles?.[index],
          right?.particles?.[index],
          fraction
        ))
      };
    });
  }

  function sampleForProgress(progress) {
    if (!trajectory.samples.length) {
      return makeSample(0, bodies.map(bodyState));
    }
    const model = readModel();
    const target = Math.max(0, Math.min(model.timeSpan, progress * model.timeSpan));
    const samples = trajectory.samples;
    if (target <= samples[0].t) return samples[0];
    if (target >= samples[samples.length - 1].t) return samples[samples.length - 1];

    let lo = 0;
    let hi = samples.length - 1;
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (samples[mid].t <= target) lo = mid;
      else hi = mid;
    }
    const a = samples[lo];
    const b = samples[hi];
    const fraction = (target - a.t) / Math.max(1e-9, b.t - a.t);
    return {
      t: target,
      bodies: a.bodies.map((state, index) => interpolateState(state, b.bodies[index], fraction)),
      debris: interpolateDebrisFields(a.debris, b.debris, fraction)
    };
  }

  function sampleForTime(t) {
    const model = readModel();
    return sampleForProgress(t / Math.max(model.timeSpan, 1e-9));
  }

  function barycenterForSample(sample) {
    let totalMass = 0;
    let center = vec(0, 0, 0);
    sample.bodies.forEach((state, index) => {
      if (!stateActive(state, index)) return;
      const mass = stateMass(state, index);
      totalMass += mass;
      center = addVec(center, scaleVec(state, mass));
    });
    (sample.debris || []).forEach((field) => {
      (field.particles || []).forEach((particle) => {
        const mass = Math.max(0, Number(particle.mass) || 0);
        if (mass <= 0) return;
        totalMass += mass;
        center = addVec(center, scaleVec(particle, mass));
      });
    });
    return totalMass > 0 ? scaleVec(center, 1 / totalMass) : vec(0, 0, 0);
  }

  function viewOriginForSample(sample) {
    const frame = controls.viewFrame?.value || "inertial";
    if (frame === "selected") {
      const selectedIndex = bodies.findIndex((body) => body.id === selectedBodyId);
      return sample.bodies[selectedIndex] || vec(0, 0, 0);
    }
    if (frame === "rotatingPair") {
      const pair = pairKinematics(sample);
      return pair?.bary || vec(0, 0, 0);
    }
    if (frame === "barycenter") return barycenterForSample(sample);
    return vec(0, 0, 0);
  }

  function samplePositionInView(sample, position) {
    const frame = controls.viewFrame?.value || "inertial";
    if (frame === "rotatingPair") {
      const pair = pairKinematics(sample);
      if (!pair) return subVec(position, viewOriginForSample(sample));
      const rel = subVec(position, pair.bary);
      return vec(dotVec(rel, pair.eX), dotVec(rel, pair.eZ), dotVec(rel, pair.eY));
    }
    return subVec(position, viewOriginForSample(sample));
  }

  function sampleVectorInView(sample, vector) {
    const frame = controls.viewFrame?.value || "inertial";
    if (frame === "rotatingPair") {
      const pair = pairKinematics(sample);
      if (!pair) return vector;
      return vec(dotVec(vector, pair.eX), dotVec(vector, pair.eZ), dotVec(vector, pair.eY));
    }
    return vector;
  }

  function spinPhaseInView(sample, bodyIndex) {
    const state = sample?.bodies?.[bodyIndex];
    const phase = Number(state?.spinPhase) || 0;
    if ((controls.viewFrame?.value || "inertial") !== "rotatingPair") return phase;
    const pair = pairKinematics(sample);
    if (!pair) return phase;
    const frameAngle = Math.atan2(pair.eX.z, pair.eX.x);
    return phase - frameAngle;
  }

  function transformedSamplePosition(sample, bodyIndex) {
    const state = sample.bodies[bodyIndex];
    if (!state) return vec(0, 0, 0);
    return samplePositionInView(sample, state);
  }

  function keplerFocusForSample(sample) {
    if ((controls.viewFrame?.value || "inertial") === "selected") return vec(0, 0, 0);
    return samplePositionInView(sample, barycenterForSample(sample));
  }

  function keplerFocusLabel() {
    if ((controls.viewFrame?.value || "inertial") === "selected") {
      const body = bodies.find((item) => item.id === selectedBodyId);
      return body ? `focus: ${body.name}` : "focus: selected body";
    }
    return "focus: barycenter";
  }

  function twoBodyOsculatingPeriod(sample, model) {
    if (bodies.length !== 2 || sample.bodies.length < 2) return null;
    const r = subVec(sample.bodies[1], sample.bodies[0]);
    const v = subVec(
      vec(sample.bodies[1].vx, sample.bodies[1].vy, sample.bodies[1].vz),
      vec(sample.bodies[0].vx, sample.bodies[0].vy, sample.bodies[0].vz)
    );
    const rNorm = normVec(r);
    const mu = model.g * (bodies[0].mass + bodies[1].mass);
    const specificEnergy = 0.5 * dotVec(v, v) - mu / Math.max(rNorm, 1e-9);
    if (specificEnergy >= -1e-9 || mu <= 1e-9) return null;
    const a = -mu / (2 * specificEnergy);
    if (!Number.isFinite(a) || a <= 0) return null;
    return Math.PI * 2 * Math.sqrt(Math.pow(a, 3) / mu);
  }

  function relativeRadiusAtSample(sample, centralIndex, bodyIndex) {
    const central = sample.bodies[centralIndex];
    const body = sample.bodies[bodyIndex];
    if (!central || !body) return null;
    return normVec(subVec(body, central));
  }

  function measuredKeplerOrbit(centralIndex, bodyIndex, currentT) {
    const availableSamples = trajectory.samples.filter((sample) => sample.t <= currentT + 1e-9);
    if (availableSamples.length < 6) {
      return { measuring: true, reason: "waiting for samples" };
    }

    const series = availableSamples
      .map((sample, sampleIndex) => ({
        sampleIndex,
        t: sample.t,
        r: relativeRadiusAtSample(sample, centralIndex, bodyIndex)
      }))
      .filter((point) => Number.isFinite(point.r));
    if (series.length < 6) {
      return { measuring: true, reason: "waiting for relative orbit" };
    }

    const pericenters = [];
    if (series[0].r <= series[1].r) pericenters.push(0);
    for (let i = 1; i < series.length - 1; i += 1) {
      if (series[i].r <= series[i - 1].r && series[i].r < series[i + 1].r) {
        pericenters.push(i);
      }
    }
    if (pericenters.length < 2) {
      return { measuring: true, reason: "waiting for next periapsis" };
    }

    const endIndex = pericenters[pericenters.length - 1];
    const startIndex = pericenters[pericenters.length - 2];
    if (endIndex <= startIndex + 2) {
      return { measuring: true, reason: "radial cycle too short" };
    }

    const cycle = series.slice(startIndex, endIndex + 1);
    const period = series[endIndex].t - series[startIndex].t;
    const periapsis = (series[startIndex].r + series[endIndex].r) / 2;
    const apoapsis = cycle.reduce((max, point) => Math.max(max, point.r), 0);
    const a = (periapsis + apoapsis) / 2;
    if (!Number.isFinite(period) || !Number.isFinite(a) || period <= 0 || a <= 0) {
      return { measuring: true, reason: "invalid measured cycle" };
    }

    return {
      measuring: false,
      a,
      period,
      periapsis,
      apoapsis,
      t0: series[startIndex].t,
      t1: series[endIndex].t
    };
  }

  function lagrangeReferencePair() {
    if (bodies.length < 2) return null;
    const indexed = bodies
      .map((body, index) => ({ body, index }))
      .sort((a, b) => b.body.mass - a.body.mass);
    const first = indexed[0];
    const second = indexed[1];
    if (!first || !second) return null;
    return first.body.mass >= second.body.mass
      ? { primaryIndex: first.index, secondaryIndex: second.index }
      : { primaryIndex: second.index, secondaryIndex: first.index };
  }

  function pairKinematics(sample, pair = lagrangeReferencePair()) {
    if (!pair || !sample?.bodies?.length) return null;
    const primaryBodyState = sample.bodies[pair.primaryIndex];
    const secondaryBodyState = sample.bodies[pair.secondaryIndex];
    const primary = bodies[pair.primaryIndex];
    const secondary = bodies[pair.secondaryIndex];
    if (!primaryBodyState || !secondaryBodyState || !primary || !secondary) return null;
    const m1 = primary.mass;
    const m2 = secondary.mass;
    const totalMass = m1 + m2;
    if (totalMass <= 0) return null;
    const r1 = vec(primaryBodyState.x, primaryBodyState.y, primaryBodyState.z);
    const r2 = vec(secondaryBodyState.x, secondaryBodyState.y, secondaryBodyState.z);
    const v1 = vec(primaryBodyState.vx, primaryBodyState.vy, primaryBodyState.vz);
    const v2 = vec(secondaryBodyState.vx, secondaryBodyState.vy, secondaryBodyState.vz);
    const axis = subVec(r2, r1);
    const distance = normVec(axis);
    if (distance <= 1e-8) return null;
    const velocityDelta = subVec(v2, v1);
    const angularMomentum = crossVec(axis, velocityDelta);
    const angularMomentumNorm = normVec(angularMomentum);
    const eX = normalizeVec(axis);
    const fallbackNormal = Math.abs(eX.y) < 0.9 ? vec(0, 1, 0) : vec(0, 0, 1);
    const eZ = angularMomentumNorm > 1e-10
      ? scaleVec(angularMomentum, 1 / angularMomentumNorm)
      : normalizeVec(crossVec(eX, fallbackNormal), vec(0, 0, 1));
    const eY = normalizeVec(crossVec(eZ, eX), vec(0, 0, 1));
    const bary = scaleVec(addVec(scaleVec(r1, m1), scaleVec(r2, m2)), 1 / totalMass);
    const baryVelocity = scaleVec(addVec(scaleVec(v1, m1), scaleVec(v2, m2)), 1 / totalMass);
    const omegaVector = scaleVec(angularMomentum, 1 / Math.max(distance * distance, 1e-9));
    return {
      ...pair,
      primary,
      secondary,
      m1,
      m2,
      totalMass,
      mu: m2 / totalMass,
      distance,
      r1,
      r2,
      v1,
      v2,
      bary,
      baryVelocity,
      eX,
      eY,
      eZ,
      omegaVector,
      angularSpeed: normVec(omegaVector)
    };
  }

  function pairEccentricity(pair, model) {
    if (!pair) return null;
    const r = subVec(pair.r2, pair.r1);
    const v = subVec(pair.v2, pair.v1);
    const rNorm = normVec(r);
    const muG = model.g * pair.totalMass;
    if (rNorm <= 1e-9 || muG <= 1e-9) return null;
    const h = crossVec(r, v);
    const eVec = subVec(scaleVec(crossVec(v, h), 1 / muG), scaleVec(r, 1 / rNorm));
    const e = normVec(eVec);
    return Number.isFinite(e) ? e : null;
  }

  function collinearLagrangeRoot(mu, minX, maxX) {
    const f = (x) => {
      const r1 = Math.max(1e-10, Math.abs(x + mu));
      const r2 = Math.max(1e-10, Math.abs(x - (1 - mu)));
      return x
        - ((1 - mu) * (x + mu)) / Math.pow(r1, 3)
        - (mu * (x - (1 - mu))) / Math.pow(r2, 3);
    };
    let left = minX;
    let leftValue = f(left);
    const segments = 800;
    for (let i = 1; i <= segments; i += 1) {
      const right = minX + ((maxX - minX) * i) / segments;
      const rightValue = f(right);
      if (Number.isFinite(leftValue) && Number.isFinite(rightValue) && leftValue * rightValue <= 0) {
        let a = left;
        let b = right;
        let fa = leftValue;
        for (let step = 0; step < 70; step += 1) {
          const mid = (a + b) / 2;
          const fm = f(mid);
          if (Math.abs(fm) < 1e-12) return mid;
          if (fa * fm <= 0) {
            b = mid;
          } else {
            a = mid;
            fa = fm;
          }
        }
        return (a + b) / 2;
      }
      left = right;
      leftValue = rightValue;
    }
    return null;
  }

  function lagrangePointsForSample(sample = sampleForProgress(Number(controls.slider?.value || 0))) {
    const pair = pairKinematics(sample);
    if (!pair) return null;
    const mu = Math.min(Math.max(pair.mu, 1e-6), 0.499999);
    const x1 = -mu;
    const x2 = 1 - mu;
    const eps = 1e-5;
    const roots = {
      L1: collinearLagrangeRoot(mu, x1 + eps, x2 - eps),
      L2: collinearLagrangeRoot(mu, x2 + eps, x2 + 5),
      L3: collinearLagrangeRoot(mu, x1 - 5, x1 - eps)
    };
    if (roots.L1 == null || roots.L2 == null || roots.L3 == null) return null;
    const dimensionless = {
      L1: vec(roots.L1, 0, 0),
      L2: vec(roots.L2, 0, 0),
      L3: vec(roots.L3, 0, 0),
      L4: vec(0.5 - mu, Math.sqrt(3) / 2, 0),
      L5: vec(0.5 - mu, -Math.sqrt(3) / 2, 0)
    };
    const points = {};
    Object.entries(dimensionless).forEach(([label, local]) => {
      const position = addVec(
        pair.bary,
        addVec(
          scaleVec(pair.eX, local.x * pair.distance),
          scaleVec(pair.eY, local.y * pair.distance)
        )
      );
      const velocity = addVec(pair.baryVelocity, crossVec(pair.omegaVector, subVec(position, pair.bary)));
      points[label] = {
        label,
        position,
        velocity,
        local,
        stable: label === "L4" || label === "L5" ? mu < 0.03852 : false
      };
    });
    return { pair, points };
  }

  function keplerDisplayBodyIndex() {
    const selectedIndex = bodies.findIndex((body) => body.id === selectedBodyId);
    if ((controls.viewFrame?.value || "inertial") === "selected") {
      return selectedIndex === 0 ? 1 : 0;
    }
    if (selectedIndex >= 0 && bodies[selectedIndex]?.type !== "star") return selectedIndex;
    return bodies[0]?.mass <= bodies[1]?.mass ? 0 : 1;
  }

  function keplerThirdApplicability(sample = null) {
    if (bodies.length < 2) return { ok: false, reason: "need at least two bodies" };
    const centralIndex = bodies.reduce((best, body, index) => (
      body.mass > bodies[best].mass ? index : best
    ), 0);
    const central = bodies[centralIndex];
    if (central.type !== "star") return { ok: false, reason: "dominant body is not a star" };
    const restMass = bodies.reduce((sum, body, index) => sum + (index === centralIndex ? 0 : body.mass), 0);
    if (restMass <= 0 || central.mass < restMass * 6) {
      return { ok: false, reason: "central mass is not dominant" };
    }
    const currentSample = sample || sampleForProgress(Number(controls.slider?.value || 0));
    const radii = bodies
      .map((body, index) => {
        if (index === centralIndex) return null;
        const state = currentSample.bodies[index];
        const centralState = currentSample.bodies[centralIndex];
        if (!state || !centralState) return null;
        return normVec(subVec(state, centralState));
      })
      .filter((radius) => Number.isFinite(radius) && radius > 1e-6)
      .sort((a, b) => a - b);
    if (!radii.length) return { ok: false, reason: "no orbiting bodies" };
    for (let i = 1; i < radii.length; i += 1) {
      if ((radii[i] - radii[i - 1]) / Math.max(radii[i - 1], 1e-9) < 0.18) {
        return { ok: false, reason: "orbits are not well separated" };
      }
    }
    return { ok: true, centralIndex };
  }

  function updateKeplerStatus(sample) {
    if (!controls.keplerStatus) return;
    if (!controls.showKeplerThird?.checked) {
      controls.keplerStatus.classList.remove("is-visible");
      controls.keplerStatus.innerHTML = "";
      return;
    }
    const model = readModel();
    const applicability = keplerThirdApplicability(sample);
    if (!applicability.ok) {
      controls.keplerStatus.classList.add("is-visible");
      controls.keplerStatus.innerHTML = `
        <h3>Kepler III</h3>
        <div class="celestial-kepler-note">Unavailable: ${escapeHtml(applicability.reason)}.</div>
      `;
      return;
    }
    const centralIndex = applicability.centralIndex;
    const rows = bodies.map((body, index) => {
      if (index === centralIndex) return null;
      const mu = model.g * (bodies[centralIndex].mass + body.mass);
      const expected = (4 * Math.PI * Math.PI) / Math.max(mu, 1e-9);
      const measured = measuredKeplerOrbit(centralIndex, index, sample.t);
      if (measured.measuring) {
        return { name: body.name, measuring: true, reason: measured.reason, expected };
      }
      const { a, period } = measured;
      const ratio = (period * period) / Math.max(Math.pow(a, 3), 1e-9);
      const errorPercent = ((ratio - expected) / Math.max(Math.abs(expected), 1e-9)) * 100;
      return { name: body.name, a, period, ratio, expected, errorPercent, measured };
    }).filter(Boolean);
    controls.keplerStatus.classList.add("is-visible");
    if (!rows.length) {
      controls.keplerStatus.innerHTML = `
        <h3>Kepler III</h3>
        <div class="celestial-kepler-note">Unavailable: no orbiting bodies.</div>
      `;
      return;
    }
    const bodyRows = rows.map((row) => {
      if (row.measuring) {
        return `
          <span>${escapeHtml(row.name)}</span>
          <span>measuring</span>
          <span>-</span>
          <span>-</span>
          <span class="celestial-kepler-match"><strong>...</strong><span class="celestial-kepler-bar" title="${escapeHtml(row.reason)}"><i style="width:0%"></i></span></span>
        `;
      }
      const score = Math.max(0, Math.min(100, 100 - Math.abs(row.errorPercent) * 10));
      const scoreLabel = `${score.toFixed(0)}%`;
      return `
        <span>${escapeHtml(row.name)}</span>
        <span>${row.a.toFixed(2)}</span>
        <span>${row.period.toFixed(2)}</span>
        <span>${row.ratio.toFixed(3)}</span>
        <span class="celestial-kepler-match"><strong>${scoreLabel}</strong><span class="celestial-kepler-bar" title="expected ${row.expected.toFixed(3)}, error ${row.errorPercent.toFixed(2)}%"><i style="width:${score.toFixed(0)}%"></i></span></span>
      `;
    }).join("");
    controls.keplerStatus.innerHTML = `
      <h3>Kepler III around ${escapeHtml(bodies[centralIndex].name)}</h3>
      <div class="celestial-kepler-grid">
        <span class="header">body</span>
        <span class="header">a</span>
        <span class="header">T</span>
        <span class="header">T^2/a^3</span>
        <span class="header">match</span>
        ${bodyRows}
      </div>
      <div class="celestial-kepler-note">Measured from the last completed radial cycle in the simulated trajectory: T is periapsis-to-periapsis time and a = (periapsis + apoapsis) / 2. Expected value is 4 pi^2 / G(M + m).</div>
    `;
  }

  function updateLagrangeStatus(sample) {
    if (!controls.lagrangeStatus) return;
    if (!controls.showLagrange?.checked) {
      controls.lagrangeStatus.classList.remove("is-visible");
      controls.lagrangeStatus.innerHTML = "";
      return;
    }
    const data = lagrangePointsForSample(sample);
    if (!data) {
      controls.lagrangeStatus.classList.add("is-visible");
      controls.lagrangeStatus.innerHTML = `
        <h3>Lagrange points</h3>
        <div class="celestial-lagrange-note">Unavailable: need a separated reference pair.</div>
      `;
      return;
    }
    const { pair } = data;
    const model = readModel();
    const mu = pair.mu;
    const eccentricity = pairEccentricity(pair, model);
    const period = pair.angularSpeed > 1e-9 ? (Math.PI * 2) / pair.angularSpeed : null;
    const l45 = mu < 0.03852 ? "L4/L5 linearly stable" : "L4/L5 unstable for this mass ratio";
    const approximation = bodies.length > 2
      ? "Approximate: extra bodies perturb these pair-based points."
      : "Classical circular restricted three-body approximation.";
    const circularityNote = eccentricity == null
      ? "Circularity unknown."
      : eccentricity < 0.03
        ? `Near-circular pair orbit, e~${eccentricity.toFixed(3)}.`
        : `Pair orbit is not circular, e~${eccentricity.toFixed(3)}; L4/L5 placement is an instantaneous approximation and may drift quickly.`;
    controls.lagrangeStatus.classList.add("is-visible");
    controls.lagrangeStatus.innerHTML = `
      <h3>Lagrange points</h3>
      <div class="celestial-lagrange-grid">
        <span class="header">pair</span>
        <span>${escapeHtml(pair.primary.name)} - ${escapeHtml(pair.secondary.name)}</span>
        <span class="header">mu</span>
        <span>${mu.toFixed(4)}</span>
        <span class="header">distance</span>
        <span>${pair.distance.toFixed(3)}</span>
        <span class="header">period</span>
        <span>${period == null ? "n/a" : period.toFixed(2)}</span>
        <span class="header">pair e</span>
        <span>${eccentricity == null ? "n/a" : eccentricity.toFixed(3)}</span>
        <span class="header">demo</span>
        <span>${eccentricity != null && eccentricity < 0.03 ? "near-circular" : "instantaneous"}</span>
        <span class="header">L1-L3</span>
        <span>unstable</span>
        <span class="header">L4/L5</span>
        <span>${l45}</span>
      </div>
      <div class="celestial-lagrange-note">${approximation} ${circularityNote}</div>
    `;
  }

  function updateTidalStatus(sample) {
    if (!controls.tidalStatus) return;
    const tidalVisible = Boolean(controls.showTidalForces?.checked);
    const rocheVisible = Boolean(controls.showRocheLimit?.checked || controls.rocheBreakup?.checked);
    if (!tidalVisible && !rocheVisible) {
      controls.tidalStatus.classList.remove("is-visible");
      controls.tidalStatus.innerHTML = "";
      return;
    }
    const model = readModel();
    const diagnostics = tidalDiagnosticsForSample(sample, model);
    controls.tidalStatus.classList.add("is-visible");
    const targetIndexForStatus = bodies.findIndex((body) => body.id === selectedBodyId);
    const targetStateForStatus = sample?.bodies?.[targetIndexForStatus];
    if (!diagnostics && targetStateForStatus?.fragmented) {
      const field = (sample.debris || []).find((item) => item.targetIndex === targetIndexForStatus);
      const gravityLabel = field?.gravityMode === "self"
        ? "fragment N-body"
        : field?.gravityMode === "collective"
          ? "collective mass"
          : "tracer cloud";
      const gravityNote = field?.gravityMode === "self"
        ? "Fragments mutually attract each other and compact bodies feel each fragment."
        : field?.gravityMode === "collective"
          ? "Compact bodies feel the debris center of mass; fragments still move as individual particles."
          : "Fragments are visual/test particles: they feel compact bodies, but do not pull back on them.";
      controls.tidalStatus.innerHTML = `
        <h3>Roche disruption</h3>
        <div class="celestial-lagrange-grid">
          <span class="header">selected body</span>
          <span>${escapeHtml(bodies[targetIndexForStatus]?.name || "body")}</span>
          <span class="header">status</span>
          <span>fragmented</span>
          <span class="header">fragments</span>
          <span>${field?.particles?.length ?? "n/a"}</span>
          <span class="header">debris gravity</span>
          <span>${gravityLabel}</span>
          <span class="header">t</span>
          <span>${Number(targetStateForStatus.fragmentedAt || sample.t).toFixed(2)}</span>
        </div>
        <div class="celestial-lagrange-note">The original body has crossed the accumulated Roche damage threshold and is now shown as a debris field. ${gravityNote} This is a teaching model, not a material-fracture solver.</div>
      `;
      return;
    }
    if (!diagnostics) {
      controls.tidalStatus.innerHTML = `
        <h3>Tidal field</h3>
        <div class="celestial-lagrange-note">Select an active body with at least one external gravitating body.</div>
      `;
      return;
    }
    const formatPercentRatio = (value) => {
      if (!Number.isFinite(value)) return "n/a";
      const percent = value * 100;
      const abs = Math.abs(percent);
      if (abs >= 0.1 && abs < 1000) return `${percent.toFixed(abs >= 10 ? 1 : 2)}%`;
      return `${percent.toExponential(2)}%`;
    };
    const surfaceRatio = formatPercentRatio(diagnostics.ratio);
    const sourceRatio = formatPercentRatio(diagnostics.sourceRatio);
    const sourcePull = Number.isFinite(diagnostics.sourcePull)
      ? diagnostics.sourcePull.toExponential(2)
      : "n/a";
    const overlayScale = tidalOverlayScaleFor(model, diagnostics);
    const orbitPeakRatio = overlayScale.maxAcross > 0 ? diagnostics.across / overlayScale.maxAcross : Number.NaN;
    const orbitPeakPercent = formatPercentRatio(orbitPeakRatio);
    const sourceRadius = stateRadius(diagnostics.source.state, diagnostics.source.index);
    const contactDistance = diagnostics.radius + sourceRadius;
    const contactNote = diagnostics.source.distance <= contactDistance
      ? " The bodies are overlapping or touching at this sample, so the tidal ratio is no longer a clean separated-body estimate."
      : diagnostics.source.distance <= contactDistance * 1.15
        ? " This is a near-contact pass; the tidal ratio is very sensitive to small distance changes."
        : "";
    const roche = rocheVisible ? rocheDiagnosticsFromTidal(diagnostics) : null;
    const rocheRows = roche
      ? `
        <span class="header">Roche fluid</span>
        <span>${roche.fluid.toFixed(3)}</span>
        <span class="header">distance / fluid</span>
        <span>${roche.fluidRatio.toFixed(2)}</span>
        <span class="header">Roche rigid</span>
        <span>${roche.rigid.toFixed(3)}</span>
        <span class="header">distance / rigid</span>
        <span>${roche.rigidRatio.toFixed(2)}</span>
      `
      : "";
    const rocheNote = roche
      ? roche.fluidRatio < 1
        ? " The selected body is inside the fluid Roche limit for this source."
        : roche.rigidRatio < 1
          ? " The selected body is inside the rigid Roche limit."
          : roche.fluidRatio < 1.15
            ? " The selected body is close to the fluid Roche limit."
            : ""
      : "";
    const damageEnabled = Boolean(controls.showRocheLimit?.checked || controls.rocheBreakup?.checked);
    const reconstructedDamage = damageEnabled
      ? (() => {
        const series = rocheDamageSeries(samplesUntil(sample.t), model);
        return series.selectedDamage[series.selectedDamage.length - 1] || 0;
      })()
      : 0;
    const damage = Math.max(Number(diagnostics.targetState?.rocheDamage) || 0, reconstructedDamage);
    const instantaneousSeverity = roche ? rocheDamageSeverity(roche, readRocheBreakupModel()) : 0;
    const severity = Math.max(Number(diagnostics.targetState?.rocheSeverity) || 0, instantaneousSeverity);
    const formatSmall = (value) => {
      if (!Number.isFinite(value)) return "n/a";
      const abs = Math.abs(value);
      if (abs === 0) return "0";
      if (abs < 0.01) return value.toExponential(2);
      return value.toFixed(abs < 1 ? 3 : 2);
    };
    const damageState = !damageEnabled
      ? ""
      : !roche
        ? "no Roche source"
        : roche.rigidRatio < 1
          ? "inside rigid Roche"
          : roche.fluidRatio < 1
            ? "inside fluid Roche"
            : "outside Roche limit";
    const damageRows = damageEnabled
      ? `
        <span class="header">tidal damage</span>
        <span>${formatSmall(Math.min(1, damage))}</span>
        <span class="header">damage rate</span>
        <span>${formatSmall(severity)}</span>
        <span class="header">breakup state</span>
        <span>${escapeHtml(damageState)}</span>
        <span class="header">breakup mode</span>
        <span>${controls.rocheBreakup?.checked ? "fragment at damage = 1" : "diagnostic only"}</span>
      `
      : "";
    const damageNote = damageEnabled
      ? damage >= 0.75
        ? (controls.rocheBreakup?.checked ? " Roche breakup is imminent if the body stays in the disruptive zone." : " Roche damage has reached the danger zone; enable breakup to fragment the body at damage = 1.")
        : damage > 0.25
          ? " Roche damage is accumulating; a fast flyby may still escape before breakup."
          : " Roche damage accumulates over a finite internal response time, so crossing the boundary is not an instant explosion."
      : "";
    const spinDiagnostics = controls.showTidalLocking?.checked
      ? spinOrbitDiagnosticsForSample(sample, model)
      : null;
    const spinRows = spinDiagnostics
      ? `
        <span class="header">spin / orbit</span>
        <span>${spinDiagnostics.spinRatio.toFixed(2)}</span>
        <span class="header">spin omega</span>
        <span>${spinDiagnostics.spinOmega.toExponential(2)}</span>
        <span class="header">orbit rate</span>
        <span>${spinDiagnostics.orbitalRate.toExponential(2)}</span>
        <span class="header">tidal torque</span>
        <span>${spinDiagnostics.torque.toExponential(2)}</span>
        <span class="header">bulk spin L</span>
        <span>${spinDiagnostics.bulkSpinL.toExponential(2)}</span>
        <span class="header">orbit L</span>
        <span>${spinDiagnostics.orbitL.toExponential(2)}</span>
        <span class="header">heat</span>
        <span>${spinDiagnostics.heat.toExponential(2)}</span>
        <span class="header">k2 / lag / alpha</span>
        <span>${spinDiagnostics.k2.toFixed(2)} / ${spinDiagnostics.timeLag.toFixed(2)} / ${spinDiagnostics.inertiaAlpha.toFixed(2)}</span>
        <span class="header">outcome</span>
        <span>${escapeHtml(spinDiagnostics.spinState)}</span>
      `
      : "";
    const spinNote = spinDiagnostics
      ? " Spin-orbit locking uses a planar constant-time-lag torque approximation here: the selected body's bulk spin exchanges angular momentum with the relative orbit, while lost mechanical energy is tracked as heat."
      : "";
    controls.tidalStatus.innerHTML = `
      <h3>Tidal field on ${escapeHtml(diagnostics.targetBody.name)}</h3>
      <div class="celestial-lagrange-grid">
        <span class="header">main source</span>
        <span>${escapeHtml(diagnostics.sourceBody?.name || "body")}</span>
        <span class="header">distance</span>
        <span>${diagnostics.source.distance.toFixed(3)}</span>
        <span class="header">near-far tide delta a</span>
        <span>${diagnostics.across.toExponential(2)}</span>
        <span class="header">near-far tide delta a / surface g</span>
        <span>${surfaceRatio}</span>
        <span class="header">source pull</span>
        <span>${sourcePull}</span>
        <span class="header">near-far tide delta a / source pull</span>
        <span>${sourceRatio}</span>
        <span class="header">current / orbit peak</span>
        <span>${orbitPeakPercent}</span>
        ${rocheRows}
        ${damageRows}
        ${spinRows}
      </div>
      <div class="celestial-lagrange-note">Arrows show total differential gravitational acceleration from all other bodies, relative to the selected body's center. The near side is pulled more than the center; the far side is pulled less than the center, so in the center-following frame it also points outward. The main source is the largest single G M / r^3 contribution.${contactNote}${rocheNote}${damageNote}${spinNote}</div>
    `;
  }

  function orbitPoint(model, phase) {
    const e = Math.min(model.eccentricity, 0.98);
    const a = model.semiMajor;
    const b = a * Math.sqrt(Math.max(0, 1 - e * e));
    const angle = phase * Math.PI * 2;
    return {
      x: a * Math.cos(angle) - a * e,
      y: b * Math.sin(angle)
    };
  }

  function makeStripedTexture(kind) {
    if (!window.THREE) return null;
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = 256;
    textureCanvas.height = 128;
    const ctx = textureCanvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, textureCanvas.height);

    if (kind === "mars") {
      gradient.addColorStop(0, "#8f3d24");
      gradient.addColorStop(0.5, "#c46b3e");
      gradient.addColorStop(1, "#6f2d1b");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, textureCanvas.width, textureCanvas.height);
      ctx.fillStyle = "rgba(255, 210, 160, 0.28)";
      for (let i = 0; i < 42; i += 1) {
        const x = (i * 47) % textureCanvas.width;
        const y = (i * 29) % textureCanvas.height;
        ctx.beginPath();
        ctx.ellipse(x, y, 10 + (i % 8), 3 + (i % 4), i * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      gradient.addColorStop(0, "#d8b383");
      gradient.addColorStop(0.5, "#f1d5a5");
      gradient.addColorStop(1, "#9f7656");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, textureCanvas.width, textureCanvas.height);
      const bands = ["#b46b42", "#f6dfb8", "#8f573b", "#e3b978", "#f9e8c7"];
      for (let y = 0; y < textureCanvas.height; y += 11) {
        ctx.fillStyle = bands[(y / 11) % bands.length | 0];
        ctx.globalAlpha = 0.55;
        ctx.fillRect(0, y, textureCanvas.width, 5 + (y % 4));
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(130, 52, 38, 0.55)";
      ctx.beginPath();
      ctx.ellipse(176, 70, 28, 10, -0.12, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  function makeStarTexture() {
    if (!window.THREE) return null;
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = 512;
    textureCanvas.height = 256;
    const ctx = textureCanvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, textureCanvas.height);
    gradient.addColorStop(0, "#f97316");
    gradient.addColorStop(0.18, "#fbbf24");
    gradient.addColorStop(0.5, "#ffe08a");
    gradient.addColorStop(0.82, "#f59e0b");
    gradient.addColorStop(1, "#b45309");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, textureCanvas.width, textureCanvas.height);

    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 260; i += 1) {
      const x = Math.random() * textureCanvas.width;
      const y = Math.random() * textureCanvas.height;
      const rx = 5 + Math.random() * 26;
      const ry = 2 + Math.random() * 8;
      const alpha = 0.035 + Math.random() * 0.11;
      ctx.fillStyle = `rgba(255, ${170 + Math.random() * 70}, ${40 + Math.random() * 80}, ${alpha})`;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalCompositeOperation = "multiply";
    for (let i = 0; i < 95; i += 1) {
      const x = Math.random() * textureCanvas.width;
      const y = Math.random() * textureCanvas.height;
      const rx = 10 + Math.random() * 42;
      const ry = 2 + Math.random() * 9;
      ctx.fillStyle = `rgba(120, 36, 12, ${0.025 + Math.random() * 0.09})`;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalCompositeOperation = "source-over";
    const image = ctx.getImageData(0, 0, textureCanvas.width, textureCanvas.height);
    for (let i = 0; i < image.data.length; i += 4) {
      const grain = (Math.random() - 0.5) * 30;
      image.data[i] = Math.max(0, Math.min(255, image.data[i] + grain));
      image.data[i + 1] = Math.max(0, Math.min(255, image.data[i + 1] + grain * 0.7));
      image.data[i + 2] = Math.max(0, Math.min(255, image.data[i + 2] + grain * 0.25));
    }
    ctx.putImageData(image, 0, 0);

    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  function makeCoronaTexture() {
    if (!window.THREE) return null;
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = 256;
    textureCanvas.height = 256;
    const ctx = textureCanvas.getContext("2d");
    const cx = textureCanvas.width / 2;
    const cy = textureCanvas.height / 2;
    const gradient = ctx.createRadialGradient(cx, cy, 30, cx, cy, 126);
    gradient.addColorStop(0, "rgba(255, 244, 190, 0.9)");
    gradient.addColorStop(0.22, "rgba(251, 191, 36, 0.42)");
    gradient.addColorStop(0.54, "rgba(248, 113, 22, 0.16)");
    gradient.addColorStop(1, "rgba(248, 113, 22, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, textureCanvas.width, textureCanvas.height);
    ctx.strokeStyle = "rgba(255, 228, 150, 0.18)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 42; i += 1) {
      const angle = (i / 42) * Math.PI * 2;
      const r0 = 42 + Math.random() * 14;
      const r1 = 92 + Math.random() * 34;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * r0, cy + Math.sin(angle) * r0);
      ctx.lineTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
      ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.needsUpdate = true;
    return texture;
  }

  function makeStarField() {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    for (let i = 0; i < 850; i += 1) {
      const radius = 18 + Math.random() * 34;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions.push(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
      );
    }
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xe2e8f0,
      size: 0.04,
      transparent: true,
      opacity: 0.78
    });
    return new THREE.Points(geometry, material);
  }

  function makeOrbitLine(model) {
    const points = [];
    for (let i = 0; i <= 360; i += 1) {
      const p = orbitPoint(model, i / 360);
      points.push(new THREE.Vector3(p.x, 0, p.y));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0x60a5fa,
      transparent: true,
      opacity: 0.95
    });
    return new THREE.Line(geometry, material);
  }

  function makeBodyOrbitLine(body, model) {
    const points = [];
    for (let i = 0; i <= 240; i += 1) {
      points.push(bodyPosition(body, model, i / 240));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: body.type === "star" ? 0xfbbf24 : (body.texture === "mars" ? 0xf97316 : 0x60a5fa),
      transparent: true,
      opacity: body.type === "star" ? 0.32 : 0.7
    });
    return new THREE.Line(geometry, material);
  }

  function bodyPosition(body, model, progress) {
    const sample = sampleForProgress(progress);
    const index = bodies.findIndex((item) => item.id === body.id);
    const state = sample.bodies[index] || bodyState(body);
    return new THREE.Vector3(state.x, state.y, state.z);
  }

  function viewAdjustedPointForSample(sample, bodyIndex, currentOrigin) {
    const state = sample.bodies[bodyIndex];
    if (!state) return null;
    if ((controls.viewFrame?.value || "inertial") === "rotatingPair") {
      return vector3FromVec(samplePositionInView(sample, state));
    }
    const sampleOrigin = viewOriginForSample(sample);
    return new THREE.Vector3(
      state.x - sampleOrigin.x + currentOrigin.x,
      state.y - sampleOrigin.y + currentOrigin.y,
      state.z - sampleOrigin.z + currentOrigin.z
    );
  }

  function viewAdjustedCollisionPoint(event, currentOrigin) {
    if (!event?.position) return null;
    const sample = sampleForTime(event.t);
    if ((controls.viewFrame?.value || "inertial") === "rotatingPair") {
      return vector3FromVec(samplePositionInView(sample, event.position));
    }
    const sampleOrigin = viewOriginForSample(sample);
    return new THREE.Vector3(
      event.position.x - sampleOrigin.x + currentOrigin.x,
      event.position.y - sampleOrigin.y + currentOrigin.y,
      event.position.z - sampleOrigin.z + currentOrigin.z
    );
  }

  function makeBodyGroup(body) {
    const group = new THREE.Group();
    group.userData.bodyId = body.id;

    if (body.type === "star") {
      const star = new THREE.Mesh(
        new THREE.SphereGeometry(body.radius, 64, 40),
        new THREE.MeshBasicMaterial({
          map: makeStarTexture(),
          color: 0xffffff
        })
      );
      star.userData.bodyId = body.id;
      group.add(star);

      const corona = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeCoronaTexture(),
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }));
      corona.scale.set(body.radius * 4.2, body.radius * 4.2, body.radius * 4.2);
      corona.userData.bodyId = body.id;
      group.add(corona);
    } else {
      const planet = new THREE.Mesh(
        new THREE.SphereGeometry(body.radius, 48, 32),
        new THREE.MeshStandardMaterial({
          map: makeStripedTexture(body.texture),
          roughness: 0.68,
          metalness: 0.02
        })
      );
      planet.userData.bodyId = body.id;
      group.add(planet);

      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(body.radius * 1.35, 32, 20),
        new THREE.MeshBasicMaterial({
          color: body.texture === "mars" ? 0xf97316 : 0x38bdf8,
          transparent: true,
          opacity: 0.11,
          depthWrite: false
        })
      );
      glow.userData.bodyId = body.id;
      group.add(glow);

      const spinBand = new THREE.Mesh(
        new THREE.TorusGeometry(body.radius * 1.08, Math.max(body.radius * 0.012, 0.003), 8, 72),
        new THREE.MeshBasicMaterial({
          color: 0xf8fafc,
          transparent: true,
          opacity: 0.62,
          depthWrite: false
        })
      );
      spinBand.userData.bodyId = body.id;
      spinBand.userData.spinBulkMarker = true;
      spinBand.rotation.x = Math.PI / 2;
      spinBand.visible = false;
      group.add(spinBand);
    }

    const pickSphere = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(body.radius * 2.2, 0.18), 24, 16),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false
      })
    );
    pickSphere.userData.bodyId = body.id;
    group.add(pickSphere);

    return group;
  }

  function rebuildBodyMeshes() {
    if (!three) return;
    three.bodyGroup.children.slice().forEach((child) => {
      three.bodyGroup.remove(child);
      disposeObject(child);
    });
    three.bodyMeshes = new Map();
    three.trailLines = new Map();
    three.bodyOrbitLines = new Map();
    three.pickables = [];
    bodies.forEach((body) => {
      if (body.orbit > 0) {
        const orbitLine = makeBodyOrbitLine(body, readModel());
        orbitLine.visible = false;
        three.bodyOrbitLines.set(body.id, orbitLine);
        three.bodyGroup.add(orbitLine);
      }

      const group = makeBodyGroup(body);
      three.bodyMeshes.set(body.id, group);
      three.bodyGroup.add(group);
      group.traverse((child) => {
        if (child.isMesh) three.pickables.push(child);
      });

      const trail = new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({
          color: body.type === "star" ? 0xfbbf24 : (body.texture === "mars" ? 0xf97316 : 0x38bdf8),
          transparent: true,
          opacity: body.type === "star" ? 0.34 : 0.52
        })
      );
      trail.visible = controls.showTrails?.checked ?? true;
      three.trailLines.set(body.id, trail);
      three.bodyGroup.add(trail);
    });
    three.bodyMeshSignature = bodies.map((body) => [
      body.id,
      body.type,
      body.radius.toFixed(4),
      body.orbit.toFixed(4),
      body.inclination.toFixed(4),
      (body.eccentricity ?? readModel().eccentricity).toFixed(4),
      body.texture
    ].join(":")).join("|");
    three.trajectoryLineSignature = "";
  }

  function updateTrajectoryLines(progress) {
    if (!three) return;
    const currentSample = sampleForProgress(progress);
    const currentOrigin = viewOriginForSample(currentSample);
    const frame = controls.viewFrame?.value || "inertial";
    const originKey = frame === "inertial"
      ? "0:0:0"
      : `${currentOrigin.x.toFixed(5)}:${currentOrigin.y.toFixed(5)}:${currentOrigin.z.toFixed(5)}`;
    const signature = `${trajectory.signature}:${trajectory.samples.length}:${frame}:${selectedBodyId}:${originKey}`;
    if (three.trajectoryLineSignature === signature) return;
    bodies.forEach((body, bodyIndex) => {
      const line = three.bodyOrbitLines.get(body.id);
      if (!line || trajectory.samples.length < 2) return;
      line.visible = false;
      const points = trajectory.samples
        .filter((sample) => stateActive(sample.bodies[bodyIndex], bodyIndex))
        .map((sample) => viewAdjustedPointForSample(sample, bodyIndex, currentOrigin))
        .filter(Boolean);
      line.geometry.dispose();
      line.geometry = new THREE.BufferGeometry().setFromPoints(points);
    });
    three.trajectoryLineSignature = signature;
  }

  function clearKeplerOverlay() {
    if (!three?.keplerOverlayGroup) return;
    three.keplerOverlayGroup.children.slice().forEach((child) => {
      three.keplerOverlayGroup.remove(child);
      disposeObject(child);
    });
  }

  function vector3FromVec(value) {
    return new THREE.Vector3(value.x, value.y, value.z);
  }

  function makeLabelSprite(text, color = "#fef08a") {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 72;
    const ctx = canvas.getContext("2d");
    ctx.font = "700 22px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(15, 23, 42, 0.76)";
    ctx.strokeStyle = "rgba(254, 240, 138, 0.85)";
    ctx.lineWidth = 2;
    const textWidth = Math.min(220, ctx.measureText(text).width);
    const boxWidth = textWidth + 28;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(8, 12, boxWidth, 42, 10);
    } else {
      ctx.rect(8, 12, boxWidth, 42);
    }
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillText(text, 22, 34, 210);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: false
    }));
    sprite.scale.set(1.15, 0.32, 1);
    return sprite;
  }

  function addKeplerPath(bodyIndex, color) {
    const sourceSamples = trajectory.samples.length ? trajectory.samples : [sampleForProgress(Number(controls.slider.value || 0))];
    if (sourceSamples.length < 2) return;
    const step = Math.max(1, Math.ceil(sourceSamples.length / 360));
    const points = [];
    for (let i = 0; i < sourceSamples.length; i += step) {
      points.push(vector3FromVec(transformedSamplePosition(sourceSamples[i], bodyIndex)));
    }
    if (points.length < 2) return;
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.82
      })
    );
    three.keplerOverlayGroup.add(line);
  }

  function addKeplerFocusMarker(sample) {
    const focus = vector3FromVec(keplerFocusForSample(sample));
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 24, 16),
      new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.94,
        depthWrite: false
      })
    );
    marker.position.copy(focus);
    three.keplerOverlayGroup.add(marker);

    [0, Math.PI / 2].forEach((rotationY) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.18, 0.012, 8, 40),
        new THREE.MeshBasicMaterial({
          color: 0xfef08a,
          transparent: true,
          opacity: 0.66,
          depthWrite: false
        })
      );
      ring.rotation.x = Math.PI / 2;
      ring.rotation.y = rotationY;
      ring.position.copy(focus);
      three.keplerOverlayGroup.add(ring);
    });

    const crosshair = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(focus.x - 0.26, focus.y, focus.z),
        new THREE.Vector3(focus.x + 0.26, focus.y, focus.z),
        new THREE.Vector3(focus.x, focus.y - 0.26, focus.z),
        new THREE.Vector3(focus.x, focus.y + 0.26, focus.z),
        new THREE.Vector3(focus.x, focus.y, focus.z - 0.26),
        new THREE.Vector3(focus.x, focus.y, focus.z + 0.26)
      ]),
      new THREE.LineBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.84,
        depthWrite: false
      })
    );
    three.keplerOverlayGroup.add(crosshair);

    const label = makeLabelSprite(keplerFocusLabel());
    label.position.copy(focus).add(new THREE.Vector3(0.28, 0.36, 0));
    three.keplerOverlayGroup.add(label);
  }

  function addKeplerAreaSector(bodyIndex, t0, t1, color) {
    const substeps = 12;
    const focus = vector3FromVec(keplerFocusForSample(sampleForTime(t0)));
    const vertices = [];
    for (let i = 0; i < substeps; i += 1) {
      const a = t0 + (t1 - t0) * (i / substeps);
      const b = t0 + (t1 - t0) * ((i + 1) / substeps);
      const pa = vector3FromVec(transformedSamplePosition(sampleForTime(a), bodyIndex));
      const pb = vector3FromVec(transformedSamplePosition(sampleForTime(b), bodyIndex));
      vertices.push(focus.x, focus.y, focus.z, pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
    }
    if (!vertices.length) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    three.keplerOverlayGroup.add(mesh);
  }

  function updateKeplerOverlays(progress) {
    if (!three?.keplerOverlayGroup) return;
    clearKeplerOverlay();
    if (bodies.length !== 2) return;
    const showFirst = controls.showKeplerFirst?.checked;
    const showSecond = controls.showKeplerSecond?.checked;
    if (!showFirst && !showSecond) return;

    const sample = sampleForProgress(progress);
    let focusMarkerAdded = false;
    if (showFirst) {
      if ((controls.viewFrame?.value || "inertial") === "selected") {
        addKeplerPath(keplerDisplayBodyIndex(), 0x7dd3fc);
      } else {
        addKeplerPath(0, 0xfbbf24);
        addKeplerPath(1, 0x60a5fa);
      }
      addKeplerFocusMarker(sample);
      focusMarkerAdded = true;
    }

    if (showSecond) {
      const model = readModel();
      const bodyIndex = keplerDisplayBodyIndex();
      const period = twoBodyOsculatingPeriod(sample, model);
      const percent = Math.max(1, Math.min(40, numberValue(controls.keplerSecondPercent, 8)));
      const equalDt = Math.max(((period || model.timeSpan) * percent) / 100, model.h * 8);
      const currentT = sample.t;
      const colors = [0x38bdf8, 0xf97316, 0xa78bfa];
      for (let i = 0; i < 3; i += 1) {
        const t1 = currentT - equalDt * (2 - i);
        const t0 = t1 - equalDt;
        if (t0 < 0) continue;
        if (t1 > t0) addKeplerAreaSector(bodyIndex, t0, t1, colors[i]);
      }
      if (!focusMarkerAdded) addKeplerFocusMarker(sample);
    }
  }

  function clearLagrangeOverlay() {
    if (!three?.lagrangeOverlayGroup) return;
    three.lagrangeOverlayGroup.children.slice().forEach((child) => {
      three.lagrangeOverlayGroup.remove(child);
      disposeObject(child);
    });
  }

  function addLagrangeMarker(point, sample) {
    const unstableColor = 0xfb923c;
    const stableColor = 0x22c55e;
    const approximateColor = 0xa78bfa;
    const color = (point.label === "L4" || point.label === "L5")
      ? (point.stable ? stableColor : approximateColor)
      : unstableColor;
    const position = vector3FromVec(samplePositionInView(sample, point.position));
    const markerGroup = new THREE.Group();
    markerGroup.position.copy(position);

    const size = 0.17;
    const notch = 0.055;
    const markerMaterial = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: point.stable ? 0.86 : 0.78,
      depthWrite: false
    });
    [
      [new THREE.Vector3(-size, 0, 0), new THREE.Vector3(-notch, 0, 0)],
      [new THREE.Vector3(notch, 0, 0), new THREE.Vector3(size, 0, 0)],
      [new THREE.Vector3(0, 0, -size), new THREE.Vector3(0, 0, -notch)],
      [new THREE.Vector3(0, 0, notch), new THREE.Vector3(0, 0, size)]
    ].forEach(([a, b]) => {
      markerGroup.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([a, b]),
        markerMaterial
      ));
    });

    const diamond = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, -notch),
        new THREE.Vector3(notch, 0, 0),
        new THREE.Vector3(0, 0, notch),
        new THREE.Vector3(-notch, 0, 0)
      ]),
      markerMaterial
    );
    markerGroup.add(diamond);

    const label = makeLabelSprite(point.label, "#f8fafc");
    label.position.set(0.24, 0.26, 0);
    markerGroup.add(label);
    three.lagrangeOverlayGroup.add(markerGroup);
  }

  function updateLagrangeOverlays(progress) {
    if (!three?.lagrangeOverlayGroup) return;
    clearLagrangeOverlay();
    if (!controls.showLagrange?.checked) return;
    const sample = sampleForProgress(progress);
    const data = lagrangePointsForSample(sample);
    if (!data) return;
    Object.values(data.points).forEach((point) => addLagrangeMarker(point, sample));
  }

  function clearTidalOverlay() {
    if (!three?.tidalOverlayGroup) return;
    three.tidalOverlayGroup.children.slice().forEach((child) => {
      three.tidalOverlayGroup.remove(child);
      disposeObject(child);
    });
  }

  function addTidalArrow(sample, probe, maxDelta, radius) {
    const deltaMagnitude = normVec(probe.delta);
    if (deltaMagnitude <= 1e-12 || maxDelta <= 0) return;
    const origin = vector3FromVec(samplePositionInView(sample, probe.position));
    const direction = vector3FromVec(normalizeVec(sampleVectorInView(sample, probe.delta)));
    const outward = dotVec(probe.offset, probe.delta) >= 0;
    const strength = Math.max(0, Math.min(1, deltaMagnitude / maxDelta));
    const visibleStrength = Math.sqrt(strength);
    const minLength = outward ? radius * 0.28 : radius * 0.42;
    const maxLength = outward ? radius * 1.14 : radius * 0.9;
    const length = Math.max(minLength, Math.min(maxLength, minLength + visibleStrength * radius * 0.72));
    const arrow = new THREE.ArrowHelper(
      direction,
      origin,
      length,
      outward ? 0x38bdf8 : 0xfb923c,
      Math.max(0.045, length * 0.22),
      Math.max(0.025, length * 0.11)
    );
    arrow.traverse((object) => {
      if (object.material) {
        object.material.transparent = true;
        object.material.opacity = (outward ? 0.24 : 0.2) + visibleStrength * (outward ? 0.64 : 0.58);
        object.material.depthWrite = false;
      }
    });
    three.tidalOverlayGroup.add(arrow);
  }

  function addTidalShape(sample, diagnostics, visualRadius) {
    if (!window.THREE) return;
    const target = sample.bodies[diagnostics.targetIndex];
    const sourceAxis = normalizeVec(subVec(diagnostics.source.state, target), vec(1, 0, 0));
    const spinDiagnostics = controls.showTidalLocking?.checked
      ? spinOrbitDiagnosticsForSample(sample, readModel())
      : null;
    let bulgeAxis = sourceAxis;
    if (spinDiagnostics && Number.isFinite(spinDiagnostics.spinOmega) && Number.isFinite(spinDiagnostics.orbitalRate)) {
      const relativeVelocity = subVec(
        vec(target.vx, target.vy, target.vz),
        vec(diagnostics.source.state.vx, diagnostics.source.state.vy, diagnostics.source.state.vz)
      );
      const orbitAxis = normalizeVec(crossVec(subVec(target, diagnostics.source.state), relativeVelocity), vec(0, 1, 0));
      const lagAngle = Math.max(-0.42, Math.min(0.42, (spinDiagnostics.spinOmega - spinDiagnostics.orbitalRate) * 0.16));
      bulgeAxis = normalizeVec(rotateVecAroundAxis(sourceAxis, orbitAxis, lagAngle), sourceAxis);
    }
    const sideAxis = normalizeVec(crossVec(bulgeAxis, vec(0, 1, 0)), diagnostics.probes[2]?.offset || vec(0, 1, 0));
    const center = sample.bodies[diagnostics.targetIndex];
    const stretch = visualRadius * 1.28;
    const squeeze = visualRadius * 0.72;
    const points = [];
    for (let step = 0; step <= 96; step += 1) {
      const theta = (step / 96) * Math.PI * 2;
      const position = addVec(
        center,
        addVec(
          scaleVec(bulgeAxis, Math.cos(theta) * stretch),
          scaleVec(sideAxis, Math.sin(theta) * squeeze)
        )
      );
      points.push(vector3FromVec(samplePositionInView(sample, position)));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.74,
      depthWrite: false
    });
    const outline = new THREE.LineLoop(geometry, material);
    three.tidalOverlayGroup.add(outline);

    const centerInView = vector3FromVec(transformedSamplePosition(sample, diagnostics.targetIndex));
    const sourceAxisInView = vector3FromVec(normalizeVec(sampleVectorInView(sample, bulgeAxis)));
    const sideAxisInView = vector3FromVec(normalizeVec(sampleVectorInView(sample, sideAxis)));
    const stretchLabel = makeLabelSprite(spinDiagnostics ? "lagged bulge" : "stretch", "#bae6fd");
    stretchLabel.position.copy(centerInView).add(sourceAxisInView.multiplyScalar(stretch * 1.35));
    three.tidalOverlayGroup.add(stretchLabel);
    const squeezeLabel = makeLabelSprite("squeeze", "#fed7aa");
    squeezeLabel.position.copy(centerInView).add(sideAxisInView.multiplyScalar(squeeze * 1.65));
    three.tidalOverlayGroup.add(squeezeLabel);
  }

  function rocheOrbitBasis(sample, roche) {
    const source = roche.sourceState;
    const target = sample.bodies[roche.targetIndex];
    if (!source || !target) {
      return { eX: vec(1, 0, 0), eY: vec(0, 0, 1) };
    }
    const radial = normalizeVec(subVec(target, source), vec(1, 0, 0));
    const relativeVelocity = subVec(vec(target.vx, target.vy, target.vz), vec(source.vx, source.vy, source.vz));
    const normal = normalizeVec(crossVec(radial, relativeVelocity), vec(0, 1, 0));
    const tangent = normalizeVec(crossVec(normal, radial), vec(0, 0, 1));
    return { eX: radial, eY: tangent };
  }

  function addRocheRing(sample, roche, radius, label, color, inside) {
    if (!window.THREE || !roche || !Number.isFinite(radius) || radius <= 0) return;
    const { eX, eY } = rocheOrbitBasis(sample, roche);
    const points = [];
    for (let step = 0; step <= 160; step += 1) {
      const theta = (step / 160) * Math.PI * 2;
      const position = addVec(
        roche.sourceState,
        addVec(
          scaleVec(eX, Math.cos(theta) * radius),
          scaleVec(eY, Math.sin(theta) * radius)
        )
      );
      points.push(vector3FromVec(samplePositionInView(sample, position)));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: inside ? 0.96 : 0.62,
      depthWrite: false
    });
    const ring = new THREE.LineLoop(geometry, material);
    three.tidalOverlayGroup.add(ring);

    const labelPosition = addVec(roche.sourceState, scaleVec(eX, radius * 1.04));
    const sprite = makeLabelSprite(label, inside ? "#fecaca" : "#ddd6fe");
    sprite.position.copy(vector3FromVec(samplePositionInView(sample, labelPosition)));
    three.tidalOverlayGroup.add(sprite);
  }

  function addRocheOverlay(sample, diagnostics) {
    const roche = rocheDiagnosticsFromTidal(diagnostics);
    if (!roche) return;
    const mode = controls.rocheMode?.value || "both";
    if (mode === "fluid" || mode === "both") {
      addRocheRing(sample, roche, roche.fluid, "Roche fluid", 0xef4444, roche.fluidRatio < 1);
    }
    if (mode === "rigid" || mode === "both") {
      addRocheRing(sample, roche, roche.rigid, "Roche rigid", 0xa855f7, roche.rigidRatio < 1);
    }
  }

  function addRocheDamageHalo(sample, diagnostics) {
    if (!window.THREE || !diagnostics || !controls.rocheBreakup?.checked) return;
    const damage = Math.max(0, Math.min(1, Number(diagnostics.targetState?.rocheDamage) || 0));
    if (damage <= 0.02) return;
    const center = sample.bodies[diagnostics.targetIndex];
    const sourceAxis = normalizeVec(subVec(diagnostics.source.state, center), vec(1, 0, 0));
    const sideAxis = normalizeVec(diagnostics.probes[2]?.offset || vec(0, 1, 0));
    const radius = Math.max(0.12, diagnostics.radius * (1.52 + damage * 0.35));
    const points = [];
    for (let step = 0; step <= 72; step += 1) {
      const theta = (step / 72) * Math.PI * 2;
      const wobble = 1 + Math.sin(theta * 7 + damage * 6) * 0.045 * damage;
      const position = addVec(
        center,
        addVec(
          scaleVec(sourceAxis, Math.cos(theta) * radius * wobble),
          scaleVec(sideAxis, Math.sin(theta) * radius * wobble * (1 - damage * 0.18))
        )
      );
      points.push(vector3FromVec(samplePositionInView(sample, position)));
    }
    const color = damage > 0.72 ? 0xef4444 : 0xf59e0b;
    const halo = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.28 + damage * 0.5,
        depthWrite: false
      })
    );
    three.tidalOverlayGroup.add(halo);
    const crackCount = Math.min(9, 2 + Math.floor(damage * 8));
    for (let index = 0; index < crackCount; index += 1) {
      const theta = (index / crackCount) * Math.PI * 2 + damage * 0.8;
      const inner = addVec(center, addVec(scaleVec(sourceAxis, Math.cos(theta) * radius * 0.36), scaleVec(sideAxis, Math.sin(theta) * radius * 0.28)));
      const outer = addVec(center, addVec(scaleVec(sourceAxis, Math.cos(theta) * radius * 0.9), scaleVec(sideAxis, Math.sin(theta) * radius * 0.72)));
      const crack = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          vector3FromVec(samplePositionInView(sample, inner)),
          vector3FromVec(samplePositionInView(sample, outer))
        ]),
        new THREE.LineBasicMaterial({
          color,
          transparent: true,
          opacity: 0.2 + damage * 0.55,
          depthWrite: false
        })
      );
      three.tidalOverlayGroup.add(crack);
    }
  }

  function updateTidalOverlays(progress) {
    if (!three?.tidalOverlayGroup) return;
    clearTidalOverlay();
    const tidalVisible = Boolean(controls.showTidalForces?.checked);
    const rocheVisible = Boolean(controls.showRocheLimit?.checked || controls.rocheBreakup?.checked);
    if (!tidalVisible && !rocheVisible) return;
    const sample = sampleForProgress(progress);
    const model = readModel();
    const diagnostics = tidalDiagnosticsForSample(sample, model);
    if (!diagnostics) return;
    if (rocheVisible) addRocheOverlay(sample, diagnostics);
    addRocheDamageHalo(sample, diagnostics);
    if (tidalVisible) {
      const overlayScale = tidalOverlayScaleFor(model, diagnostics);
      const maxDelta = overlayScale.maxDelta || Math.max(...diagnostics.probes.map((probe) => normVec(probe.delta)), 0);
      const visualRadius = Math.max(0.14, diagnostics.radius * 1.35);
      const mode = controls.tidalOverlayMode?.value || "both";
      if (mode === "shape" || mode === "both") addTidalShape(sample, diagnostics, visualRadius);
      if (mode === "arrows" || mode === "both") {
        diagnostics.probes.forEach((probe) => addTidalArrow(sample, probe, maxDelta, visualRadius));
      }
      const label = makeLabelSprite("tidal gradient", "#bae6fd");
      label.position.copy(vector3FromVec(transformedSamplePosition(sample, diagnostics.targetIndex))).add(new THREE.Vector3(0.32, visualRadius * 1.25, 0));
      three.tidalOverlayGroup.add(label);
    }
  }

  function clearThreeGroup(group) {
    if (!group) return;
    group.children.slice().forEach((child) => {
      group.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.());
        else child.material.dispose?.();
      }
    });
  }

  function updateDebrisMeshes(sample) {
    if (!window.THREE || !three?.debrisGroup) return;
    clearThreeGroup(three.debrisGroup);
    const fields = sample.debris || [];
    fields.forEach((field) => {
      const center = debrisFieldCenterOfMass(field);
      const birthDuration = Math.max(0.25, Number(field.birthDuration) || 0.8);
      const coreFade = Math.max(0, 1 - (Number(field.age) || 0) / (birthDuration * 1.45));
      if (center && coreFade > 0.02 && field.parentRadius) {
        const coreGeometry = new THREE.SphereGeometry(Math.max(0.018, field.parentRadius * (0.75 + coreFade * 0.18)), 28, 18);
        const coreMaterial = new THREE.MeshBasicMaterial({
          color: field.coreColor || field.color || "#f1d5a5",
          transparent: true,
          opacity: 0.24 * coreFade,
          depthWrite: false
        });
        const core = new THREE.Mesh(coreGeometry, coreMaterial);
        core.position.copy(vector3FromVec(samplePositionInView(sample, center)));
        core.scale.set(1.12, 0.92, 0.92);
        three.debrisGroup.add(core);
      }
      field.particles.forEach((particle, index) => {
        if ((particle.opacity ?? 1) <= 0.02) return;
        const geometry = new THREE.SphereGeometry(Math.max(0.012, particle.radius), 10, 8);
        const material = new THREE.MeshBasicMaterial({
          color: particle.color || field.color || "#f59e0b",
          transparent: true,
          opacity: Math.max(0.16, Math.min(0.95, particle.opacity ?? 1)),
          depthWrite: false
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(vector3FromVec(samplePositionInView(sample, particle)));
        const pulse = 1 + 0.16 * Math.sin((field.age || 0) * 10 + index);
        mesh.scale.setScalar(pulse);
        three.debrisGroup.add(mesh);
      });
      if (field.gravityMode === "collective" && center) {
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(Math.max(0.016, (field.parentRadius || 0.12) * 0.08), 12, 8),
          new THREE.MeshBasicMaterial({
            color: 0xf8fafc,
            transparent: true,
            opacity: 0.72,
            depthWrite: false
          })
        );
        marker.position.copy(vector3FromVec(samplePositionInView(sample, center)));
        three.debrisGroup.add(marker);
      }
    });
  }

  function updateBodyMeshes(model, progress) {
    if (!three) return;
    ensureBodies();
    const signature = bodies.map((body) => [
      body.id,
      body.type,
      body.radius.toFixed(4),
      body.orbit.toFixed(4),
      body.inclination.toFixed(4),
      (body.eccentricity ?? model.eccentricity).toFixed(4),
      body.texture
    ].join(":")).join("|");
    if (three.bodyMeshSignature !== signature) rebuildBodyMeshes();
    updateTrajectoryLines(progress);

    let selectedPosition = null;
    let selectedRadius = 0.2;
    const barycenter = new THREE.Vector3();
    let totalMass = 0;
    const currentSample = sampleForProgress(progress);
    const currentOrigin = viewOriginForSample(currentSample);
    bodies.forEach((body, bodyIndex) => {
      const group = three.bodyMeshes.get(body.id);
      if (!group) return;
      const sampleState = currentSample.bodies[bodyIndex];
      const active = stateActive(sampleState, bodyIndex);
      group.visible = active;
      const position = (controls.viewFrame?.value || "inertial") === "rotatingPair"
        ? vector3FromVec(transformedSamplePosition(currentSample, bodyIndex))
        : bodyPosition(body, model, progress);
      group.position.copy(position);
      const radiusScale = active ? stateRadius(sampleState, bodyIndex) / Math.max(body.radius, 1e-9) : 1;
      group.scale.setScalar(Number.isFinite(radiusScale) && radiusScale > 0 ? radiusScale : 1);
      group.rotation.z = (body.spinTilt * Math.PI) / 180;
      group.rotation.y = spinPhaseInView(currentSample, bodyIndex);
      group.traverse((child) => {
        if (child.userData?.spinBulkMarker) {
          child.visible = active && Boolean(controls.showTidalLocking?.checked);
        }
      });
      const mass = stateMass(sampleState, bodyIndex);
      if (active && mass > 0) {
        barycenter.addScaledVector(position, mass);
        totalMass += mass;
      }

      const trail = three.trailLines.get(body.id);
      if (trail) {
        trail.visible = active && (controls.showTrails?.checked ?? true);
        const points = [];
        const sampleCount = body.type === "star" ? 36 : 72;
        const trailSpan = body.type === "star" ? 0.18 : 0.28;
        for (let i = sampleCount; i >= 0; i -= 1) {
          const p = progress - (i / sampleCount) * trailSpan;
          const trailSample = sampleForProgress(p);
          if (!stateActive(trailSample.bodies[bodyIndex], bodyIndex)) continue;
          const point = viewAdjustedPointForSample(trailSample, bodyIndex, currentOrigin);
          if (point) points.push(point);
        }
        trail.geometry.dispose();
        trail.geometry = new THREE.BufferGeometry().setFromPoints(points);
      }

      if (active && body.id === selectedBodyId) {
        selectedPosition = position;
        selectedRadius = stateRadius(sampleState, bodyIndex);
      }
    });

    three.selectionRing.visible = Boolean(selectedPosition);
    if (selectedPosition) {
      three.selectionRing.position.copy(selectedPosition);
      three.selectionRing.scale.setScalar(Math.max(0.16, selectedRadius * 1.7));
    }

    three.barycenterMarker.visible = totalMass > 0;
    if (totalMass > 0) {
      barycenter.multiplyScalar(1 / totalMass);
      if ((controls.viewFrame?.value || "inertial") === "rotatingPair") {
        three.barycenterMarker.position.set(0, 0, 0);
      } else {
        three.barycenterMarker.position.copy(barycenter);
      }
    }

    if (three.collisionMarker) {
      const sample = sampleForProgress(progress);
      const marker = visibleCollisionMarker(sample.t);
      three.collisionMarker.visible = Boolean(marker);
      if (marker) {
        const collision = marker.event;
        const collisionPosition = viewAdjustedCollisionPoint(collision, currentOrigin);
        if (collisionPosition) three.collisionMarker.position.copy(collisionPosition);
        three.collisionMarker.scale.setScalar(Math.max(0.16, collision.radius * 1.45) * marker.pulse);
        three.collisionMarker.traverse((object) => {
          if (object.material) object.material.opacity = Math.max(0.12, marker.fade * 0.92);
        });
      }
    }
    updateDebrisMeshes(currentSample);

    const frame = controls.viewFrame ? controls.viewFrame.value : "inertial";
    if (frame === "rotatingPair") {
      three.orbitGroup.position.set(0, 0, 0);
    } else if (frame === "barycenter" && totalMass > 0) {
      three.orbitGroup.position.copy(barycenter).multiplyScalar(-1);
    } else if (frame === "selected" && selectedPosition) {
      three.orbitGroup.position.copy(selectedPosition).multiplyScalar(-1);
    } else {
      three.orbitGroup.position.set(0, 0, 0);
    }
  }

  function selectNearestProjectedBody(event) {
    if (!bodies.length) return false;
    if (!three) return selectNearestFallbackBody(event);
    const model = readModel();
    const progress = Number(controls.slider.value || 0);
    resizeThree();
    updateThreeObjects(model, progress);
    if (three.orbitControls) three.orbitControls.update();
    three.scene.updateMatrixWorld(true);
    three.camera.updateMatrixWorld(true);

    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    let best = null;
    let nearest = null;

    bodies.forEach((body) => {
      const group = three.bodyMeshes.get(body.id);
      const world = group
        ? new THREE.Vector3().setFromMatrixPosition(group.matrixWorld)
        : bodyPosition(body, model, progress)
          .clone()
          .add(three.orbitGroup.position)
          .applyMatrix4(three.pivot.matrixWorld);
      const projected = world.project(three.camera);
      if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y)) return;
      const x = ((projected.x + 1) / 2) * rect.width;
      const y = ((1 - projected.y) / 2) * rect.height;
      const distance = Math.hypot(clickX - x, clickY - y);
      const visiblePenalty = projected.z < -1 || projected.z > 1 ? 1000 : 0;
      const threshold = Math.max(56, Math.min(130, 48 + body.radius * 130));
      const score = distance + visiblePenalty;
      const candidate = {
        body,
        distance,
        threshold,
        score,
        x,
        y,
        z: projected.z
      };
      if (!nearest || distance < nearest.distance) nearest = candidate;
      if (distance <= threshold && (!best || score < best.score)) {
        best = candidate;
      }
    });

    if (!best) return false;
    selectedBodyId = best.body.id;
    syncBodySelect();
    syncBodyEditor();
    drawScene();
    updatePlots();
    return true;
  }

  function fallbackProjectionMapper() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, Math.round(rect.width));
    const height = Math.max(260, Math.round(rect.height));
    const progress = Number(controls.slider.value || 0);
    const sample = sampleForProgress(progress);
    const allStates = (trajectory.samples.length ? trajectory.samples : [sample])
      .flatMap((item) => [
        ...item.bodies.filter((state, index) => stateActive(state, index)),
        ...(item.debris || []).flatMap((field) => field.particles || [])
      ]);
    const minX = Math.min(...allStates.map((state) => state.x), -1);
    const maxX = Math.max(...allStates.map((state) => state.x), 1);
    const minZ = Math.min(...allStates.map((state) => state.z), -1);
    const maxZ = Math.max(...allStates.map((state) => state.z), 1);
    const span = Math.max(maxX - minX, maxZ - minZ, 1);
    const scale = Math.min(width * 0.72, height * 0.72) / span;
    const cx = width * 0.5 - ((minX + maxX) / 2) * scale;
    const cy = height * 0.52 + ((minZ + maxZ) / 2) * scale;
    return {
      rect,
      scale,
      sample,
      map: (state) => ({
        x: cx + state.x * scale,
        y: cy - state.z * scale
      })
    };
  }

  function selectNearestFallbackBody(event) {
    const { rect, scale, sample, map } = fallbackProjectionMapper();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    let best = null;
    let nearest = null;
    sample.bodies.forEach((state, index) => {
      const body = bodies[index];
      if (!body || !stateActive(state, index)) return;
      const point = map(state);
      const distance = Math.hypot(clickX - point.x, clickY - point.y);
      const drawnRadius = Math.max(body.type === "star" ? 8 : 5, body.radius * scale * 0.55);
      const threshold = Math.max(42, drawnRadius + 30);
      const candidate = { body, distance, threshold, x: point.x, y: point.y };
      if (!nearest || distance < nearest.distance) nearest = candidate;
      if (distance <= threshold && (!best || distance < best.distance)) {
        best = candidate;
      }
    });
    if (!best) return false;
    selectedBodyId = best.body.id;
    syncBodySelect();
    syncBodyEditor();
    drawScene();
    updatePlots();
    return true;
  }

  function disposeObject(object) {
    object.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => {
            if (material.map) material.map.dispose();
            material.dispose();
          });
        } else {
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      }
    });
  }

  function initThree() {
    if (!window.THREE || three || fallback2d) return;

    try {
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x0f172a, 1);
      if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x0f172a, 18, 54);

      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
      camera.position.set(0, 5.6, 8.6);
      camera.lookAt(0, 0, 0);

      const orbitControls = window.THREE.OrbitControls
        ? new THREE.OrbitControls(camera, canvas)
        : null;
      if (orbitControls) {
        orbitControls.enableDamping = true;
        orbitControls.enablePan = true;
        orbitControls.screenSpacePanning = true;
        orbitControls.dampingFactor = 0.08;
        orbitControls.rotateSpeed = 0.65;
        orbitControls.zoomSpeed = 0.85;
        orbitControls.panSpeed = 0.55;
        orbitControls.minDistance = 1.2;
        orbitControls.maxDistance = 36;
        orbitControls.target.set(0, 0, 0);
        orbitControls.addEventListener("change", () => {
          resizeThree();
          renderer.render(scene, camera);
        });
      }

      const pivot = new THREE.Group();
      pivot.rotation.x = -0.35;
      pivot.rotation.y = -0.45;
      scene.add(pivot);

      const ambient = new THREE.AmbientLight(0x93c5fd, 0.45);
      scene.add(ambient);

      const sunLight = new THREE.PointLight(0xfff0c2, 2.4, 38, 1.4);
      sunLight.position.set(0, 0.1, 0);
      pivot.add(sunLight);

      const starField = makeStarField();
      scene.add(starField);

      const orbitGroup = new THREE.Group();
      pivot.add(orbitGroup);
      const keplerOverlayGroup = new THREE.Group();
      pivot.add(keplerOverlayGroup);
      const lagrangeOverlayGroup = new THREE.Group();
      pivot.add(lagrangeOverlayGroup);
      const tidalOverlayGroup = new THREE.Group();
      pivot.add(tidalOverlayGroup);

      const sunMaterial = new THREE.MeshBasicMaterial({
        map: makeStarTexture(),
        color: 0xffffff
      });
      const sun = new THREE.Mesh(new THREE.SphereGeometry(0.42, 64, 40), sunMaterial);
      sun.visible = false;
      orbitGroup.add(sun);

      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeCoronaTexture(),
        color: 0xffffff,
        transparent: true,
        opacity: 0.94,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }));
      glow.scale.set(1.75, 1.75, 1.75);
      glow.visible = false;
      orbitGroup.add(glow);

      const planetMaterial = new THREE.MeshStandardMaterial({
        map: makeStripedTexture("jupiter"),
        roughness: 0.68,
        metalness: 0.02
      });
      const planet = new THREE.Mesh(new THREE.SphereGeometry(0.18, 48, 32), planetMaterial);
      planet.castShadow = false;
      planet.visible = false;
      orbitGroup.add(planet);

      const planetGlow = new THREE.Mesh(
        new THREE.SphereGeometry(0.23, 32, 20),
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.12,
          depthWrite: false
        })
      );
      planetGlow.visible = false;
      orbitGroup.add(planetGlow);

      const orbitPlane = new THREE.GridHelper(9, 18, 0x334155, 0x1e293b);
      orbitPlane.material.transparent = true;
      orbitPlane.material.opacity = 0.28;
      pivot.add(orbitPlane);

      const rungeLenzArrow = new THREE.ArrowHelper(
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 0.62, 0),
        1,
        0xfb7185,
        0.16,
        0.08
      );
      orbitGroup.add(rungeLenzArrow);

      const radiusLineGeometry = new THREE.BufferGeometry();
      const radiusLine = new THREE.Line(
        radiusLineGeometry,
        new THREE.LineBasicMaterial({
          color: 0xf8fafc,
          transparent: true,
          opacity: 0.42
        })
      );
      orbitGroup.add(radiusLine);

      const bodyGroup = new THREE.Group();
      orbitGroup.add(bodyGroup);
      const debrisGroup = new THREE.Group();
      orbitGroup.add(debrisGroup);

      const selectionRing = new THREE.Mesh(
        new THREE.TorusGeometry(1, 0.018, 12, 96),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.86,
          depthWrite: false
        })
      );
      selectionRing.rotation.x = Math.PI / 2;
      selectionRing.visible = false;
      orbitGroup.add(selectionRing);

      const barycenterMarker = new THREE.Mesh(
        new THREE.TorusGeometry(0.08, 0.012, 10, 32),
        new THREE.MeshBasicMaterial({
          color: 0xa78bfa,
          transparent: true,
          opacity: 0.95
        })
      );
      barycenterMarker.rotation.x = Math.PI / 2;
      barycenterMarker.visible = false;
      orbitGroup.add(barycenterMarker);

      const collisionMarker = new THREE.Group();
      const collisionRing = new THREE.Mesh(
        new THREE.TorusGeometry(1, 0.025, 12, 64),
        new THREE.MeshBasicMaterial({
          color: 0xef4444,
          transparent: true,
          opacity: 0.92,
          depthWrite: false
        })
      );
      collisionRing.rotation.x = Math.PI / 2;
      collisionMarker.add(collisionRing);
      const collisionCore = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 20, 12),
        new THREE.MeshBasicMaterial({
          color: 0xfef2f2,
          transparent: true,
          opacity: 0.9,
          depthWrite: false
        })
      );
      collisionMarker.add(collisionCore);
      collisionMarker.visible = false;
      orbitGroup.add(collisionMarker);

      let orbitLine = null;
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let clickStart = null;

      canvas.addEventListener("contextmenu", (event) => {
        event.preventDefault();
      });

      three = {
        renderer,
        scene,
        camera,
        orbitControls,
        pivot,
        orbitGroup,
        sun,
        glow,
        planet,
        planetGlow,
        bodyGroup,
        debrisGroup,
        keplerOverlayGroup,
        lagrangeOverlayGroup,
        tidalOverlayGroup,
        bodyMeshes: new Map(),
        trailLines: new Map(),
        bodyMeshSignature: "",
        trajectoryLineSignature: "",
        pickables: [],
        selectionRing,
        barycenterMarker,
        collisionMarker,
        raycaster,
        pointer,
        orbitLine,
        radiusLine,
        rungeLenzArrow,
        planetMaterial
      };

      canvas.addEventListener("pointerdown", (event) => {
        clickStart = { x: event.clientX, y: event.clientY };
      });

      canvas.addEventListener("pointerup", (event) => {
        if (!clickStart) return;
        const dx = event.clientX - clickStart.x;
        const dy = event.clientY - clickStart.y;
        clickStart = null;
        if (Math.hypot(dx, dy) > 12) return;
        if (selectNearestProjectedBody(event)) return;
        const rect = canvas.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
        three.scene.updateMatrixWorld(true);
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(three.pickables, true);
        const hit = hits.find((item) => item.object.userData.bodyId);
        if (!hit) return;
        selectedBodyId = hit.object.userData.bodyId;
        syncBodySelect();
        syncBodyEditor();
        drawScene();
      });

      canvas.addEventListener("click", (event) => {
        if (selectNearestProjectedBody(event)) {
          event.preventDefault();
          event.stopPropagation();
        }
      }, true);
    } catch (error) {
      fallback2d = true;
      three = null;
    }
  }

  function resizeThree() {
    if (!three) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, Math.round(rect.width));
    const height = Math.max(260, Math.round(rect.height));
    three.camera.aspect = width / height;
    three.camera.updateProjectionMatrix();
    three.renderer.setSize(width, height, false);
  }

  function updateThreeObjects(model, progress) {
    if (!three) return;
    ensureBodies();
    const sample = sampleForProgress(progress);
    const metrics = computeMetrics(model, sample);
    if (three.orbitLine) {
      three.orbitGroup.remove(three.orbitLine);
      disposeObject(three.orbitLine);
      three.orbitLine = null;
    }

    updateBodyMeshes(model, progress);
    updateKeplerOverlays(progress);
    updateLagrangeOverlays(progress);
    updateTidalOverlays(progress);

    const referenceBody = selectedBody() || bodies.find((body) => body.type === "planet") || bodies[0];
    const referenceIndex = referenceBody ? bodies.findIndex((body) => body.id === referenceBody.id) : -1;
    const p = referenceIndex >= 0 && (controls.viewFrame?.value || "inertial") === "rotatingPair"
      ? vector3FromVec(transformedSamplePosition(sample, referenceIndex))
      : referenceBody ? bodyPosition(referenceBody, model, progress) : new THREE.Vector3(0, 0, 0);

    three.radiusLine.geometry.dispose();
    three.radiusLine.geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      p
    ]);

    const rungeLenzVisibleThreshold = 1e-3;
    const showA = controls.showRungeLenz?.checked
      && bodies.length === 2
      && metrics.rungeLenz != null
      && metrics.rungeLenz > rungeLenzVisibleThreshold;
    three.rungeLenzArrow.visible = Boolean(showA);
    if (showA) {
      const direction = new THREE.Vector3(
        metrics.rungeLenzVector.x,
        metrics.rungeLenzVector.y,
        metrics.rungeLenzVector.z
      );
      if (direction.lengthSq() < 1e-8) {
        three.rungeLenzArrow.visible = false;
        return;
      }
      direction.normalize();
      const arrowLength = metrics.rungeLenz * 1.2;
      three.rungeLenzArrow.setDirection(direction);
      three.rungeLenzArrow.setLength(arrowLength, 0.16, 0.08);
      three.rungeLenzArrow.position.set(0, 0.62, 0);
    }
  }

  function renderThree() {
    if (!three) return;
    resizeThree();
    if (three.orbitControls) three.orbitControls.update();
    three.renderer.render(three.scene, three.camera);
  }

  function drawFallbackScene() {
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(320, Math.round(rect.width * dpr));
    const height = Math.max(260, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const model = readModel();
    const progress = Number(controls.slider.value || 0);
    const sample = sampleForProgress(progress);
    const metrics = computeMetrics(model, sample);
    ctx.clearRect(0, 0, width, height);

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#0f172a");
    gradient.addColorStop(1, "#182235");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const allStates = (trajectory.samples.length ? trajectory.samples : [sample])
      .flatMap((item) => item.bodies);
    const minX = Math.min(...allStates.map((state) => state.x), -1);
    const maxX = Math.max(...allStates.map((state) => state.x), 1);
    const minZ = Math.min(...allStates.map((state) => state.z), -1);
    const maxZ = Math.max(...allStates.map((state) => state.z), 1);
    const span = Math.max(maxX - minX, maxZ - minZ, 1);
    const scale = Math.min(width * 0.72, height * 0.72) / span;
    const cx = width * 0.5 - ((minX + maxX) / 2) * scale;
    const cy = height * 0.52 + ((minZ + maxZ) / 2) * scale;
    const map = (state) => ({
      x: cx + state.x * scale,
      y: cy - state.z * scale
    });

    const showFullPathLines = false;
    if (showFullPathLines) {
      bodies.forEach((body, bodyIndex) => {
        const color = body.type === "star" ? "#fbbf24" : (body.texture === "mars" ? "#f97316" : "#38bdf8");
        ctx.strokeStyle = color;
        ctx.globalAlpha = body.type === "star" ? 0.42 : 0.74;
        ctx.lineWidth = Math.max(1.5, width / 620);
        ctx.beginPath();
        trajectory.samples.forEach((item, index) => {
          const state = item.bodies[bodyIndex];
          if (!state) return;
          const point = map(state);
          if (index === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
    }

    let barycenter = vec(0, 0, 0);
    let totalMass = 0;
    sample.bodies.forEach((state, index) => {
      if (!stateActive(state, index)) return;
      const mass = stateMass(state, index);
      barycenter = addVec(barycenter, scaleVec(state, mass));
      totalMass += mass;
    });
    if (totalMass > 0) {
      barycenter = scaleVec(barycenter, 1 / totalMass);
      const point = map(barycenter);
      ctx.strokeStyle = "#a78bfa";
      ctx.lineWidth = Math.max(1.5, width / 620);
      ctx.beginPath();
      ctx.arc(point.x, point.y, Math.max(5, width / 150), 0, Math.PI * 2);
      ctx.stroke();
    }

    const fallbackDiagnostics = tidalDiagnosticsForSample(sample, model);
    const fallbackRoche = fallbackDiagnostics ? rocheDiagnosticsFromTidal(fallbackDiagnostics) : null;
    if ((controls.showRocheLimit?.checked || controls.rocheBreakup?.checked) && fallbackRoche) {
      const mode = controls.rocheMode?.value || "both";
      const sourcePoint = map(fallbackRoche.sourceState);
      const drawRocheCircle = (radius, color, label, inside, offsetIndex) => {
        const screenRadius = Math.max(4, radius * scale);
        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.globalAlpha = inside ? 0.92 : 0.58;
        ctx.lineWidth = Math.max(1.5, width / 720);
        ctx.setLineDash(inside ? [] : [8, 6]);
        ctx.beginPath();
        ctx.arc(sourcePoint.x, sourcePoint.y, screenRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = `${Math.max(10, width / 95)}px Arial`;
        ctx.fillText(label, sourcePoint.x + screenRadius + 6, sourcePoint.y - 8 - offsetIndex * 14);
        ctx.restore();
      };
      if (mode === "fluid" || mode === "both") {
        drawRocheCircle(fallbackRoche.fluid, "#ef4444", "Roche fluid", fallbackRoche.fluidRatio < 1, 0);
      }
      if (mode === "rigid" || mode === "both") {
        drawRocheCircle(fallbackRoche.rigid, "#a855f7", "Roche rigid", fallbackRoche.rigidRatio < 1, 1);
      }
      const damage = Math.max(0, Math.min(1, Number(fallbackDiagnostics.targetState?.rocheDamage) || 0));
      if (controls.rocheBreakup?.checked && damage > 0.02) {
        const targetPoint = map(sample.bodies[fallbackDiagnostics.targetIndex]);
        ctx.save();
        ctx.strokeStyle = damage > 0.72 ? "#ef4444" : "#f59e0b";
        ctx.globalAlpha = 0.25 + damage * 0.52;
        ctx.lineWidth = Math.max(2, width / 620);
        ctx.beginPath();
        ctx.arc(targetPoint.x, targetPoint.y, Math.max(8, fallbackDiagnostics.radius * scale * (0.85 + damage * 0.25)), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    sample.bodies.forEach((state, index) => {
      const body = bodies[index];
      if (!body || !stateActive(state, index)) return;
      const point = map(state);
      const radius = Math.max(body.type === "star" ? 8 : 5, stateRadius(state, index) * scale * 0.55);
      ctx.fillStyle = body.type === "star" ? "#fbbf24" : (body.texture === "mars" ? "#f97316" : "#38bdf8");
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    (sample.debris || []).forEach((field) => {
      const center = debrisFieldCenterOfMass(field);
      const birthDuration = Math.max(0.25, Number(field.birthDuration) || 0.8);
      const coreFade = Math.max(0, 1 - (Number(field.age) || 0) / (birthDuration * 1.45));
      if (center && coreFade > 0.02 && field.parentRadius) {
        const corePoint = map(center);
        ctx.fillStyle = field.coreColor || field.color || "#f1d5a5";
        ctx.globalAlpha = 0.2 * coreFade;
        ctx.beginPath();
        ctx.arc(corePoint.x, corePoint.y, Math.max(3, field.parentRadius * scale * 0.42), 0, Math.PI * 2);
        ctx.fill();
      }
      field.particles.forEach((particle) => {
        const point = map(particle);
        ctx.fillStyle = particle.color || field.color || "#f59e0b";
        ctx.globalAlpha = Math.max(0.18, Math.min(0.9, particle.opacity ?? 1));
        ctx.beginPath();
        ctx.arc(point.x, point.y, Math.max(2, particle.radius * scale * 0.55), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    });

    const marker = visibleCollisionMarker(sample.t);
    if (marker) {
      const collision = marker.event;
      const point = map(collision.position);
      ctx.strokeStyle = `rgba(239, 68, 68, ${Math.max(0.15, marker.fade * 0.95)})`;
      ctx.fillStyle = `rgba(254, 226, 226, ${Math.max(0.12, marker.fade * 0.78)})`;
      ctx.lineWidth = Math.max(2, width / 520);
      ctx.beginPath();
      ctx.arc(point.x, point.y, Math.max(10, collision.radius * scale * 0.65) * marker.pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(point.x, point.y, Math.max(3, width / 260), 0, Math.PI * 2);
      ctx.fill();
    }

    if (controls.showRungeLenz?.checked && metrics.rungeLenz != null && metrics.rungeLenz > 1e-3) {
      const origin = map(vec(0, 0, 0));
      const tip = map(scaleVec(metrics.rungeLenzVector, Math.max(1, span * 0.25)));
      ctx.strokeStyle = "#fb7185";
      ctx.fillStyle = "#fb7185";
      ctx.lineWidth = Math.max(2, width / 520);
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
    }
  }

  function updateMetrics() {
    const model = readModel();
    const progress = Number(controls.slider.value || 0);
    const sample = sampleForProgress(progress);
    const metrics = computeMetrics(model, sample);
    controls.timeLabel.textContent = `t=${sample.t.toFixed(1)}`;
    controls.energy.textContent = metrics.energy.toFixed(3);
    controls.angularMomentum.textContent = metrics.angularMomentum.toFixed(3);
    controls.metricEccentricity.textContent = metrics.eccentricity == null ? "n/a" : metrics.eccentricity.toFixed(3);
    controls.rungeLenz.textContent = metrics.rungeLenz == null ? "n/a" : metrics.rungeLenz.toFixed(3);
    updateCollisionStatus(sample.t);
    const now = performance.now();
    if (!playing || now - lastStatusPanelUpdate > 550) {
      lastStatusPanelUpdate = now;
      updateKeplerStatus(sample);
      updateLagrangeStatus(sample);
      updateTidalStatus(sample);
    }
  }

  function drawScene() {
    const model = readModel();
    const progress = Number(controls.slider.value || 0);
    updateMetrics();

    initThree();
    if (three) {
      updateThreeObjects(model, progress);
      three.planet.rotation.y += 0.035;
      three.sun.rotation.y += 0.01;
      three.glow.rotation.y -= 0.006;
      renderThree();
      return;
    }

    drawFallbackScene();
  }

  function paddedPlotRange(values, options = {}) {
    const finite = values.filter((value) => Number.isFinite(value));
    if (!finite.length) return undefined;
    const min = Math.min(...finite);
    const max = Math.max(...finite);
    const middle = (min + max) / 2;
    const relativeMin = options.relativeMin ?? 0.04;
    const absoluteMin = options.absoluteMin ?? 0.05;
    const span = Math.max(
      (max - min) * 1.35,
      Math.abs(middle) * relativeMin,
      absoluteMin
    );
    let low = middle - span / 2;
    let high = middle + span / 2;
    if (options.nonnegative && low < 0) {
      high += -low;
      low = 0;
    }
    return [low, high];
  }

  function currentTimeShape(t) {
    return {
      type: "line",
      xref: "x",
      yref: "paper",
      x0: t,
      x1: t,
      y0: 0,
      y1: 1,
      line: { color: "rgba(15, 23, 42, 0.45)", width: 1.5, dash: "dot" }
    };
  }

  function currentTimeAnnotation(t) {
    return {
      x: t,
      y: 1,
      xref: "x",
      yref: "paper",
      text: `t=${t.toFixed(2)}`,
      showarrow: false,
      xanchor: "left",
      yanchor: "bottom",
      font: { size: 11, color: "#334155" },
      bgcolor: "rgba(255, 255, 255, 0.82)",
      bordercolor: "rgba(148, 163, 184, 0.45)",
      borderwidth: 1
    };
  }

  function collisionPlotShapes() {
    return trajectory.collisionEvents.slice(0, 16).map((event) => ({
      type: "line",
      xref: "x",
      yref: "paper",
      x0: event.t,
      x1: event.t,
      y0: 0,
      y1: 1,
      line: { color: "rgba(220, 38, 38, 0.62)", width: 1.8, dash: "dash" }
    }));
  }

  function collisionPlotAnnotations() {
    return trajectory.collisionEvents.slice(0, 6).map((event) => ({
      x: event.t,
      y: 1,
      xref: "x",
      yref: "paper",
      text: "collision",
      showarrow: false,
      xanchor: "left",
      yanchor: "top",
      font: { size: 10, color: "#991b1b" },
      bgcolor: "rgba(255, 255, 255, 0.82)"
    }));
  }

  function rocheBreakupPlotShapes() {
    return (trajectory.rocheEvents || []).slice(0, 16).map((event) => ({
      type: "line",
      xref: "x",
      yref: "paper",
      x0: event.t,
      x1: event.t,
      y0: 0,
      y1: 1,
      line: { color: "rgba(245, 158, 11, 0.68)", width: 1.7, dash: "dot" }
    }));
  }

  function rocheBreakupPlotAnnotations() {
    return (trajectory.rocheEvents || []).slice(0, 4).map((event) => ({
      x: event.t,
      y: 0,
      xref: "x",
      yref: "paper",
      text: "Roche breakup",
      showarrow: false,
      xanchor: "left",
      yanchor: "bottom",
      font: { size: 10, color: "#92400e" },
      bgcolor: "rgba(255, 255, 255, 0.84)"
    }));
  }

  function latestCollisionAtOrBefore(t) {
    let latest = null;
    trajectory.collisionEvents.forEach((event) => {
      if (event.t <= t && (!latest || event.t > latest.t)) latest = event;
    });
    return latest;
  }

  function visibleCollisionMarker(t) {
    const latest = latestCollisionAtOrBefore(t);
    if (!latest) return null;
    const windowSize = Math.max(0.45, readModel().timeSpan * 0.035);
    const age = t - latest.t;
    if (age < 0 || age > windowSize) return null;
    return {
      event: latest,
      fade: 1 - age / windowSize,
      pulse: 1 + (age / windowSize) * 0.75
    };
  }

  function nextCollisionAfter(t) {
    return trajectory.collisionEvents.find((event) => event.t > t) || null;
  }

  function updateCollisionStatus(t) {
    if (!controls.collisionStatus) return;
    const latest = latestCollisionAtOrBefore(t);
    if (latest) {
      const marker = visibleCollisionMarker(t);
      controls.collisionStatus.textContent = `${marker ? "collision" : "last collision"} ${latest.label} t=${latest.t.toFixed(2)} v=${latest.relativeSpeed.toFixed(2)}`;
      return;
    }
    const next = nextCollisionAfter(t);
    controls.collisionStatus.textContent = next
      ? `next collision ${next.label} t=${next.t.toFixed(2)}`
      : "no collision";
  }

  function samplesUntil(t) {
    const samples = trajectory.samples.length ? trajectory.samples : [makeSample(0, bodies.map(bodyState))];
    const visible = samples.filter((sample) => sample.t <= t);
    const current = sampleForProgress(t / Math.max(readModel().timeSpan, 1e-9));
    if (!visible.length || visible[visible.length - 1].t < current.t) visible.push(current);
    return visible;
  }

  function lagrangeDistanceSeries(samples) {
    return bodies
      .map((body, bodyIndex) => {
        if (body.role !== "lagrange-test" || !body.lagrangePoint) return null;
        return {
          id: body.id,
          name: body.name,
          point: body.lagrangePoint,
          distance: samples.map((sample) => {
            const state = sample.bodies[bodyIndex];
            if (!stateActive(state, bodyIndex)) return Number.NaN;
            const data = lagrangePointsForSample(sample);
            const point = data?.points?.[body.lagrangePoint];
            return point ? normVec(subVec(state, point.position)) : Number.NaN;
          })
        };
      })
      .filter(Boolean);
  }

  function celestialSeries(samples, model) {
    const metrics = samples.map((sample) => computeMetrics(model, sample));
    const selectedIndex = Math.max(0, bodies.findIndex((body) => body.id === selectedBodyId));
    const selectedContribution = (item) => item.bodyContributions[selectedIndex] || {
      energy: 0,
      angularVector: vec(0, 0, 0),
      angularMagnitude: 0
    };
    const restEnergy = (item) => item.bodyContributions
      .reduce((sum, part, index) => sum + (index === selectedIndex ? 0 : part.energy), 0);
    const restAngular = (item) => {
      const restVector = item.bodyContributions.reduce((sum, part, index) => (
        index === selectedIndex ? sum : addVec(sum, part.angularVector)
      ), vec(0, 0, 0));
      return normVec(restVector);
    };
    const bodyAngular = bodies.map((body, bodyIndex) => ({
      id: body.id,
      name: body.name,
      lx: metrics.map((item) => item.bodyContributions[bodyIndex]?.angularVector.x || 0),
      ly: metrics.map((item) => item.bodyContributions[bodyIndex]?.angularVector.y || 0),
      lz: metrics.map((item) => item.bodyContributions[bodyIndex]?.angularVector.z || 0),
      l: metrics.map((item) => item.bodyContributions[bodyIndex]?.angularMagnitude || 0)
    }));
    const bodyEnergy = bodies.map((body, bodyIndex) => ({
      id: body.id,
      name: body.name,
      energy: metrics.map((item) => item.bodyContributions[bodyIndex]?.energy || 0),
      kinetic: metrics.map((item) => item.bodyContributions[bodyIndex]?.kinetic || 0)
    }));
    const pairPotential = [];
    for (let i = 0; i < bodies.length; i += 1) {
      for (let j = i + 1; j < bodies.length; j += 1) {
        pairPotential.push({
          key: `${i}:${j}`,
          label: `${bodies[i].name}-${bodies[j].name}`,
          potential: samples.map((sample) => {
            const stateA = sample.bodies[i];
            const stateB = sample.bodies[j];
            if (!stateActive(stateA, i) || !stateActive(stateB, j)) return 0;
            const r = normVec(subVec(stateB, stateA));
            return r > 1e-8 ? -model.g * stateMass(stateA, i) * stateMass(stateB, j) / r : 0;
          })
        });
      }
    }
    const tidalDiagnostics = samples.map((sample) => tidalDiagnosticsForSample(sample, model));
    const rocheSeries = rocheSeriesFromDiagnostics(tidalDiagnostics);
    const rocheDamage = rocheDamageSeries(samples, model);
    const spinOrbit = spinOrbitSeries(samples, model);
    return {
      t: samples.map((sample) => sample.t),
      kinetic: metrics.map((item) => item.kinetic),
      potential: metrics.map((item) => item.potential),
      energy: metrics.map((item) => item.energy),
      selectedEnergy: metrics.map((item) => selectedContribution(item).energy),
      restEnergy: metrics.map((item) => restEnergy(item)),
      lx: metrics.map((item) => item.angularVector.x),
      ly: metrics.map((item) => item.angularVector.y),
      lz: metrics.map((item) => item.angularVector.z),
      l: metrics.map((item) => item.angularMomentum),
      selectedLx: metrics.map((item) => selectedContribution(item).angularVector.x),
      selectedLy: metrics.map((item) => selectedContribution(item).angularVector.y),
      selectedLz: metrics.map((item) => selectedContribution(item).angularVector.z),
      selectedL: metrics.map((item) => selectedContribution(item).angularMagnitude),
      restL: metrics.map((item) => restAngular(item)),
      bodyEnergy,
      pairPotential,
      bodyAngular,
      lagrangeDistances: lagrangeDistanceSeries(samples),
      tidalRatio: tidalDiagnostics.map((item) => item ? item.ratio : Number.NaN),
      tidalAcross: tidalDiagnostics.map((item) => item ? item.across : Number.NaN),
      rocheFluidRatio: rocheSeries.fluidRatio,
      rocheRigidRatio: rocheSeries.rigidRatio,
      rocheDamage: rocheDamage.selectedDamage,
      rocheMaxDamage: rocheDamage.maxDamage,
      spinLockProgress: spinOrbit.lockProgress,
      spinRatio: spinOrbit.spinRatio,
      orbitScale: spinOrbit.orbitScale,
      spinHeat: spinOrbit.heat,
      spinTotalL: spinOrbit.totalL,
      closestRatio: metrics.map((item) => item.closestPair.ratio),
      closestDistance: metrics.map((item) => item.closestPair.distance)
    };
  }

  function energyPlotSpec(full, elapsed, selectedName, lineTrace, faint, strong) {
    const totalOptions = [
      { key: "kinetic", label: "K kinetic", enabled: controls.energyK?.checked, color: "#2563eb", faint: "rgba(37, 99, 235, 0.16)" },
      { key: "potential", label: "U potential", enabled: controls.energyU?.checked, color: "#f97316", faint: "rgba(249, 115, 22, 0.16)" },
      { key: "energy", label: "E total", enabled: controls.energyTotal?.checked, color: "#16a34a", faint: "rgba(22, 163, 74, 0.16)" }
    ];
    const traces = [];
    const values = [];
    const elapsedIndices = [];
    const elapsedX = [];
    const elapsedY = [];
    const cursorYFull = [];
    const bodyDashes = ["dot", "dash", "dashdot", "longdash", "longdashdot"];
    const enabledTotals = totalOptions.filter((option) => option.enabled);
    if (!enabledTotals.length
      && !controls.energyExchange?.checked
      && !controls.energyKBody?.checked
      && !controls.energyUPair?.checked
      && !controls.energyEShare?.checked) {
      enabledTotals.push(totalOptions[2]);
    }

    enabledTotals.forEach((option) => {
      values.push(...full[option.key]);
      traces.push(lineTrace(
        full.t,
        full[option.key],
        `${option.label} full`,
        option.faint,
        { ...faint, showlegend: false }
      ));
    });

    if (controls.energyExchange?.checked) {
      [
        { key: "selectedEnergy", label: `${selectedName} share`, color: "#7c3aed", faint: "rgba(124, 58, 237, 0.13)" },
        { key: "restEnergy", label: "others share", color: "#64748b", faint: "rgba(100, 116, 139, 0.13)" }
      ].forEach((option) => {
        values.push(...full[option.key]);
        traces.push(lineTrace(
          full.t,
          full[option.key],
          `${option.label} full`,
          option.faint,
          { ...faint, showlegend: false }
        ));
      });
    }

    if (controls.energyKBody?.checked) {
      full.bodyEnergy.forEach((bodySeries, bodyIndex) => {
        values.push(...bodySeries.kinetic);
        traces.push(lineTrace(
          full.t,
          bodySeries.kinetic,
          `K ${bodySeries.name} full`,
          "rgba(37, 99, 235, 0.11)",
          { ...faint, showlegend: false, dash: bodyDashes[bodyIndex % bodyDashes.length] }
        ));
      });
    }

    if (controls.energyUPair?.checked) {
      full.pairPotential.forEach((pairSeries, pairIndex) => {
        values.push(...pairSeries.potential);
        traces.push(lineTrace(
          full.t,
          pairSeries.potential,
          `U ${pairSeries.label} full`,
          "rgba(249, 115, 22, 0.11)",
          { ...faint, showlegend: false, dash: bodyDashes[pairIndex % bodyDashes.length] }
        ));
      });
    }

    if (controls.energyEShare?.checked) {
      full.bodyEnergy.forEach((bodySeries, bodyIndex) => {
        values.push(...bodySeries.energy);
        traces.push(lineTrace(
          full.t,
          bodySeries.energy,
          `E share ${bodySeries.name} full`,
          "rgba(15, 118, 110, 0.12)",
          { ...faint, showlegend: false, dash: bodyDashes[bodyIndex % bodyDashes.length] }
        ));
      });
    }

    enabledTotals.forEach((option) => {
      elapsedIndices.push(traces.length);
      elapsedX.push(elapsed.t);
      elapsedY.push(elapsed[option.key]);
      cursorYFull.push(full[option.key]);
      traces.push(lineTrace(elapsed.t, elapsed[option.key], option.label, option.color, strong));
    });

    if (controls.energyExchange?.checked) {
      [
        { key: "selectedEnergy", label: `${selectedName} share`, color: "#7c3aed" },
        { key: "restEnergy", label: "others share", color: "#64748b" }
      ].forEach((option) => {
        elapsedIndices.push(traces.length);
        elapsedX.push(elapsed.t);
        elapsedY.push(elapsed[option.key]);
        cursorYFull.push(full[option.key]);
        traces.push(lineTrace(elapsed.t, elapsed[option.key], option.label, option.color, strong));
      });
    }

    if (controls.energyKBody?.checked) {
      elapsed.bodyEnergy.forEach((bodySeries, bodyIndex) => {
        const isSelectedBody = bodySeries.id === selectedBodyId;
        elapsedIndices.push(traces.length);
        elapsedX.push(elapsed.t);
        elapsedY.push(bodySeries.kinetic);
        cursorYFull.push(full.bodyEnergy[bodyIndex]?.kinetic || []);
        traces.push(lineTrace(
          elapsed.t,
          bodySeries.kinetic,
          `K ${bodySeries.name}`,
          "#2563eb",
          { ...strong, width: isSelectedBody ? 2.4 : 1.7, dash: bodyDashes[bodyIndex % bodyDashes.length] }
        ));
      });
    }

    if (controls.energyUPair?.checked) {
      elapsed.pairPotential.forEach((pairSeries, pairIndex) => {
        const selectedIndex = bodies.findIndex((body) => body.id === selectedBodyId);
        const [i, j] = pairSeries.key.split(":").map(Number);
        const touchesSelected = i === selectedIndex || j === selectedIndex;
        elapsedIndices.push(traces.length);
        elapsedX.push(elapsed.t);
        elapsedY.push(pairSeries.potential);
        cursorYFull.push(full.pairPotential[pairIndex]?.potential || []);
        traces.push(lineTrace(
          elapsed.t,
          pairSeries.potential,
          `U ${pairSeries.label}`,
          "#f97316",
          { ...strong, width: touchesSelected ? 2.4 : 1.7, dash: bodyDashes[pairIndex % bodyDashes.length] }
        ));
      });
    }

    if (controls.energyEShare?.checked) {
      elapsed.bodyEnergy.forEach((bodySeries, bodyIndex) => {
        const isSelectedBody = bodySeries.id === selectedBodyId;
        elapsedIndices.push(traces.length);
        elapsedX.push(elapsed.t);
        elapsedY.push(bodySeries.energy);
        cursorYFull.push(full.bodyEnergy[bodyIndex]?.energy || []);
        traces.push(lineTrace(
          elapsed.t,
          bodySeries.energy,
          `E share ${bodySeries.name}`,
          "#0f766e",
          { ...strong, width: isSelectedBody ? 2.4 : 1.7, dash: bodyDashes[bodyIndex % bodyDashes.length] }
        ));
      });
    }

    return {
      traces,
      elapsedIndices,
      elapsedX,
      elapsedY,
      cursorYFull,
      values,
      title: `Energy in ${energyFrameLabel()}: K uses frame-relative velocity; U is gravitational`
    };
  }

  function angularPlotSpec(full, elapsed, selectedName, lineTrace, faint, strong) {
    const componentOptions = [
      { key: "lx", label: "Lx", enabled: controls.angularLx?.checked, color: "#2563eb", faint: "rgba(37, 99, 235, 0.13)" },
      { key: "ly", label: "Ly", enabled: controls.angularLy?.checked, color: "#f97316", faint: "rgba(249, 115, 22, 0.13)" },
      { key: "lz", label: "Lz", enabled: controls.angularLz?.checked, color: "#7c3aed", faint: "rgba(124, 58, 237, 0.13)" },
      { key: "l", label: "|L|", enabled: controls.angularMag?.checked, color: "#059669", faint: "rgba(5, 150, 105, 0.14)" }
    ];
    const components = componentOptions.filter((component) => component.enabled);
    if (!components.length) components.push(componentOptions[3]);
    const bodyDashes = ["dot", "dash", "dashdot", "longdash", "longdashdot"];
    const traces = [];
    const values = [];
    const elapsedIndices = [];
    const elapsedX = [];
    const elapsedY = [];
    const cursorYFull = [];

    components.forEach((component) => {
      values.push(...full[component.key]);
      traces.push(lineTrace(
        full.t,
        full[component.key],
        `${component.label} total full`,
        component.faint,
        { ...faint, showlegend: false }
      ));
      full.bodyAngular.forEach((bodySeries, bodyIndex) => {
        values.push(...bodySeries[component.key]);
        traces.push(lineTrace(
          full.t,
          bodySeries[component.key],
          `${component.label} ${bodySeries.name} full`,
          component.faint,
          { ...faint, showlegend: false, dash: bodyDashes[bodyIndex % bodyDashes.length] }
        ));
      });
    });

    components.forEach((component) => {
      elapsedIndices.push(traces.length);
      elapsedX.push(elapsed.t);
      elapsedY.push(elapsed[component.key]);
      cursorYFull.push(full[component.key]);
      traces.push(lineTrace(
        elapsed.t,
        elapsed[component.key],
        `${component.label} total`,
        component.color,
        { ...strong, width: 2.8 }
      ));
      elapsed.bodyAngular.forEach((bodySeries, bodyIndex) => {
        const isSelectedBody = bodySeries.id === selectedBodyId;
        elapsedIndices.push(traces.length);
        elapsedX.push(elapsed.t);
        elapsedY.push(bodySeries[component.key]);
        cursorYFull.push(full.bodyAngular[bodyIndex]?.[component.key] || []);
        traces.push(lineTrace(
          elapsed.t,
          bodySeries[component.key],
          `${component.label} ${bodySeries.name}`,
          component.color,
          { ...strong, width: isSelectedBody ? 2.4 : 1.7, dash: bodyDashes[bodyIndex % bodyDashes.length] }
        ));
      });
    });

    return {
      traces,
      elapsedIndices,
      elapsedX,
      elapsedY,
      cursorYFull,
      values,
      title: `Angular momentum: inertial components, ${selectedName} highlighted`
    };
  }

  function updatePlots() {
    if (!window.Plotly) return;
    const model = readModel();
    const samples = trajectory.samples.length ? trajectory.samples : [makeSample(0, bodies.map(bodyState))];
    const currentSample = sampleForProgress(Number(controls.slider.value || 0));
    const currentT = currentSample.t;
    const full = celestialSeries(samples, model);
    const elapsed = celestialSeries(samplesUntil(currentT), model);
    const selectedName = selectedBody()?.name || "selected";
    const config = { responsive: true, displayModeBar: false };
    const layoutBase = {
      margin: { l: 54, r: 18, t: 68, b: 42 },
      paper_bgcolor: "rgba(255,255,255,0)",
      plot_bgcolor: "#ffffff",
      font: { family: "Arial, sans-serif", size: 12, color: "#334155" },
      legend: { orientation: "h", y: 1.22, x: 0, font: { size: 11 } },
      shapes: [currentTimeShape(currentT), ...collisionPlotShapes(), ...rocheBreakupPlotShapes()],
      annotations: [currentTimeAnnotation(currentT), ...collisionPlotAnnotations(), ...rocheBreakupPlotAnnotations()]
    };
    const faint = { width: 1.1 };
    const strong = { width: 2.2 };
    const lineTrace = (x, y, name, color, options = {}) => ({
      x,
      y,
      type: "scatter",
      mode: "lines",
      line: { color, width: options.width ?? 2, dash: options.dash || "solid" },
      name,
      yaxis: options.yaxis,
      showlegend: options.showlegend ?? true
    });
    const energySpec = energyPlotSpec(full, elapsed, selectedName, lineTrace, faint, strong);
    const angularSpec = angularPlotSpec(full, elapsed, selectedName, lineTrace, faint, strong);

    Plotly.react("celestialEnergyPlot", energySpec.traces, {
      ...layoutBase,
      title: { text: energySpec.title, font: { size: 14 } },
      xaxis: { title: "t" },
      yaxis: { title: "energy", range: paddedPlotRange(energySpec.values, { relativeMin: 0.06, absoluteMin: 0.12 }) }
    }, config);

    Plotly.react("celestialAngularPlot", angularSpec.traces, {
      ...layoutBase,
      title: { text: angularSpec.title, font: { size: 14 } },
      xaxis: { title: "t" },
      yaxis: { title: "L", range: paddedPlotRange(angularSpec.values, { relativeMin: 0.08, absoluteMin: 0.12 }) }
    }, config);

    const lagrangeDistanceColors = ["#7c3aed", "#0891b2", "#16a34a", "#f97316", "#475569"];
    const lagrangeDistanceFaintColors = [
      "rgba(124, 58, 237, 0.16)",
      "rgba(8, 145, 178, 0.16)",
      "rgba(22, 163, 74, 0.16)",
      "rgba(249, 115, 22, 0.16)",
      "rgba(71, 85, 105, 0.16)"
    ];
    const lagrangeDistanceFullTraces = full.lagrangeDistances.map((series, index) => lineTrace(
      full.t,
      series.distance,
      `${series.name} distance to ${series.point} full`,
      lagrangeDistanceFaintColors[index % lagrangeDistanceFaintColors.length],
      { ...faint, showlegend: false, dash: "dash", yaxis: "y2" }
    ));
    const lagrangeDistanceElapsedTraces = elapsed.lagrangeDistances.map((series, index) => lineTrace(
      elapsed.t,
      series.distance,
      `${series.name} distance to ${series.point}`,
      lagrangeDistanceColors[index % lagrangeDistanceColors.length],
      { width: 2, dash: "dash", yaxis: "y2" }
    ));
    const lagrangeDistanceValues = full.lagrangeDistances.flatMap((series) => series.distance);
    const tidalEnabled = Boolean(controls.showTidalForces?.checked)
      && full.tidalRatio.some((value) => Number.isFinite(value));
    const tidalFullTrace = tidalEnabled
      ? lineTrace(full.t, full.tidalRatio, `${selectedName} near-far tide delta a / surface g full`, "rgba(14, 165, 233, 0.18)", { ...faint, showlegend: false, yaxis: "y2" })
      : null;
    const tidalElapsedTrace = tidalEnabled
      ? lineTrace(elapsed.t, elapsed.tidalRatio, `${selectedName} near-far tide delta a / surface g`, "#0284c7", { width: 2.2, yaxis: "y2" })
      : null;
    const rocheMode = controls.rocheMode?.value || "both";
    const rocheEnabled = Boolean(controls.showRocheLimit?.checked || controls.rocheBreakup?.checked)
      && (
        (rocheMode !== "rigid" && full.rocheFluidRatio.some((value) => Number.isFinite(value)))
        || (rocheMode !== "fluid" && full.rocheRigidRatio.some((value) => Number.isFinite(value)))
      );
    const rocheTraceSpecs = [
      ...(rocheMode === "fluid" || rocheMode === "both"
        ? [{ key: "rocheFluidRatio", label: `${selectedName} distance / fluid Roche`, color: "#ef4444", faint: "rgba(239, 68, 68, 0.15)", dash: "dash" }]
        : []),
      ...(rocheMode === "rigid" || rocheMode === "both"
        ? [{ key: "rocheRigidRatio", label: `${selectedName} distance / rigid Roche`, color: "#a855f7", faint: "rgba(168, 85, 247, 0.15)", dash: "dot" }]
        : [])
    ].filter((spec) => full[spec.key]?.some((value) => Number.isFinite(value)));
    const rocheFullTraces = rocheEnabled
      ? rocheTraceSpecs.map((spec) => lineTrace(full.t, full[spec.key], `${spec.label} full`, spec.faint, { ...faint, showlegend: false, yaxis: "y2", dash: spec.dash }))
      : [];
    const rocheElapsedTraces = rocheEnabled
      ? rocheTraceSpecs.map((spec) => lineTrace(elapsed.t, elapsed[spec.key], spec.label, spec.color, { width: 2.05, yaxis: "y2", dash: spec.dash }))
      : [];
    const rocheBreakupEnabled = Boolean(controls.showRocheLimit?.checked || controls.rocheBreakup?.checked)
      && full.rocheMaxDamage.some((value) => Number.isFinite(value));
    const rocheDamageFullTrace = rocheBreakupEnabled
      ? lineTrace(full.t, full.rocheMaxDamage, "max tidal damage full", "rgba(245, 158, 11, 0.16)", { ...faint, showlegend: false, yaxis: "y2" })
      : null;
    const rocheDamageElapsedTrace = rocheBreakupEnabled
      ? lineTrace(elapsed.t, elapsed.rocheMaxDamage, "max tidal damage", "#f59e0b", { width: 2.15, yaxis: "y2" })
      : null;
    const rocheThresholdTrace = (rocheEnabled || rocheBreakupEnabled)
      ? lineTrace(full.t, full.t.map(() => 1), "Roche / damage threshold", "rgba(239, 68, 68, 0.55)", { width: 1.35, dash: "dot", yaxis: "y2" })
      : null;
    const spinOrbitEnabled = Boolean(controls.showTidalLocking?.checked)
      && full.spinLockProgress.some((value) => Number.isFinite(value));
    const spinOrbitFullTrace = spinOrbitEnabled
      ? lineTrace(full.t, full.spinLockProgress, "spin lock progress full", "rgba(124, 58, 237, 0.16)", { ...faint, showlegend: false, yaxis: "y2" })
      : null;
    const spinOrbitElapsedTrace = spinOrbitEnabled
      ? lineTrace(elapsed.t, elapsed.spinLockProgress, "spin lock progress", "#7c3aed", { width: 2.2, dash: "dot", yaxis: "y2" })
      : null;
    const tidalValues = tidalEnabled ? full.tidalRatio.filter((value) => Number.isFinite(value)) : [];
    const rocheValues = rocheEnabled
      ? rocheTraceSpecs.flatMap((spec) => full[spec.key].filter((value) => Number.isFinite(value)))
      : [];
    const rocheDamageValues = rocheBreakupEnabled ? full.rocheMaxDamage.filter((value) => Number.isFinite(value)) : [];
    const spinOrbitValues = spinOrbitEnabled ? full.spinLockProgress.filter((value) => Number.isFinite(value)) : [];
    const diagnosticTitleParts = ["Collision monitor"];
    if (full.lagrangeDistances.length) diagnosticTitleParts.push("L-point drift");
    if (tidalEnabled) diagnosticTitleParts.push("tidal stress");
    if (rocheEnabled) diagnosticTitleParts.push("Roche limit");
    if (rocheBreakupEnabled) diagnosticTitleParts.push("tidal damage");
    if (spinOrbitEnabled) diagnosticTitleParts.push("spin-orbit exchange");
    const hasSecondaryDiagnostics = full.lagrangeDistances.length || tidalEnabled || rocheEnabled || rocheBreakupEnabled || spinOrbitEnabled;
    const elementsLayout = {
      ...layoutBase,
      margin: { ...layoutBase.margin, r: hasSecondaryDiagnostics ? 62 : layoutBase.margin.r },
      title: { text: diagnosticTitleParts.join(" + "), font: { size: 14 } },
      xaxis: { title: "t" },
      yaxis: { title: "distance / (R_i + R_j)", range: paddedPlotRange(full.closestRatio, { relativeMin: 0.12, absoluteMin: 0.4, nonnegative: true }) },
      shapes: [
        currentTimeShape(currentT),
        ...collisionPlotShapes(),
        ...rocheBreakupPlotShapes(),
        {
          type: "line",
          xref: "paper",
          yref: "y",
          x0: 0,
          x1: 1,
          y0: 1,
          y1: 1,
          line: { color: "rgba(220, 38, 38, 0.45)", width: 1.5, dash: "dash" }
        }
      ],
      annotations: [
        currentTimeAnnotation(currentT),
        ...collisionPlotAnnotations(),
        ...rocheBreakupPlotAnnotations(),
        {
          x: 1,
          y: 1,
          xref: "paper",
          yref: "y",
          text: "contact",
          showarrow: false,
          xanchor: "right",
          yanchor: "bottom",
          font: { size: 11, color: "#991b1b" },
          bgcolor: "rgba(255, 255, 255, 0.82)"
        }
      ]
    };
    if (hasSecondaryDiagnostics) {
      const secondaryValues = [...lagrangeDistanceValues, ...tidalValues, ...rocheValues, ...rocheDamageValues, ...spinOrbitValues, ...(rocheEnabled || rocheBreakupEnabled ? [0, 1] : [])];
      const secondaryTitleParts = [];
      if (full.lagrangeDistances.length) secondaryTitleParts.push("L distance");
      if (tidalEnabled) secondaryTitleParts.push("tide / surface g");
      if (rocheEnabled) secondaryTitleParts.push("distance / Roche");
      if (rocheBreakupEnabled) secondaryTitleParts.push("damage");
      if (spinOrbitEnabled) secondaryTitleParts.push("spin lock");
      elementsLayout.yaxis = {
        ...elementsLayout.yaxis,
        domain: [0, 0.42]
      };
      elementsLayout.yaxis2 = {
        title: secondaryTitleParts.join(" + "),
        anchor: "x",
        domain: [0.58, 1],
        side: "right",
        rangemode: "tozero",
        range: paddedPlotRange(secondaryValues, { relativeMin: 0.18, absoluteMin: tidalEnabled ? 0.02 : 0.2, nonnegative: true })
      };
    }

    const elementTraces = [
      lineTrace(full.t, full.closestRatio, "closest full", "rgba(220, 38, 38, 0.16)", { ...faint, showlegend: false }),
      lineTrace(elapsed.t, elapsed.closestRatio, "closest distance / contact distance", "#dc2626", strong),
      ...lagrangeDistanceFullTraces,
      ...lagrangeDistanceElapsedTraces,
      ...rocheFullTraces,
      ...(rocheThresholdTrace ? [rocheThresholdTrace] : [])
    ];
    let tidalElapsedIndex = -1;
    if (tidalFullTrace && tidalElapsedTrace) {
      elementTraces.push(tidalFullTrace);
      tidalElapsedIndex = elementTraces.length;
      elementTraces.push(tidalElapsedTrace);
    }
    const rocheElapsedStartIndex = elementTraces.length;
    elementTraces.push(...rocheElapsedTraces);
    let rocheDamageElapsedIndex = -1;
    if (rocheDamageFullTrace && rocheDamageElapsedTrace) {
      elementTraces.push(rocheDamageFullTrace);
      rocheDamageElapsedIndex = elementTraces.length;
      elementTraces.push(rocheDamageElapsedTrace);
    }
    let spinOrbitElapsedIndex = -1;
    if (spinOrbitFullTrace && spinOrbitElapsedTrace) {
      elementTraces.push(spinOrbitFullTrace);
      spinOrbitElapsedIndex = elementTraces.length;
      elementTraces.push(spinOrbitElapsedTrace);
    }
    const elementElapsedIndices = [
      1,
      ...lagrangeDistanceElapsedTraces.map((_, index) => 2 + lagrangeDistanceFullTraces.length + index),
      ...(tidalElapsedIndex >= 0 ? [tidalElapsedIndex] : []),
      ...rocheElapsedTraces.map((_, index) => rocheElapsedStartIndex + index),
      ...(rocheDamageElapsedIndex >= 0 ? [rocheDamageElapsedIndex] : []),
      ...(spinOrbitElapsedIndex >= 0 ? [spinOrbitElapsedIndex] : [])
    ];
    try {
      Plotly.react("celestialElementsPlot", elementTraces, elementsLayout, config);
    } catch (error) {
      console.error("Celestial elements plot failed", error);
    }
    plotCursorState = {
      t: full.t,
      energy: {
        indices: energySpec.elapsedIndices,
        yFull: energySpec.cursorYFull
      },
      angular: {
        indices: angularSpec.elapsedIndices,
        yFull: angularSpec.cursorYFull
      },
      elements: {
        indices: elementElapsedIndices,
        yFull: [
          full.closestRatio,
          ...full.lagrangeDistances
            .slice(0, lagrangeDistanceElapsedTraces.length)
            .map((series) => series.distance),
          ...(tidalElapsedIndex >= 0 ? [full.tidalRatio] : []),
          ...(rocheEnabled ? rocheTraceSpecs.map((spec) => full[spec.key]) : []),
          ...(rocheDamageElapsedIndex >= 0 ? [full.rocheMaxDamage] : []),
          ...(spinOrbitElapsedIndex >= 0 ? [full.spinLockProgress] : [])
        ]
      }
    };
    plotCursorReady = true;
  }

  function updatePlotCursors() {
    if (!window.Plotly || !plotCursorReady || !plotCursorState || !trajectory.complete) return;
    const sample = sampleForProgress(Number(controls.slider.value || 0));
    const endIndex = plotCursorEndIndex(sample.t);
    const xSlice = plotCursorState.t.slice(0, endIndex + 1);
    updateElapsedPlot("celestialEnergyPlot", plotCursorState.energy, xSlice, endIndex);
    updateElapsedPlot("celestialAngularPlot", plotCursorState.angular, xSlice, endIndex);
    updateElapsedPlot("celestialElementsPlot", plotCursorState.elements, xSlice, endIndex);
    const relayout = {
      shapes: [currentTimeShape(sample.t), ...collisionPlotShapes(), ...rocheBreakupPlotShapes()],
      annotations: [currentTimeAnnotation(sample.t), ...collisionPlotAnnotations(), ...rocheBreakupPlotAnnotations()]
    };
    Plotly.relayout("celestialEnergyPlot", relayout);
    Plotly.relayout("celestialAngularPlot", relayout);
    Plotly.relayout("celestialElementsPlot", {
      shapes: [
        currentTimeShape(sample.t),
        ...collisionPlotShapes(),
        ...rocheBreakupPlotShapes(),
        {
          type: "line",
          xref: "paper",
          yref: "y",
          x0: 0,
          x1: 1,
          y0: 1,
          y1: 1,
          line: { color: "rgba(220, 38, 38, 0.45)", width: 1.5, dash: "dash" }
        }
      ],
      annotations: [
        currentTimeAnnotation(sample.t),
        ...collisionPlotAnnotations(),
        ...rocheBreakupPlotAnnotations(),
        {
          x: 1,
          y: 1,
          xref: "paper",
          yref: "y",
          text: "contact",
          showarrow: false,
          xanchor: "right",
          yanchor: "bottom",
          font: { size: 11, color: "#991b1b" },
          bgcolor: "rgba(255, 255, 255, 0.82)"
        }
      ]
    });
  }

  function plotCursorEndIndex(time) {
    const t = plotCursorState?.t || [];
    if (!t.length) return 0;
    let low = 0;
    let high = t.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (t[mid] <= time) low = mid;
      else high = mid - 1;
    }
    return Math.max(0, Math.min(low, t.length - 1));
  }

  function updateElapsedPlot(plotId, spec, xSlice, endIndex) {
    if (!spec?.indices?.length) return;
    const y = spec.yFull.map((series) => (series || []).slice(0, endIndex + 1));
    const x = spec.indices.map(() => xSlice);
    Plotly.restyle(plotId, { x, y }, spec.indices);
  }

  function refresh() {
    syncInputModeUi();
    updateCelestialEquation();
    rebuildTrajectoryBuffer();
  }

  function resizePlots() {
    if (!window.Plotly) return;
    ["celestialEnergyPlot", "celestialAngularPlot", "celestialElementsPlot"].forEach((id) => {
      const plot = document.getElementById(id);
      if (plot) Plotly.Plots.resize(plot);
    });
  }

  function redrawDiagnostics() {
    updateCelestialEquation();
    drawScene();
    updatePlots();
    resizePlots();
  }

  function refreshAndRedraw() {
    refresh();
  }

  function tick(timestamp) {
    if (!playing) return;
    try {
      if (!lastFrame) lastFrame = timestamp;
      const dt = (timestamp - lastFrame) / 1000;
      lastFrame = timestamp;
      const model = readModel();
      const simSecondsPerRealSecond = 2.7 * model.speed;
      const progressDelta = (dt * simSecondsPerRealSecond) / Math.max(model.timeSpan, 1e-9);
      playProgress = (playProgress + progressDelta) % 1;
      controls.slider.value = String(playProgress);
      drawScene();
      if (timestamp - lastPlotCursorUpdate > 120) {
        lastPlotCursorUpdate = timestamp;
        updatePlotCursors();
      }
      rafId = requestAnimationFrame(tick);
    } catch (error) {
      stopPlayback();
      throw error;
    }
  }

  const bodyEditorControls = [
    controls.bodyMass,
    controls.bodyRadius,
    controls.bodyOrbit,
    controls.bodyEccentricity,
    controls.bodyPhase,
    controls.bodyInclination,
    controls.bodyX,
    controls.bodyY,
    controls.bodyZ,
    controls.bodyVx,
    controls.bodyVy,
    controls.bodyVz,
    controls.bodySpin,
    controls.bodySpinTilt
  ];

  Object.values(controls).forEach((control) => {
    if (!control || [
      controls.playBtn,
      controls.scenario,
      controls.bodySelect,
      controls.viewFrame,
      controls.energyK,
      controls.energyU,
      controls.energyTotal,
      controls.energyExchange,
      controls.energyKBody,
      controls.energyUPair,
      controls.energyEShare,
      controls.angularLx,
      controls.angularLy,
      controls.angularLz,
      controls.angularMag,
      controls.inputMode,
      controls.showRungeLenz,
      controls.showKeplerFirst,
      controls.showKeplerSecond,
      controls.keplerSecondPercent,
      controls.showKeplerThird,
      controls.showLagrange,
      controls.showTidalForces,
      controls.tidalOverlayMode,
      controls.showTidalLocking,
      controls.showRocheLimit,
      controls.rocheMode,
      controls.rocheBreakup,
      controls.rocheMaterial,
      controls.debrisGravityMode,
      controls.debrisSelfGravityLimit,
      controls.tidalK2,
      controls.tidalLag,
      controls.tidalInertia,
      controls.showTrails,
      controls.slider,
      controls.addPlanetBtn,
      controls.addStarBtn,
      controls.removeBodyBtn,
      controls.resetPresetBtn,
      controls.bodySummary,
      ...bodyEditorControls
    ].includes(control)) return;
    control.addEventListener("input", refresh);
    control.addEventListener("change", refresh);
  });

  controls.scenario.addEventListener("change", () => {
    if (controls.scenario.value !== "custom") activePreset = controls.scenario.value;
    resetBodiesFromScenario();
    refreshAndRedraw();
  });

  controls.bodySelect.addEventListener("change", () => {
    selectedBodyId = controls.bodySelect.value;
    syncBodyEditor();
    if (controls.showTidalLocking?.checked || controls.rocheBreakup?.checked) {
      refreshAndRedraw();
      return;
    }
    redrawDiagnostics();
  });

  controls.viewFrame.addEventListener("change", () => {
    redrawDiagnostics();
  });

  [
    controls.energyK,
    controls.energyU,
    controls.energyTotal,
    controls.energyExchange,
    controls.energyKBody,
    controls.energyUPair,
    controls.energyEShare,
    controls.angularLx,
    controls.angularLy,
    controls.angularLz,
    controls.angularMag
  ].forEach((control) => {
    control?.addEventListener("change", () => {
      updatePlots();
    });
  });

  controls.inputMode.addEventListener("change", () => {
    syncInputModeUi();
    if (controls.inputMode.value === "orbit") syncStatesFromOrbitalElements();
    else if (bodies.length === 2) syncOrbitFromSelectedState();
    syncBodyEditor();
    refreshAndRedraw();
  });

  controls.collisionMode?.addEventListener("change", refreshAndRedraw);
  controls.showTidalLocking?.addEventListener("change", () => {
    updateCapabilityControls();
    refreshAndRedraw();
  });
  const handleRocheLimitControl = () => {
    if (!controls.showRocheLimit.checked && controls.rocheBreakup?.checked) {
      controls.rocheBreakup.checked = false;
      updateCapabilityControls();
      refreshAndRedraw();
      return;
    }
    updateCapabilityControls();
    redrawDiagnostics();
  };
  controls.showRocheLimit?.addEventListener("change", handleRocheLimitControl);
  controls.showRocheLimit?.addEventListener("input", handleRocheLimitControl);
  const handleRocheBreakupControl = () => {
    if (controls.rocheBreakup.checked && controls.showRocheLimit) controls.showRocheLimit.checked = true;
    updateCapabilityControls();
    redrawDiagnostics();
    refreshAndRedraw();
  };
  controls.rocheBreakup?.addEventListener("change", handleRocheBreakupControl);
  controls.rocheBreakup?.addEventListener("input", handleRocheBreakupControl);
  controls.rocheMaterial?.addEventListener("change", refreshAndRedraw);
  controls.debrisGravityMode?.addEventListener("change", () => {
    updateCapabilityControls();
    refreshAndRedraw();
  });
  controls.debrisSelfGravityLimit?.addEventListener("input", refreshAndRedraw);
  controls.debrisSelfGravityLimit?.addEventListener("change", refreshAndRedraw);
  [controls.tidalK2, controls.tidalLag, controls.tidalInertia].forEach((control) => {
    control?.addEventListener("input", refreshAndRedraw);
    control?.addEventListener("change", refreshAndRedraw);
  });

  controls.showRungeLenz.addEventListener("change", () => {
    drawScene();
  });

  [controls.showKeplerFirst, controls.showKeplerSecond, controls.keplerSecondPercent, controls.showKeplerThird, controls.showLagrange, controls.showTidalForces, controls.tidalOverlayMode, controls.rocheMode, controls.showTidalLocking].forEach((control) => {
    control?.addEventListener("change", redrawDiagnostics);
    control?.addEventListener("input", redrawDiagnostics);
  });

  lagrangePlaceButtons.forEach((button) => {
    button.addEventListener("click", () => {
      placeTestBodyAtLagrangePoint(button.dataset.lagrangePlace);
    });
  });

  controls.showTrails.addEventListener("change", () => {
    if (three?.trailLines) {
      three.trailLines.forEach((trail) => {
        trail.visible = controls.showTrails.checked;
      });
    }
    drawScene();
  });

  bodyEditorControls.forEach((control) => {
    control.addEventListener("input", () => {
      updateSelectedBodyFromEditor();
      syncBodyEditor();
      refresh();
    });
    control.addEventListener("change", () => {
      updateSelectedBodyFromEditor();
      syncBodyEditor();
      refresh();
    });
  });

  controls.slider.addEventListener("input", () => {
    playProgress = Number(controls.slider.value || 0);
    drawScene();
    updatePlotCursors();
  });

  const stage = canvas.closest(".celestial-stage");
  const handleStagePick = (event) => {
    if (selectNearestProjectedBody(event)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  canvas.addEventListener("click", handleStagePick, true);
  if (stage) stage.addEventListener("click", handleStagePick, true);

  controls.addPlanetBtn.addEventListener("click", () => {
    addBody("planet");
  });

  controls.addStarBtn.addEventListener("click", () => {
    addBody("star");
  });

  controls.removeBodyBtn.addEventListener("click", () => {
    removeSelectedBody();
  });

  controls.resetPresetBtn.addEventListener("click", () => {
    resetBodiesFromScenario();
    refreshAndRedraw();
  });

  controls.playBtn.addEventListener("click", () => {
    playing = !playing;
    controls.playBtn.textContent = playing ? "Pause" : "Play";
    lastFrame = 0;
    if (playing) rafId = requestAnimationFrame(tick);
    else if (rafId) cancelAnimationFrame(rafId);
  });

  const tabButton = document.querySelector('[data-tab="celestial"]');
  if (tabButton) {
    tabButton.addEventListener("click", () => {
      window.setTimeout(() => {
        refreshAndRedraw();
      }, 0);
    });
  }

  window.addEventListener("resize", drawScene);
  resetBodiesFromScenario();
  refreshAndRedraw();
}
