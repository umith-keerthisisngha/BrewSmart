# BrewSmart — AI-Based Smart Tea Warehouse Management & Optimization System

BrewSmart is a full-stack tea warehouse operations system built for broker-led receiving, GRN, location allocation, stock inquiry, GIN/Gate Pass dispatch, reporting and user-level access control.

## Technology

- Frontend: React + Vite + Axios
- Backend: PHP 8+ REST-style endpoints + PDO
- Database: MySQL/MariaDB
- AI service: Python + Flask + explainable multi-criteria optimization; optional scikit-learn training when sufficient reviewed history exists

## Core warehouse rules

- 20 racks × 6 levels (A–F) × 60 positions = **7,200 locations**
- Location code format: `01A01` … `20F60`
- Maximum **10 bags per location**
- Mandatory safety rule: bags from **50–65 kg may only use levels A/B/C**
- Tea Grade Master defines packing density and minimum/maximum permitted bag weight
- Critical stock operations use database transactions

## Main operational flow

`Turn / Arrival → Multiple Invoices → Backend validation → Safety rules → Python explainable ranking (PHP fallback) → Location allocation → GRN → Live warehouse stock → GIN reservation → Gate Pass stock-out → Issued Inquiry → Reports`

## AI / optimization

BrewSmart does not fabricate ML accuracy when historical data is insufficient. Mandatory constraints run first in PHP. Only safe locations are sent to the Python service, which ranks them using an explainable weighted multi-criteria model. If the AI service is unavailable, a deterministic PHP fallback keeps warehouse operations available. See `docs/AI_MODEL.md`.

## Fresh installation

1. Start Apache and MySQL in XAMPP.
2. Import `database/schema.sql` into phpMyAdmin. This is the **single authoritative fresh schema**.
3. For a lecturer/demo dataset, import `database/seed_demo_data.sql`.
4. Run `database/verify_warehouse.sql`; location count must be 7,200 and over-capacity count must be 0.
5. Copy `frontend/.env.example` to `frontend/.env` and adjust `VITE_API_BASE_URL` if required.
6. In `frontend`: `npm install` then `npm run dev`.
7. For AI ranking: in `ai`, install `requirements.txt` and run `python api/app.py` (port 5001). The application still works using PHP fallback if this service is stopped.

### Default demo admin

- Username: `admin`
- Password: `admin123`

Change the password before any real deployment.

## Reports

The Reports menu contains only working database-backed reports: Daily Stock Summary, Invoice/Arrival Register, Daily Arrivals, Rack Wise Stock, Grade Wise Live Stock, Broker Wise Live Stock, Daily Issued Summary, Turn Number Summary, Location Utilization and Daily Stock Movements. PDF export uses the current report data.

## Access control

Admin has full access. Managers can manage user-specific functional access. Backend endpoints enforce permissions; hiding a menu item is not treated as authorization.

## Verification

- `bash tests/run_all.sh` — PHP syntax + critical warehouse rule tests + Python optimizer tests
- `database/verify_warehouse.sql` — database integrity checks
- `docs/TESTING.md` — manual acceptance test matrix

## Project structure

```text
frontend/               React UI
backend/api/            HTTP endpoints
backend/services/       business services / AI / reports
backend/repositories/   persistence access helpers
backend/models/         domain models
ai/                     optimization API + optional ML training
 database/schema.sql    authoritative fresh DB
 database/seed_demo_data.sql
 tests/                  automated verification
docs/                    architecture, AI and test evidence
```

Old incremental migrations and update notes are retained only in `database/legacy_migrations/` and `docs/archive/` for traceability. New installations should not run them individually.
