# Dynamical Systems and Physics Roadmap

Status: 2026-06-11

This file is the current source of truth for the dynamical-systems and physics roadmap. Older notes from this file were consolidated here so we do not have several competing plans after editor restarts.

## Current App Structure

The app should keep two related but distinct teaching modes:

- `Numerical Methods`: explains how numerical schemes work.
- `Physics Lab`: shows concrete systems that use those schemes.

The numerical-method panels should stay focused on algorithms:

- First-order ODEs: `y' = f(t, y)`.
- Second-order ODEs: `y'' = f(t, y, v)` with `v = y'`.
- Step views and method-stage visualizations.
- Method comparisons and error/energy behavior where useful.

Physics examples should be grouped by topic rather than added as one long flat list.

## Implemented Physics Lab Examples

Mechanical:

- Harmonic/damped/driven oscillator.
- Oscillator resonance scan with selectable drive frequencies.
- Oscillator animation modes: spring block and parabolic potential well.
- Pendulum with damping, external force, and linear-model comparison.
- Projectile motion in uniform gravity.
- Vertical bounce in uniform gravity, with drag and restitution.
- Coupled oscillators.

Fields and circuits:

- Charged particle in uniform electric and magnetic fields.
- RLC circuit with optional `R`, `L`, `C`, source voltage, and comparison case.

Biological / population:

- Lotka-Volterra predator-prey model.
- FitzHugh-Nagumo neuron model.

Shared physics features now present:

- Method selector reused across systems.
- Canvas animation.
- Time plots.
- Phase-projection selector for higher-dimensional systems.
- Energy plots when physically meaningful.
- Comparison mode for selected systems.

## UI Organization Target

Short-term structure inside `Physics Lab`:

- Mechanical
  - oscillator
  - pendulum
  - projectile / vertical bounce
  - coupled oscillators
- Fields and circuits
  - charged particle in `E + B`
  - RLC circuit
  - future dipole
- Biological / population
  - predator-prey
  - FitzHugh-Nagumo neuron
  - future Hodgkin-Huxley

Current minimal UI step already done:

- The `system` dropdown is grouped with `optgroup` sections.

Possible next UI cleanup:

- Replace the single flat system select with:
  - `category` select or tabs,
  - `system` select filtered by category,
  - shared controls below.
- Split `physics-lab.js` into smaller files once behavior stabilizes:
  - `physics/models.js`
  - `physics/solvers.js`
  - `physics/plots.js`
  - `physics/canvas.js`
  - `physics/controls.js`
- Keep `js/README.md` updated if files are moved.

Do not add a new top-level panel for every single example. Add new top-level panels only when the teaching goal changes.

## Planned Panels / Subpanels

### Rigid Body / Rotation

Goal: teach angular momentum, torque, and rotational dynamics with concrete animations.

Candidate examples:

- Rotating disk / wheel with angular momentum vector.
- Conservation of angular momentum: changing moment of inertia changes angular speed.
- Gyroscope and precession.
- Rolling wheel, pulley, or spool converting translation and rotation.
- Crank-slider mechanism converting rotational and translational motion.

Visual focus:

- Vectors: angular velocity `omega`, angular momentum `L`, torque `tau`.
- Energy split: translational, rotational, potential where applicable.
- Clear axis and scale annotations.

Implementation note:

- Start simple with planar rotation before 3D gyroscope rendering.
- A 3D gyroscope may later deserve Three.js, but the first version can be 2D/2.5D.

### Electric Dipoles

Goal: show rotational dynamics in a field without starting from full electrodynamics.

Candidate example:

- Rigid electric dipole in a uniform electric field.

Equations / physics:

- Torque: `tau = p x E`.
- Potential energy: `U = -p . E`.
- Optional damping.

Visual focus:

- Dipole rod with charges `+q` and `-q`.
- Field arrows.
- Torque arrow.
- Energy and angle over time.

Possible extension:

- Magnetic dipole in magnetic field, but only after the electric case is clear.

### Chaos Lab

This should be separate from the basic `Physics Lab` flow. It can mix mechanical, biological, and discrete examples because the common theme is chaos, not domain.

Core examples:

- Double pendulum.
- Lorenz attractor.
- Driven damped pendulum.
- Duffing oscillator.
- Logistic map with cobweb and bifurcation diagram.
- Rossler attractor.
- Henon map.
- Baker/tent map for stretch-and-fold intuition.

Educational focus:

- Sensitivity to initial conditions.
- Phase space.
- Attractors.
- Bifurcations.
- Poincare sections.
- Stretching and folding.

Lorenz visualization:

- 3D trajectory or selectable 2D projections.
- Two nearby initial conditions shown in different colors.
- Treat physical interpretation carefully: Lorenz is a simplified convection model, not a literal weather simulator.

Logistic map placement:

- It is not an ODE, but it belongs in `Chaos Lab`.
- Justification: deterministic chaos does not require differential equations; maps are the simplest way to show period doubling and bifurcation diagrams.

### Phase Flow / Liouville Lab

Goal: compare how a small bubble of initial states evolves in regular, dissipative, and chaotic systems.

Candidate systems:

- Harmonic oscillator.
- Pendulum / small-angle pendulum.
- Damped oscillator.
- Driven chaotic pendulum.
- Double pendulum.
- Lorenz attractor.

Core visual:

- Start with a small cloud/bubble of nearby initial conditions.
- Animate its evolution in a chosen phase projection.
- Optionally show area/volume estimate over time.

Important concept:

- Liouville volume conservation applies to Hamiltonian flow, not arbitrary damped systems.
- In 2D autonomous continuous systems there is no true chaos. For chaotic continuous systems we need at least 3D state space, then visualize 2D projections.

Suggested comparisons:

- Hamiltonian oscillator: bubble rotates/deforms without area loss.
- Damped oscillator: bubble contracts.
- Chaotic system: bubble stretches, folds, and separates rapidly in projections.

### Celestial Mechanics

Keep this separate from the current `Physics Lab`.

Reasons:

- It deserves its own visual quality and interaction model.
- It will likely need mission-planning ideas, orbital maneuvers, gravity assists, and multi-body simulations.
- Avoid mixing quick educational oscillators with a serious orbital-mechanics sandbox.

Candidate examples later:

- Two-body orbit.
- Three-body and N-body systems.
- Energy and angular momentum plots.
- Hohmann transfer.
- Gravity assist.
- Rocket burns and mission planning.

## Build Order Recommendation

1. Finish structural cleanup of `Physics Lab`.
2. Add `Rigid Body / Rotation` as the next new physics domain.
3. Add electric dipole as a compact field/rotation bridge.
4. Start `Chaos Lab` with double pendulum and Lorenz.
5. Add logistic map and bifurcation diagrams.
6. Add `Phase Flow / Liouville Lab`.
7. Save celestial mechanics for a dedicated, more polished panel.

## UX Principles

- Prefer concrete animations over abstract variables.
- Keep equations visible but not dominant.
- Show scales on canvas whenever motion may look slow because the view is zoomed out.
- Avoid redundant plots. If `x vs y` is available as a phase projection, do not also show it as a separate trajectory plot unless there is a specific teaching reason.
- Use phase plots when they clarify state, not as decorative charts.
- For touch devices, avoid hover-only explanations.
- Keep linked views close together or use explicit selectors.
- Add controls only when they support a clear teaching question.

## Documentation Hygiene

- Keep this file as the main roadmap.
- Keep `js/README.md` for code-structure notes only.
- If a planned idea becomes obsolete, move it to a short `Superseded` note in this file instead of creating another plan file.
- If a feature is implemented, move it from `Planned` to `Implemented`.
