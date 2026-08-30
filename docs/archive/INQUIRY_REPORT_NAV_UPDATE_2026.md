# BrewSmart Inquiry / Report / Navigation Update

- Removed AI Allocation from the top navigation. AI allocation remains embedded in Invoice Entry where it is used.
- Removed Invoice Download, Chest Location Details, and Turn Number Allocation from the Bin Operation menu.
- Removed AI score from Invoice Inquiry.
- Added Entry User and Updated User to Invoice Inquiry. Updated User is resolved from the existing invoice update audit log, so no new database column is required.
- Removed the descriptive live-status sentence from Location Inquiry.
- Added Daily Stock Summary report with Arrivals, Deliveries and Closing Stock in both bags and weight.

No new database migration is required for this update.
