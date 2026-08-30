# BrewSmart Invoice / Inquiry / AI Allocation Fix

## Fixed in this package
1. **Saved invoices now appear in Inquiry**
   - Inquiry opens on a live `Invoices` tab.
   - Search works by invoice, mark, grade, broker, store and allocated location.

2. **Saved invoices now appear in Reports**
   - `Invoice / Arrival Register` is live.
   - `Arrival Report (With Pallets)` is live from saved invoice data.
   - `Daily Arrivals Summary For All Brokers` is live.

3. **Net weight is automatic**
   - Frontend: `Total Net Weight = Chests × Net Weight Each` updates instantly.
   - Backend recalculates the same value before saving, so the browser value is never trusted.

4. **AI allocation is inside Invoice Add**
   - The page automatically runs `Rule Engine + Weighted Model 2026.2` after Chests and Net Weight Each are entered.
   - The model shows allowed levels, safety rules, location plan, score and reason.
   - Automatic allocation is ON by default.
   - Saving recomputes the plan on the PHP backend and updates warehouse occupancy/weight transactionally.

5. **Multi-location allocation**
   - If one safe location cannot hold the complete invoice, the model can split the invoice across multiple safe locations.

6. **Safety**
   - The configurable database `location_rules` are applied before ranking.
   - 50–65 kg packages are restricted to A/B/C when the mandatory heavy-bag rule applies.

## Database upgrade
### Existing BrewSmart database from the previous package
Import only:

`database/migration_invoice_ai_flow.sql`

### Fresh setup
Import in this order:
1. `database/database.sql`
2. `database/migrations_2026_full_upgrade.sql`
3. `database/verify_warehouse.sql` (verification)

## New API endpoints
- `POST /backend/api/invoices/recommend-location.php`
- `GET /backend/api/reports/invoices.php`
- `GET /backend/api/reports/daily-arrivals.php`

## Verification performed in the build environment
- All 68 PHP source files passed `php -l` syntax validation.
- Full React/Vite production build could not be completed because npm package downloads are unavailable in the isolated build environment (`npm ci --offline` reports an uncached package). Run `npm install` and `npm run build` on the XAMPP development machine.
- MySQL runtime migration could not be executed because no MySQL/MariaDB server is installed in the build environment.
