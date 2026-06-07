(function () {
  const COLORS = window.COLORS;
  const state = window.PlotState;
  const {
    generateX,
    integralMethodShapes,
    lightenColor,
    secondOrderTangent,
    taylorSecondOrder
  } = window.MathUtils;

  function handlePlotMouseMove(e) {
    if (!checked("function")) return;

    if (
      !checked("tangent") &&
      !checked("tangent2") &&
      !checked("integral_shapes")
    ) {
      return;
    }

    const xaxis = this._fullLayout.xaxis;
    const rect = this.getBoundingClientRect();
    const xPix = e.clientX - rect.left;
    const xVal = xaxis.p2l(xPix - xaxis._offset);

    const min = parseFloat(getVal("min"));
    const max = parseFloat(getVal("max"));

    if (xVal < min || xVal > max) return;
    if (state.animationFrame) return;

    state.animationFrame = requestAnimationFrame(() => {
      updateInteractiveTraces(xVal);
      state.animationFrame = null;
    });
  }

  function updateInteractiveTraces(xVal) {
    const eq = getVal("eq");
    const h = parseFloat(getVal("h"));
    const h2 = parseFloat(getVal("h2"));
    const min = parseFloat(getVal("min"));
    const max = parseFloat(getVal("max"));

    const hRatio = h / (max - min);
    const showDeltaPoints = hRatio > 0.01;
    const h2Ratio = h2 / (max - min);
    const showDeltaPoints2 = h2Ratio > 0.01;

    state.lastX = xVal;

    const x = generateX(min, max, parseFloat(getVal("step")));
    const f = window.math.compile(eq);
    const tangentTraces = [];
    const y0 = f.evaluate({ x: state.lastX });

    if (checked("analytic") && checked("tangent")) {
      const df = window.math.compile(getVal("dev1"));
      const slope = df.evaluate({ x: state.lastX });

      tangentTraces.push({
        x,
        y: x.map(xi => slope * (xi - state.lastX) + y0),
        name: "tangent analytic",
        line: {
          color: lightenColor(COLORS.analytic, 0.3),
          dash: "dash"
        },
        hoverinfo: "skip"
      });
    }

    if (checked("num_sym") && checked("tangent")) {
      addSymmetricTangent(tangentTraces, f, x, h, showDeltaPoints);
    }

    if (checked("num_asym") && checked("tangent")) {
      addAsymmetricTangent(tangentTraces, f, x, h, showDeltaPoints);
    }

    if (checked("tangent2")) {
      addSecondOrderTangents(tangentTraces, f, x, h2, showDeltaPoints2);
    }

    const traces = [
      ...state.currentBaseTraces,
      ...tangentTraces,
      {
        x: [state.lastX],
        y: [y0],
        mode: "markers",
        marker: { size: 10, color: "black" },
        name: "point",
        hoverinfo: "skip",
        showlegend: false
      }
    ];

    if (checked("integral_shapes")) {
      const hInt = parseFloat(getVal("hInt"));
      const rawX0 = parseFloat(getVal("intX0"));
      const x0 = isFinite(rawX0) ? rawX0 : min;
      const shapeResults = window.INTEGRAL_METHODS.map(({ type, method, colorKey }) => {
        if (!checked(type)) return null;
        return integralMethodShapes(eq, x0, state.lastX, hInt, method, COLORS[colorKey]);
      });
      const visibleShapeResults = shapeResults.filter(Boolean);
      const limited = visibleShapeResults.some(result => result.limited);

      state.currentLayout.shapes = visibleShapeResults.flatMap(result => result.shapes);
      if (limited && window.setIntegralStatus) {
        const maxStep = Math.max(...visibleShapeResults.map(result => result.step));
        window.setIntegralStatus(`shape h limited to ${formatNumber(maxStep)}`);
      }
    } else {
      state.currentLayout.shapes = [];
    }

    window.Plotly.react("plot", traces, state.currentLayout);
  }

  function addSymmetricTangent(tangentTraces, f, x, h, showDeltaPoints) {
    const xL = state.lastX - h / 2;
    const xR = state.lastX + h / 2;
    const yL = f.evaluate({ x: xL });
    const yR = f.evaluate({ x: xR });
    const slope = (yR - yL) / (xR - xL);

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

  function addAsymmetricTangent(tangentTraces, f, x, h, showDeltaPoints) {
    const x0 = state.lastX;
    const x1 = state.lastX + h;
    const y0 = f.evaluate({ x: x0 });
    const y1 = f.evaluate({ x: x1 });
    const slope = (y1 - y0) / (x1 - x0);

    tangentTraces.push({
      x,
      y: x.map(xi => slope * (xi - x0) + y0),
      name: "tangent asym",
      line: {
        color: lightenColor(COLORS.asym, 0.3),
        dash: "dash"
      },
      hoverinfo: "skip"
    });

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

  function addSecondOrderTangents(tangentTraces, f, x, h2, showDeltaPoints2) {
    if (checked("num2")) {
      tangentTraces.push({
        x,
        y: secondOrderTangent(getVal("eq"), state.lastX, x, h2),
        name: "tangent 2nd",
        line: {
          color: COLORS.num2,
          dash: "dot"
        },
        hoverinfo: "skip"
      });

      if (showDeltaPoints2) {
        const xL = state.lastX - h2;
        const xR = state.lastX + h2;
        const yL = f.evaluate({ x: xL });
        const yC = f.evaluate({ x: state.lastX });
        const yR = f.evaluate({ x: xR });

        tangentTraces.push({
          x: [xL, state.lastX, xR],
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
          getVal("eq"),
          getVal("dev1"),
          getVal("dev2"),
          state.lastX,
          x
        ),
        name: "taylor 2nd",
        line: {
          color: COLORS.analytic2,
          dash: "dash"
        },
        hoverinfo: "skip"
      });
    }
  }

  window.handlePlotMouseMove = handlePlotMouseMove;
})();

function formatNumber(value) {
  if (!isFinite(value)) return "0";
  return String(Math.round(value * 1000000) / 1000000);
}
