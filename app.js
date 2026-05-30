const getVal = id => document.getElementById(id).value;
const checked = t => document.querySelector(`[data-type="${t}"]`).checked;

let lastX = null;
let currentBaseTraces = [];
let currentLayout = {};
let animationFrame = null;

let lastIntegralInput = "";

let fixedYRange = null;

const COLORS = {
  function: "#1f77b4",   // niebieski
  analytic: "#d62728",   // czerwony
  sym: "#2ca02c",        // zielony
  asym: "#9467bd",        // fioletowy
  analytic2: "#ff7f0e",   // pomarańczowy
  num2: "#17becf",        // turkus
  integral: "#8c564b",
  
  num_rect: "#bcbd22",
  num_trap: "#7f7f7f"
};

function getHover() {
  const el = document.getElementById("showValues");
  return el && el.checked ? "x+y+name" : "skip";
}


const devInput = document.getElementById("dev1");

/* COLORS LIGHTENING */
function lightenColor(hex, factor = 0.5) {
  const num = parseInt(hex.replace("#", ""), 16);

  let r = (num >> 16) + Math.floor((255 - (num >> 16)) * factor);
  let g = ((num >> 8) & 0x00FF) + Math.floor((255 - ((num >> 8) & 0x00FF)) * factor);
  let b = (num & 0x0000FF) + Math.floor((255 - (num & 0x0000FF)) * factor);

  return `rgb(${r},${g},${b})`;
}

/* ===== TABS ===== */

document.querySelectorAll("[data-tab]").forEach(btn => {
  btn.addEventListener("click", () => {

    document.querySelectorAll(".tabs button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

/* ===== MOBILE PANEL ===== */

document.getElementById("togglePanel").addEventListener("click", () => {
  document.querySelector(".controls-panel").classList.toggle("active");
});

/* ===== CORE ===== */

function generateX(min, max, step) {
  const arr = [];
  for (let x = min; x <= max; x += step) arr.push(x);
  return arr;
}

function evalExpr(expr, xArr) {
  const f = math.compile(expr);
  return xArr.map(x => f.evaluate({ x }));
}

// ====== AUTO INTEGRALS ========/

function computeIntegralSymbolic(expr) {
  try {
    return Algebrite.integral(expr, "x").toString();
  } catch {
    return "";
  }
}


function updateIntegralWithC() {
  const base = getVal("int");
  const C = parseFloat(document.getElementById("cSlider").value);

  const el = document.getElementById("int");

  const cleanBase = base.replace(/\s*[+-]\s*\d+(\.\d+)?$/, "");

  if (C === 0) {
    el.value = cleanBase;
  } else if (C > 0) {
    el.value = `${cleanBase} + ${C}`;
  } else {
    el.value = `${cleanBase} - ${Math.abs(C)}`;
  }
}

function interpolate(xSrc, ySrc, xTarget) {
  const y = [];
  let j = 0;

  for (let xi of xTarget) {
    while (j < xSrc.length - 1 && xSrc[j + 1] < xi) j++;

    const x1 = xSrc[j];
    const x2 = xSrc[j + 1];
    const y1 = ySrc[j];
    const y2 = ySrc[j + 1];

    const t = (xi - x1) / (x2 - x1);
    y.push(y1 + t * (y2 - y1));
  }

  return y;
}

function integralRect(expr, min, max, h) {
  const f = math.compile(expr);
  const x = [];
  const y = [];

  let sum = 0;

  for (let xi = min; xi <= max + h; xi += h) {
    const val = f.evaluate({ x: xi });
    sum += val * h;

    x.push(xi);
    y.push(sum);
  }

  return { x, y };
}

function integralTrap(expr, min, max, h) {
  const f = math.compile(expr);
  const x = [];
  const y = [];

  let xi = min;
  let prev = f.evaluate({ x: xi });

  let sum = 0;

  x.push(xi);
  y.push(0);

  for (xi = xi + h; xi <= max + h; xi += h) {
    const curr = f.evaluate({ x: xi });

    sum += (prev + curr) / 2 * h;

    x.push(xi);
    y.push(sum);

    prev = curr;
  }

  return { x, y };
}



// ===== AUTO DERIVATIVE =====


function computeDerivative(expr) {
  try {
    return math.derivative(expr, 'x').toString();
  } catch {
    return "";
  }
}


/* ===== NUMERICAL DERIVATIVES ===== */

function derivativeAsym(expr, xArr, h) {
  const f = math.compile(expr);
  return xArr.map(x =>
    (f.evaluate({ x: x + h }) - f.evaluate({ x })) / h
  );
}

function derivativeSym(expr, xArr, h) {
  const f = math.compile(expr);
  return xArr.map(x =>
    (f.evaluate({ x: x + h/2 }) - f.evaluate({ x: x - h/2 })) / h
  );
}

function secondDerivativeNum(expr, xArr, h) {
  const f = math.compile(expr);
  return xArr.map(x =>
    (f.evaluate({ x: x - h }) +
     f.evaluate({ x: x + h }) -
     2 * f.evaluate({ x })) / (h * h)
  );
}

/* ===== TANGENT ===== */

function tangentAtPoint(expr, x0, xArr, h) {
  const f = math.compile(expr);
  const y0 = f.evaluate({ x: x0 });
  const slope = (f.evaluate({ x: x0 + h }) - y0) / h;

  return {
    y0,
    slope,
    y: xArr.map(x => slope * (x - x0) + y0)
  };
}

function secondOrderTangent(expr, x0, xArr, h) {
  const f = math.compile(expr);

  const x1 = x0 - h;
  const x2 = x0;
  const x3 = x0 + h;

  const y1 = f.evaluate({ x: x1 });
  const y2 = f.evaluate({ x: x2 });
  const y3 = f.evaluate({ x: x3 });

  // Lagrange interpolation (parabola)
  return xArr.map(x =>
    y1 * (x - x2) * (x - x3) / ((x1 - x2) * (x1 - x3)) +
    y2 * (x - x1) * (x - x3) / ((x2 - x1) * (x2 - x3)) +
    y3 * (x - x1) * (x - x2) / ((x3 - x1) * (x3 - x2))
  );
}

function taylorSecondOrder(expr, d1expr, d2expr, x0, xArr) {
  const f = math.compile(expr);
  const df = math.compile(d1expr);
  const d2f = math.compile(d2expr);

  const y0 = f.evaluate({ x: x0 });
  const d1 = df.evaluate({ x: x0 });
  const d2 = d2f.evaluate({ x: x0 });

  return xArr.map(x =>
    y0 + d1 * (x - x0) + 0.5 * d2 * (x - x0) * (x - x0)
  );
}

/* ===== RECTANGLES ===== */

function rectangleShapes(expr, min, xEnd, h) {
  const f = math.compile(expr);
  const shapes = [];

  for (let x = min; x < xEnd; x += h) {
    const y = f.evaluate({ x: x+h });

    shapes.push({
      type: 'rect',
      x0: x,
      x1: Math.min(x + h, xEnd),
      y0: 0,
      y1: y,
      fillcolor: 'rgba(188,189,34,0.3)',
      line: {
        width: 1,
        color: "#bcbd22"
      }
    });
  }

  return shapes;
}

/* ===== MAIN ===== */

function computeYRange(traces) {
  let yMin = Infinity;
  let yMax = -Infinity;

  traces.forEach(t => {
    if (!t.y) return;
    t.y.forEach(v => {
      if (isFinite(v)) {
        if (v < yMin) yMin = v;
        if (v > yMax) yMax = v;
      }
    });
  });

  if (!isFinite(yMin) || !isFinite(yMax)) return [-1, 1];

  const margin = 0.1 * (yMax - yMin || 1);
  return [yMin - margin, yMax + margin];
}



function plot() {
	
	// 🔥 auto-uzupełnienie pochodnej
	const derivative = computeDerivative(getVal("eq"));
	if (derivative) {
		document.getElementById("dev1").value = derivative;
	}
	
	const derivative2 = computeDerivative(getVal("dev1"));
	if (derivative2) {
		document.getElementById("dev2").value = derivative2;
	}
	
	const eqNow = getVal("eq");

	if (eqNow !== lastIntegralInput) {
  const integral = computeIntegralSymbolic(eqNow);

  if (integral) {
    document.getElementById("int").value = integral;
	updateIntegralWithC();
  }

  lastIntegralInput = eqNow;
}

  const min = parseFloat(getVal("min"));
  const max = parseFloat(getVal("max"));
  const step = parseFloat(getVal("step"));
  const h = parseFloat(getVal("h"));
  const h2 = parseFloat(getVal("h2"));
  const hInt = parseFloat(getVal("hInt"));

  const eq = getVal("eq");
  const x = generateX(min, max, step);

  const traces = [];
  const layout = {
  shapes: [],
  xaxis: {
    range: [min, max],
    autorange: false
  }
};

  if (checked("function")) {
    traces.push({
  x,
  y: evalExpr(eq, x),
  name: "f(x)",
  line: { color: COLORS.function },
  hoverinfo: getHover()
});
  }

  if (checked("analytic")) {
  traces.push({
  x,
  y: evalExpr(getVal("dev1"), x),
  name: "f' analytic",
  line: { color: COLORS.analytic },
  hoverinfo: getHover()
});
}


  if (checked("num_asym")) {
    traces.push({
  x,
  y: derivativeAsym(eq, x, h),
  name: "f' num asym",
  line: { color: COLORS.asym },
  hoverinfo: getHover()
});
  }

  if (checked("num_sym")) {
traces.push({
  x,
  y: derivativeSym(eq, x, h),
  name: "f' num sym",
  line: { color: COLORS.sym },
  hoverinfo: getHover()
});
  }
  
  if (checked("analytic2")) {
  traces.push({
    x,
    y: evalExpr(getVal("dev2"), x),
    name: "f'' analytic",
    line: { color: COLORS.analytic2 },
    hoverinfo: getHover()
  });
}

if (checked("num2")) {
  
  traces.push({
    x,
    y: secondDerivativeNum(eq, x, h2),
    name: "f'' numeric",
    line: { color: COLORS.num2 },
    hoverinfo: getHover()
  });
}


  if (checked("integral")) {

  const C = parseFloat(document.getElementById("cSlider").value);

  const y = evalExpr(getVal("int"), x);

  traces.push({
    x,
    y,
    name: "F(x) + C",
    line: { color: COLORS.integral },
    hoverinfo: getHover()
  });
}

if (checked("num_rect")) {
  const { x: xr, y: yr } = integralRect(eq, min, max, hInt);
  const yInterp = interpolate(xr, yr, x);

	traces.push({
	x,
	y: yInterp,
    name: "∫ rect",
    line: { color: COLORS.num_rect },
    hoverinfo: getHover()
  });
}

if (checked("num_trap")) {
  const { x: xt, y: yt } = integralTrap(eq, min, max, hInt);
  const yInterp = interpolate(xt, yt, x);

  traces.push({
  x,
  y: yInterp,
  name: "∫ trap",
  line: { color: COLORS.num_trap },
  hoverinfo: getHover()
  });
}

  currentBaseTraces = traces;
  
  if (!fixedYRange) {
  fixedYRange = computeYRange(traces);
}

layout.yaxis = {
  range: fixedYRange,
  autorange: false
};

  layout.hovermode = "x";
  
  currentLayout = layout;

  Plotly.newPlot("plot", traces, layout);
}



document.getElementById("plot").addEventListener("mousemove", function(e) {
	
	if (!checked("function")) return;

if (
  !checked("tangent") &&
  !checked("tangent2") &&
  !checked("rectangles")
) return;

 const xaxis = this._fullLayout.xaxis;

// piksel względem całego plot div
const rect = this.getBoundingClientRect();
const xPix = e.clientX - rect.left;

// uwzględnij margines osi
const xVal = xaxis.p2l(xPix - xaxis._offset);

const min = parseFloat(getVal("min"));
const max = parseFloat(getVal("max"));

if (xVal < min || xVal > max) return;

  if (animationFrame) return;

  animationFrame = requestAnimationFrame(() => {
	  
	const eq = getVal("eq");
const h = parseFloat(getVal("h"));
const h2 = parseFloat(getVal("h2"));

const min = parseFloat(getVal("min"));
const max = parseFloat(getVal("max"));

const hRatio = h / (max - min);
const showDeltaPoints = hRatio > 0.01;

const h2Ratio = h2 / (max - min);
const showDeltaPoints2 = h2Ratio > 0.01;

lastX = xVal;

    const x = generateX(
      parseFloat(getVal("min")),
      parseFloat(getVal("max")),
      parseFloat(getVal("step"))
    );

	const f = math.compile(eq);
const tangentTraces = [];

const y0 = f.evaluate({ x: lastX });

// ===== ANALYTIC =====
if (checked("analytic") && checked("tangent")) {
  const df = math.compile(getVal("dev1"));
  const slope = df.evaluate({ x: lastX });

  tangentTraces.push({
    x,
    y: x.map(xi => slope * (xi - lastX) + y0),
    name: "tangent analytic",
    line: {
  color: lightenColor(COLORS.analytic, 0.3),
  dash: "dash"
},
  hoverinfo: "skip"
  });
}

// ===== SYMMETRIC =====
if (checked("num_sym") && checked("tangent")) {
  const xL = lastX - h/2;
  const xR = lastX + h/2;

  const yL = f.evaluate({ x: xL });
  const yR = f.evaluate({ x: xR });

  const slope = (yR - yL) / (xR - xL);

  // 🔥 pełna prosta (nie odcinek)
  tangentTraces.push({
    x,
    y: x.map(xi => slope * (xi - xL) + yL),
    name: "tangent sym",
    line: {
      color: lightenColor(COLORS.sym, 0.3),
      dash: "dash"
    },
    hoverinfo: "skip"
  });

  // 🔵 punkty pomocnicze (opcjonalnie)
  if (showDeltaPoints) {
    tangentTraces.push({
      x: [xL, xR],
      y: [yL, yR],
      mode: "markers",
      marker: {
        size: 8,
        color: COLORS.sym
      },
      hoverinfo: "skip",
      showlegend: false
    });
  }
}


// ===== ASYMMETRIC =====
if (checked("num_asym") && checked("tangent")) {
  const x0 = lastX;
  const x1 = lastX + h;

  const y0_local = f.evaluate({ x: x0 });
  const y1 = f.evaluate({ x: x1 });

  const slope = (y1 - y0_local) / (x1 - x0);

  // 🔥 pełna prosta
  tangentTraces.push({
    x,
    y: x.map(xi => slope * (xi - x0) + y0_local),
    name: "tangent asym",
    line: {
      color: lightenColor(COLORS.asym, 0.3),
      dash: "dash"
    },
    hoverinfo: "skip"
  });

  // 🔵 punkt pomocniczy
  if (showDeltaPoints) {
    tangentTraces.push({
      x: [x1],
      y: [y1],
      mode: "markers",
      marker: {
        size: 8,
        color: COLORS.asym
      },
      hoverinfo: "skip",
      showlegend: false
    });
  }
  
} 
  // ===== SECOND ORDER (PARABOLA) =====
  
if (checked("tangent2")) {
 
	if(checked("num2")) {
  tangentTraces.push({
    x,
    y: secondOrderTangent(eq, lastX, x, h2),
    name: "tangent 2nd",
    line: {
      color: COLORS.num2,
      dash: "dot"
    },
    hoverinfo: "skip"
  });

  // opcjonalne punkty
  
  if (showDeltaPoints2) {
	  const f = math.compile(eq);
  const xL = lastX - h2;
  const xR = lastX + h2;

  const yL = f.evaluate({ x: xL });
  const yC = f.evaluate({ x: lastX });
  const yR = f.evaluate({ x: xR });

  tangentTraces.push({
    x: [xL, lastX, xR],
    y: [yL, yC, yR],
    mode: "markers",
    marker: {
      size: 8,
      color: COLORS.num2
    },
    hoverinfo: "skip",
    showlegend: false
  });
    
  }
	}
	
	if (checked("analytic2")) {
  tangentTraces.push({
    x,
    y: taylorSecondOrder(
      eq,
      getVal("dev1"),
      getVal("dev2"),
      lastX,
      x
    ),
    name: "taylor 2nd",
    line: {
      color: COLORS.analytic2,   // 🔥 ten sam co analytic2
      dash: "dash"
    },
    hoverinfo: "skip"
  });
}
  
}

const traces = [
  ...currentBaseTraces,
  ...tangentTraces,

  {
    x: [lastX],
    y: [y0],
    mode: "markers",
    marker: { size: 10, color: "black" },
    name: "point",
	hoverinfo: "skip",
	showlegend: false
  }
];

if (checked("rectangles")) {
  const hInt = parseFloat(getVal("hInt"));
  currentLayout.shapes = rectangleShapes(eq, min, lastX, hInt);
} else {
  currentLayout.shapes = [];
}

Plotly.react("plot", traces, currentLayout);

    animationFrame = null;
  });
});

/* ===== EVENTS ===== */

document.getElementById("plotBtn").addEventListener("click", () => {
  fixedYRange = null;   // 🔥 reset skali
  plot();
});

document.querySelectorAll("input").forEach(el => {
  el.addEventListener("change", plot);
});

document.querySelectorAll('input[type="checkbox"]').forEach(el => {
  el.addEventListener("input", () => {
    fixedYRange = null;   // 🔥 reset skali
    plot();
  });
});


const hSlider = document.getElementById("h");
const hVal = document.getElementById("hVal");

const h2Slider = document.getElementById("h2");
const h2Val = document.getElementById("h2Val");

const hIntSlider = document.getElementById("hInt");
const hIntVal = document.getElementById("hIntVal");

// inicjalizacja
hVal.textContent = hSlider.value;

// zmiana wartości
hSlider.addEventListener("input", () => {
  hVal.textContent = hSlider.value;
  plot(); // live update 🔥
});

h2Val.textContent = h2Slider.value;

h2Slider.addEventListener("input", () => {
  h2Val.textContent = h2Slider.value;
  plot();
});

hIntVal.textContent = hIntSlider.value;

hIntSlider.addEventListener("input", () => {
  hIntVal.textContent = hIntSlider.value;
  plot();
});

const cSlider = document.getElementById("cSlider");
const cVal = document.getElementById("cVal");

// inicjalizacja
cVal.textContent = cSlider.value;

// ruch slidera
cSlider.addEventListener("input", () => {
  cVal.textContent = cSlider.value;

  updateIntegralWithC();   // 🔥 NOWE
  plot();
});

devInput.value = computeDerivative(getVal("eq"));

window.addEventListener("load", plot);

plot();