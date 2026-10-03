# Buy & Sell Manager correction checklist

## Confirmed position — September 29, 2026

- [x] Audit current inventory, capital, profit, and operating-cash records.
- [x] Confirm the ₱3,150 last-last-week profit is already included within the ₱19,860 distributed total.
- [x] Disable automatic creation of the September 29 four-box transition.
- [x] Supersede the planned four-box period without deleting history.
- [x] Reverse the existing −100-unit transition through an auditable +100-unit reversal.
- [x] Supersede the prior 325-unit physical count with a new auditable 300-unit reconciliation.
- [x] Keep owner capital, inventory value, profit, and operating cash as separate backend business metrics.
- [x] Preserve every original dashboard KPI card except the requested fund/breakdown logic.
- [x] Verify historical sales, profit allocations, distributions, owed profit, and capital records are unchanged.
- [x] Add Business Position breakdown: owner capital, profit distributions paid, posted capital withdrawals, physical inventory, inventory value, and cash/Next Box Fund.

## Confirmed position — October 3, 2026

- [x] Add a dedicated cash-reconciliation ledger table with auditable point-in-time baselines.
- [x] Record actual business cash / Next Box Fund baseline: ₱36,000.
- [x] Reconcile physical inventory from 182 to 278 units with a +96 inventory-only adjustment.
- [x] Keep the reconciliation separate from owner capital, profit, distributions, and sales.
- [x] Calculate future Next Box Fund as baseline cash + collected sales − retained-cash purchases − expenses − profit distributions − posted capital withdrawals.
- [x] Make retained-cash purchase validation use the same cash-based calculation.
- [x] Include cash reconciliation records in logical backups.
- [x] Add regression tests for baseline cash, purchase/sale/payout carry-forward, and exclusion of pre-baseline history.
- [x] Verify live dashboard response: 278 units, ₱19,460 inventory value, ₱36,000 Next Box Fund, ₱210,000 owner capital, and ₱19,860 profit distributed.
- [ ] Publish the verified source and data correction to the production deployment.
