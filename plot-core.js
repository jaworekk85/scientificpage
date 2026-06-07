(function () {
  const COLORS = window.COLORS;
  const state = window.PlotState;
  const {
    computeDerivative,
    computeIntegralSymbolic,
    computeYRange,
    derivativeAsym,
    derivativeSym,
    evalExpr,
    generateX,
    numericIntegral,
    secondDerivativeNum
  } = window.MathUtils;

  function getIntegralAnchor() {
    const x0 = parseFloat(getVal("intX0"));
    const f0 = parseFloat(document.getElementById("f0Slider").value);

    return {
      x0: isFinite(x0) ? x0 : parseFloat(getVal("min")),
      f0: isFinite(f0) ? f0 : 0
    };
  }

  function getIntegralConstant() {
    const { x0, f0 } = getIntegralAnchor();

    try {
      const base = window.math.compile(getVal("int"));
      return f0 - base.evaluate({ x: x0 });
    } catch {
      return 0;
    }
  }

  function updateIntegralConstantDisplay() {
    document.getElementById("cVal").textContent = formatNumber(getIntegralConstant());
  }

  function setIntegralStatus(message) {
    const el = document.getElementById("integralStatus");
    if (el) el.textContent = message;
  }

  function formatNumber(value) {
    if (!isFinite(value)) return "0";
    return String(Math.round(value * 1000000) / 1000000);
  }

  function plotScientificGraph() {
    const derivative = computeDerivative(getVal("eq"));
    if (derivative) {
      document.getElementById("dev1").value = derivative;
    }

    const derivative2 = computeDerivative(getVal("dev1"));
    if (derivative2) {
      document.getElementById("dev2").value = derivative2;
    }

    const eqNow = getVal("eq");
    if (eqNow !== state.lastIntegralInput) {
      const integral = computeIntegralSymbolic(eqNow);

      if (integral) {
        document.getElementById("int").value = integral;
      }

      state.lastIntegralInput = eqNow;
    }

    const min = parseFloat(getVal("min"));
    const max = parseFloat(getVal("max"));
    const step = parseFloat(getVal("step"));
    const h = parseFloat(getVal("h"));
    const h2 = parseFloat(getVal("h2"));
    const hInt = parseFloat(getVal("hInt"));
    const { x0, f0 } = getIntegralAnchor();
    const integralConstant = getIntegralConstant();
    const statusNotes = [];

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
      const y = evalExpr(getVal("int"), x).map(value => value + integralConstant);

      traces.push({
        x,
        y,
        name: "F(x)=G(x)+C",
        line: { color: COLORS.integral },
        hoverinfo: getHover()
      });
    }

    window.INTEGRAL_METHODS.forEach(({ type, method, label, colorKey }) => {
      if (!checked(type)) return;

      const { y, step, limited } = numericIntegral(eq, x, hInt, method, x0, f0);
      if (limited) {
        statusNotes.push(`numeric h limited to ${formatNumber(step)}`);
      }

      traces.push({
        x,
        y,
        name: `\u222b ${label}`,
        line: { color: COLORS[colorKey] },
        hoverinfo: getHover()
      });
    });

    updateIntegralConstantDisplay();
    setIntegralStatus([...new Set(statusNotes)].join("; "));

    state.currentBaseTraces = traces;

    if (!state.fixedYRange) {
      state.fixedYRange = computeYRange(traces);
    }

    layout.yaxis = {
      range: state.fixedYRange,
      autorange: false
    };

    layout.hovermode = "x";
    state.currentLayout = layout;

    window.Plotly.newPlot("plot", traces, layout);
  }

  window.updateIntegralConstantDisplay = updateIntegralConstantDisplay;
  window.setIntegralStatus = setIntegralStatus;
  window.plotScientificGraph = plotScientificGraph;
})();
