# BrewSmart Dispatch / Issued Inquiry / GRN Turn Auto-Load Upgrade

## New workflow

### Incoming / GRN
1. Add New Invoice / Arrival requires an **Arrival / Turn No**.
2. The arrival also stores lorry number, driver name and NIC/DV number.
3. Open **GRN -> Add New GRN**.
4. Enter the same Turn Number.
5. BrewSmart automatically loads all unreceived invoice/arrival lines for that turn and fills date, store, lorry, driver, broker/buyer and mark where available.
6. The loaded lines are selected for GRN creation.

### GIN / Gate Pass / Dispatch
1. Create a GIN from available invoice stock.
2. Saving the GIN creates a **PENDING** dispatch reservation; it does not remove physical warehouse stock yet.
3. Open **GIN -> Picking List / Gate Pass**.
4. Select the GIN and click **Issue Gate Pass / Dispatch & Print**.
5. BrewSmart performs a database transaction that:
   - reduces `invoice_location_allocations`,
   - reduces `warehouse_locations.occupied_bags`,
   - reduces location weight,
   - sets an empty location to `EMPTY`,
   - records an OUT stock movement,
   - marks the GIN as `DISPATCHED`,
   - generates a Gate Pass number.
6. Reprinting the Gate Pass never deducts stock a second time.

### Inquiry -> Issued
`Inquiry -> Issued` now shows dispatched stock from the OUT movement history, including GIN, Gate Pass, invoice, buyer, source location, quantity, weight and vehicle.

## Existing database upgrade
Import:

`database/migration_dispatch_gatepass_turn_autoload.sql`

Run it after the previous BrewSmart migrations.

Important: legacy GIN rows from the older version are marked DISPATCHED by this migration because that older version already deducted warehouse stock at GIN save time. This prevents double deduction.
