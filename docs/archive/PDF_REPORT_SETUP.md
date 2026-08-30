# BrewSmart PDF Report Export

## Added
- Direct **Download PDF** button on `Warehousing > Reports`.
- PDF is generated from the same live report rows returned by the BrewSmart PHP report APIs.
- No external PDF npm package is required.
- Landscape A4 layout with BrewSmart title, report title, generated date/user, page number, table, and record count.
- Multi-page report support.

## Live reports currently exportable
- Invoice / Arrival Register
- Arrival Report (With Pallets)
- Daily Arrivals Summary For All Brokers
- Rack Wise Stock
- Mark Wise Stock
- Daily Unloaded Turns

Reports that do not yet have a live backend endpoint remain unavailable for PDF export until their APIs are implemented.

## Main files changed
- `frontend/src/pages/warehouse/Reports.jsx`
- `frontend/src/pages/warehouse/Reports.css`
- `frontend/src/utils/reportPdf.js`

## Use
1. Open Warehousing > Reports.
2. Select a live report.
3. Click **View Report** to preview it (optional).
4. Click **Download PDF**.
5. The browser downloads a `.pdf` file automatically.
