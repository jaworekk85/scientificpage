# JavaScript structure

- `core/` - shared constants, DOM helpers, math utilities, and general UI wiring.
- `plotter/` - the main function plotter: curves, derivatives, integrals, and plot interactions.
- `methods/` - numerical-method teaching panels, including ODE solvers and step visualizations.
- `app.js` - small entrypoint that starts the page after all browser globals are loaded.

Keep files loaded in dependency order in `index.html`. These scripts currently share browser globals instead of ES modules, so moving a file may require updating only its `<script src="...">` path, not imports.
