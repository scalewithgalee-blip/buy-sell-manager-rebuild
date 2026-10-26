
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

## Neutral unit terminology — October 26, 2026

- [x] Remove all standalone “ream” and “reams” wording from the application source, UI labels, alerts, settings, reports, tests, and historical user-visible reconciliation text.
- [x] Replace the removed terminology with “unit” or “units” without changing calculations, conversion values, inventory totals, or financial records.
- [x] Preserve immutable record identifiers while correcting only descriptions, notes, and audit payload labels.
- [x] Confirm the source tree and live user-visible text fields contain zero remaining matches.
- [x] Validate TypeScript, all 54 tests, production build, and diff cleanliness.

## Inventory history filters and layout — October 26, 2026

- [x] Default shared Inventory history to the last 7 calendar days.
- [x] Add optional Last 30 days and All history filters.
- [x] Show a clear empty state when the selected range has no movements.
- [x] Move Traceable Movements / Inventory transactions below the purchase and manual reconciliation forms at full page width.
- [x] Validate TypeScript, all 54 tests, production build, and diff cleanliness.

## Custom history filters — October 26, 2026

- [x] Add Custom dates with start and end inputs to Inventory history.
- [x] Apply the same selected range to the Recent Sales table.
- [x] Add Clear filters buttons that restore Last 7 days and reset dates.
- [x] Validate reversed custom ranges with a clear inline warning and empty results.
- [x] Validate TypeScript, all 54 tests, production build, and diff cleanliness.

## Inventory history placement correction — October 26, 2026

- [x] Keep the new custom date-range and Clear filters controls.
- [x] Apply the synchronized filter to Recent Sales as well as Inventory transactions.
- [x] Place Traceable Movements / Inventory transactions in the right-hand column beside the purchase and reconciliation forms, matching the requested layout.
- [x] Validate TypeScript, all 54 tests, production build, and diff cleanliness.
