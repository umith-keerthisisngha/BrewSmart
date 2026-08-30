# BrewSmart Dashboard Cleanup 2026

- Removed the separate Warehouse Dashboard tab from the Warehousing navigation.
- `/warehousing/dashboard` now redirects to the normal Warehousing HOME page.
- Removed Warehouse Dashboard from the Warehousing home quick actions.
- Added a cleanup migration to hide `warehousing.dashboard` in Access Manager.
- Reworked Brokering HOME into an operational workspace with direct master actions, next auction, counts, recent brokers, recent buyers and upcoming auctions.
- Brokering dashboard API now degrades safely if one optional dashboard table is not available instead of failing the whole page.

## Database update
Run `database/migration_brokering_home_cleanup_2026.sql` on an existing BrewSmart database. It creates the Buyer/Auction tables only if missing and hides the removed Warehouse Dashboard permission without deleting operational data.
