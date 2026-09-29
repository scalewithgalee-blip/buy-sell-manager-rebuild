# Buy & Sell Manager correction checklist

## Confirmed position — September 29, 2026

- [x] Audit current inventory, capital, profit, and operating-cash records.
- [x] Confirm the ₱3,150 last-last-week profit is already included within the ₱19,860 distributed total.
- [x] Disable automatic creation of the September 29 four-box transition.
- [x] Supersede the planned four-box period without deleting history.
- [x] Reverse the existing −100-unit transition through an auditable +100-unit reversal.
- [x] Supersede the prior 325-unit physical count with a new auditable 300-unit reconciliation.
- [x] Keep owner capital, inventory value, profit, and operating cash as separate backend business metrics.
- [x] Preserve every original dashboard KPI card except renaming “Retained Cash Available” to “Operating Cash” and updating only its breakdown.
- [x] Verify historical sales, profit allocations, distributions, owed profit, and capital records are unchanged.
- [x] Run 32 unit tests, TypeScript checks, the production build, and live UI verification.
- [x] Prepare the verified final WebDev checkpoint.
- [x] Add Business Position breakdown: owner capital, profit distributions paid, posted capital withdrawals, and calculated Next Box Fund.
- [x] Correct Next Box Fund to owner capital minus posted capital withdrawals; profit distributions do not reduce it.
- [x] Promote Next Box Fund to the primary KPI and remove the old operating-cash breakdown from the main dashboard.
- [x] Verify the live UI shows ₱210,000 − ₱0 = ₱210,000, with −₱19,860 distributions displayed separately.
