# BrewSmart — What's Actually Working (as of this build)

This file is an honest map of the app after a full backend + frontend pass.
Setup instructions are still in `README_SETUP.md`.

## Backend — fully working, all 27+2 endpoints tested against live MySQL

Two critical bugs were fixed that had every single endpoint returning a
fatal error:
1. All 27 endpoint files pointed to `_endpoint.php` with a wrong relative
   path (`../../_endpoint.php` instead of `../_endpoint.php`).
2. `inventory_list` (used by `inventory/get.php`) called `$pdo->prepare()`
   on an undefined variable instead of `db()->prepare()`.

Two small additions were made to round out the warehouse grid feature:
- `POST warehouse/set-status.php` — block/unblock a warehouse location
  (refuses to block a location that still has stock allocated).
- `GET meta.php` — returns tea types, grades and suppliers in one call
  (the dispatcher already had a `meta` action but no route file existed).

Every endpoint listed in `README_SETUP.md` plus these two was exercised
end-to-end with curl against a real database and returns correct data.

## Frontend — routed pages, by status

**Fully wired to the live backend:**
- Login / Dashboard / session handling / logout
- Warehousing home, Brokering home (landing pages)
- **Master → Access Control** (`/master`) — role/page permission toggles
- **Warehousing → Master** — Rack, Grade, Tea Type, Supplier cards show
  real data (marked with ●). Store/Broker/Buyer/Owner/Category/Packing
  Type/User Account/User Group have no backend table yet — clicking them
  says so honestly instead of faking data.
- **Warehousing → Reports** — Rack Wise Stock, Mark Wise Stock, Daily
  Unloaded Turns (marked ●) pull real data. The other ~26 report names
  from the legacy menu are listed but say plainly they aren't wired to
  an endpoint yet rather than showing fake rows.
- **Warehousing → Inquiry** — Stock tab and Location tab (marked ●) run
  real searches against `inventory/get.php` and `location/search.php`.
  The other tabs (Bin, Received, Issued, Pvt Sale, Sale, Delete,
  Withdrawn, T15) have no backing table and say so.
- **Bin Operation → Invoice Entry → Add New** — saves to
  `invoices/create.php`.
- **Bin Operation → GRN → Add/Edit GRN** — saves to `grn/create.php`.
- **Bin Operation → GIN → Add GIN** — saves to `gin/create.php`.
- **Bin Operation → GRN → Chest Location Details** — rebuilt to show
  real rack/location occupancy from the database (previously random
  fake colors), with working Block/Un-Block.
- **Warehousing → AI Allocation** (new) — a rule-based multi-factor
  location recommendation engine. Pick a tea lot and a quantity, and it
  scores every warehouse location with enough free space on three
  weighted factors:
  - **Fit (40%)** — how little space is wasted for this quantity
  - **Consolidation (35%)** — rewards placing stock next to the same
    tea type/grade already in that location, stays neutral for empty
    locations, and penalizes mixing different tea in one slot
  - **Rack balance (25%)** — prefers racks that are, overall, less full,
    to avoid piling everything into one rack
  Each recommendation shows its score breakdown and a plain-English
  reason, and you can allocate directly from the card. This is a
  transparent scoring algorithm, not a trained ML model — it's honest
  about that in the UI itself.

**Still placeholder (no backend to wire to yet):**
- Invoice Entry Edit/Download, GRN Print, Turn Number Allocation, GIN
  Picking List — these need list/search endpoints that don't exist yet
  (only `create` actions exist for GRN/GIN/invoices, no `list`/`get`).
- The entire **Brokering** module beyond the landing page (Auction Sale,
  Private Sale, Payment & Settlement, DR/CR, SMS, and its ~20-item
  Master submenu) — there are no database tables for any of this. It's
  a real, separate feature area that would need its own schema and API
  before it could be anything but a themed page.

## Dead code removed

These files existed but were never imported by any route or component
(confirmed by grepping actual import paths, not just filenames), so they
were deleted rather than left as confusing empty stubs:
`pages/{AIOptimization,AddInventory,Dispatch,EditInventory,Inventory,
LocationInquiry,RackManagement,Reports,Settings,StockMovement,Users}.jsx`,
`components/{DataTable,Modal,Navbar,Sidebar,StatCard,WarehouseMap}.jsx`,
and all nine files under `services/` (`aiService.js`, `api.js`, etc. —
all were single-line comments).

## Suggested next steps if you want to keep building

1. Add `list`/`get` endpoints for GRN, GIN and warehouse invoices (the
   `create` actions exist, listing doesn't) — that unlocks Invoice Entry
   Edit, GRN Print, and GIN Picking List for free since the UI shells
   are already built.
2. Decide if Brokering is in scope — if so it needs its own schema
   (auctions, sales, brokers, buyers, settlements) before any of that
   module can be real.
3. Add tables + endpoints for Store, Broker, Buyer, Owner, Category,
   Packing Type if you want the remaining Master Data cards live.

## Invoice integration upgrade
- Invoice Add: total net weight auto-calculation.
- Invoice Add: embedded AI location model preview.
- Invoice Save: backend AI re-check + automatic transactional location allocation.
- Invoice Save: multi-location allocation plan when needed.
- Invoice Inquiry: saved invoices are now directly queryable.
- Location Inquiry: can search by invoice number after the new migration.
- Reports: Invoice / Arrival Register, Arrival Report, and Daily Arrivals Summary use saved invoice data.
