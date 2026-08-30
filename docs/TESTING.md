# BrewSmart Acceptance Test Matrix

| Test | Steps | Expected result |
|---|---|---|
| Login | valid admin credentials | session created and dashboard opens |
| Failed login throttle | repeatedly use invalid password | excessive attempts receive HTTP 429 |
| User permission | disable Invoice Add for a staff user | route/API denied with 403 |
| Grade validation | Grade PF1 range 50–60, enter 65 kg | invoice cannot be staged/saved |
| Net weight | 20 bags × 58 kg | backend stores 1,160 kg |
| Heavy-bag safety | 58 kg invoice | only A/B/C candidates; D/E/F rejected |
| Location capacity | fill location to 10 bags | 11th bag cannot be allocated |
| Multi-location | 25 bags | allocation splits 10 + 10 + 5 or equivalent safe plan |
| Turn multi-invoice | stage 3 invoices then Save Turn | all save together; any failure rolls all back |
| GRN Turn lookup | enter a saved Turn No | associated invoices/vehicle/driver auto-load |
| GIN pending | save GIN | stock remains in location and is reserved for dispatch workflow |
| Gate Pass | confirm Gate Pass | issued quantity is removed from location and OUT movement is created |
| Issued Inquiry | search GIN/Gate Pass | dispatched row and historical location are visible |
| Location Inquiry | open affected location | bags/weight/status match DB after allocation/dispatch |
| Blocked location | block an empty location then allocate | location is excluded |
| Reports | select every shown report | each loads real DB data; no “not wired” option exists |
| PDF | Download PDF from a report | PDF contains displayed report rows |
| Warehouse seed | run demo seed | dashboard shows non-zero stock and activity |

Automated tests live in `tests/`; database assertions are in `database/verify_warehouse.sql`.
