# BrewSmart Invoice Database Hotfix

Fixes:
`SQLSTATE[42S22]: Column not found: 1054 Unknown column 'total_net_weight' in 'field list'`

## Existing database
1. Open phpMyAdmin.
2. Select `brewsMart_db`.
3. Import `database/hotfix_invoice_columns_2026.sql`.
4. Confirm the verification query returns these columns:
   - `total_net_weight`
   - `allocation_score`
   - `allocation_model`
   - `allocation_explanation`
   - `allocation_type`
5. Retry Invoice Entry -> Save Invoice.

The hotfix also creates the invoice allocation / AI recommendation tables if missing and backfills old invoice total net weights.

## Fresh install
`database/database.sql` has also been corrected so new installations already include the required invoice columns.

## Total net weight
Backend calculation remains authoritative:
`total_net_weight = chests * net_weight_each`
