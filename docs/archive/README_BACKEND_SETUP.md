# BrewSmart — Backend Setup (XAMPP)

## 1. Copy the project
Copy the `BrewSmart` folder to:

`C:\xampp\htdocs\BrewSmart`

## 2. Start XAMPP
Start **Apache** and **MySQL**.

## 3. Create the database
Open phpMyAdmin and import:

`database/database.sql`

The script creates the `brewsMart_db` database, tables, warehouse racks/levels/locations, permissions and demo data.

## 4. Default login
- Username: `admin`
- Password: `admin123`

## 5. Start the frontend
From `BrewSmart/frontend`:

```bash
npm install
npm run dev
```

Open the Vite URL, normally `http://localhost:5173`.

The current frontend already calls the XAMPP backend at:

`http://localhost/BrewSmart/backend/api/`

## 6. Backend health check
Open:

`http://localhost/BrewSmart/backend/api/health.php`

Expected response contains:

`"success":true` and `"database":"connected"`

## Main API endpoints
- `POST auth/login.php`
- `POST auth/logout.php`
- `GET auth/session-check.php`
- `GET inventory/get.php`
- `POST inventory/add.php`
- `POST inventory/update.php`
- `POST inventory/delete.php`
- `GET warehouse/racks.php`
- `GET warehouse/levels.php`
- `GET warehouse/locations.php`
- `GET location/search.php?q=RACK-01`
- `POST allocation/allocate.php`
- `GET allocation/recommendations.php?bags=10`
- `GET movement/get.php`
- `POST movement/add.php`
- `GET dispatch/get.php`
- `POST dispatch/create.php`
- `GET reports/inventory.php`
- `GET reports/warehouse.php`
- `GET reports/movements.php`
- `GET permissions/get.php`
- `GET permissions/check.php?page_key=warehousing`
- `POST permissions/update.php`
- `POST grn/create.php`
- `POST gin/create.php`
- `POST invoices/create.php`

## Notes
The backend uses PDO prepared statements, password hashing, PHP sessions, CORS credentials, role checks and database transactions for stock allocation/dispatch operations.
