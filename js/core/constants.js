window.COLORS = {
  function: "#1f77b4",
  analytic: "#d62728",
  sym: "#2ca02c",
  asym: "#9467bd",
  analytic2: "#ff7f0e",
  num2: "#17becf",
  integral: "#8c564b",
  num_left: "#bcbd22",
  num_right: "#e377c2",
  num_mid: "#2ca02c",
  num_trap: "#7f7f7f",
  num_simpson: "#111827"
};

window.INTEGRAL_METHODS = [
  { type: "num_left", method: "left", label: "left", colorKey: "num_left" },
  { type: "num_right", method: "right", label: "right", colorKey: "num_right" },
  { type: "num_mid", method: "midpoint", label: "midpoint", colorKey: "num_mid" },
  { type: "num_trap", method: "trapezoid", label: "trapezoid", colorKey: "num_trap" },
  { type: "num_simpson", method: "simpson", label: "Simpson", colorKey: "num_simpson" }
];

window.PERFORMANCE_LIMITS = {
  maxIntegralCurveSegments: 3000,
  maxIntegralShapesPerMethod: 160
};
