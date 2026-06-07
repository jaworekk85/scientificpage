(function () {
  function setupPlotter() {
    const plotEl = document.getElementById("plot");
    plotEl.addEventListener("mousemove", window.handlePlotMouseMove);

    document.getElementById("plotBtn").addEventListener("click", () => {
      window.PlotState.fixedYRange = null;
      window.plotScientificGraph();
    });

    document.querySelectorAll("input").forEach(el => {
      el.addEventListener("change", window.plotScientificGraph);
    });

    document.querySelectorAll('input[type="checkbox"]').forEach(el => {
      el.addEventListener("input", () => {
        window.PlotState.fixedYRange = null;
        window.plotScientificGraph();
      });
    });

    setupSliders();

    document.getElementById("dev1").value =
      window.MathUtils.computeDerivative(getVal("eq"));

    window.addEventListener("load", window.plotScientificGraph);
    window.plotScientificGraph();
  }

  function setupSliders() {
    const hSlider = document.getElementById("h");
    const hVal = document.getElementById("hVal");
    const h2Slider = document.getElementById("h2");
    const h2Val = document.getElementById("h2Val");
    const hIntSlider = document.getElementById("hInt");
    const hIntVal = document.getElementById("hIntVal");
    const f0Slider = document.getElementById("f0Slider");
    const f0Val = document.getElementById("f0Val");
    const cVal = document.getElementById("cVal");

    hVal.textContent = hSlider.value;
    hSlider.addEventListener("input", () => {
      hVal.textContent = hSlider.value;
      window.plotScientificGraph();
    });

    h2Val.textContent = h2Slider.value;
    h2Slider.addEventListener("input", () => {
      h2Val.textContent = h2Slider.value;
      window.plotScientificGraph();
    });

    hIntVal.textContent = hIntSlider.value;
    hIntSlider.addEventListener("input", () => {
      hIntVal.textContent = hIntSlider.value;
      window.plotScientificGraph();
    });

    f0Val.textContent = f0Slider.value;
    cVal.textContent = "0";
    f0Slider.addEventListener("input", () => {
      f0Val.textContent = f0Slider.value;
      window.updateIntegralConstantDisplay();
      window.plotScientificGraph();
    });
  }

  window.setupPlotter = setupPlotter;
})();
