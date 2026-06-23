# Project Handoff Notes

Status: 2026-06-22

This file is a compact memory anchor for future sessions after editor, browser, or assistant restarts.

## What This Project Is

`scientificpage` is a small browser-based scientific teaching app. It is currently a lightweight static frontend:

- `index.html` contains the main page structure and loads external libraries from CDNs.
- `style.css` contains the shared visual styling.
- `js/` contains the app logic split into core, plotter, numerical-method, and physics modules.
- There is no `package.json` at the moment, so the normal workflow is not npm-based.

The app has two closely related teaching areas:

- `Numerical Methods`: explains ODE algorithms and method behavior.
- `Dynamics`: shows concrete dynamical systems using those numerical methods, including classical physics, fields, biological models, chaos, and later phase-flow / Liouville examples.

The main roadmap for dynamical systems and physics work is:

- `DYNAMICAL_SYSTEMS_AND_PHYSICS_PLAN.md`

Keep that file as the source of truth for physics direction, implemented examples, and future lab ideas.

## Collaboration Style

The usual workflow is iterative and visual:

1. Codex reads the local code and roadmap before changing behavior.
2. Codex makes focused edits in the existing style of the app.
3. The user refreshes the already-open browser page and visually checks what changed.
4. The user reports what looks good, wrong, awkward, or confusing.
5. Codex adjusts the code and repeats.

The user likes direct, practical progress over long planning. Short status updates are useful while Codex is reading or editing.

Important: do not assume the user sees command output. Summarize relevant checks and results in the response.

## How Changes Are Tested

There is currently no automated frontend test runner. The normal test loop is:

1. Edit files locally.
2. Run lightweight static checks when possible, for example:
   - `git diff --check -- <changed files>`
   - search for conflict markers with `rg -n "<<<<<<<|=======|>>>>>>>" <changed files>`
3. The user refreshes the page in the browser.
4. The user manually verifies UI, plots, animation, and console errors.

If Node is not installed, `node --check` is unavailable. Do not block on it.

For this project, browser inspection by the user is the real acceptance check.

## Current Dynamics Direction

The current `Dynamics` stage is complete enough to stop expanding it for now. Future work should focus on bug fixes, labels, readability, or examples with a very clear teaching payoff.

The next major planned area is `Celestial mechanics` / orbital mechanics.

The app should keep examples grouped by topic instead of becoming one long flat list.

Current category structure in the Dynamics selector:

- `Mechanical`
- `Rotation / rigid body`
- `Fields & circuits`
- `Biological / population`
- `Chaos`

Do not add Celestial Mechanics as just another small Dynamics example unless the UI direction changes. It should probably become a dedicated area or a clearly separated major category because it needs richer scene controls, orbital presets, and mission-planning interactions.

Current Celestial Mechanics UI status:

- A first top-level tab shell exists.
- Files involved:
  - `index.html`
  - `style.css`
  - `js/app.js`
  - `js/celestial/celestial-lab.js`
- The current renderer is a first Three.js/WebGL orbit scene with OrbitControls, pan/zoom/rotate camera interaction, a procedural star/corona, procedural planet textures, selectable bodies, and a 2D canvas fallback if Three.js fails to load.
- The layout reserves space for the WebGL viewport plus diagnostic plots.
- Current object workflow supports picking bodies in the 3D scene, selecting from a dropdown, editing mass/radius/orbit/phase/inclination, adding planets or stars, resetting the preset, and visual binary/circumbinary presets.
- Future object workflow should replace the visual orbit scaffold with true N-body state variables and add remove/duplicate controls, moons, hierarchical systems, and persistent body lists.

The `Rotation / rigid body` category currently contains:

- `rotatingDisk`: rotating disk / variable inertia, with changing moment of inertia.
- `rollingBodies`: sphere, cylinder, and hoop rolling without slipping down the same incline.
- `spool`: pulled spool model with the currently drawn upper tangent string geometry.
- `wilberforce`: Wilberforce oscillator converting energy periodically between vertical motion and torsional rotation.
- `gyroscope`: symmetric heavy-top model with numerical precession and nutation.

The `Fields & circuits` category currently contains:

- `chargedParticle`: point charge in uniform electric and magnetic fields.
- `rigidDipole`: two endpoint charges on a rigid rod, integrated as a 6D ODE in uniform electric and optional magnetic fields.
- `rlc`: RLC circuit with optional components and source voltage.

The latest known changed files for this work were:

- `DYNAMICAL_SYSTEMS_AND_PHYSICS_PLAN.md`
- `index.html`
- `js/chaos/chaos-lab.js`
- `js/physics/physics-lab.js`
- `style.css`

## Recent Implementation Notes

Recent additions include:

- A `category` select for Dynamics.
- Filtered `system` options per category.
- Controls for rotating disk / variable inertia:
  - `I0`, `I1`, torque, initial angle, initial angular velocity.
- Controls for Wilberforce oscillator:
  - mass, spin inertia, vertical stiffness, torsional stiffness, coupling, damping, and initial vertical/torsional state.
- Controls for gyroscope / precession:
  - mass, pivot distance, transverse inertia `I1`, spin-axis inertia `I3`, spin angular speed, initial tilt, gravity, initial azimuth, initial nutation rate, and initial precession rate.
- New model builders, equation text, metric labels, default parameters, and canvas renderers in `js/physics/physics-lab.js`.
- Wilberforce and gyroscope visuals use a stronger 2.5D canvas style with depth cues, shadows, ellipses, and pseudo-3D rotating parts.
- Rigid charged dipole:
  - state is `x, y, vx, vy, theta, omega`;
  - `Bz = 0` is the clean electric-dipole case;
  - `Bz != 0` applies Lorentz forces separately at the `+q` and `-q` endpoints;
  - plots include angle/angular velocity/torque, selectable phase projection, energy split, and center-of-mass path.
- Rolling / spool additions before Chaos:
  - `rollingBodies` compares `k = I/(mR^2)` for sphere, cylinder, and hoop;
  - rolling bodies should be drawn in three separate side-by-side canvas lanes to avoid overlap;
  - rolling phase projections should offer `s-v`, `phi-omega`, `s-phi`, and `v-omega`;
  - rolling energy plots should split potential, translational kinetic, and rotational kinetic energy;
  - `spool` currently matches the visible upper tangent geometry, so its ODE uses `cos(alpha)+r/R`;
  - the classic reversal case needs a separate lower/alternate wrapping geometry before using `cos(alpha)-r/R`;
  - `crank-slider` is postponed unless it gets real dynamics beyond the geometric constraint.
- Chaos first version:
  - integrated as `Dynamics > Chaos` rather than a separate top-level tab;
  - `js/chaos/chaos-lab.js` contains Lorenz, logistic map, double pendulum, Duffing, and phase-flow / Liouville simulations;
  - Lorenz and double pendulum use two nearby deterministic trajectories with selectable Euler, midpoint RK2, Heun RK2, or RK4 integration;
  - Lorenz canvas is always drag-rotatable pseudo-3D; its dropdown selects only the 2D phase projection plot;
  - logistic map shows cobweb, animated `x_n` generation per scanned `r`, split build-up canvas, transient/long-run separation before plotting bifurcation columns, Feigenbaum period-doubling markers, and visible ratio estimates;
  - a driven damped pendulum Chaos prototype was tried and removed from the UI because the selected examples did not visibly demonstrate chaos reliably enough;
  - double pendulum shows animated pendulums, tip trails, selectable 2D projections of the 4D phase space with Greek axis labels, A/B angle traces, logarithmic separation, and a separate mechanical-energy plot comparing `K_A`, `K_B`, `U_A`, `U_B`, `E_A`, and `E_B`;
  - Lorenz and double pendulum Plotly panels now show the whole trajectory faintly while the elapsed part saturates during animation;
  - The `Run` button was removed from Chaos because simulations recompute automatically on control changes and on entering the panel.
  - Duffing is implemented as a separate Chaos system with regular/chaotic presets, double-well potential canvas, `q-p` projection, and nearby-start separation. A Poincare period-doubling sweep prototype was removed from the UI because it was visually confusing and did not communicate the physics well.
  - Phase-flow / Liouville is implemented as a system inside `Dynamics > Chaos`, not as a separate top-level category. It shows a material cloud/mesh, triangulated projected area ratio, and mean energy drift/change for Hamiltonian, damped, driven, Duffing, and double-pendulum flow. Its ratio plot uses separate y-axes for projected material area and local 4D volume. Double-pendulum Liouville mode also shows a local 4D volume estimate in canonical `(theta, p)` coordinates while the visible bubble remains a selected 2D projection.

Current completion checkpoint:

- Mechanical, rotation/rigid-body, fields/circuits, biology, and Chaos/Liouville examples are all represented in the app.
- The known visually weak Chaos ideas were removed rather than left half-active:
  - driven damped pendulum Chaos view;
  - Duffing period-doubling / Poincare sweep UI.
- If future sessions revisit either idea, first define a visualization that visibly communicates the physics before implementing controls.

The gyroscope is no longer just the steady-precession approximation:

- It uses a symmetric heavy-top model with Euler-angle dynamics.
- `theta` is integrated numerically, so nutation can appear.
- `phi` and `psi` are evolved from conserved angular momenta.
- Its plots include Euler-angle time traces, selectable 2D projections of the 4D state, angular-momentum components, and energy.
- It is still rendered in 2D/2.5D canvas, not full Three.js rigid-body rendering.

## Next Major Stage: Celestial Mechanics

Planned direction:

- Build from Newtonian gravity and Newton's laws:
  - `F_ij = -G m_i m_j (r_i - r_j) / |r_i - r_j|^3`;
  - integrate each body's position and velocity.
- Start with the two-body / Kepler problem:
  - circular, elliptical, parabolic, and hyperbolic orbits;
  - comparison against analytic orbit shapes;
  - plots for energy, angular momentum, eccentricity, and orbital elements.
- The unusual conserved quantity the user remembered is probably the Laplace-Runge-Lenz vector / eccentricity vector. It points toward periapsis and is conserved in the ideal inverse-square two-body problem.
- Then add:
  - three-body and N-body chaos;
  - Solar System presets;
  - star-planet-moon / satellite hierarchy;
  - tidal-force intuition, tidal locking, and later simplified spin/orbit angular-momentum exchange;
  - Lagrange points in the circular restricted three-body problem;
  - Hohmann transfers, burns, gravity assists, and mission-planning tools.

Implementation order for spacecraft / mission planning:

- First convert the visual orbit scaffold into a true N-body model with each body carrying mass, position, velocity, radius, and visual style.
- Then add a spacecraft as a test particle affected by gravity but not significantly affecting planets.
- Start mission planning with impulsive burns: `v -> v + Delta v`, with prograde/retrograde/radial/normal directions.
- Add Hohmann transfer as an overlay and interactive burn exercise.
- Only after that add finite burns and fuel with `(r, v, m)'`, including `m' = -T/(Isp g0)`.
- Gravity assists should come after spacecraft + N-body behavior are stable, preferably with patched-conic explanations first.

Visualization preference for Celestial Mechanics:

- A richer 3D/WebGL approach is worth considering, probably Three.js.
- Keep it physically readable: trails, orbital planes, vectors, burn markers, Lagrange-point labels, and scale/time controls.
- Pair the 3D view with 2D diagnostic plots; do not rely on the pretty scene alone.
- Use symplectic integrators such as leapfrog / velocity Verlet for long-running gravity simulations, and show RK4 mainly as a comparison when discussing energy drift.

## Design Preferences

For this app:

- Prefer concrete animations over abstract-only plots.
- Keep equations visible but secondary to intuition.
- Avoid redundant plots unless they teach something specific.
- Use clear labels and visual vectors for physical quantities.
- Keep controls compact and practical.
- Add new examples inside existing categories unless the teaching goal truly changes.

## Things To Be Careful About

- Do not revert user changes or unrelated work.
- Avoid splitting `physics-lab.js` until the behavior stabilizes.
- If files are eventually split, update `js/README.md` if it exists or is introduced.
- Keep `DYNAMICAL_SYSTEMS_AND_PHYSICS_PLAN.md` up to date when a planned feature becomes implemented.
- Because testing is manual, preserve small, easy-to-check increments.

## Useful Recovery Checklist

After a crash or context loss:

1. Run `git status --short`.
2. Read `DYNAMICAL_SYSTEMS_AND_PHYSICS_PLAN.md`.
3. Read this file.
4. Inspect diffs for the currently changed files.
5. Run `git diff --check -- <changed files>`.
6. Ask the user what they currently see in the browser after refresh.
