# Dynamical Systems and Physics Roadmap

Status: 2026-06-23

Short source of truth. Old `Dynamics` work is mostly done; active roadmap is **Celestial Mechanics**.

## Current State

- `Numerical Methods`: ODE methods, stages, errors, comparisons.
- `Dynamics`: mechanics, rotation, fields/circuits, biology, chaos, phase flow / Liouville.
- `Celestial Mechanics`: new top-level tab with first Three.js/WebGL scene, object picking, editable visual bodies, binary/circumbinary presets, and diagnostic plot slots.

## Dynamics Snapshot

Do not keep expanding `Dynamics` unless it is a bug fix, clarity polish, or an unusually strong teaching example.

Implemented: oscillators, pendulum, projectile/bounce, coupled oscillators, rotating disk, rolling bodies, spool, Wilberforce, gyroscope, charged particle, rigid dipole, RLC, Lotka-Volterra, FitzHugh-Nagumo, Lorenz, logistic map, double pendulum, Duffing trajectory view, phase flow / Liouville.

Decisions:

- Driven damped pendulum chaos view removed: not visually convincing.
- Duffing bifurcation / Poincare sweep removed: too confusing visually.
- Crank-slider postponed unless it gets real dynamics beyond kinematics.

## Celestial Mechanics

Current implementation:

- Three.js/WebGL viewport with OrbitControls: rotate, zoom, pan.
- Procedural star/corona and planet textures.
- Select body by click or dropdown.
- Edit visual parameters: mass, radius, orbit, phase, inclination.
- Add planet/star and reset preset.
- Binary-star and circumbinary visual presets.
- Still only a visual Kepler-style scaffold, not real N-body physics yet.

Core target:

- Each body should have `m`, `r`, `v`, radius, visual style, and trail.
- Gravity: `F_ij = -G m_i m_j (r_i - r_j) / |r_i - r_j|^3`.
- ODE: `r_i' = v_i`, `v_i' = sum_j F_ij / m_i`.
- Diagnostics: energy, momentum, barycenter, angular momentum `L`, orbital elements, energy drift.
- Main integrator: leapfrog / velocity Verlet. Keep RK4 for comparison.

Roadmap:

1. Replace visual orbits with real N-body state: `m`, `r`, `v`.
2. Add two-body Kepler lab with analytic comparison.
3. Show energy, `L`, orbital elements, and Laplace-Runge-Lenz / eccentricity vector.
4. Compare RK4 vs leapfrog / velocity Verlet.
5. Improve body editor: true `r/v` editing, add/remove/duplicate, barycenter, presets.
6. Add spacecraft as test particle.
7. Add impulsive burns: `v -> v + Delta v`, prograde/retrograde/radial/normal/custom.
8. Add Hohmann transfer overlay and interactive burn exercise.
9. Add finite burns with fuel:
   - state `(r, v, m)`,
   - `r' = v`,
   - `v' = gravity + T u / m`,
   - `m' = -T / (Isp g0)`.
10. Add restricted three-body and Lagrange points.
11. Add Solar System and star-planet-moon presets.
12. Add gravity assists and patched-conic explanations.

Later ideas:

- tides, tidal locking, Moon recession,
- Hill sphere,
- Roche limit,
- resonances,
- low-thrust spirals,
- perturbation precession,
- J2 satellite perturbation,
- Lambert solver / transfer windows.

Visualization rules:

- Keep Three.js scene physically legible: trails, orbital planes, vectors, burn markers, barycenter, scale/time controls.
- Pair 3D with plots; do not rely on pretty visuals alone.
- Keep UI responsive: stacked panels/plots on narrow screens.

## Documentation Hygiene

- Keep this file short.
- Put detailed recovery/collaboration notes in `PROJECT_HANDOFF.md`.
- Old completed/rejected work gets one-line bullets, not roadmap sections.
