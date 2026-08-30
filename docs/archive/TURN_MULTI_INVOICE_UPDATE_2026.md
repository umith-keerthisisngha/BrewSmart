# BrewSmart Turn Multi-Invoice Entry Update (2026)

## New workflow
1. Enter Broker / Turn / vehicle / driver details once.
2. Enter the first invoice.
3. AI location preview runs for the current invoice.
4. Click **Add Invoice to Turn**. Nothing is saved to MySQL yet.
5. The invoice appears in the Invoice Entry Details grid.
6. Enter and add more invoices for the same Turn.
7. Edit/delete grid rows before final save if required.
8. Click **Save Turn** only after all invoices are in the grid.
9. Backend saves every invoice in one MySQL transaction and recalculates safe AI allocation sequentially.
10. If any invoice fails validation/allocation, the whole Turn save rolls back.

## Important behavior
- Turn header fields are locked after the first invoice is added to the grid.
- Invoice details are cleared after each Add Invoice action while Turn information remains.
- Total bags and total net weight are summarized for the Turn.
- `create-turn.php` is the new endpoint for transactional multi-invoice save.
- No database schema migration is required for this update.

## Validation performed
- PHP syntax check: passed for backend PHP files.
- JS/JSX parser check: 28 files parsed, 0 syntax errors.
- Vite production build could not be executed because the supplied `node_modules` does not contain the Vite executable.
- Live MySQL/XAMPP end-to-end testing must be performed in the deployment environment.
