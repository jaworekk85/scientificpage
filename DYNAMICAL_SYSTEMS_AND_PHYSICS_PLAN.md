# Dynamical Systems and Physics Plan

## Direction

Keep the general numerical-method panels focused on explaining algorithms:

- First-order ODEs: `y' = f(t, y)`.
- Second-order ODEs: `y'' = f(t, y, v)` with `v = y'`.

Use separate thematic panels for concrete, visual examples. This should make the app easier to use in YouTube explanations: the numerical-method panels teach the schemes, while the thematic panels show why those schemes matter.

## Physics Panel

Avoid planets and orbital mechanics here. Celestial mechanics should become its own dedicated panel later.

Current implemented examples:

- Harmonic/damped/driven oscillator.
- Pendulum with optional damping and external force.
- RLC circuit as an electrical oscillator.
- Predator-prey / Lotka-Volterra as a first non-mechanical 2D system.
- FitzHugh-Nagumo neuron as a simple excitable-system model.

Suggested physics examples:

- Harmonic oscillator
  - Equation: `x'' = -omega^2*x`.
  - Visuals: animated mass on a spring or moving point, `x(t)`, `v(t)`, phase plot `(x, v)`, kinetic/potential/total energy.
  - Educational focus: compare Euler, Euler-Cromer, RK, Verlet, velocity Verlet; show energy drift or conservation.

- Damped oscillator
  - Equation: `x'' = -omega^2*x - gamma*v`.
  - Visuals: decaying oscillation, phase spiral, energy decay.
  - Educational focus: damping, loss of energy, stability of methods.

- Driven damped oscillator
  - Equation: `x'' = -omega^2*x - gamma*v + A*cos(Omega*t)`.
  - Visuals: driven motion, resonance, phase plot.
  - Educational focus: forcing, resonance, transition to richer dynamics.

- Pendulum
  - Equation: `theta'' = -(g/L)*sin(theta)`.
  - Visuals: animated pendulum, `theta(t)`, `omega(t)`, phase plot, energy.
  - Educational focus: nonlinear motion; compare with small-angle approximation `theta'' = -(g/L)*theta`.

- RLC circuit
  - Equation form similar to a damped oscillator.
  - Visuals: charge/current or voltage/current over time, energy exchange between capacitor and inductor, damping with resistance.
  - Educational focus: mechanical-electrical analogy.

- Predator-prey / Lotka-Volterra
  - Equations: `s' = alpha*s - beta*s*w`, `w' = delta*s*w - gamma*w`.
  - Visuals: changing sheep and wolf populations, population bars, time series, phase plot.
  - Educational focus: feedback loops and oscillations without a spring.
  - Numerical note: this is a 2D first-order system, so Euler/RK methods apply directly; Verlet-style choices in the shared UI should be explained as leapfrog/predictor-corrector analogs rather than literal mechanical Verlet.

- FitzHugh-Nagumo neuron
  - Equations: `u' = u - u^3/3 - w + I`, `w' = (u + a - b*w)/tau`.
  - Visuals: stylized neuron, voltage/recovery meters, spike threshold, time series, phase plot.
  - Educational focus: excitability and threshold-like behavior in a simple biological system.
  - Numerical note: also a 2D first-order system; the method dropdown should remain active, but the interpretation of second-order-specific methods needs a short UI/status explanation.

## Non-Mechanical Dynamical Systems Panel

These examples should show that the same numerical-method ideas appear outside mechanics. Keep them visually concrete: reservoirs, circuits, populations, concentrations, and fields rather than abstract variables only.

Suggested examples:

- RC/RL/RLC circuits
  - Equations: first-order charging/discharging for RC/RL; second-order oscillator for RLC.
  - Visuals: capacitor filling, current arrows, voltage/current plots.
  - Educational focus: time constants, damping, analogy between electrical and mechanical systems.

- SIR epidemic model
  - Equations:
    - `S' = -beta*S*I`
    - `I' = beta*S*I - gamma*I`
    - `R' = gamma*I`
  - Visuals: three connected population tanks or bars, time series for susceptible/infected/recovered.
  - Educational focus: coupled first-order systems, thresholds, peak infection, parameter sensitivity.

- Predator-prey / Lotka-Volterra
  - Equations:
    - `x' = alpha*x - beta*x*y`
    - `y' = delta*x*y - gamma*y`
  - Visuals: two population bars, phase plot cycles, time series.
  - Educational focus: feedback loops, phase portraits, oscillations without springs.

- Chemical reaction kinetics
  - Examples: simple reversible reaction, autocatalysis, Brusselator/Oregonator later.
  - Visuals: concentrations as liquid levels/colors, reaction arrows, time series.
  - Educational focus: rates, equilibrium, oscillating chemical reactions.

- Neuron model
  - Candidate: FitzHugh-Nagumo as a simplified excitable system.
  - Visuals: membrane voltage trace, recovery variable, phase plot, spike threshold marker.
  - Educational focus: excitability, thresholds, fast/slow variables.

- Simple climate / thermal model
  - Equation: temperature balance with input, cooling, and feedback.
  - Visuals: thermometer/tank, heating/cooling arrows, equilibrium marker.
  - Educational focus: equilibrium, feedback, stability, response time.

## Dynamical Systems / Chaos Panel

This should probably be separate from Physics. It can mix mechanical and non-mechanical examples, united by ideas like phase space, sensitivity to initial conditions, bifurcations, attractors, and stretch-and-fold behavior.

Suggested examples:

- Logistic map
  - Equation: `x_(n+1) = r*x_n*(1 - x_n)`.
  - Visuals: cobweb animation, time series, bifurcation diagram.
  - Educational focus: chaos without differential equations; period doubling; parameter-driven transition to chaos.

- Driven damped pendulum
  - Equation: `theta'' + gamma*theta' + sin(theta) = A*cos(omega*t)`.
  - Visuals: animated pendulum, `theta(t)`, phase plot, Poincare section, nearby initial conditions diverging.
  - Educational focus: deterministic chaos in a physical system.

- Double pendulum
  - Visuals: animated double pendulum, two nearby starts diverging.
  - Educational focus: sensitivity to initial conditions.
  - Note: visually excellent but implementation is more involved; add later.

- Lorenz attractor
  - Equations:
    - `x' = sigma*(y - x)`
    - `y' = x*(rho - z) - y`
    - `z' = x*y - beta*z`
  - Origin: simplified model of atmospheric convection.
  - Variables roughly represent convection intensity and temperature differences in a simplified heated-fluid layer.
  - Visuals: animated 3D trajectory or 2D projections, two nearby trajectories diverging.
  - Educational focus: deterministic equations can produce unpredictable-looking behavior; sensitivity to initial conditions.

- Rossler attractor
  - Visuals: spiral-like chaotic attractor, animated point.
  - Educational focus: another continuous chaotic attractor, often visually simpler than Lorenz.

- Duffing oscillator
  - Equation: `x'' + delta*x' + alpha*x + beta*x^3 = gamma*cos(omega*t)`.
  - Visuals: particle in a nonlinear or double-well potential, phase plot, Poincare section.
  - Educational focus: nonlinear forced oscillator and chaos.

- Henon map
  - Equations:
    - `x_(n+1) = 1 - a*x_n^2 + y_n`
    - `y_(n+1) = b*x_n`
  - Visuals: points accumulating on a fractal attractor.
  - Educational focus: discrete 2D chaos and strange attractors.

- Baker's map / tent map
  - Visuals: stretching and folding an interval or square.
  - Educational focus: geometric mechanism of chaos: stretch, fold, repeat.

## Suggested Build Order

1. Physics: harmonic oscillator.
2. Physics: damped and driven oscillator.
3. Physics: pendulum.
4. Physics: RLC circuit.
5. Non-mechanical systems: RC circuit or SIR model.
6. Non-mechanical systems: predator-prey model.
7. Chaos: logistic map with cobweb and bifurcation diagram.
8. Chaos: driven damped pendulum with Poincare section.
9. Chaos: Lorenz attractor.
10. Chaos: Duffing oscillator.
11. Chaos: Henon or Baker map.

## UX Notes

- Prefer concrete animations over abstract controls.
- Keep equations visible but not dominant.
- Use phase plots when they clarify state, not as decorative charts.
- In animations, make physical coupling visually explicit. A force source should visibly touch or connect to the object it affects; otherwise beginners may read it as a separate decoration.
- For touch devices, avoid relying only on hover. Use pinned step/selected state patterns.
- When several linked views exist, keep them physically close on screen or provide tabs/switchers.
- Big overview plots can be optional; local step views should stay compact and immediately adjacent to the main interaction.
