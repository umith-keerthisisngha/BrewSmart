# BrewSmart Verification Suite

Run `bash tests/run_all.sh` from Git Bash/WSL/Linux. The suite checks PHP syntax, the critical 10-bag capacity rule, the 58 kg A/B/C safety rule, and the Python explainable optimizer.

For database integration, import `database/schema.sql` and `database/seed_demo_data.sql`, then run `database/verify_warehouse.sql` in phpMyAdmin. It must report 7,200 locations and no location over 10 bags.

Manual acceptance tests are documented in `docs/TESTING.md` and cover Turn multi-invoice save, GRN auto-load, GIN reservation, Gate Pass stock release, Issued Inquiry, permissions, reports and PDF export.
