(function () {
  const METHOD_DEFS = [
    { key: "euler", label: "Euler", family: "Euler", color: "#1f77b4", formula: "k1=f(t_n,y_n); y_(n+1)=y_n+h*k1" },
    { key: "backwardEuler", label: "backward Euler", family: "Euler", color: "#d62728", formula: "solve y_(n+1)=y_n+h*f(t_(n+1),y_(n+1))" },
    { key: "midpoint", label: "midpoint RK2", family: "Runge-Kutta", color: "#2ca02c", formula: "k1=f(t_n,y_n); k2=f(t_n+h/2,y_n+h*k1/2); y_(n+1)=y_n+h*k2" },
    { key: "heun", label: "Heun RK2", family: "Runge-Kutta", color: "#9467bd", formula: "k1=f(t_n,y_n); k2=f(t_n+h,y_n+h*k1); y_(n+1)=y_n+h*(k1+k2)/2" },
    { key: "rk4", label: "RK4", family: "Runge-Kutta", color: "#111827", formula: "k1=f(t_n,y_n); k2=f(t_n+h/2,y_n+h*k1/2); k3=f(t_n+h/2,y_n+h*k2/2); k4=f(t_n+h,y_n+h*k3); y_(n+1)=y_n+h*(k1+2*k2+2*k3+k4)/6" },
    { key: "rk5", label: "RK5", family: "Runge-Kutta", color: "#7f7f7f", formula: "k1..k6 from intermediate trial points; y_(n+1)=y_n+h*(35*k1/384+500*k3/1113+125*k4/192-2187*k5/6784+11*k6/84)" },
    { key: "richardsonEuler", label: "Richardson Euler", family: "Richardson", color: "#bcbd22", formula: "full=Euler(h); half=Euler(h/2 twice); y_(n+1)=half+(half-full)/(2^1-1)" },
    { key: "richardsonMidpoint", label: "Richardson midpoint", family: "Richardson", color: "#e377c2", formula: "full=midpoint(h); half=midpoint(h/2 twice); y_(n+1)=half+(half-full)/(2^2-1)" },
    { key: "richardsonRK4", label: "Richardson RK4", family: "Richardson", color: "#4b5563", formula: "full=RK4(h); half=RK4(h/2 twice); y_(n+1)=half+(half-full)/(2^4-1)" }
  ];

  const MAX_STEPS = 6000;

  function simulateOde(config, methodKey) {
    const method = METHOD_DEFS.find(item => item.key === methodKey);
    const t0 = finiteOr(config.t0, 0);
    const t1 = finiteOr(config.t1, 5);
    const requestedH = Math.abs(finiteOr(config.h, 0.1));
    const direction = Math.sign(t1 - t0 || 1);
    const span = Math.max(Math.abs(t1 - t0), requestedH);
    const h = Math.max(requestedH, span / MAX_STEPS) * direction;
    const slopeFn = createSlopeFunction(config.equation);

    const points = [{ t: t0, y: finiteOr(config.y0, 1) }];
    let t = t0;
    let y = finiteOr(config.y0, 1);
    let guard = 0;

    while ((h > 0 && t < t1) || (h < 0 && t > t1)) {
      const step = h > 0 ? Math.min(h, t1 - t) : Math.max(h, t1 - t);
      y = stepByMethod(methodKey, t, y, step, slopeFn);
      t += step;
      points.push({ t, y });
      guard++;
      if (guard > MAX_STEPS + 2) break;
    }

    return {
      method,
      points,
      h,
      limited: Math.abs(h) > requestedH
    };
  }

  function explainStep(config, methodKey, stepIndex) {
    const simulation = simulateOde(config, methodKey);
    const points = simulation.points;
    const index = clamp(Math.floor(stepIndex), 0, Math.max(points.length - 2, 0));
    const current = points[index] || points[0];
    const next = points[index + 1] || current;
    const h = next.t - current.t;
    const slopeFn = createSlopeFunction(config.equation);
    const method = METHOD_DEFS.find(item => item.key === methodKey);
    const detail = getStepDetail(methodKey, current.t, current.y, h, slopeFn);

    return {
      method,
      current,
      next,
      h,
      index,
      maxIndex: Math.max(points.length - 2, 0),
      ...detail
    };
  }

  function stepByMethod(methodKey, t, y, h, slopeFn) {
    if (methodKey === "euler") return eulerStep(t, y, h, slopeFn);
    if (methodKey === "backwardEuler") return backwardEulerStep(t, y, h, slopeFn);
    if (methodKey === "midpoint") return midpointStep(t, y, h, slopeFn);
    if (methodKey === "heun") return heunStep(t, y, h, slopeFn);
    if (methodKey === "rk4") return rk4Step(t, y, h, slopeFn);
    if (methodKey === "rk5") return rk5Step(t, y, h, slopeFn);
    if (methodKey === "richardsonEuler") return richardsonStep(t, y, h, slopeFn, eulerStep, 1);
    if (methodKey === "richardsonMidpoint") return richardsonStep(t, y, h, slopeFn, midpointStep, 2);
    if (methodKey === "richardsonRK4") return richardsonStep(t, y, h, slopeFn, rk4Step, 4);
    return rk4Step(t, y, h, slopeFn);
  }

  function getStepDetail(methodKey, t, y, h, slopeFn) {
    if (methodKey === "euler") return eulerDetail(t, y, h, slopeFn);
    if (methodKey === "backwardEuler") return backwardEulerDetail(t, y, h, slopeFn);
    if (methodKey === "midpoint") return midpointDetail(t, y, h, slopeFn);
    if (methodKey === "heun") return heunDetail(t, y, h, slopeFn);
    if (methodKey === "rk4") return rk4Detail(t, y, h, slopeFn);
    if (methodKey === "rk5") return rk5Detail(t, y, h, slopeFn);
    if (methodKey === "richardsonEuler") return richardsonDetail(t, y, h, slopeFn, eulerStep, 1, "Euler");
    if (methodKey === "richardsonMidpoint") return richardsonDetail(t, y, h, slopeFn, midpointStep, 2, "midpoint");
    if (methodKey === "richardsonRK4") return richardsonDetail(t, y, h, slopeFn, rk4Step, 4, "RK4");
    return rk4Detail(t, y, h, slopeFn);
  }

  function eulerStep(t, y, h, slopeFn) {
    return y + h * slopeFn(t, y);
  }

  function eulerDetail(t, y, h, slopeFn) {
    const k1 = slopeFn(t, y);
    const yNext = y + h * k1;

    return {
      nextY: yNext,
      stages: [
        { label: "k1", t, y, slope: k1 }
      ],
      guides: [
        { label: "Euler step", from: { t, y }, to: { t: t + h, y: yNext } }
      ],
      formulas: [
        `k1 = f(t_n, y_n) = ${formatNumber(k1)}`,
        `y_(n+1) = y_n + h*k1 = ${formatNumber(yNext)}`
      ]
    };
  }

  function backwardEulerStep(t, y, h, slopeFn) {
    let guess = eulerStep(t, y, h, slopeFn);
    for (let i = 0; i < 8; i++) {
      guess = y + h * slopeFn(t + h, guess);
    }
    return guess;
  }

  function backwardEulerDetail(t, y, h, slopeFn) {
    let guess = eulerStep(t, y, h, slopeFn);
    const iterations = [];

    for (let i = 0; i < 6; i++) {
      const nextGuess = y + h * slopeFn(t + h, guess);
      iterations.push({ label: `guess ${i + 1}`, t: t + h, y: nextGuess, slope: slopeFn(t + h, guess) });
      guess = nextGuess;
    }

    const kEnd = slopeFn(t + h, guess);

    return {
      nextY: guess,
      stages: [
        { label: "start", t, y, slope: slopeFn(t, y) },
        ...iterations
      ],
      guides: [
        { label: "implicit step", from: { t, y }, to: { t: t + h, y: guess } }
      ],
      formulas: [
        "solve y_(n+1) = y_n + h*f(t_(n+1), y_(n+1))",
        `end slope ~= ${formatNumber(kEnd)}`,
        `y_(n+1) ~= ${formatNumber(guess)}`
      ]
    };
  }

  function midpointStep(t, y, h, slopeFn) {
    const k1 = slopeFn(t, y);
    const yMid = y + h * k1 / 2;
    return y + h * slopeFn(t + h / 2, yMid);
  }

  function midpointDetail(t, y, h, slopeFn) {
    const k1 = slopeFn(t, y);
    const yMid = y + h * k1 / 2;
    const k2 = slopeFn(t + h / 2, yMid);
    const yNext = y + h * k2;

    return {
      nextY: yNext,
      stages: [
        { label: "k1", t, y, slope: k1 },
        { label: "midpoint", t: t + h / 2, y: yMid, slope: k2 }
      ],
      guides: [
        { label: "trial half-step", from: { t, y }, to: { t: t + h / 2, y: yMid } },
        { label: "final step", from: { t, y }, to: { t: t + h, y: yNext } }
      ],
      formulas: [
        `k1 = ${formatNumber(k1)}`,
        `middle y = y_n + h*k1/2 = ${formatNumber(yMid)}`,
        `k2 = f(t_n+h/2, middle y) = ${formatNumber(k2)}`,
        `y_(n+1) = y_n + h*k2 = ${formatNumber(yNext)}`
      ]
    };
  }

  function heunStep(t, y, h, slopeFn) {
    const k1 = slopeFn(t, y);
    const k2 = slopeFn(t + h, y + h * k1);
    return y + h * (k1 + k2) / 2;
  }

  function heunDetail(t, y, h, slopeFn) {
    const k1 = slopeFn(t, y);
    const predictor = y + h * k1;
    const k2 = slopeFn(t + h, predictor);
    const average = (k1 + k2) / 2;
    const yNext = y + h * average;

    return {
      nextY: yNext,
      stages: [
        { label: "k1", t, y, slope: k1 },
        { label: "predictor", t: t + h, y: predictor, slope: k2 },
        { label: "average", t: t + h, y: yNext, slope: average }
      ],
      guides: [
        { label: "Euler predictor", from: { t, y }, to: { t: t + h, y: predictor } },
        { label: "averaged step", from: { t, y }, to: { t: t + h, y: yNext } }
      ],
      formulas: [
        `k1 = ${formatNumber(k1)}`,
        `predictor = y_n + h*k1 = ${formatNumber(predictor)}`,
        `k2 = f(t_n+h, predictor) = ${formatNumber(k2)}`,
        `average slope = (k1+k2)/2 = ${formatNumber(average)}`,
        `y_(n+1) = ${formatNumber(yNext)}`
      ]
    };
  }

  function rk4Step(t, y, h, slopeFn) {
    const k1 = slopeFn(t, y);
    const k2 = slopeFn(t + h / 2, y + h * k1 / 2);
    const k3 = slopeFn(t + h / 2, y + h * k2 / 2);
    const k4 = slopeFn(t + h, y + h * k3);
    return y + h * (k1 + 2 * k2 + 2 * k3 + k4) / 6;
  }

  function rk4Detail(t, y, h, slopeFn) {
    const k1 = slopeFn(t, y);
    const y2 = y + h * k1 / 2;
    const k2 = slopeFn(t + h / 2, y2);
    const y3 = y + h * k2 / 2;
    const k3 = slopeFn(t + h / 2, y3);
    const y4 = y + h * k3;
    const k4 = slopeFn(t + h, y4);
    const combined = (k1 + 2 * k2 + 2 * k3 + k4) / 6;
    const yNext = y + h * combined;

    return {
      nextY: yNext,
      stages: [
        { label: "k1", t, y, slope: k1 },
        { label: "k2", t: t + h / 2, y: y2, slope: k2 },
        { label: "k3", t: t + h / 2, y: y3, slope: k3 },
        { label: "k4", t: t + h, y: y4, slope: k4 }
      ],
      guides: [
        { label: "k1 trial", from: { t, y }, to: { t: t + h / 2, y: y2 } },
        { label: "k2 trial", from: { t, y }, to: { t: t + h / 2, y: y3 } },
        { label: "k3 trial", from: { t, y }, to: { t: t + h, y: y4 } },
        { label: "weighted step", from: { t, y }, to: { t: t + h, y: yNext } }
      ],
      formulas: [
        `k1 = ${formatNumber(k1)}`,
        `k2 = ${formatNumber(k2)}`,
        `k3 = ${formatNumber(k3)}`,
        `k4 = ${formatNumber(k4)}`,
        `weighted slope = (k1+2*k2+2*k3+k4)/6 = ${formatNumber(combined)}`,
        `y_(n+1) = ${formatNumber(yNext)}`
      ]
    };
  }

  function rk5Step(t, y, h, slopeFn) {
    const k1 = slopeFn(t, y);
    const k2 = slopeFn(t + h / 5, y + h * k1 / 5);
    const k3 = slopeFn(t + 3 * h / 10, y + h * (3 * k1 / 40 + 9 * k2 / 40));
    const k4 = slopeFn(t + 4 * h / 5, y + h * (44 * k1 / 45 - 56 * k2 / 15 + 32 * k3 / 9));
    const k5 = slopeFn(t + 8 * h / 9, y + h * (19372 * k1 / 6561 - 25360 * k2 / 2187 + 64448 * k3 / 6561 - 212 * k4 / 729));
    const k6 = slopeFn(t + h, y + h * (9017 * k1 / 3168 - 355 * k2 / 33 + 46732 * k3 / 5247 + 49 * k4 / 176 - 5103 * k5 / 18656));

    return y + h * (35 * k1 / 384 + 500 * k3 / 1113 + 125 * k4 / 192 - 2187 * k5 / 6784 + 11 * k6 / 84);
  }

  function rk5Detail(t, y, h, slopeFn) {
    const k1 = slopeFn(t, y);
    const y2 = y + h * k1 / 5;
    const k2 = slopeFn(t + h / 5, y2);
    const y3 = y + h * (3 * k1 / 40 + 9 * k2 / 40);
    const k3 = slopeFn(t + 3 * h / 10, y3);
    const y4 = y + h * (44 * k1 / 45 - 56 * k2 / 15 + 32 * k3 / 9);
    const k4 = slopeFn(t + 4 * h / 5, y4);
    const y5 = y + h * (19372 * k1 / 6561 - 25360 * k2 / 2187 + 64448 * k3 / 6561 - 212 * k4 / 729);
    const k5 = slopeFn(t + 8 * h / 9, y5);
    const y6 = y + h * (9017 * k1 / 3168 - 355 * k2 / 33 + 46732 * k3 / 5247 + 49 * k4 / 176 - 5103 * k5 / 18656);
    const k6 = slopeFn(t + h, y6);
    const combined = 35 * k1 / 384 + 500 * k3 / 1113 + 125 * k4 / 192 - 2187 * k5 / 6784 + 11 * k6 / 84;
    const yNext = y + h * combined;

    return {
      nextY: yNext,
      stages: [
        { label: "k1", t, y, slope: k1 },
        { label: "k2", t: t + h / 5, y: y2, slope: k2 },
        { label: "k3", t: t + 3 * h / 10, y: y3, slope: k3 },
        { label: "k4", t: t + 4 * h / 5, y: y4, slope: k4 },
        { label: "k5", t: t + 8 * h / 9, y: y5, slope: k5 },
        { label: "k6", t: t + h, y: y6, slope: k6 }
      ],
      guides: [
        { label: "k2 trial", from: { t, y }, to: { t: t + h / 5, y: y2 } },
        { label: "k3 trial", from: { t, y }, to: { t: t + 3 * h / 10, y: y3 } },
        { label: "k4 trial", from: { t, y }, to: { t: t + 4 * h / 5, y: y4 } },
        { label: "k5 trial", from: { t, y }, to: { t: t + 8 * h / 9, y: y5 } },
        { label: "k6 trial", from: { t, y }, to: { t: t + h, y: y6 } },
        { label: "weighted step", from: { t, y }, to: { t: t + h, y: yNext } }
      ],
      formulas: [
        `k1..k6 are sampled inside one step`,
        `weighted slope ~= ${formatNumber(combined)}`,
        `y_(n+1) = ${formatNumber(yNext)}`
      ]
    };
  }

  function richardsonStep(t, y, h, slopeFn, baseStep, order) {
    const coarse = baseStep(t, y, h, slopeFn);
    const half = baseStep(t, y, h / 2, slopeFn);
    const fine = baseStep(t + h / 2, half, h / 2, slopeFn);
    const factor = Math.pow(2, order) - 1;
    return fine + (fine - coarse) / factor;
  }

  function richardsonDetail(t, y, h, slopeFn, baseStep, order, baseName) {
    const coarse = baseStep(t, y, h, slopeFn);
    const half = baseStep(t, y, h / 2, slopeFn);
    const fine = baseStep(t + h / 2, half, h / 2, slopeFn);
    const factor = Math.pow(2, order) - 1;
    const yNext = fine + (fine - coarse) / factor;

    return {
      nextY: yNext,
      stages: [
        { label: "start", t, y, slope: slopeFn(t, y) },
        { label: "one full step", t: t + h, y: coarse, slope: slopeFn(t + h, coarse) },
        { label: "half step", t: t + h / 2, y: half, slope: slopeFn(t + h / 2, half) },
        { label: "two half steps", t: t + h, y: fine, slope: slopeFn(t + h, fine) },
        { label: "extrapolated", t: t + h, y: yNext, slope: slopeFn(t + h, yNext) }
      ],
      guides: [
        { label: "one full step", from: { t, y }, to: { t: t + h, y: coarse } },
        { label: "two half steps", from: { t, y }, to: { t: t + h / 2, y: half } },
        { label: "two half steps", from: { t: t + h / 2, y: half }, to: { t: t + h, y: fine } },
        { label: "Richardson result", from: { t, y }, to: { t: t + h, y: yNext } }
      ],
      formulas: [
        `${baseName}: one full step = ${formatNumber(coarse)}`,
        `${baseName}: two half steps = ${formatNumber(fine)}`,
        `correction = (two half steps - full step)/(2^${order}-1)`,
        `y_(n+1) = ${formatNumber(yNext)}`
      ]
    };
  }

  function createSlopeFunction(expr) {
    const compiled = window.math.compile(expr || "0");
    return (t, y) => compiled.evaluate({ t, y });
  }

  function evaluateExact(config, t) {
    if (!config.exact) return null;

    try {
      const compiled = window.math.compile(config.exact);
      return compiled.evaluate({
        t,
        t0: finiteOr(config.t0, 0),
        y0: finiteOr(config.y0, 1)
      });
    } catch {
      return null;
    }
  }

  function finiteOr(value, fallback) {
    return isFinite(value) ? value : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function formatNumber(value) {
    if (!isFinite(value)) return "0";
    return String(Math.round(value * 1000000) / 1000000);
  }

  window.OdeMethods = {
    METHOD_DEFS,
    evaluateExact,
    explainStep,
    simulateOde
  };
})();
