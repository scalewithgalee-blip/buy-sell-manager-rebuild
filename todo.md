
## Inventory-only viewer access — October 25, 2026

The viewer PIN now exposes only the shared Inventory page. Viewer sessions are automatically redirected to Inventory if they enter another hash route, the viewer navigation contains no Dashboard, Sales, Money, Reports, Settings, Data, or Separate Inventory links, and the existing server-side rule still blocks all mutations. Admin access remains unchanged. TypeScript, all 53 tests, production build, and diff checks pass.

## October 25, 2026 shared reconciliation — October 26, 2026

- [x] Add a dated shared reconciliation control for physical inventory and cash left.
- [x] Record the October 25 manual check as 274 units and ₱18,200 cash left.
- [x] Preserve all earlier sales, purchases, profit allocations, capital entries, and history; record only a +24-unit adjustment from the prior 250-unit ledger total.
- [x] Add the ₱18,200 cash-on-hand baseline used by the cash-based Next Box Fund calculation.
- [x] Remove the accidental duplicate retry baseline while preserving the original reconciliation and audit event.
- [x] Make identical retries idempotent so they cannot create duplicate cash baselines.
- [x] Validate TypeScript, all 53 tests, production build, diff cleanliness, and live totals.
