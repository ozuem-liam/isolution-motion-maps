# Contributing

Use Node.js 20 or newer. Run `npm install`, then run `npm run typecheck`, `npm test` and `npm run build` before opening a pull request.

Keep the core renderer-neutral and free of browser, map-provider and database assumptions. Add provider integrations through explicit export subpaths. New session fields require validation, fixtures, tests and a documented migration strategy.

Do not commit API keys, production coordinates or identifiable location history.
