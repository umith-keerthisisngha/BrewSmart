# BrewSmart Receiving / Issuing Pages Upgrade (2026.3)

This upgrade rebuilds the legacy-reference workflows as BrewSmart pages while keeping BrewSmart branding and access control.

## Existing database upgrade

Do **not** re-import `database.sql` over an existing database. In phpMyAdmin select `brewsMart_db` and import:

`database/migration_receiving_issuing_workflow.sql`

This adds:
- optional invoice buyer field
- richer GRN/turn/driver/store data
- `grn_items` invoice-to-GRN relation
- richer GIN/loading/collection data
- `gin_items` location-level issue rows
- `invoice_stock_movements` for invoice stock-out audit

## New working flows

### Invoice Chest Receiving / GRN
1. Save invoices first in Invoice Entry.
2. Open `Bin Operation > GRN > Invoice Chest Receiving / GRN`.
3. Select date/broker/mark and Load.
4. Select saved invoices and received chest quantities.
5. Save GRN. The GRN links to the actual invoices.
6. Existing GRNs can be loaded and edited by GRN number.

### Unloading / GRN Print
- Load by date/search.
- Select all or selected rows.
- Print Arrival Slip / GRN views.
- Download PDF from live GRN data.

### Invoice Chest Issuing / GIN
1. Enter collection, vehicle and buyer details.
2. Search a saved invoice with remaining allocated stock.
3. Select invoice and issue quantity.
4. Add one or more invoices to the issuing grid.
5. Save GIN.
6. Backend transaction reduces `invoice_location_allocations`, `warehouse_locations.occupied_bags`, and `warehouse_locations.current_weight`.
7. A location becomes EMPTY/PARTIAL/FULL according to the remaining 10-bag capacity.
8. The stock-out is logged in `invoice_stock_movements`.

### Loading / Picking / GIN Print
- Load saved GINs by date/search.
- Print Picking List, GIN or Gate Pass.
- Download the selected document as PDF.

## Validation performed in this package
- PHP syntax lint: passed for backend files.
- JS/JSX parser check: passed for all frontend source files.
- Full Vite build could not be completed in the isolated build environment because the npm dependency installation timed out. Run `npm install` then `npm run build` on the XAMPP development machine.
- MySQL integration requires importing the migration into the user's live MySQL/MariaDB database; no live MySQL server was available in the build environment.
