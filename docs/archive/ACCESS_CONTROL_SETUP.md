# BrewSmart — User-by-User Access Control Setup

## What changed

1. **Mark, Grade and Packing Type cannot be created from Invoice Add/Edit.**
   - Invoice screens contain dropdowns only.
   - New records are created from **Brokering → Master**.

2. **Access Manager is in Brokering → Master → Access Manager.**
   - Admin can manage user access.
   - Manager can manage Warehouse Staff and Broker access.
   - Admin permissions are always full access.
   - Managers retain Access Manager authority.

3. **Function-level permissions are per user.**
   - Menus hide functions the logged-in user does not have.
   - Direct URLs are protected.
   - Key backend actions also enforce the same permission key.

## Database

### Fresh database
Import in this order:

1. `database/database.sql`
2. `database/migrations_2026_full_upgrade.sql`

The full upgrade now contains the access-control migration.

### Database already upgraded before this change
Run only:

`database/migration_user_function_access.sql`

This creates:

- `permission_catalog`
- `user_permissions`
- fine-grained role default records in `role_permissions`

## How to use

1. Login as Admin or Manager.
2. Open **BROKERING**.
3. Open **MASTER → User Account** to create users if required.
4. Open **MASTER → Access Manager**.
5. Select a user.
6. Turn individual functions ON/OFF.
7. Login with that user account.
8. BrewSmart shows only functions that user is allowed to access.

## Important security behavior

- Frontend visibility is not the only check.
- `ProtectedRoute` checks permission keys before opening protected pages.
- Backend master/invoice/GRN/GIN/report actions also validate permissions.
- A user cannot gain access by manually typing a protected route URL.
