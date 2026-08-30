# BrewSmart — 10 Bags Per Location Fix

Physical warehouse rule corrected: **one location can store at most 10 bags/chests**.

## What changed
- Fresh 7,200-location generation now creates every location with `capacity_bags = 10`.
- Invoice AI allocation uses an effective hard maximum of 10 bags per location.
- Multi-location plans split automatically (for example 25 bags => 10 + 10 + 5).
- Manual stock allocation also rejects allocations that would make a location exceed 10 bags.
- Warehouse capacity/report calculations use the 10-bag maximum.
- Existing databases can be corrected with `database/migration_location_capacity_10.sql`.

## Existing database
Run the migration in phpMyAdmin after the previous BrewSmart migrations.
If the final verification query shows a location already holding more than 10 bags from old test data, no new stock will be allocated to it. Transfer/dispatch enough stock to bring it back to 10 or fewer.
