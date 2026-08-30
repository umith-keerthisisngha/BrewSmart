# BrewSmart 2026 Upgrade Notes

This package preserves the existing BrewSmart project and adds the first critical architecture upgrade required by the final-year specification.

## Implemented in this upgrade
- Added a migration that expands the warehouse to **20 racks × 6 levels × 60 positions = 7,200 physical locations**.
- Correct location codes are generated in `RR + LEVEL + PP` format (`01A01` ... `20F60`).
- Added location weight/volume capacity, level code, position, blocked/reserved/active and heavy-load fields.
- Added configurable `location_rules` with the mandatory **50–65 kg => A/B/C only** rule.
- AI recommendation candidate filtering now rejects blocked, reserved and inactive locations before scoring.
- AI recommendation filtering now rejects D/E/F for a 50–65 kg bag before ranking.
- Allocation endpoint independently re-validates the same heavy-bag rule, so React cannot bypass it.
- Allocation validates location weight capacity and updates current location weight transactionally.
- Added `ai_recommendations`, `location_blocks` and `audit_logs` foundation tables.
- Added `verify_warehouse.sql` for warehouse-generation verification.

## Database install order
1. Import `database/database.sql`.
2. Import `database/migrations_2026_full_upgrade.sql`.
3. Run `database/verify_warehouse.sql`.
4. Confirm `total_locations = 7200`.

## Critical safety test
Set a tea inventory record's `bag_weight` to `58.00`, request AI recommendations, and verify only A/B/C level locations are returned. A direct allocation request to D/E/F must return a validation error.

## Verification status
- PHP allocation/API file: `php -l` passed after the upgrade.
- Frontend production build was attempted in the isolated build environment, but dependency installation/build did not complete within the available execution timeout. Do not treat the React production build as verified yet.
- MySQL migration was authored for MySQL 8+/modern MariaDB-compatible environments but could not be executed here because no MySQL server is available in the build environment.

This is an upgrade of the supplied codebase, not a claim that every Phase 1–18 feature is finished.

## 2026-08-29 — User-by-user Access Manager

Run `database/migration_user_function_access.sql` after the main database scripts. It adds a permission catalog and per-user overrides. Admin can manage all non-admin user access. Managers can manage Warehouse Staff/Broker access. Transaction forms no longer create Mark/Grade/Packing records inline; those are created only from Master pages.

## 2026-08-29 — Invoice / AI Auto-Allocation Integration
- Saved warehouse invoices now have a dedicated live **Invoices** inquiry tab.
- Added live **Invoice / Arrival Register**, **Arrival Report**, and **Daily Arrivals Summary For All Brokers** report data from `warehouse_invoices`.
- Invoice Add now calculates **Total Net Weight = Chests × Net Weight Each** immediately in React and recalculates it again in PHP before saving.
- Invoice Add now embeds the **Rule Engine + Weighted Model 2026.2** and automatically previews a safe location plan while details are entered.
- With **Automatically allocate** enabled (default), Save recomputes the recommendation on the backend and transactionally updates invoice allocations and warehouse location occupancy/weight.
- Multi-location invoice plans are supported when one location cannot safely hold the complete invoice.
- The critical 50–65 kg lower-level safety rule is applied before scoring; D/E/F are excluded when the rule applies.
- Added `invoice_location_allocations` and `invoice_ai_recommendations` for allocation history and model traceability.

### Existing database upgrade
If `database.sql`, `migrations_2026_full_upgrade.sql`, and the access-control migration were already imported before this package, import only:

`database/migration_invoice_ai_flow.sql`

Then restart the PHP/React applications.
