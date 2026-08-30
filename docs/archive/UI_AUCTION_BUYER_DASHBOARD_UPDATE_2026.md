# BrewSmart UI + Auction + Buyer + Warehouse Dashboard Update (2026)

## Added
- Smaller BrewSmart logo across login, main dashboard, brokering, warehouse, and master pages.
- Main dashboard greeting now changes automatically by browser time: Morning / Afternoon / Evening / Night.
- Tea Auction Calendar under Brokering -> Master.
- Next Tea Auction card on Brokering and Warehousing home pages reads the next scheduled date from MySQL.
- Buyer Master under Brokering -> Master.
- Buyer dropdown in GIN / Dispatch reads active buyers from Buyer Master.
- New Warehouse Dashboard with 30-second live refresh, stock bags, stock weight, arrivals, deliveries, utilization, location status, pending GIN, rack utilization and recent movements.
- Warehouse Dashboard permission added to Access Manager.

## Removed / hidden
- Warehouse MASTER navigation.
- Unused Access Manager catalog entries for Warehouse Master, separate AI Allocation page, Invoice Download, Chest Location Details and Turn Number Allocation.
- Old Brokering home information cards about user access; replaced with operational dashboard information.

## Existing database update
Import:
`database/migration_auction_buyers_warehouse_dashboard_2026.sql`

Do not delete the existing BrewSmart database.
