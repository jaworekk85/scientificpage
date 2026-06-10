# JavaScript structure

- `core/` - shared constants, DOM helpers, math utilities, and general UI wiring.
- `plotter/` - the main function plotter: curves, derivatives, integrals, and plot interactions.
- `methods/` - numerical-method teaching panels, including first-order and second-order ODE solvers with step visualizations.
- `physics/` - concrete physics examples built on the numerical methods, with animations and linked plots.
- `app.js` - small entrypoint that starts the page after all browser globals are loaded.

Keep files loaded in dependency order in `index.html`. These scripts currently share browser globals instead of ES modules, so moving a file may require updating only its `<script src="...">` path, not imports.
