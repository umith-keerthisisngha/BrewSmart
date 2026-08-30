# BrewSmart — Backend Setup (XAMPP)

## 1. Copy the project
Copy the `BrewSmart` folder to:

`C:\xampp\htdocs\BrewSmart`

## 2. Start XAMPP
Start **Apache** and **MySQL**.

## 3. Create the database
Open phpMyAdmin and import:

`database/database.sql`

Then import:

`database/migrations_2026_full_upgrade.sql`

The upgrade creates the 7,200 physical locations, safety rules, AI support tables, and the user-by-user function access system. If your database was already upgraded before this version, run `database/migration_user_function_access.sql` if needed, then run `database/migration_invoice_ai_flow.sql` for invoice inquiry/report visibility, total-net-weight calculation, and AI auto-allocation tables.

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
- `GET permissions/current.php`
- `GET permissions/check.php?page_key=warehousing.invoice_add`
- `GET permissions/users.php`
- `GET permissions/user.php?user_id=2`
- `POST permissions/update-user.php`
- `POST permissions/reset-user.php`
- `GET users/list.php`
- `POST users/create.php`
- `POST grn/create.php`
- `POST gin/create.php`
- `POST invoices/create.php`
- `POST invoices/recommend-location.php`
- `GET invoices/list.php`
- `GET reports/invoices.php`
- `GET reports/daily-arrivals.php`

## Notes
The backend uses PDO prepared statements, password hashing, PHP sessions, CORS credentials, role checks and database transactions for stock allocation/dispatch operations.


## User-by-user access
- **Admin** has full access and can assign permissions to users.
- **Manager** can use **Brokering → Master → Access Manager** to assign functions to Warehouse Staff and Broker users.
- Transaction pages show only saved master values. **Mark, Grade, and Packing Type can be created only from Master pages**, not from Invoice Add/Edit.
- Menus and direct routes are permission-protected; the backend also checks permission keys for protected actions.
