function lightenColor(hex, factor = 0.5) {
  const num = parseInt(hex.replace("#", ""), 16);

  const r = (num >> 16) + Math.floor((255 - (num >> 16)) * factor);
  const g = ((num >> 8) & 0x00FF) + Math.floor((255 - ((num >> 8) & 0x00FF)) * factor);
  const b = (num & 0x0000FF) + Math.floor((255 - (num & 0x0000FF)) * factor);

  return `rgb(${r},${g},${b})`;
}

function generateX(min, max, step) {
  const arr = [];
  for (let x = min; x <= max; x += step) arr.push(x);
  return arr;
}

function evalExpr(expr, xArr) {
  const f = window.math.compile(expr);
  return xArr.map(x => f.evaluate({ x }));
}

function computeIntegralSymbolic(expr) {
  try {
    return window.Algebrite.integral(expr, "x").toString();
  } catch {
    return "";
  }
}

function integralStep(f, a, b, method) {
  const dx = b - a;
  const left = Math.min(a, b);
  const right = Math.max(a, b);
  const mid = (left + right) / 2;

  if (method === "left") return f.evaluate({ x: left }) * dx;
  if (method === "right") return f.evaluate({ x: right }) * dx;
  if (method === "midpoint") return f.evaluate({ x: mid }) * dx;
  if (method === "simpson") {
    return (f.evaluate({ x: left }) + 4 * f.evaluate({ x: mid }) + f.evaluate({ x: right })) * dx / 6;
  }

  return (f.evaluate({ x: left }) + f.evaluate({ x: right })) * dx / 2;
}

function getSafeIntegralStep(range, h, maxSegments) {
  const requested = isFinite(h) && h > 0 ? h : 0.01;
  const safeRange = Math.max(Math.abs(range), requested);
  const minimum = safeRange / maxSegments;

  return Math.max(requested, minimum);
}

function numericIntegral(expr, xTargets, h, method, x0, f0) {
  const f = window.math.compile(expr);
  const sorted = [...xTargets].sort((a, b) => a - b);
  const range = sorted.length > 1 ? sorted[sorted.length - 1] - sorted[0] : h;
  const step = getSafeIntegralStep(
    range,
    h,
    window.PERFORMANCE_LIMITS.maxIntegralCurveSegments
  );
  const anchorX = isFinite(x0) ? x0 : 0;
  const anchorY = isFinite(f0) ? f0 : 0;
  const sortedTargets = [...new Set(xTargets.map(roundKey))].sort((a, b) => a - b);
  const yByX = buildNumericIntegralValues(f, sortedTargets, step, method, anchorX, anchorY);

  return {
    x: xTargets,
    y: xTargets.map(target => yByX.get(roundKey(target))),
    step,
    limited: step > (isFinite(h) && h > 0 ? h : 0.01)
  };
}

function buildNumericIntegralValues(f, sortedTargets, h, method, anchorX, anchorY) {
  const yByX = new Map();
  const upperTargets = sortedTargets.filter(x => x >= anchorX);
  const lowerTargets = sortedTargets.filter(x => x <= anchorX).reverse();

  walkIntegralTargets(f, upperTargets, h, method, anchorX, anchorY, yByX);
  walkIntegralTargets(f, lowerTargets, h, method, anchorX, anchorY, yByX);

  return yByX;
}

function walkIntegralTargets(f, targets, h, method, anchorX, anchorY, yByX) {
  let currentX = anchorX;
  let currentY = anchorY;

  targets.forEach(nextX => {
    if (Math.abs(nextX - anchorX) <= 1e-10) {
      yByX.set(roundKey(nextX), anchorY);
      return;
    }

    currentY += integrateApproxBetween(f, currentX, nextX, h, method, anchorX);
    currentX = nextX;
    yByX.set(roundKey(currentX), currentY);
  });
}

function integrateApproxBetween(f, from, to, h, method, anchorX) {
  let current = from;
  let total = 0;
  const direction = Math.sign(to - from);

  if (direction === 0) return 0;

  while ((direction > 0 && current < to) || (direction < 0 && current > to)) {
    const { left, right } = getIntegralCellBounds(current, h, anchorX, direction);
    const next = direction > 0 ? Math.min(to, right) : Math.max(to, left);

    total += integrateLocalApprox(f, current, next, left, right, method);
    current = next;
  }

  return total;
}

function getIntegralCellBounds(x, h, anchorX, direction) {
  const offset = (x - anchorX) / h;
  const index = direction > 0 ? Math.floor(offset + 1e-12) : Math.ceil(offset - 1e-12) - 1;
  const left = anchorX + index * h;

  return {
    left,
    right: left + h
  };
}

function integrateLocalApprox(f, from, to, cellLeft, cellRight, method) {
  if (method === "trapezoid") {
    return integrateLinearApprox(f, from, to, cellLeft, cellRight);
  }

  if (method === "simpson") {
    return integrateQuadraticApprox(f, from, to, cellLeft, cellRight);
  }

  const sampleX = getRectangleSampleX(cellLeft, cellRight, method);
  return f.evaluate({ x: sampleX }) * (to - from);
}

function integrateLinearApprox(f, from, to, cellLeft, cellRight) {
  const yLeft = f.evaluate({ x: cellLeft });
  const yRight = f.evaluate({ x: cellRight });
  const slope = (yRight - yLeft) / (cellRight - cellLeft);

  const primitive = x => {
    const dx = x - cellLeft;
    return yLeft * dx + slope * dx * dx / 2;
  };

  return primitive(to) - primitive(from);
}

function integrateQuadraticApprox(f, from, to, cellLeft, cellRight) {
  const mid = (cellLeft + cellRight) / 2;
  const yLeft = f.evaluate({ x: cellLeft });
  const yMid = f.evaluate({ x: mid });
  const yRight = f.evaluate({ x: cellRight });
  const segmentMid = (from + to) / 2;

  return (
    quadraticAt(from, cellLeft, yLeft, mid, yMid, cellRight, yRight) +
    4 * quadraticAt(segmentMid, cellLeft, yLeft, mid, yMid, cellRight, yRight) +
    quadraticAt(to, cellLeft, yLeft, mid, yMid, cellRight, yRight)
  ) * (to - from) / 6;
}

function roundKey(value) {
  return Math.round(value * 10000000000) / 10000000000;
}

function computeDerivative(expr) {
  try {
    return window.math.derivative(expr, "x").toString();
  } catch {
    return "";
  }
}

function derivativeAsym(expr, xArr, h) {
  const f = window.math.compile(expr);
  return xArr.map(x =>
    (f.evaluate({ x: x + h }) - f.evaluate({ x })) / h
  );
}

function derivativeSym(expr, xArr, h) {
  const f = window.math.compile(expr);
  return xArr.map(x =>
    (f.evaluate({ x: x + h / 2 }) - f.evaluate({ x: x - h / 2 })) / h
  );
}

function secondDerivativeNum(expr, xArr, h) {
  const f = window.math.compile(expr);
  return xArr.map(x =>
    (f.evaluate({ x: x - h }) +
      f.evaluate({ x: x + h }) -
      2 * f.evaluate({ x })) / (h * h)
  );
}

function secondOrderTangent(expr, x0, xArr, h) {
  const f = window.math.compile(expr);

  const x1 = x0 - h;
  const x2 = x0;
  const x3 = x0 + h;

  const y1 = f.evaluate({ x: x1 });
  const y2 = f.evaluate({ x: x2 });
  const y3 = f.evaluate({ x: x3 });

  return xArr.map(x =>
    y1 * (x - x2) * (x - x3) / ((x1 - x2) * (x1 - x3)) +
    y2 * (x - x1) * (x - x3) / ((x2 - x1) * (x2 - x3)) +
    y3 * (x - x1) * (x - x2) / ((x3 - x1) * (x3 - x2))
  );
}

function taylorSecondOrder(expr, d1expr, d2expr, x0, xArr) {
  const f = window.math.compile(expr);
  const df = window.math.compile(d1expr);
  const d2f = window.math.compile(d2expr);

  const y0 = f.evaluate({ x: x0 });
  const d1 = df.evaluate({ x: x0 });
  const d2 = d2f.evaluate({ x: x0 });

  return xArr.map(x =>
    y0 + d1 * (x - x0) + 0.5 * d2 * (x - x0) * (x - x0)
  );
}

function integralMethodShapes(expr, xStart, xEnd, h, method, color) {
  const f = window.math.compile(expr);
  const shapes = [];
  const range = Math.abs(xEnd - xStart);
  const step = getSafeIntegralStep(
    range,
    h,
    window.PERFORMANCE_LIMITS.maxIntegralShapesPerMethod
  );
  const direction = Math.sign(xEnd - xStart);
  let x = xStart;

  if (direction === 0) return shapes;

  while ((direction > 0 && x < xEnd) || (direction < 0 && x > xEnd)) {
    const { left, right } = getIntegralCellBounds(x, step, xStart, direction);
    const next = direction > 0 ? Math.min(xEnd, right) : Math.max(xEnd, left);
    const x0 = Math.min(x, next);
    const x1 = Math.max(x, next);

    if (method === "trapezoid") {
      shapes.push(trapezoidShape(f, x0, x1, left, right, color));
    } else if (method === "simpson") {
      shapes.push(simpsonShape(f, x0, x1, left, right, color));
    } else {
      shapes.push(rectangleMethodShape(f, x0, x1, left, right, method, color));
    }

    x = next;
  }

  return {
    shapes,
    step,
    limited: step > (isFinite(h) && h > 0 ? h : 0.01)
  };
}

function rectangleMethodShape(f, x0, x1, cellLeft, cellRight, method, color) {
  const sampleX = getRectangleSampleX(cellLeft, cellRight, method);
  const y = f.evaluate({ x: sampleX });

  return {
    type: "rect",
    x0,
    x1,
    y0: 0,
    y1: y,
    fillcolor: transparentColor(color, 0.16),
    line: {
      width: 1,
      color
    }
  };
}

function getRectangleSampleX(x0, x1, method) {
  if (method === "right") return x1;
  if (method === "midpoint") return (x0 + x1) / 2;
  return x0;
}

function trapezoidShape(f, x0, x1, cellLeft, cellRight, color) {
  const y0 = linearApproxAt(f, x0, cellLeft, cellRight);
  const y1 = linearApproxAt(f, x1, cellLeft, cellRight);

  return {
    type: "path",
    path: `M ${x0},0 L ${x0},${y0} L ${x1},${y1} L ${x1},0 Z`,
    fillcolor: transparentColor(color, 0.14),
    line: {
      width: 1,
      color
    }
  };
}

function simpsonShape(f, x0, x1, cellLeft, cellRight, color) {
  const mid = (cellLeft + cellRight) / 2;
  const y0 = f.evaluate({ x: cellLeft });
  const ym = f.evaluate({ x: mid });
  const y1 = f.evaluate({ x: cellRight });
  const curve = [];

  for (let i = 0; i <= 12; i++) {
    const x = x0 + (x1 - x0) * i / 12;
    curve.push(`L ${x},${quadraticAt(x, cellLeft, y0, mid, ym, cellRight, y1)}`);
  }

  return {
    type: "path",
    path: `M ${x0},0 ${curve.join(" ")} L ${x1},0 Z`,
    fillcolor: transparentColor(color, 0.12),
    line: {
      width: 1,
      color
    }
  };
}

function linearApproxAt(f, x, cellLeft, cellRight) {
  const yLeft = f.evaluate({ x: cellLeft });
  const yRight = f.evaluate({ x: cellRight });
  const t = (x - cellLeft) / (cellRight - cellLeft);

  return yLeft + (yRight - yLeft) * t;
}

function quadraticAt(x, x0, y0, x1, y1, x2, y2) {
  return (
    y0 * (x - x1) * (x - x2) / ((x0 - x1) * (x0 - x2)) +
    y1 * (x - x0) * (x - x2) / ((x1 - x0) * (x1 - x2)) +
    y2 * (x - x0) * (x - x1) / ((x2 - x0) * (x2 - x1))
  );
}

function transparentColor(hex, opacity) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = num >> 16;
  const g = (num >> 8) & 0x00FF;
  const b = num & 0x0000FF;
  return `rgba(${r},${g},${b},${opacity})`;
}

function computeYRange(traces) {
  let yMin = Infinity;
  let yMax = -Infinity;

  traces.forEach(trace => {
    if (!trace.y) return;
    trace.y.forEach(value => {
      if (isFinite(value)) {
        if (value < yMin) yMin = value;
        if (value > yMax) yMax = value;
      }
    });
  });

  if (!isFinite(yMin) || !isFinite(yMax)) return [-1, 1];

  const margin = 0.1 * (yMax - yMin || 1);
  return [yMin - margin, yMax + margin];
}

window.MathUtils = {
  computeDerivative,
  computeIntegralSymbolic,
  computeYRange,
  derivativeAsym,
  derivativeSym,
  evalExpr,
  generateX,
  getSafeIntegralStep,
  integralMethodShapes,
  lightenColor,
  numericIntegral,
  secondDerivativeNum,
  secondOrderTangent,
  taylorSecondOrder
};
