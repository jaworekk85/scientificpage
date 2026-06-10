(function () {
  let currentModel = null;
  let currentResult = null;
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
        ["physicsTimePlot", "physicsPhasePlot", "physicsEnergyPlot"].forEach(id => {
          const el = document.getElementById(id);
          if (el) window.Plotly.Plots.resize(el);
        });
      }, 0);
    });
  }

  function runPhysicsSimulation() {
    if (!window.SecondOrderMethods) return;

    const model = readModel();
    const methodKey = document.getElementById("physicsMethod").value;

    try {
      if (model.mode === "planar") {
        currentResult = simulatePlanarSystem(model, methodKey);
      } else if (model.mode === "circuitFirstOrder") {
        currentResult = simulateCircuitFirstOrder(model, methodKey);
      } else {
        const config = {
          equation: model.equation,
          t0: model.t0,
          t1: model.t1,
          h: model.h,
          y0: model.y0,
          v0: model.v0
        };
        currentResult = window.SecondOrderMethods.simulateSecondOrder(config, methodKey);
      }
      currentModel = model;
      updatePhysicsControls(model);
      renderEquation(model);
      document.getElementById("physicsStatus").textContent = physicsStatusText(model, currentResult);
      drawPhysicsPlots(model, currentResult);
      animationT = model.t0;
      animationStart = performance.now();
      isPlaying = false;
      document.getElementById("physicsPlayBtn").textContent = "Play";
      document.getElementById("physicsTimeSlider").value = 0;
      lastPlotCursorUpdate = 0;
      resizeCanvasToDisplay();
      drawFrame(animationT);
    } catch (error) {
      document.getElementById("physicsStatus").textContent = error.message;
    }
  }

  function readModel() {
    const type = document.getElementById("physicsSystem").value;
    const omega = finiteOr(parseFloat(document.getElementById("physicsOmega").value), 1);
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
    const circuitL = Math.max(finiteOr(parseFloat(document.getElementById("physicsCircuitL").value), 1), 0);
    const circuitC = Math.max(finiteOr(parseFloat(document.getElementById("physicsCircuitC").value), 1), 0);
    const circuitR = Math.max(finiteOr(parseFloat(document.getElementById("physicsCircuitR").value), 0.2), 0);
    const circuitV = finiteOr(parseFloat(document.getElementById("physicsCircuitV").value), 0);
    const circuitOmega = finiteOr(parseFloat(document.getElementById("physicsCircuitOmega").value), 0);
    const predAlpha = Math.max(finiteOr(parseFloat(document.getElementById("physicsPredAlpha").value), 0.55), 0);
    const predBeta = Math.max(finiteOr(parseFloat(document.getElementById("physicsPredBeta").value), 0.02), 0);
    const predDelta = Math.max(finiteOr(parseFloat(document.getElementById("physicsPredDelta").value), 0.01), 0);
    const predGamma = Math.max(finiteOr(parseFloat(document.getElementById("physicsPredGamma").value), 0.4), 0);
    const neuronA = finiteOr(parseFloat(document.getElementById("physicsNeuronA").value), 0.7);
    const neuronB = finiteOr(parseFloat(document.getElementById("physicsNeuronB").value), 0.8);
    const neuronTau = Math.max(finiteOr(parseFloat(document.getElementById("physicsNeuronTau").value), 12.5), 0.1);
    const neuronI = finiteOr(parseFloat(document.getElementById("physicsNeuronI").value), 0.7);

    const forcing = Math.abs(driveA) > 1e-9 ? driveA : 0;

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
        description: modelDescription(type)
      };
    }

    if (type === "rlc") {
      const voltage = Math.abs(circuitV) > 1e-9 ? circuitV : 0;
      const hasL = circuitL > 1e-9;
      const hasC = circuitC > 1e-9;
      const dampingTerm = hasL ? circuitR / circuitL : 0;
      const capacitorTerm = hasL && hasC ? 1 / (circuitL * circuitC) : 0;
      const driveTerm = hasL ? voltage / circuitL : 0;
      return {
        type: "rlc",
        mode: hasL ? "secondOrder" : "circuitFirstOrder",
        t0,
        t1,
        h,
        y0,
        v0,
        circuitL,
        circuitC,
        circuitR,
        circuitV: voltage,
        circuitOmega,
        hasL,
        hasC,
        hasR: circuitR > 1e-9,
        omega: hasL && hasC ? 1 / Math.sqrt(circuitL * circuitC) : 0,
        gamma: dampingTerm,
        driveA: driveTerm,
        driveOmega: circuitOmega,
        equation: `-(${dampingTerm})*v - (${capacitorTerm})*y + (${driveTerm})*cos((${circuitOmega})*t)`,
        latex: buildRlcLatex(circuitL, circuitC, circuitR, voltage, circuitOmega),
        description: modelDescription(type)
      };
    }

    if (type === "predatorPrey") {
      return {
        type: "predatorPrey",
        mode: "planar",
        positiveState: true,
        t0,
        t1,
        h,
        y0: Math.max(y0, 0),
        v0: Math.max(v0, 0),
        predAlpha,
        predBeta,
        predDelta,
        predGamma,
        derivative: (t, prey, wolves) => ({
          y: predAlpha * prey - predBeta * prey * wolves,
          v: predDelta * prey * wolves - predGamma * wolves
        }),
        latex: buildPredatorPreyLatex(predAlpha, predBeta, predDelta, predGamma),
        description: modelDescription(type)
      };
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

    const w2 = omega * omega;
    return {
      type: "oscillator",
      mode: "secondOrder",
      t0,
      t1,
      h,
      y0,
      v0,
      omega,
      gamma,
      driveA: forcing,
      driveOmega,
      length,
      g,
      equation: `-(${w2})*y - (${gamma})*v + (${forcing})*cos((${driveOmega})*t)`,
      latex: buildOscillatorLatex(omega, gamma, forcing, driveOmega),
      description: modelDescription(type)
    };
  }

  function modelDescription(type) {
    if (type === "oscillator") return "oscillator: x'' = -omega^2 x, with optional damping and drive";
    if (type === "pendulum") return "pendulum: theta'' = -(g/L) sin(theta)";
    if (type === "rlc") return "RLC circuit: charge and current behave like a damped oscillator";
    if (type === "predatorPrey") return "predator-prey: two populations coupled by feedback";
    if (type === "neuron") return "FitzHugh-Nagumo neuron: voltage and recovery variable";
    return "";
  }

  function updatePhysicsControls(model = readModel()) {
    const type = document.getElementById("physicsSystem").value;
    const pendulum = type === "pendulum";
    const visibility = {
      secondMethod: true,
      initial: true,
      omega: type === "oscillator",
      damping: type === "oscillator" || type === "pendulum",
      drive: type === "oscillator" || type === "pendulum",
      pendulum,
      rlc: type === "rlc",
      predator: type === "predatorPrey",
      neuron: type === "neuron"
    };

    document.querySelectorAll("[data-physics-param]").forEach(group => {
      group.classList.toggle("hidden", !visibility[group.dataset.physicsParam]);
    });

    const labels = variableLabels(model || { type });
    document.getElementById("physicsY0Label").textContent = `${labels.y}(0)`;
    document.getElementById("physicsV0Label").textContent = `${labels.v}(0)`;
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

  function drawPhysicsPlots(model, result) {
    const t = result.points.map(point => point.t);
    const y = result.points.map(point => point.y);
    const v = result.points.map(point => point.v);
    const labels = variableLabels(model);
    const metrics = result.points.map(point => metricParts(model, point));
    const metricNames = metricLabels(model);
    const timeYRange = paddedRange([...y, ...v]);

    window.Plotly.newPlot("physicsTimePlot", [
      {
        x: t,
        y,
        name: `${labels.y}(t)`,
        mode: "lines",
        line: { color: "#2563eb", width: 1.5 },
        opacity: 0.25
      },
      {
        x: t,
        y: v,
        name: `${labels.v}(t)`,
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
    ], {
      title: `${labels.y}(t) and ${labels.v}(t)`,
      margin: { t: 42, r: 16, b: 42, l: 52 },
      xaxis: { title: "t", range: [model.t0, model.t1], autorange: false, fixedrange: true },
      yaxis: { title: `${labels.y}, ${labels.v}`, range: timeYRange, autorange: false, fixedrange: true },
      shapes: [timeCursorShape(model.t0)],
      annotations: [timeCursorAnnotation(model.t0)],
      uirevision: `${model.type}-time`
    }, { responsive: true });

    window.Plotly.newPlot("physicsPhasePlot", [
      {
        x: y,
        y: v,
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
    ], {
      title: `phase path: (${labels.y}, ${labels.v})`,
      margin: { t: 42, r: 16, b: 42, l: 52 },
      xaxis: { title: labels.y, range: paddedRange(y), autorange: false, fixedrange: true },
      yaxis: { title: labels.v, range: paddedRange(v), autorange: false, fixedrange: true },
      uirevision: `${model.type}-phase`
    }, { responsive: true });

    window.Plotly.newPlot("physicsEnergyPlot", [
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
    ], {
      title: metricNames.title,
      margin: { t: 42, r: 16, b: 42, l: 52 },
      xaxis: { title: "t" },
      yaxis: { title: metricNames.axis },
      shapes: [timeCursorShape(model.t0)],
      annotations: [timeCursorAnnotation(model.t0)]
    }, { responsive: true });
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
    if (result.limited) parts.push(`h limited to ${formatNumber(Math.abs(result.h))}`);
    if (model.mode === "planar") parts.push(result.method.note || `2D system solved with ${result.method.label}`);
    if (model.mode === "circuitFirstOrder" && result.note) parts.push(result.note);
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
        physicsDriveOmega: 0
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
        physicsG: 9.81
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
        physicsCircuitOmega: 0
      },
      predatorPrey: {
        physicsT1: 40,
        physicsH: 0.03,
        physicsY0: 45,
        physicsV0: 15,
        physicsPredAlpha: 0.55,
        physicsPredBeta: 0.02,
        physicsPredDelta: 0.01,
        physicsPredGamma: 0.4
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
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    if (currentModel.type === "pendulum") {
      drawPendulum(ctx, width, height, state, currentModel);
    } else if (currentModel.type === "rlc") {
      drawRlcCircuit(ctx, width, height, state, currentModel);
    } else if (currentModel.type === "predatorPrey") {
      drawPredatorPrey(ctx, width, height, state, currentModel);
    } else if (currentModel.type === "neuron") {
      drawNeuron(ctx, width, height, state, currentModel);
    } else {
      drawOscillator(ctx, width, height, state, currentModel);
    }

    drawCanvasHud(ctx, state, currentModel);
    updateTimeControls(t);
    updatePlotCursors(t, state, options.forcePlotUpdate);
  }

  function drawOscillator(ctx, width, height, state, model) {
    const centerY = height * 0.55;
    const wallX = width * 0.12;
    const originX = width * 0.52;
    const scale = width * 0.16;
    const massX = originX + clamp(state.y, -2, 2) * scale;
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
    [-2, -1, 0, 1, 2].forEach(tick => {
      const tickX = originX + tick * scale;
      ctx.strokeStyle = tick === 0 ? "#64748b" : "#cbd5e1";
      ctx.lineWidth = tick === 0 ? 1.6 : 1;
      ctx.beginPath();
      ctx.moveTo(tickX, centerY + 36);
      ctx.lineTo(tickX, centerY + 58);
      ctx.stroke();
      ctx.fillText(`x=${tick}`, tickX - 12, centerY + 74);
    });

    ctx.fillStyle = hasDriver ? "#f97316" : "#2563eb";
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.fillRect(massLeft, centerY - massH / 2, massW, massH);
    ctx.strokeRect(massLeft, centerY - massH / 2, massW, massH);

    drawMassCenterMarker(ctx, massX, centerY, massH);

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

  function drawPendulum(ctx, width, height, state, model) {
    const pivotX = width / 2;
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

    ctx.fillStyle = "#7c3aed";
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bobX, bobY, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

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

  function drawRlcCircuit(ctx, width, height, state, model) {
    const left = width * 0.16;
    const right = width * 0.84;
    const top = height * 0.25;
    const bottom = height * 0.64;
    const midY = (top + bottom) / 2;
    const current = state.v;
    const voltage = circuitVoltage(model, state.t);
    const chargeLevel = clamp(state.y / 2, -1, 1);
    const resistorStart = width * 0.34;
    const resistorEnd = width * 0.52;
    const inductorStart = width * 0.46;
    const inductorEnd = width * 0.66;
    const capHeight = 88;
    const capGap = 18;
    const hasSource = Math.abs(model.circuitV) > 1e-9;

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

  function drawPredatorPrey(ctx, width, height, state, model) {
    const meadowTop = height * 0.18;
    const meadowBottom = height * 0.78;
    const prey = Math.max(state.y, 0);
    const wolves = Math.max(state.v, 0);
    const rates = model.derivative(state.t, prey, wolves);
    const meadowLeft = width * 0.08;
    const meadowWidth = width * 0.84;
    const meadowHeight = meadowBottom - meadowTop;
    const dividerX = meadowLeft + meadowWidth * 0.62;
    const iconTop = meadowTop + 34;
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
    const unit = predatorIconUnit(ctx, sheepArea, wolfArea);

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

    drawPredatorLabels(ctx, meadowLeft, meadowTop, meadowWidth, prey, wolves, rates, unit);
    drawPopulationIcons(ctx, sheepArea.x, sheepArea.y, sheepArea.width, sheepArea.height, prey, unit, "sheep");
    drawPopulationIcons(ctx, wolfArea.x, wolfArea.y, wolfArea.width, wolfArea.height, wolves, unit, "wolf");

    drawPopulationBar(ctx, width * 0.16, height * 0.84, width * 0.3, prey, "#2563eb", "sheep");
    drawPopulationBar(ctx, width * 0.54, height * 0.84, width * 0.3, wolves, "#dc2626", "wolves");
  }

  function drawPredatorLabels(ctx, x, y, width, prey, wolves, rates, unit) {
    ctx.fillStyle = "#166534";
    ctx.font = "bold 12px Arial";
    ctx.fillText("Lotka-Volterra", x + 12, y + 17);
    ctx.fillStyle = "#475569";
    ctx.font = "11px Arial";
    ctx.fillText(`1 icon = ${formatHudNumber(unit)}`, x + width - 92, y + 17);
    ctx.fillText(`sheep ${formatHudNumber(prey)} | rate ${formatHudNumber(rates.y)}`, x + 12, y + 33);
    ctx.fillText(`wolves ${formatHudNumber(wolves)} | rate ${formatHudNumber(rates.v)}`, x + width * 0.62 + 12, y + 33);
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

  function predatorIconUnit(ctx, sheepArea, wolfArea) {
    const maxPopulation = Math.max(...(currentResult?.points || [{ y: 1, v: 1 }]).map(point => Math.max(point.y, point.v, 0)), 1);
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

  function drawCanvasHud(ctx, state, model) {
    ctx.fillStyle = "#334155";
    ctx.font = "15px Arial";
    const labels = variableLabels(model);
    ctx.fillText(`t=${formatHudNumber(state.t)}   ${labels.y}=${formatHudNumber(state.y)}   ${labels.v}=${formatHudNumber(state.v)}`, 18, 28);
  }

  function interpolateState(points, t) {
    if (!points.length) return { t: 0, y: 0, v: 0 };
    if (t <= points[0].t) return points[0];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (t >= a.t && t <= b.t) {
        const fraction = (t - a.t) / (b.t - a.t || 1);
        return {
          t,
          y: a.y + (b.y - a.y) * fraction,
          v: a.v + (b.v - a.v) * fraction
        };
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
    label.textContent = `t=${formatHudNumber(t)}`;
  }

  function updatePlotCursors(t, state, force = false) {
    if (!currentResult || !currentModel) return;
    const now = performance.now();
    if (!force && now - lastPlotCursorUpdate < 80) return;
    lastPlotCursorUpdate = now;
    const history = getHistoryUntil(t);
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
    restyleIfReady("physicsEnergyPlot", {
      x: [history.t, history.t, history.t],
      y: [history.kinetic, history.potential, history.total]
    }, [3, 4, 5]);
  }

  function getHistoryUntil(t) {
    const points = currentResult?.points || [];
    const state = interpolateState(points, t);
    const visiblePoints = points.filter(point => point.t <= t);
    if (!visiblePoints.length || visiblePoints[visiblePoints.length - 1].t < t) {
      visiblePoints.push(state);
    }
    const metrics = visiblePoints.map(point => metricParts(currentModel, point));
    return {
      t: visiblePoints.map(point => point.t),
      y: visiblePoints.map(point => point.y),
      v: visiblePoints.map(point => point.v),
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
      text: `t=${formatHudNumber(t)}`,
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

  window.setupPhysicsLab = setupPhysicsLab;
})();
