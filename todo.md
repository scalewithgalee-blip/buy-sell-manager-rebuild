
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

## Philippines-local weekly rollover — October 26, 2026

- [x] Make current-day and current-week reporting use the business’s Philippines local calendar (UTC+8) instead of the server’s UTC date.
- [x] Start the active week on Monday, October 26, 2026, with the saved 500-unit target.
- [x] Reset current-week progress to 0 units and ₱0 profit without altering October 19–25 history.
- [x] Create the October 26 weekly target snapshot through the normal dashboard initialization path.
- [x] Add regression coverage for Monday rollover before UTC midnight.
- [x] Validate TypeScript, all 54 tests, production build, diff cleanliness, and live dashboard output.
