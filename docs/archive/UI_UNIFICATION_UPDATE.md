# BrewSmart Unified Invoice Entry UI Update

## Changes
- Rebuilt Invoice Entry / Add New to follow the supplied warehouse reference workflow while keeping BrewSmart branding.
- Removed Buyer from Invoice Add New. Invoice receiving is Broker-based only on this page.
- Broker remains database-driven from Broker Master.
- Store defaults to `BrewSmart Warehouse` and is read-only.
- Mark selection automatically fills Selling Mark.
- Removed duplicate/unused weight inputs from the Add New UI; only Net Weight Each and auto-calculated Total Net Weight are shown.
- Total Net Weight remains calculated as `No. of Chests × Net Weight Each` and is recalculated by the backend on save.
- AI location allocation remains active. The page now presents it through a compact `Location Allocate` workflow matching the reference screen.
- Added an Invoice Entry Details live preview grid and consistent Reset / Save Details actions.
- Unified shared warehousing form, table, button, panel and section styling so GRN, GIN, reports, inquiry and location pages visually follow the same operations-system language.

## Validation completed in build environment
- 28 frontend JS/JSX files parsed with TypeScript JSX parser: 0 syntax diagnostics.
- 78 PHP files passed `php -l` syntax validation.
- Full Vite production build was not completed because npm dependency installation timed out in the isolated environment.
