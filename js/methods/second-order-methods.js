(function () {
  const METHOD_DEFS = [
    { key: "euler2", label: "Euler", family: "Euler", color: "#1f77b4", formula: "a_n=f(t_n,y_n,v_n); y_(n+1)=y_n+h*v_n; v_(n+1)=v_n+h*a_n" },
    { key: "eulerCromer", label: "Euler-Cromer", family: "Euler", color: "#d62728", formula: "a_n=f(t_n,y_n,v_n); v_(n+1)=v_n+h*a_n; y_(n+1)=y_n+h*v_(n+1)" },
    { key: "midpoint2", label: "midpoint RK2", family: "Runge-Kutta", color: "#2ca02c", formula: "k1=(v_n,a_n); mid=(y_n+h*k1_y/2,v_n+h*k1_v/2); y_(n+1)=y_n+h*k2_y; v_(n+1)=v_n+h*k2_v" },
    { key: "rk4System", label: "RK4", family: "Runge-Kutta", color: "#111827", formula: "apply RK4 to y'=v and v'=f(t,y,v)" },
    { key: "verlet", label: "Verlet", family: "Verlet", color: "#9467bd", formula: "y_(n+1)=2*y_n-y_(n-1)+h^2*a_n; v_(n+1)~(y_(n+1)-y_(n-1))/(2h)" },
    { key: "velocityVerlet", label: "velocity Verlet", family: "Verlet", color: "#ff7f0e", formula: "y_(n+1)=y_n+h*v_n+h^2*a_n/2; v_(n+1)=v_n+h*(a_n+a_(n+1))/2" }
  ];

  const MAX_STEPS = 6000;

  function simulateSecondOrder(config, methodKey) {
    const method = METHOD_DEFS.find(item => item.key === methodKey);
    if (!method) throw new Error("unknown method");

    const t0 = finiteOr(config.t0, 0);
    const t1 = finiteOr(config.t1, 12);
    const requestedH = Math.abs(finiteOr(config.h, 0.25));
    const direction = Math.sign(t1 - t0 || 1);
    const span = Math.max(Math.abs(t1 - t0), requestedH);
    const h = Math.max(requestedH, span / MAX_STEPS) * direction;
    const accelFn = createAccelerationFunction(config.equation);

    const points = [];
    let t = t0;
    let y = finiteOr(config.y0, 1);
    let v = finiteOr(config.v0, 0);
    let prevY = y - h * v + 0.5 * h * h * accelFn(t, y, v);
    points.push({ t, y, v, a: accelFn(t, y, v), prevY });

    let guard = 0;
    while ((h > 0 && t < t1) || (h < 0 && t > t1)) {
      const step = h > 0 ? Math.min(h, t1 - t) : Math.max(h, t1 - t);
      const next = stepByMethod(methodKey, t, y, v, step, accelFn, prevY);
      prevY = y;
      t += step;
      y = next.y;
      v = next.v;
      points.push({ t, y, v, a: accelFn(t, y, v), prevY });
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

  function explainSecondOrderStep(config, methodKey, stepIndex) {
    const simulation = simulateSecondOrder(config, methodKey);
    const points = simulation.points;
    const index = clamp(Math.floor(stepIndex), 0, Math.max(points.length - 2, 0));
    const current = points[index] || points[0];
    const next = points[index + 1] || current;
    const h = next.t - current.t;
    const accelFn = createAccelerationFunction(config.equation);
    const method = METHOD_DEFS.find(item => item.key === methodKey);
    const detail = getStepDetail(methodKey, current.t, current.y, current.v, h, accelFn, current.prevY);

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

  function stepByMethod(methodKey, t, y, v, h, accelFn, prevY) {
    if (methodKey === "euler2") return eulerStep(t, y, v, h, accelFn);
    if (methodKey === "eulerCromer") return eulerCromerStep(t, y, v, h, accelFn);
    if (methodKey === "midpoint2") return midpointStep(t, y, v, h, accelFn);
    if (methodKey === "rk4System") return rk4Step(t, y, v, h, accelFn);
    if (methodKey === "verlet") return verletStep(t, y, v, h, accelFn, prevY);
    if (methodKey === "velocityVerlet") return velocityVerletStep(t, y, v, h, accelFn);
    return rk4Step(t, y, v, h, accelFn);
  }

  function getStepDetail(methodKey, t, y, v, h, accelFn, prevY) {
    if (methodKey === "euler2") return eulerDetail(t, y, v, h, accelFn);
    if (methodKey === "eulerCromer") return eulerCromerDetail(t, y, v, h, accelFn);
    if (methodKey === "midpoint2") return midpointDetail(t, y, v, h, accelFn);
    if (methodKey === "rk4System") return rk4Detail(t, y, v, h, accelFn);
    if (methodKey === "verlet") return verletDetail(t, y, v, h, accelFn, prevY);
    if (methodKey === "velocityVerlet") return velocityVerletDetail(t, y, v, h, accelFn);
    return rk4Detail(t, y, v, h, accelFn);
  }

  function eulerStep(t, y, v, h, accelFn) {
    const a = accelFn(t, y, v);
    return { y: y + h * v, v: v + h * a };
  }

  function eulerDetail(t, y, v, h, accelFn) {
    const a = accelFn(t, y, v);
    const next = eulerStep(t, y, v, h, accelFn);
    return {
      nextY: next.y,
      nextV: next.v,
      stages: [
        { label: "start", t, y, v, a },
        { label: "Euler", t: t + h, y: next.y, v: next.v, a: accelFn(t + h, next.y, next.v) }
      ],
      guides: [{ label: "Euler step", from: { t, y }, to: { t: t + h, y: next.y } }],
      formulas: [
        `a_n = f(t_n, y_n, v_n) = ${formatNumber(a)}`,
        `y_(n+1) = y_n + h*v_n = ${formatNumber(next.y)}`,
        `v_(n+1) = v_n + h*a_n = ${formatNumber(next.v)}`
      ]
    };
  }

  function eulerCromerStep(t, y, v, h, accelFn) {
    const a = accelFn(t, y, v);
    const nextV = v + h * a;
    return { y: y + h * nextV, v: nextV };
  }

  function eulerCromerDetail(t, y, v, h, accelFn) {
    const a = accelFn(t, y, v);
    const next = eulerCromerStep(t, y, v, h, accelFn);
    return {
      nextY: next.y,
      nextV: next.v,
      stages: [
        { label: "start", t, y, v, a },
        { label: "new v", t, y, v: next.v, a },
        { label: "Euler-Cromer", t: t + h, y: next.y, v: next.v, a: accelFn(t + h, next.y, next.v) }
      ],
      guides: [{ label: "new velocity step", from: { t, y }, to: { t: t + h, y: next.y } }],
      formulas: [
        `a_n = ${formatNumber(a)}`,
        `v_(n+1) = v_n + h*a_n = ${formatNumber(next.v)}`,
        `y_(n+1) = y_n + h*v_(n+1) = ${formatNumber(next.y)}`
      ]
    };
  }

  function midpointStep(t, y, v, h, accelFn) {
    const a1 = accelFn(t, y, v);
    const midY = y + h * v / 2;
    const midV = v + h * a1 / 2;
    const a2 = accelFn(t + h / 2, midY, midV);
    return { y: y + h * midV, v: v + h * a2 };
  }

  function midpointDetail(t, y, v, h, accelFn) {
    const a1 = accelFn(t, y, v);
    const midY = y + h * v / 2;
    const midV = v + h * a1 / 2;
    const a2 = accelFn(t + h / 2, midY, midV);
    const next = { y: y + h * midV, v: v + h * a2 };
    return {
      nextY: next.y,
      nextV: next.v,
      stages: [
        { label: "k1", t, y, v, a: a1 },
        { label: "mid", t: t + h / 2, y: midY, v: midV, a: a2 },
        { label: "next", t: t + h, y: next.y, v: next.v, a: accelFn(t + h, next.y, next.v) }
      ],
      guides: [
        { label: "midpoint trial", from: { t, y }, to: { t: t + h / 2, y: midY } },
        { label: "midpoint step", from: { t, y }, to: { t: t + h, y: next.y } }
      ],
      formulas: [
        `k1_y = v_n = ${formatNumber(v)}, k1_v = a_n = ${formatNumber(a1)}`,
        `mid = (${formatNumber(midY)}, ${formatNumber(midV)})`,
        `y_(n+1) = y_n + h*v_mid = ${formatNumber(next.y)}`,
        `v_(n+1) = v_n + h*a_mid = ${formatNumber(next.v)}`
      ]
    };
  }

  function rk4Step(t, y, v, h, accelFn) {
    const k1 = systemSlope(t, y, v, accelFn);
    const k2 = systemSlope(t + h / 2, y + h * k1.y / 2, v + h * k1.v / 2, accelFn);
    const k3 = systemSlope(t + h / 2, y + h * k2.y / 2, v + h * k2.v / 2, accelFn);
    const k4 = systemSlope(t + h, y + h * k3.y, v + h * k3.v, accelFn);
    return {
      y: y + h * (k1.y + 2 * k2.y + 2 * k3.y + k4.y) / 6,
      v: v + h * (k1.v + 2 * k2.v + 2 * k3.v + k4.v) / 6
    };
  }

  function rk4Detail(t, y, v, h, accelFn) {
    const k1 = systemSlope(t, y, v, accelFn);
    const p2 = { t: t + h / 2, y: y + h * k1.y / 2, v: v + h * k1.v / 2 };
    const k2 = systemSlope(p2.t, p2.y, p2.v, accelFn);
    const p3 = { t: t + h / 2, y: y + h * k2.y / 2, v: v + h * k2.v / 2 };
    const k3 = systemSlope(p3.t, p3.y, p3.v, accelFn);
    const p4 = { t: t + h, y: y + h * k3.y, v: v + h * k3.v };
    const k4 = systemSlope(p4.t, p4.y, p4.v, accelFn);
    const next = rk4Step(t, y, v, h, accelFn);
    return {
      nextY: next.y,
      nextV: next.v,
      stages: [
        { label: "k1", t, y, v, a: k1.v },
        { label: "k2", ...p2, a: k2.v },
        { label: "k3", ...p3, a: k3.v },
        { label: "k4", ...p4, a: k4.v },
        { label: "next", t: t + h, y: next.y, v: next.v, a: accelFn(t + h, next.y, next.v) }
      ],
      guides: [
        { label: "k2 trial", from: { t, y }, to: { t: p2.t, y: p2.y } },
        { label: "k3 trial", from: { t, y }, to: { t: p3.t, y: p3.y } },
        { label: "k4 trial", from: { t, y }, to: { t: p4.t, y: p4.y } },
        { label: "RK4 step", from: { t, y }, to: { t: t + h, y: next.y } }
      ],
      formulas: [
        "k1..k4 are slopes of the system y'=v, v'=a",
        `weighted y slope = ${formatNumber((k1.y + 2 * k2.y + 2 * k3.y + k4.y) / 6)}`,
        `weighted v slope = ${formatNumber((k1.v + 2 * k2.v + 2 * k3.v + k4.v) / 6)}`,
        `y_(n+1) = ${formatNumber(next.y)}, v_(n+1) = ${formatNumber(next.v)}`
      ]
    };
  }

  function verletStep(t, y, v, h, accelFn, prevY) {
    const a = accelFn(t, y, v);
    const previous = isFinite(prevY) ? prevY : y - h * v + 0.5 * h * h * a;
    const nextY = 2 * y - previous + h * h * a;
    const nextV = (nextY - previous) / (2 * h);
    return { y: nextY, v: nextV };
  }

  function verletDetail(t, y, v, h, accelFn, prevY) {
    const a = accelFn(t, y, v);
    const previous = isFinite(prevY) ? prevY : y - h * v + 0.5 * h * h * a;
    const next = verletStep(t, y, v, h, accelFn, previous);
    return {
      nextY: next.y,
      nextV: next.v,
      stages: [
        { label: "previous", t: t - h, y: previous, v, a },
        { label: "start", t, y, v, a },
        { label: "next", t: t + h, y: next.y, v: next.v, a: accelFn(t + h, next.y, next.v) }
      ],
      guides: [
        { label: "previous to current", from: { t: t - h, y: previous }, to: { t, y } },
        { label: "Verlet step", from: { t, y }, to: { t: t + h, y: next.y } }
      ],
      formulas: [
        `a_n = ${formatNumber(a)}`,
        `y_(n+1) = 2*y_n - y_(n-1) + h^2*a_n = ${formatNumber(next.y)}`,
        `v_(n+1) ~= (y_(n+1)-y_(n-1))/(2h) = ${formatNumber(next.v)}`
      ]
    };
  }

  function velocityVerletStep(t, y, v, h, accelFn) {
    const a = accelFn(t, y, v);
    const nextY = y + h * v + 0.5 * h * h * a;
    const predictedV = v + h * a;
    const nextA = accelFn(t + h, nextY, predictedV);
    return { y: nextY, v: v + 0.5 * h * (a + nextA) };
  }

  function velocityVerletDetail(t, y, v, h, accelFn) {
    const a = accelFn(t, y, v);
    const nextY = y + h * v + 0.5 * h * h * a;
    const predictedV = v + h * a;
    const nextA = accelFn(t + h, nextY, predictedV);
    const nextV = v + 0.5 * h * (a + nextA);
    return {
      nextY,
      nextV,
      stages: [
        { label: "start", t, y, v, a },
        { label: "position", t: t + h, y: nextY, v: predictedV, a: nextA },
        { label: "next", t: t + h, y: nextY, v: nextV, a: nextA }
      ],
      guides: [{ label: "position update", from: { t, y }, to: { t: t + h, y: nextY } }],
      formulas: [
        `a_n = ${formatNumber(a)}`,
        `y_(n+1) = y_n + h*v_n + h^2*a_n/2 = ${formatNumber(nextY)}`,
        `a_(n+1) ~= ${formatNumber(nextA)}`,
        `v_(n+1) = v_n + h*(a_n+a_(n+1))/2 = ${formatNumber(nextV)}`
      ]
    };
  }

  function systemSlope(t, y, v, accelFn) {
    return { y: v, v: accelFn(t, y, v) };
  }

  function evaluateExactY(config, t) {
    return evaluateExact(config.exactY, config, t);
  }

  function evaluateExactV(config, t) {
    return evaluateExact(config.exactV, config, t);
  }

  function evaluateExact(expr, config, t) {
    if (!expr) return null;
    try {
      const compiled = window.math.compile(expr);
      return compiled.evaluate({
        t,
        t0: finiteOr(config.t0, 0),
        y0: finiteOr(config.y0, 1),
        v0: finiteOr(config.v0, 0)
      });
    } catch {
      return null;
    }
  }

  function createAccelerationFunction(expr) {
    const compiled = window.math.compile(expr || "0");
    return (t, y, v) => compiled.evaluate({ t, y, v });
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

  window.SecondOrderMethods = {
    METHOD_DEFS,
    simulateSecondOrder,
    explainSecondOrderStep,
    evaluateExactY,
    evaluateExactV
  };
})();
