# Buy & Sell Manager Reconciliation

**As of:** September 29, 2026  
**Basis:** Live application database and configured conversion of 50 reams per box at ₱700 per ream.

## Confirmed business position

| Metric | Confirmed value |
| --- | ---: |
| Gale capital | ₱140,000 |
| Nikki capital | ₱70,000 |
| Total owner capital | **₱210,000** |
| Capital deployed | **₱210,000 / ₱210,000 (100%)** |
| Current inventory | **300 reams** |
| Current inventory boxes | **6 boxes** |
| Current inventory value | **₱210,000** |
| Total sales cash collected | **₱364,270** |
| Recorded inventory purchases paid from operating cash | **₱280,000** |
| Total profit earned, including recorded earned adjustments | **₱21,120** |
| Total profit distributed | **₱19,860** |
| Total profit owed | **₱1,260** |
| Ledger operating cash | **₱64,410** |

## Operating-cash reconciliation

| Cash-flow component | Amount |
| --- | ---: |
| Sales cash collected | +₱364,270 |
| Inventory purchases paid from operating cash | −₱280,000 |
| Operating expenses | −₱0 |
| Profit distributions paid | −₱19,860 |
| Posted capital withdrawals | −₱0 |
| **Operating cash** | **₱64,410** |

**Formula:** ₱364,270 − ₱280,000 − ₱0 − ₱19,860 − ₱0 = **₱64,410**.

Owner capital is not included as operating cash. It remains a separate ₱210,000 capital balance and is fully represented by the current ₱210,000 inventory value.

## Inventory correction and audit trail

The historical `INV-20260928-90002` −100-unit automatic transition was retained. A new `INV-20260929-REVERSE-4BOX` +100-unit reversal neutralizes it. The prior 325-unit physical count was then superseded by `INV-20260929-RECON-300`, a −125-unit physical reconciliation. Together, these two new records move the ledger from 325 units to the confirmed 300 units while preserving every prior transaction.

| Correction | Units | Cash effect |
| --- | ---: | ---: |
| Reverse obsolete automatic four-box transition | +100 | ₱0 |
| Reconcile physical inventory to 300 reams | −125 | ₱0 |
| **Net change from prior 325-unit count** | **−25** | **₱0** |

The net inventory valuation change from the prior 325-unit count is **−₱17,500**. It is a non-cash inventory valuation correction, not a purchase, sale, capital contribution, profit entry, distribution, or withdrawal.

## Profit reconciliation

The **₱3,150 last-last-week profit is already represented** and was not duplicated. Its earned basis is recorded as ₱1,575 for Gale and ₱1,575 for Nikki, while the live distribution ledger totals remain:

| Owner | Profit distributed |
| --- | ---: |
| Gale | ₱11,430 |
| Nikki | ₱8,430 |
| **Total** | **₱19,860** |

Total earned profit is ₱21,120. Less ₱19,860 distributed leaves **₱1,260 profit owed**. Owner capital remains unchanged.

## Business-logic correction

The code paths that automatically created a planned four-box period and the −100-unit September 29 inventory transition were removed. The legacy close-cycle endpoint can no longer activate that four-box transition. The existing planned period was marked closed/superseded, with its history retained.

Per the final interface direction, the original dashboard KPI cards were preserved. Only **“Retained Cash Available”** was renamed to **“Operating Cash,”** and only its expanded cash-flow breakdown was revised to distinguish operating cash from owner capital and inventory value.

The expanded dashboard now leads with a **Business Position** section: **₱210,000 Owner Capital − ₱0 Posted Capital Withdrawals = ₱210,000 Next Box Fund**. The **₱19,860 Profit Distributions Paid** is displayed separately and does not reduce owner capital or the Next Box Fund. The old operating-cash breakdown was removed from the main dashboard to keep the position clear.

## Verification

- 32 unit tests passed.
- TypeScript validation passed.
- Production build passed.
- Live dashboard visually verified with the confirmed values.
- Historical sales remain **8 rows / 499 units / ₱364,270 revenue and cash / ₱14,970 gross profit / 0 voided rows**.
- Historical profit allocations remain **16 rows / ₱14,970 allocated profit**.
- Profit distributions remain **6 retained ledger rows / ₱19,860 net distributed**.
- Capital remains **3 retained ledger rows / ₱210,000 posted contributions / ₱0 posted withdrawals**.
- Two new correction audit events document the transition reversal and 300-unit reconciliation.
- No capital, profit, distribution, or expense records were added or deleted as part of the inventory correction.

## Data disclosure

**Source:** Live Buy & Sell Manager database and application source.  
**Confidence:** High for ledger-derived totals; operating cash is the application’s recorded cash-flow balance and is not an external bank-account reconciliation.  
**Assumptions:** Only user-entered inventory purchases marked as paid from operating cash are deducted from operating cash; opening/setup inventory and non-cash physical adjustments are excluded.
