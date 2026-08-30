# BrewSmart Architecture

## Layers

**React presentation layer** calls one configurable API base URL (`VITE_API_BASE_URL`). Screens are permission-aware but never rely on frontend hiding for security.

**PHP API layer** authenticates the session, validates inputs, checks permissions and coordinates transactions. Domain/business logic is being separated into `backend/services`, persistence helpers into `backend/repositories`, and typed domain objects into `backend/models`.

**MySQL persistence layer** stores master data, arrivals/invoices, allocations, GRNs, GINs, movements, recommendations, access rules and audit/activity history. `database/schema.sql` is authoritative for a clean install.

**Python optimization service** receives candidates only after hard safety filtering. It returns an explainable ranking and score breakdown. PHP has a deterministic fallback for operational resilience.

## Allocation decision pipeline

1. Validate Grade Master profile and bag-weight range.
2. Recalculate total net weight in PHP.
3. Apply active/blocked/reserved/capacity/weight rules.
4. Apply DB-configurable location rules, including 50–65 kg → A/B/C.
5. Build feature vector for safe candidates.
6. Ask Python MCDM optimizer to rank candidates.
7. Fall back to PHP weighted scoring if service is unavailable.
8. Build a multi-location plan, max 10 bags per location.
9. Re-lock and revalidate locations inside a DB transaction before committing stock.
10. Store model/rule version, alternatives and accepted decision.

## Transaction boundaries

Multi-invoice Turn save, allocation, GIN/Gate Pass stock-out and other critical quantity changes are designed to commit atomically. A failure rolls back the operation rather than leaving partial stock updates.
