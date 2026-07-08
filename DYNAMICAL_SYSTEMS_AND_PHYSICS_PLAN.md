# Dynamical Systems and Physics Roadmap

Status: 2026-07-06

Short source of truth. `Dynamics` is mostly complete; active work is **Celestial Mechanics**.

## Current State

- `Numerical Methods`: ODE methods, stages, errors, comparisons.
- `Dynamics`: mature examples for mechanics, rotation, fields/circuits, biology, chaos, phase flow / Liouville. Expand only for bug fixes, clarity polish, or unusually strong teaching examples.
- `Celestial Mechanics`: one capability-driven sandbox. Presets are starting recipes, not closed modes; after edits the system becomes custom and controls are inferred from current bodies/capabilities.

## Celestial Mechanics Snapshot

Implemented:

- Three.js viewport with OrbitControls, body picking, selected-body dropdown, barycenter marker, selection ring, motion trails, and view frames: inertial, barycenter, selected body, rotating pair.
- Editable bodies with mass, radius, spin, initial position, and initial velocity. Two-body orbital elements are available only when meaningful.
- True N-body trajectory precompute into a sample buffer before playback. `playProgress` is the animation clock; the slider mirrors/sets it. For genuinely long runs, move solver work to a Web Worker rather than mixing solver, Plotly, and animation ticks.
- Integrators: velocity Verlet/leapfrog, RK4, explicit midpoint RK2, symplectic Euler / Euler-Cromer, Euler. Primitive methods are for teaching failure modes.
- Diagnostics:
  - energy plot: `K`, `U`, `E`, selected/rest share, `K` per body, `U` per pair, `E` share per body. `K` and total `E` use the currently selected view frame; `U` is gravitational and frame-independent.
  - angular momentum plot: inertial `Lx`, `Ly`, `Lz`, `|L|`, total plus per-body traces.
  - collision/Lagrange diagnostic plot: closest distance/contact distance, collision events, and distance-to-assigned-L traces for L-point test bodies.
- Collision tools: `detect only` and `merge / accrete`. Merge conserves mass and linear momentum in the trajectory, hides the accreted slot, and combines radius by volume.
- Optional two-body tools: Runge-Lenz/eccentricity vector, Kepler I/II overlays, Kepler III measured-vs-theoretical comparison.
- Lagrange tools: optional `L1`-`L5` overlay for the current reference pair; currently the two most massive bodies. Shows CR3BP assumptions/stability hints, pair eccentricity, and can toggle tiny test bodies at L-points.
- Co-orbital presets: L4/L5 tadpole loops, true horseshoe-style co-orbital starter, and wide co-orbital loop starter. Rotating-pair view is the intended view for reading these.
- Tidal-force first pass: optional overlay on the selected body showing the summed differential gravitational acceleration from all other bodies, plus a compact status panel and plot trace with dominant source, `near-far tide delta a / surface g`, and current/trajectory-peak tidal strength. Includes close-moon, eccentric-pulse, and spin-orbit exchange starter presets. Tidal arrows show real local `delta a` directions and are scaled against the strongest arrow over the current trajectory, not independently per animation frame.

## Design Rules

- Use state vectors as canonical data for `N > 2`; orbital elements are a two-body convenience.
- Gravity: `F_ij = -G m_i m_j (r_i - r_j) / |r_i - r_j|^3`; ODE: `r_i' = v_i`, `v_i' = sum_j F_ij / m_i`.
- Capability checks should enable tools dynamically:
  - `N = 2`: orbital elements, Runge-Lenz, Kepler tools;
  - `N > 2`: state vectors, trails, N-body diagnostics;
  - radii present: collision monitor/handling;
  - reference pair present: Lagrange/co-orbital tools;
  - spacecraft present: burns, fuel, transfers, encounters, assists;
  - tidal model present: tidal gradients, spin-orbit exchange, locking diagnostics.
- Lagrange points are exact only in the circular restricted three-body interpretation. For eccentric/perturbed systems, label them as instantaneous approximations.
- Plot titles must state frame assumptions. In rotating or selected-body frames, `K`/`E` are diagnostic frame-relative quantities, not conserved inertial energy.

## Near Roadmap

1. **Tidal forces module**
   - Theory/implementation notes live in `TIDAL_FORCES_THEORY_NOTES.md`.
   - Keep validating the visual tidal overlay: vectors are local `delta a`; the scalar panel value is the near-side minus far-side `delta a`.
   - Calibrate the first real planar spin-orbit exchange model. It uses moment of inertia, user-set `k2`, a constant-time-lag-style torque, and equal/opposite angular-momentum exchange between selected-body bulk spin and the relative orbit.
   - Polish the teaching controls for `k2`, moment-of-inertia factor, and dissipation/lag; later expose the lag as a friendly `Q`/dissipation concept in the UI.
   - Demonstrate tidal locking and orbital recession/decay by conserving total angular momentum between spin and orbit, while mechanical energy loss is tracked as heat.
   - Roche-limit teaching overlay is now implemented with fluid/rigid Roche radius around the dominant tidal source, `distance / Roche limit` plot traces, warning text, and an optional accumulated-damage breakup model. Breakup disables the compact body and renders one selectable debris field. Debris can be tracer-only, a collective gravitating mass, or a limited fragment N-body cloud when `N_frag <= n0`; it is still not a full material/hydrodynamics solver.

2. **Spacecraft / rocket module**
   - Add spacecraft/test-particle role: affected by gravity, optionally negligible back-reaction.
   - Parameters: dry mass, fuel mass, thrust, simplified fuel efficiency or `Isp`, delta-v budget.
   - Control modes:
     - manual/game: prograde, retrograde, radial in/out, normal/antinormal, toward target;
     - planner: burns by time/event, direction, duration, thrust level or delta-v.
   - Later: Hohmann transfer exercise, finite burns, low-thrust spirals, encounter targeting, gravity assists.

3. **Lagrange polish**
   - Explicit reference-pair selector for `N > 2`.
   - Optional Jacobi/zero-velocity contours for circular restricted three-body presets.
   - Better explanatory overlay for co-orbital coordinates, especially horseshoe vs wide libration.

4. **Preset/body workflow polish**
   - Clearer custom-system state and body list.
   - Better collision history labels.
   - Star-planet-moon and Solar-System-like presets only when their specific diagnostics exist.

## Later Ideas

- Hill sphere, resonances, perturbation precession, J2 satellite perturbation, Lambert solver / transfer windows.

## Documentation Hygiene

- Keep this file short.
- Put detailed recovery/collaboration notes in `PROJECT_HANDOFF.md`.
- Completed/rejected old work gets one-line bullets, not new roadmap sections.
