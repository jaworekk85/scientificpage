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
    bodySelect: document.getElementById("celestialBodySelect"),
    viewFrame: document.getElementById("celestialViewFrame"),
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
    bodySpin: document.getElementById("celestialBodySpin"),
    bodySpinTilt: document.getElementById("celestialBodySpinTilt"),
    slider: document.getElementById("celestialTimeSlider"),
    playBtn: document.getElementById("celestialPlayBtn"),
    timeLabel: document.getElementById("celestialTimeLabel"),
    energy: document.getElementById("celestialMetricEnergy"),
    angularMomentum: document.getElementById("celestialMetricAngularMomentum"),
    metricEccentricity: document.getElementById("celestialMetricEccentricity"),
    rungeLenz: document.getElementById("celestialMetricRungeLenz")
  };

  let playing = false;
  let lastFrame = 0;
  let rafId = null;
  let three = null;
  let fallback2d = false;
  let bodies = [];
  let selectedBodyId = null;
  let nextBodyId = 1;
  let syncingBodyEditor = false;

  function numberValue(input, fallback) {
    if (!input || input.value === "" || input.value == null) return fallback;
    const value = Number(input.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function readModel() {
    const g = Math.max(0.001, numberValue(controls.g, 1));
    const massA = Math.max(0.001, numberValue(controls.massA, 10));
    const massB = Math.max(0.001, numberValue(controls.massB, 0.1));
    const semiMajor = Math.max(0.2, numberValue(controls.semiMajor, 3));
    const eccentricity = Math.min(1.2, Math.max(0, numberValue(controls.eccentricity, 0.45)));
    const timeSpan = Math.max(1, numberValue(controls.timeSpan, 30));
    const speed = Math.max(0, numberValue(controls.speed, 1));
    return { g, massA, massB, semiMajor, eccentricity, timeSpan, speed };
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
      spin: options.spin ?? (type === "star" ? 0.35 : 1),
      spinTilt: options.spinTilt ?? 0,
      texture: options.texture ?? (type === "star" ? "star" : "jupiter")
    };
  }

  function presetBodiesForScenario(scenario, model) {
    if (scenario === "binary") {
      return [
        createBody("star", "Star A", { mass: 8, radius: 0.36, orbit: 0.55, phase: 0 }),
        createBody("star", "Star B", { mass: 6, radius: 0.31, orbit: 0.73, phase: 0.5 })
      ];
    }

    if (scenario === "circumbinary") {
      return [
        createBody("star", "Star A", { mass: 8, radius: 0.34, orbit: 0.48, phase: 0 }),
        createBody("star", "Star B", { mass: 5, radius: 0.28, orbit: 0.77, phase: 0.5 }),
        createBody("planet", "Circumbinary planet", {
          mass: model.massB,
          radius: 0.18,
          orbit: Math.max(model.semiMajor, 3.2),
          phase: 0.16,
          inclination: 4,
          eccentricity: model.eccentricity,
          texture: "jupiter"
        })
      ];
    }

    if (scenario === "solarSystem") {
      return [
        createBody("star", "Sun", { mass: model.massA, radius: 0.4, orbit: 0 }),
        createBody("planet", "Mars-like planet", {
          mass: 0.08,
          radius: 0.14,
          orbit: 2.2,
          phase: 0.12,
          inclination: 2,
          eccentricity: 0.18,
          texture: "mars"
        }),
        createBody("planet", "Jupiter-like planet", {
          mass: 0.28,
          radius: 0.24,
          orbit: 4.1,
          phase: 0.58,
          inclination: -4,
          eccentricity: 0.08,
          texture: "jupiter"
        })
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
    bodies = presetBodiesForScenario(controls.scenario.value, readModel());
    selectedBodyId = bodies[1]?.id || bodies[0]?.id || null;
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
    const current = controls.bodySelect.value || selectedBodyId;
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
    controls.bodySpin.value = body.spin;
    controls.bodySpinTilt.value = body.spinTilt;
    syncingBodyEditor = false;
    updateBodySummary();
  }

  function updateBodySummary() {
    const body = selectedBody();
    if (!controls.bodySummary || !body) return;
    controls.bodySummary.textContent = [
      `selected: ${body.name}`,
      `type: ${body.type}`,
      `m=${Number(body.mass).toFixed(3)}`,
      `R=${Number(body.radius).toFixed(3)}`,
      `spin=${Number(body.spin).toFixed(2)}`
    ].join(" · ");
  }

  function updateSelectedBodyFromEditor() {
    if (syncingBodyEditor) return;
    const body = selectedBody();
    if (!body) return;
    body.mass = Math.max(0.001, numberValue(controls.bodyMass, body.mass));
    body.radius = Math.max(0.03, numberValue(controls.bodyRadius, body.radius));
    body.orbit = Math.max(0, numberValue(controls.bodyOrbit, body.orbit));
    body.eccentricity = Math.min(0.95, Math.max(0, numberValue(controls.bodyEccentricity, body.eccentricity ?? 0)));
    body.phase = numberValue(controls.bodyPhase, body.phase);
    body.inclination = numberValue(controls.bodyInclination, body.inclination);
    body.spin = numberValue(controls.bodySpin, body.spin);
    body.spinTilt = numberValue(controls.bodySpinTilt, body.spinTilt);
    if (three) three.bodyMeshSignature = "";
    updateBodySummary();
  }

  function addBody(type) {
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
    selectedBodyId = body.id;
    syncBodySelect();
    syncBodyEditor();
    if (three) {
      three.bodyMeshSignature = "";
      rebuildBodyMeshes();
    }
    refresh();
  }

  function removeSelectedBody() {
    if (bodies.length <= 1) return;
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

  function computeMetrics(model) {
    const mu = model.g * (model.massA + model.massB);
    const boundedE = Math.min(model.eccentricity, 0.999);
    const specificEnergy = model.eccentricity < 1
      ? -mu / (2 * model.semiMajor)
      : 0;
    const specificAngularMomentum = Math.sqrt(
      Math.max(0, mu * model.semiMajor * (1 - boundedE * boundedE))
    );
    return {
      energy: model.massB * specificEnergy,
      angularMomentum: model.massB * specificAngularMomentum,
      eccentricity: model.eccentricity,
      rungeLenz: model.eccentricity
    };
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
    if (body.orbit <= 0) return new THREE.Vector3(0, 0, 0);
    const e = body.type === "planet" ? Math.min(body.eccentricity ?? model.eccentricity, 0.88) : 0;
    const periodScale = body.type === "star"
      ? 0.85
      : Math.pow(Math.max(body.orbit, 0.25) / Math.max(model.semiMajor, 0.25), 1.5);
    const angle = ((progress / Math.max(0.18, periodScale)) + body.phase) * Math.PI * 2;
    const b = body.orbit * Math.sqrt(Math.max(0, 1 - e * e));
    const x = body.orbit * Math.cos(angle) - body.orbit * e;
    const zFlat = b * Math.sin(angle);
    const inc = (body.inclination * Math.PI) / 180;
    return new THREE.Vector3(
      x,
      zFlat * Math.sin(inc),
      zFlat * Math.cos(inc)
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

    let selectedPosition = null;
    let selectedRadius = 0.2;
    const barycenter = new THREE.Vector3();
    let totalMass = 0;
    bodies.forEach((body) => {
      const group = three.bodyMeshes.get(body.id);
      if (!group) return;
      const position = bodyPosition(body, model, progress);
      group.position.copy(position);
      group.rotation.z = (body.spinTilt * Math.PI) / 180;
      group.rotation.y += 0.018 * body.spin;
      barycenter.addScaledVector(position, body.mass);
      totalMass += body.mass;

      const trail = three.trailLines.get(body.id);
      if (trail) {
        const points = [];
        const sampleCount = body.type === "star" ? 36 : 72;
        const trailSpan = body.type === "star" ? 0.18 : 0.28;
        for (let i = sampleCount; i >= 0; i -= 1) {
          const p = progress - (i / sampleCount) * trailSpan;
          points.push(bodyPosition(body, model, p));
        }
        trail.geometry.dispose();
        trail.geometry = new THREE.BufferGeometry().setFromPoints(points);
      }

      if (body.id === selectedBodyId) {
        selectedPosition = position;
        selectedRadius = body.radius;
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
      three.barycenterMarker.position.copy(barycenter);
    }

    const frame = controls.viewFrame ? controls.viewFrame.value : "inertial";
    if (frame === "barycenter" && totalMass > 0) {
      three.orbitGroup.position.copy(barycenter).multiplyScalar(-1);
    } else if (frame === "selected" && selectedPosition) {
      three.orbitGroup.position.copy(selectedPosition).multiplyScalar(-1);
    } else {
      three.orbitGroup.position.set(0, 0, 0);
    }
  }

  function selectNearestProjectedBody(event) {
    if (!three || !bodies.length) return false;
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    const progress = Number(controls.slider.value || 0);
    const model = readModel();
    let best = null;

    bodies.forEach((body) => {
      const world = bodyPosition(body, model, progress)
        .clone()
        .add(three.orbitGroup.position)
        .applyMatrix4(three.pivot.matrixWorld);
      const projected = world.clone().project(three.camera);
      const x = ((projected.x + 1) / 2) * rect.width;
      const y = ((1 - projected.y) / 2) * rect.height;
      const distance = Math.hypot(clickX - x, clickY - y);
      const threshold = Math.max(30, body.radius * 80);
      if (distance <= threshold && (!best || distance < best.distance)) {
        best = { body, distance };
      }
    });

    if (!best) return false;
    selectedBodyId = best.body.id;
    syncBodySelect();
    syncBodyEditor();
    drawScene();
    return true;
  }

  function disposeObject(object) {
    object.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => material.dispose());
        } else {
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
        orbitControls.minDistance = 3.8;
        orbitControls.maxDistance = 16;
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
        bodyMeshes: new Map(),
        trailLines: new Map(),
        bodyMeshSignature: "",
        pickables: [],
        selectionRing,
        barycenterMarker,
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
        const rect = canvas.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
        three.scene.updateMatrixWorld(true);
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(three.pickables, true);
        const hit = hits.find((item) => item.object.userData.bodyId);
        if (!hit) {
          selectNearestProjectedBody(event);
          return;
        }
        selectedBodyId = hit.object.userData.bodyId;
        syncBodySelect();
        syncBodyEditor();
        drawScene();
      });

      canvas.addEventListener("click", (event) => {
        selectNearestProjectedBody(event);
      });
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
    const metrics = computeMetrics(model);
    if (three.orbitLine) {
      three.orbitGroup.remove(three.orbitLine);
      disposeObject(three.orbitLine);
      three.orbitLine = null;
    }

    updateBodyMeshes(model, progress);

    const referenceBody = selectedBody() || bodies.find((body) => body.type === "planet") || bodies[0];
    const p = referenceBody ? bodyPosition(referenceBody, model, progress) : new THREE.Vector3(0, 0, 0);

    three.radiusLine.geometry.dispose();
    three.radiusLine.geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      p
    ]);

    const arrowLength = Math.max(0.18, metrics.rungeLenz * 1.2);
    three.rungeLenzArrow.setLength(arrowLength, 0.16, 0.08);
    three.rungeLenzArrow.position.set(0, 0.62, 0);
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
    const metrics = computeMetrics(model);
    ctx.clearRect(0, 0, width, height);

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#0f172a");
    gradient.addColorStop(1, "#182235");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const cx = width * 0.5;
    const cy = height * 0.52;
    const scale = Math.min(width * 0.32, height * 0.36) / Math.max(1, model.semiMajor);
    const e = Math.min(model.eccentricity, 0.98);
    const a = model.semiMajor;
    const focusX = cx - a * e * scale;

    ctx.strokeStyle = "rgba(96, 165, 250, 0.95)";
    ctx.lineWidth = Math.max(2, width / 420);
    ctx.beginPath();
    for (let i = 0; i <= 240; i += 1) {
      const point = orbitPoint(model, i / 240);
      const x = cx + point.x * scale;
      const y = cy + point.y * scale * 0.72;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    const planet = orbitPoint(model, progress);
    const planetX = cx + planet.x * scale;
    const planetY = cy + planet.y * scale * 0.72;

    ctx.fillStyle = "rgba(251, 191, 36, 0.28)";
    ctx.beginPath();
    ctx.arc(focusX, cy, Math.max(22, width / 32), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(focusX, cy, Math.max(9, width / 95), 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(248, 250, 252, 0.45)";
    ctx.beginPath();
    ctx.moveTo(focusX, cy);
    ctx.lineTo(planetX, planetY);
    ctx.stroke();

    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.arc(planetX, planetY, Math.max(6, width / 140), 0, Math.PI * 2);
    ctx.fill();

    const vectorLength = Math.max(26, width / 18) * metrics.rungeLenz;
    ctx.strokeStyle = "#fb7185";
    ctx.fillStyle = "#fb7185";
    ctx.lineWidth = Math.max(2, width / 520);
    ctx.beginPath();
    ctx.moveTo(focusX, cy + height * 0.2);
    ctx.lineTo(focusX + vectorLength, cy + height * 0.2);
    ctx.stroke();
  }

  function updateMetrics() {
    const model = readModel();
    const progress = Number(controls.slider.value || 0);
    const metrics = computeMetrics(model);
    controls.timeLabel.textContent = `t=${(progress * model.timeSpan).toFixed(1)}`;
    controls.energy.textContent = metrics.energy.toFixed(3);
    controls.angularMomentum.textContent = metrics.angularMomentum.toFixed(3);
    controls.metricEccentricity.textContent = metrics.eccentricity.toFixed(3);
    controls.rungeLenz.textContent = metrics.rungeLenz.toFixed(3);
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

  function updatePlots() {
    if (!window.Plotly) return;
    const model = readModel();
    const metrics = computeMetrics(model);
    const n = 120;
    const t = Array.from({ length: n }, (_, i) => (i / (n - 1)) * model.timeSpan);
    const methodDrift = controls.method.value === "rk4" ? 0.018 : 0.002;
    const energy = t.map((time) => metrics.energy * (1 + methodDrift * Math.sin(time * 0.55)));
    const angular = t.map((time) => metrics.angularMomentum * (1 + methodDrift * 0.3 * Math.sin(time * 0.42)));
    const ecc = t.map((time) => metrics.eccentricity + methodDrift * 0.25 * Math.sin(time * 0.36));
    const semiMajor = t.map(() => model.semiMajor);

    const config = { responsive: true, displayModeBar: false };
    const layoutBase = {
      margin: { l: 44, r: 14, t: 34, b: 36 },
      paper_bgcolor: "rgba(255,255,255,0)",
      plot_bgcolor: "#ffffff",
      font: { family: "Arial, sans-serif", size: 12, color: "#334155" }
    };

    Plotly.react("celestialEnergyPlot", [{
      x: t,
      y: energy,
      type: "scatter",
      mode: "lines",
      line: { color: "#2563eb", width: 2 },
      name: "E"
    }], {
      ...layoutBase,
      title: { text: "Mechanical energy", font: { size: 14 } },
      xaxis: { title: "t" },
      yaxis: { title: "E" }
    }, config);

    Plotly.react("celestialAngularPlot", [{
      x: t,
      y: angular,
      type: "scatter",
      mode: "lines",
      line: { color: "#059669", width: 2 },
      name: "L"
    }], {
      ...layoutBase,
      title: { text: "Angular momentum", font: { size: 14 } },
      xaxis: { title: "t" },
      yaxis: { title: "L" }
    }, config);

    Plotly.react("celestialElementsPlot", [
      {
        x: t,
        y: semiMajor,
        type: "scatter",
        mode: "lines",
        line: { color: "#7c3aed", width: 2 },
        name: "a"
      },
      {
        x: t,
        y: ecc,
        type: "scatter",
        mode: "lines",
        line: { color: "#f97316", width: 2 },
        yaxis: "y2",
        name: "e"
      }
    ], {
      ...layoutBase,
      title: { text: "Orbital elements", font: { size: 14 } },
      xaxis: { title: "t" },
      yaxis: { title: "a" },
      yaxis2: {
        title: "e",
        overlaying: "y",
        side: "right"
      },
      legend: { orientation: "h", y: 1.16, x: 0.58 }
    }, config);
  }

  function refresh() {
    drawScene();
    updatePlots();
  }

  function tick(timestamp) {
    if (!playing) return;
    if (!lastFrame) lastFrame = timestamp;
    const dt = (timestamp - lastFrame) / 1000;
    lastFrame = timestamp;
    const model = readModel();
    const current = Number(controls.slider.value || 0);
    controls.slider.value = String((current + dt * 0.09 * model.speed) % 1);
    drawScene();
    rafId = requestAnimationFrame(tick);
  }

  const bodyEditorControls = [
    controls.bodyMass,
    controls.bodyRadius,
    controls.bodyOrbit,
    controls.bodyEccentricity,
    controls.bodyPhase,
    controls.bodyInclination,
    controls.bodySpin,
    controls.bodySpinTilt
  ];

  Object.values(controls).forEach((control) => {
    if (!control || [
      controls.playBtn,
      controls.scenario,
      controls.bodySelect,
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
    resetBodiesFromScenario();
    refresh();
  });

  controls.bodySelect.addEventListener("change", () => {
    selectedBodyId = controls.bodySelect.value;
    syncBodyEditor();
    drawScene();
  });

  bodyEditorControls.forEach((control) => {
    control.addEventListener("input", () => {
      updateSelectedBodyFromEditor();
      drawScene();
    });
    control.addEventListener("change", () => {
      updateSelectedBodyFromEditor();
      drawScene();
    });
  });

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
    refresh();
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
        refresh();
        if (window.Plotly) {
          ["celestialEnergyPlot", "celestialAngularPlot", "celestialElementsPlot"].forEach((id) => {
            const plot = document.getElementById(id);
            if (plot) Plotly.Plots.resize(plot);
          });
        }
      }, 0);
    });
  }

  window.addEventListener("resize", drawScene);
  resetBodiesFromScenario();
  refresh();
}
