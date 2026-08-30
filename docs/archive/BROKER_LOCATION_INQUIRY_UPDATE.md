# BrewSmart Broker + Location Inquiry Update

Import `database/migration_broker_location_inquiry_2026.sql` into the existing `brewsMart_db`.

Changes:
- Broker Master under Brokering -> Master.
- Invoice Add New Broker is database-driven selector.
- Mark selection auto-fills Selling Mark from Mark Master name.
- Single Total Net Weight field (auto calculated); duplicate Total Gross field removed from Add New UI.
- Default Store/Warehouse shown as `BrewSmart Warehouse`.
- Inquiry menu now contains `Stock / Invoice Inquiry` and `Location Inquiry`.
- Location Inquiry shows 6 levels x 60 positions per rack, live DB occupancy/status, search, block/unblock/unallocate (authorized users), and auto refresh.
